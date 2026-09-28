<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\Invoice;
use App\Models\OperationalTask;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Single source of truth untuk seluruh perhitungan & transisi payment.
 * Frontend tidak pernah dipercaya untuk total / deposit / outstanding.
 */
class PaymentService
{
    public function totals(Booking $booking): array
    {
        $booking->loadMissing(['vehicle', 'items']);

        $subtotal = (int) $booking->subtotal;
        $delivery = (int) $booking->delivery_fee;
        $deposit = (int) ($booking->deposit_amount ?? 0);
        $grand = (int) $booking->total;
        // Guard: jika total belum sinkron (data lama), hitung ulang dari komponen.
        if ($grand <= 0) {
            $grand = $subtotal + $delivery + $deposit;
        }

        $paid = $booking->paidTotal();
        $outstanding = max(0, $grand - $paid);
        $dpPercent = (int) config('solorent.payment.dp_percent', 50);
        $dpMinimum = (int) ceil($grand * $dpPercent / 100);

        return [
            'subtotal' => $subtotal,
            'delivery_fee' => $delivery,
            'driver_fee' => 0,
            'additional_fee' => 0,
            'deposit_amount' => $deposit,
            'grand_total' => $grand,
            'paid' => $paid,
            'outstanding' => $outstanding,
            'dp_percent' => $dpPercent,
            'dp_minimum' => $dpMinimum,
            'dp_satisfied' => $paid >= $dpMinimum,
            'fully_paid' => $grand > 0 && $outstanding <= 0,
        ];
    }

    public function generatePaymentCode(): string
    {
        $prefix = 'PAY-'.now()->format('Ymd').'-';

        return DB::transaction(function () use ($prefix) {
            $sequence = Payment::whereDate('created_at', today())->lockForUpdate()->count() + 1;

            do {
                $code = $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
                $sequence++;
            } while (Payment::where('payment_code', $code)->exists());

            return $code;
        });
    }

    public function generateInvoiceNumber(): string
    {
        $prefix = 'INV-'.now()->format('Ymd').'-';

        return DB::transaction(function () use ($prefix) {
            $sequence = Invoice::whereDate('created_at', today())->lockForUpdate()->count() + 1;

            do {
                $code = $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
                $sequence++;
            } while (Invoice::where('invoice_number', $code)->exists());

            return $code;
        });
    }

