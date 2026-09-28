<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\Refund;

/**
 * Kebijakan pembatalan & refund Phase 7A.
 *
 * Aturan bisnis (configurable, satu-satunya angka di config):
 * - refund = 80% dari SELURUH pembayaran booking yang sudah paid (non-damage)
 * - booking yang sudah LUNAS tidak dapat dibatalkan (kecuali override admin)
 * - tanpa gerbang waktu (min_hours_before_start = 0)
 *
 * Backend adalah satu-satunya source of truth. Frontend tidak pernah
 * dipercaya untuk nominal apa pun.
 */
class CancellationPolicyService
{
    public function percent(): int
    {
        return (int) config('solorent.refund.percent', 80);
    }

    public function minHours(): int
    {
        return (int) config('solorent.cancellation.min_hours_before_start', 0);
    }

    /** @return list<string> */
    public function allowedStatuses(string $actor): array
    {
        return $actor === 'admin'
            ? config('solorent.cancellation.admin_allowed_statuses', ['pending', 'confirmed', 'preparing'])
            : config('solorent.cancellation.customer_allowed_statuses', ['pending', 'confirmed', 'preparing']);
    }

    public function hoursBeforeStart(Booking $booking): float
    {
        $start = $booking->start_date instanceof \DateTimeInterface
            ? $booking->start_date->copy()->startOfDay()
            : now()->copy()->startOfDay()->addDay();

        return now()->diffInHours($start, false);
    }

    /**
     * Total paid booking (non-damage) — dasar perhitungan refund.
     * Damage payments TIDAK pernah dihitung (jalur charge-nya sendiri).
     */
    public function paidTotal(Booking $booking): int
    {
        return (int) $booking->payments()
            ->where('status', Payment::STATUS_PAID)
            ->where('type', '!=', Payment::TYPE_DAMAGE)
            ->sum('amount');
    }

    /**
     * Sisa jatah refund: paid − refund aktif (pending/processing/completed).
     * Mencegah total refund melebihi uang yang benar-benar diterima.
     */
    public function refundableRemaining(Booking $booking): int
    {
        $paid = $this->paidTotal($booking);
        $claimed = (int) Refund::where('booking_id', $booking->id)
            ->whereIn('status', Refund::ACTIVE_STATUSES)
            ->sum('amount');

        return max(0, $paid - $claimed);
    }

    /** @return array<string, mixed> */
    public function evaluate(Booking $booking, string $actor = 'customer'): array
    {
        $actor = in_array($actor, ['customer', 'admin', 'system'], true) ? $actor : 'customer';

        if (! config('solorent.cancellation.enabled', true)) {
            return $this->decision($booking, false, 'Pembatalan booking sedang dinonaktifkan.');
        }

        if ($booking->status === 'cancelled') {
            return $this->decision($booking, false, 'Booking sudah dibatalkan.');
        }

        if ($booking->status === 'completed') {
            return $this->decision($booking, false, 'Booking sudah selesai dan tidak dapat dibatalkan.');
        }

        if ($booking->status === 'active') {
            return $this->decision(
                $booking,
                false,
                'Rental sudah dimulai sehingga pembatalan online tidak tersedia. Hubungi admin melalui WhatsApp.'
            );
        }

        if (! in_array($booking->status, $this->allowedStatuses($actor), true)) {
            return $this->decision($booking, false, 'Booking ini sudah tidak dapat dibatalkan.');
        }

        // Booking lunas tidak dapat dibatalkan (kecuali override admin di service).
        if (config('solorent.cancellation.block_when_fully_paid', true) && $booking->isFullyPaid()) {
            return $this->decision(
                $booking,
                false,
                'Booking ini sudah lunas sehingga pembatalan online tidak tersedia. Hubungi admin melalui WhatsApp untuk permintaan perubahan jadwal.',
                true
            );
        }

        $minHours = $this->minHours();
        $hours = $this->hoursBeforeStart($booking);
        if ($minHours > 0 && $hours < $minHours) {
            return $this->decision(
                $booking,
                false,
                "Pembatalan ditutup {$minHours} jam sebelum rental dimulai. Hubungi admin melalui WhatsApp."
            );
        }

        return $this->decision($booking, true, null);
    }

    /** @return array<string, mixed> */
    private function decision(Booking $booking, bool $eligible, ?string $blockedReason, bool $fullyPaid = false): array
    {
        $percent = $this->percent();
        $paid = $this->paidTotal($booking);
        $refundable = $this->refundableRemaining($booking);

        $policyAmount = (int) floor($paid * $percent / 100);
        $refundAmount = $eligible ? min($policyAmount, $refundable) : 0;
        $nonRefundable = max(0, $paid - $refundAmount);

        return [
            'eligible' => $eligible,
            'blocked_reason' => $blockedReason,
            'fully_paid_block' => $fullyPaid,
            'policy_percent' => $percent,
            'policy_rule' => "Refund {$percent}% dari pembayaran yang diterima",
            'hours_before_start' => $this->hoursBeforeStart($booking),
            'base_paid' => $paid,
            'refundable_remaining' => $refundable,
            'original_amount' => $paid,
            'policy_amount' => $policyAmount,
            'refund_amount' => $refundAmount,
            'non_refundable_amount' => $nonRefundable,
            'description' => $eligible
                ? 'Jika dibatalkan sekarang: refund Rp'.number_format($refundAmount, 0, ',', '.')
                    .' dari Rp'.number_format($paid, 0, ',', '.')." yang dibayarkan ({$percent}%)."
                : ($blockedReason ?? 'Booking tidak dapat dibatalkan.'),
        ];
    }
}