    public function ensureInvoice(Booking $booking): Invoice
    {
        $booking->loadMissing(['vehicle', 'items']);

        $existing = $booking->invoice()->first();
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($booking) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            $found = $locked->invoice()->first();
            if ($found) {
                return $found;
            }

            return Invoice::create([
                'booking_id' => $locked->id,
                'invoice_number' => $this->generateInvoiceNumber(),
                'customer_name' => $locked->customer_name,
                'vehicle_name' => $locked->vehicle?->name ?? $locked->items->first()?->vehicle_name_snapshot,
                'start_date' => $locked->start_date,
                'end_date' => $locked->end_date,
                'duration_days' => $locked->duration_days,
                'price_per_day' => $locked->price_per_day,
                'subtotal' => $locked->subtotal,
                'delivery_fee' => $locked->delivery_fee,
                'deposit_amount' => $locked->deposit_amount ?? 0,
                'total' => $locked->total,
                'payment_status' => $locked->payment_status ?? 'unpaid',
                'issued_at' => now(),
            ]);
        });
    }

    /**
     * Buat payment baru. Melindungi double-payment & overpayment via row lock.
     *
     * Channel 'customer' (guest) hanya boleh membayar DP: diblokir jika DP sudah
     * terpenuhi dan nominal dibatasi sisa DP. Pelunasan hanya via admin.
     */
    public function createPayment(Booking $booking, int $amount, string $method = 'bank_transfer', string $type = 'full_payment', array $extra = [], string $channel = 'admin'): Payment
    {
        abort_unless(in_array($booking->status, ['pending', 'confirmed'], true), 422, 'Booking ini tidak dapat dibayar pada status '.$booking->status.'.');
        abort_if($amount < 1, 422, 'Nominal pembayaran tidak valid.');

        return DB::transaction(function () use ($booking, $amount, $method, $type, $extra, $channel) {
            /** @var Booking $locked */
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->status, ['pending', 'confirmed'], true), 422, 'Booking ini tidak dapat dibayar.');

            $totals = $this->totals($locked);
            abort_if($totals['outstanding'] <= 0, 422, 'Tagihan booking ini sudah lunas.');

            // Jalur customer (guest) hanya untuk DP — pelunasan via admin/outlet.
            if ($channel === 'customer') {
                abort_if($locked->isDpSatisfied(), 422, 'DP sudah terpenuhi. Sisa pelunasan hanya dapat dibayar melalui admin/outlet.');
                $remainingDp = $totals['dp_minimum'] - $locked->paidTotal();
                abort_if($remainingDp <= 0, 422, 'DP sudah terpenuhi. Sisa pelunasan hanya dapat dibayar melalui admin/outlet.');
                abort_if($amount > $remainingDp, 422, 'Nominal DP melebihi sisa DP '.number_format($remainingDp, 0, ',', '.').'. Sisa pelunasan dibayar melalui admin/outlet.');
            }

            // Cegah pembayaran ganda yang masih menunggu verifikasi.
            $hasOpen = Payment::where('booking_id', $locked->id)
                ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUBMITTED])
                ->lockForUpdate()
                ->exists();
            abort_if($hasOpen, 422, 'Masih ada pembayaran yang menunggu verifikasi. Selesaikan dahulu sebelum membuat pembayaran baru.');

            abort_if($amount > $totals['outstanding'], 422, 'Nominal melebihi sisa tagihan '.number_format($totals['outstanding'], 0, ',', '.').'.');

            $payment = Payment::create([
                'booking_id' => $locked->id,
                'payment_code' => $this->generatePaymentCode(),
                'type' => $type,
                'method' => $method,
                'amount' => $amount,
                'status' => Payment::STATUS_PENDING,
                'reference' => $extra['reference'] ?? null,
                'notes' => $extra['notes'] ?? null,
                'expires_at' => $extra['expires_at'] ?? null,
            ]);

            return $payment;
        });
    }

    /**
     * Customer mengunggah bukti → pending/submitted. File disimpan di disk private.
     */
    public function submitProof(Payment $payment, $file, array $data = []): Payment
    {
        abort_unless($payment->isSubmittable(), 422, 'Pembayaran ini tidak dapat dikirim ulang pada status '.$payment->status.'.');

        return DB::transaction(function () use ($payment, $file, $data) {
            /** @var Payment $locked */
            $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->isSubmittable(), 422, 'Pembayaran ini tidak dapat dikirim ulang.');

            if ($locked->isDamage()) {
                $chargeOpen = DamageCharge::whereKey($locked->damage_charge_id)->lockForUpdate()->firstOrFail()->isOpen();
                abort_unless($chargeOpen, 422, 'Tagihan kerusakan ini sudah tidak aktif.');
            }

            /** @var Booking $booking */
            $booking = Booking::whereKey($locked->booking_id)->lockForUpdate()->firstOrFail();
            $totals = $this->totals($booking);

            // Validasi ulang terhadap outstanding saat submit (idempotency + concurrency).
            // Damage payment dihitung dari chargenya sendiri, bukan dari booking total.
            if ($locked->isDamage()) {
                $charge = DamageCharge::whereKey($locked->damage_charge_id)->lockForUpdate()->firstOrFail();
                $otherPaid = Payment::where('damage_charge_id', $charge->id)
                    ->where('status', Payment::STATUS_PAID)
                    ->sum('amount');
                $maxAllowed = max(0, (int) $charge->total - (int) $otherPaid);
            } else {
                $otherPaid = Payment::where('booking_id', $booking->id)
                    ->where('status', Payment::STATUS_PAID)
                    ->where('type', '!=', Payment::TYPE_DAMAGE)
                    ->sum('amount');
                $maxAllowed = max(0, (int) $booking->total - (int) $otherPaid);
            }
            abort_if($locked->amount > $maxAllowed, 422, 'Nominal pembayaran melebihi sisa tagihan.');

            if ($file) {
                if ($locked->proof_path && Storage::disk('local')->exists($locked->proof_path)) {
                    Storage::disk('local')->delete($locked->proof_path);
                }
                $path = $file->store('payments/proofs', 'local');
                $locked->proof_path = $path;
                $locked->proof_original_name = $file->getClientOriginalName();
            }

            abort_unless($locked->proof_path, 422, 'Bukti pembayaran wajib diunggah.');

            $locked->status = Payment::STATUS_SUBMITTED;
            $locked->submitted_at = now();
            if (isset($data['notes'])) {
                $locked->notes = $data['notes'];
            }
            $locked->save();

            return $locked->fresh();
        });
    }

    /**
     * Admin mencatat pelunasan/pembayaran offline (tunai/transfer) langsung sebagai paid.
     * Satu-satunya jalur menuju lunas — customer tidak bisa melunasi sendiri.
     */
    public function recordSettlement(Booking $booking, int $amount, string $method, ?int $adminId = null, array $extra = [], $file = null): Payment
    {
        abort_unless(in_array($booking->status, ['pending', 'confirmed', 'preparing', 'active'], true), 422, 'Booking ini tidak dapat dibayar pada status '.$booking->status.'.');
        abort_if($amount < 1, 422, 'Nominal pembayaran tidak valid.');
        abort_unless(in_array($method, ['bank_transfer', 'cash'], true), 422, 'Metode pembayaran admin tidak valid.');

        return DB::transaction(function () use ($booking, $amount, $method, $adminId, $extra, $file) {
            /** @var Booking $lockedBooking */
            $lockedBooking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($lockedBooking->status, ['pending', 'confirmed', 'preparing', 'active'], true), 422, 'Booking ini tidak dapat dibayar.');

            $totals = $this->totals($lockedBooking);
            abort_if($totals['outstanding'] <= 0, 422, 'Tagihan booking ini sudah lunas.');

            // Ledger tetap bersih: selesaikan dulu pembayaran yang masih menunggu verifikasi.
            $hasOpen = Payment::where('booking_id', $lockedBooking->id)
                ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUBMITTED])
                ->lockForUpdate()
                ->exists();
            abort_if($hasOpen, 422, 'Masih ada pembayaran yang menunggu verifikasi. Selesaikan dahulu sebelum mencatat pelunasan.');

            abort_if($amount > $totals['outstanding'], 422, 'Nominal melebihi sisa tagihan '.number_format($totals['outstanding'], 0, ',', '.').'.');

            $payment = Payment::create([
                'booking_id' => $lockedBooking->id,
                'payment_code' => $this->generatePaymentCode(),
                'type' => $extra['type'] ?? 'full_payment',
                'method' => $method,
                'amount' => $amount,
                'status' => Payment::STATUS_PAID,
                'submitted_at' => now(),
                'paid_at' => now(),
                'verified_at' => now(),
                'verified_by' => $adminId,
                'reference' => $extra['reference'] ?? null,
                'notes' => $extra['notes'] ?? null,
                'admin_note' => $extra['admin_note'] ?? null,
            ]);

            if ($file) {
                $payment->proof_path = $file->store('payments/proofs', 'local');
                $payment->proof_original_name = $file->getClientOriginalName();
                $payment->save();
            }

            $this->syncBookingPayment($lockedBooking);

            return $payment->fresh();
        });
    }

    /** Admin konfirmasi: submitted → paid + recalc booking + auto-confirm jika DP terpenuhi. */
    public function confirm(Payment $payment, ?int $adminId = null, ?string $adminNote = null): Payment
    {
        return DB::transaction(function () use ($payment, $adminId, $adminNote) {
            /** @var Payment $locked */
            $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status === Payment::STATUS_SUBMITTED, 422, 'Hanya pembayaran submitted yang dapat dikonfirmasi.');
            abort_unless($locked->proof_path, 422, 'Tidak ada bukti pembayaran untuk diverifikasi.');

            if ($locked->isDamage()) {
                $chargeOpen = DamageCharge::whereKey($locked->damage_charge_id)->lockForUpdate()->firstOrFail()->isOpen();
                abort_unless($chargeOpen, 422, 'Tagihan kerusakan ini sudah tidak aktif.');
            }

            /** @var Booking $booking */
            $booking = Booking::whereKey($locked->booking_id)->lockForUpdate()->firstOrFail();

            $locked->status = Payment::STATUS_PAID;
            $locked->paid_at = now();
            $locked->verified_at = now();
            $locked->verified_by = $adminId;
            if ($adminNote !== null) {
                $locked->admin_note = $adminNote;
            }
            $locked->save();

            if ($locked->isDamage()) {
                $this->syncDamageCharge($locked->damage_charge_id);
            } else {
                /** @var Booking $booking */
                $booking = Booking::whereKey($locked->booking_id)->lockForUpdate()->firstOrFail();
                $this->syncBookingPayment($booking);
            }

            return $locked->fresh();
        });
    }

    public function reject(Payment $payment, string $reason, ?int $adminId = null, ?string $adminNote = null): Payment
    {
        abort_unless(trim($reason) !== '', 422, 'Alasan penolakan wajib diisi.');

        return DB::transaction(function () use ($payment, $reason, $adminId, $adminNote) {
            /** @var Payment $locked */
            $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status === Payment::STATUS_SUBMITTED, 422, 'Hanya pembayaran submitted yang dapat ditolak.');

            $locked->status = Payment::STATUS_REJECTED;
            $locked->rejection_reason = trim($reason);
            $locked->verified_at = now();
            $locked->verified_by = $adminId;
            if ($adminNote !== null) {
                $locked->admin_note = $adminNote;
            }
            $locked->save();

            if ($locked->isDamage()) {
                $this->syncDamageCharge($locked->damage_charge_id);
            } else {
                /** @var Booking $booking */
                $booking = Booking::whereKey($locked->booking_id)->lockForUpdate()->firstOrFail();
                $this->syncBookingPayment($booking);
            }

            return $locked->fresh();
        });
    }

    /**
     * Sinkronkan payment_status booking dari jumlah paid aktual.
     * Damage payments TIDAK pernah dihitung di sini (charge-nya sendiri).
     * DP 50%: pending + DP terpenuhi → confirmed otomatis (booking diamankan).
     * Unit baru boleh dipakai setelah LUNAS — ditegakkan di Ready/Handover/Activate.
     */
    public function syncBookingPayment(Booking $booking): Booking
    {
        $paid = Payment::where('booking_id', $booking->id)
            ->where('status', Payment::STATUS_PAID)
            ->where('type', '!=', Payment::TYPE_DAMAGE)
            ->sum('amount');
        $grand = (int) $booking->total;
        $dpMinimum = (int) ceil($grand * (int) config('solorent.payment.dp_percent', 50) / 100);

        $paymentStatus = 'unpaid';
        if ($grand > 0 && $paid >= $grand) {
            $paymentStatus = 'paid';
        } elseif ($paid > 0) {
            $paymentStatus = 'partial';
        }

        $updates = ['payment_status' => $paymentStatus];

        // Auto-confirm: booking pending + DP 50% lunas → confirmed.
        if ($booking->status === 'pending' && $grand > 0 && $paid >= $dpMinimum) {
            $updates['status'] = 'confirmed';
            $updates['confirmed_at'] = now();

            if ($booking->pickup_method === 'delivery' && ! $booking->tasks()->where('type', OperationalTask::TYPE_DELIVERY)->exists()) {
                $booking->tasks()->create([
                    'type' => OperationalTask::TYPE_DELIVERY,
                    'address' => trim(implode(', ', array_filter([
                        $booking->delivery_name, $booking->delivery_address,
                        $booking->delivery_district, $booking->delivery_note,
                    ]))) ?: null,
                    'scheduled_at' => $booking->start_date->copy()->setTime(9, 0),
                    'status' => OperationalTask::STATUS_SCHEDULED,
                ]);
            }
            if (($booking->return_method ?? 'outlet') === 'pickup' && ! $booking->tasks()->where('type', OperationalTask::TYPE_PICKUP)->exists()) {
                $booking->tasks()->create([
                    'type' => OperationalTask::TYPE_PICKUP,
                    'address' => $booking->return_address,
                    'scheduled_at' => $booking->end_date->copy()->setTime(17, 0),
                    'status' => OperationalTask::STATUS_SCHEDULED,
                ]);
            }
        }

        $booking->update($updates);
        $booking->invoice()->update(['payment_status' => $paymentStatus]);

        return $booking->fresh();
    }

    // ---------- Damage charge payments (type = damage) ----------

    /**
     * Buat payment untuk damage charge. Nominal SELALU dari server
     * (charge outstanding penuh) — frontend tidak boleh mengirim amount.
     */
    public function createDamagePayment(DamageCharge $charge, string $method = 'bank_transfer', array $extra = []): Payment
    {
        abort_if(! $charge->isOpen(), 422, 'Tagihan kerusakan ini sudah tidak aktif.');

        return DB::transaction(function () use ($charge, $method, $extra) {
            /** @var DamageCharge $locked */
            $locked = DamageCharge::whereKey($charge->id)->lockForUpdate()->firstOrFail();
            abort_if(! $locked->isOpen(), 422, 'Tagihan kerusakan ini sudah tidak aktif.');

            $outstanding = $locked->outstanding();
            abort_if($outstanding <= 0, 422, 'Tagihan kerusakan ini sudah lunas.');

            // Cegah pembayaran ganda yang masih menunggu verifikasi.
            $hasOpen = Payment::where('damage_charge_id', $locked->id)
                ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUBMITTED])
                ->lockForUpdate()
                ->exists();
            abort_if($hasOpen, 422, 'Masih ada pembayaran yang menunggu verifikasi. Selesaikan dahulu sebelum membuat pembayaran baru.');

            return Payment::create([
                'booking_id' => $locked->booking_id,
                'damage_charge_id' => $locked->id,
                'payment_code' => $this->generatePaymentCode(),
                'type' => Payment::TYPE_DAMAGE,
                'method' => $method,
                'amount' => $outstanding,
                'status' => Payment::STATUS_PENDING,
                'reference' => $extra['reference'] ?? null,
                'notes' => $extra['notes'] ?? null,
                'expires_at' => $extra['expires_at'] ?? null,
            ]);
        });
    }

    /**
     * Admin mencatat pembayaran damage offline (tunai/transfer) langsung paid.
     */
    public function recordDamageSettlement(DamageCharge $charge, string $method, ?int $adminId = null, array $extra = [], $file = null): Payment
    {
        abort_if(! $charge->isOpen(), 422, 'Tagihan kerusakan ini sudah tidak aktif.');
        abort_unless(in_array($method, ['bank_transfer', 'cash'], true), 422, 'Metode pembayaran tidak valid.');

        return DB::transaction(function () use ($charge, $method, $adminId, $extra, $file) {
            /** @var DamageCharge $locked */
            $locked = DamageCharge::whereKey($charge->id)->lockForUpdate()->firstOrFail();
            abort_if(! $locked->isOpen(), 422, 'Tagihan kerusakan ini sudah tidak aktif.');

            $outstanding = $locked->outstanding();
            abort_if($outstanding <= 0, 422, 'Tagihan kerusakan ini sudah lunas.');

            $hasOpen = Payment::where('damage_charge_id', $locked->id)
                ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUBMITTED])
                ->lockForUpdate()
                ->exists();
            abort_if($hasOpen, 422, 'Masih ada pembayaran yang menunggu verifikasi. Selesaikan dahulu.');

            $payment = Payment::create([
                'booking_id' => $locked->booking_id,
                'damage_charge_id' => $locked->id,
                'payment_code' => $this->generatePaymentCode(),
                'type' => Payment::TYPE_DAMAGE,
                'method' => $method,
                'amount' => $outstanding,
                'status' => Payment::STATUS_PAID,
                'submitted_at' => now(),
                'paid_at' => now(),
                'verified_at' => now(),
                'verified_by' => $adminId,
                'reference' => $extra['reference'] ?? null,
                'notes' => $extra['notes'] ?? null,
                'admin_note' => $extra['admin_note'] ?? null,
            ]);

            if ($file) {
                $payment->proof_path = $file->store('payments/proofs', 'local');
                $payment->proof_original_name = $file->getClientOriginalName();
                $payment->save();
            }

            $this->syncDamageCharge($locked->id);

            return $payment->fresh();
        });
    }

    public function syncDamageCharge(int $chargeId): DamageCharge
    {
        return DB::transaction(function () use ($chargeId) {
            /** @var DamageCharge $locked */
            $locked = DamageCharge::whereKey($chargeId)->lockForUpdate()->firstOrFail();
            $locked->recalculate();

            return $locked->fresh();
        });
    }
}
