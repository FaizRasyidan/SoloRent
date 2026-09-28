<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Cancellation;
use App\Models\Driver;
use App\Models\OperationalTask;
use App\Models\Payment;
use App\Models\Refund;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth untuk pembatalan booking + pembuatan refund.
 * Satu DB transaction atomik: booking → tasks → driver → payments →
 * cancellation record → refund → notifikasi.
 */
class CancellationService
{
    public function __construct(
        private CancellationPolicyService $policy,
        private NotificationService $notifications,
    ) {}

    /** @return array<string, mixed> preview server-side untuk UI (bukan source eksekusi). */
    public function preview(Booking $booking, string $actor = 'customer'): array
    {
        return $this->policy->evaluate($booking->fresh(), $actor);
    }

    /**
     * Batalkan booking. Nominal SELALU dihitung ulang di dalam lock —
     * frontend hanya mengirim reason (+ override untuk admin).
     *
     * @param  array{reason_code?: ?string, reason?: ?string, override_amount?: ?int, override_reason?: ?string}  $input
     */
    public function cancel(Booking $booking, string $actor, ?int $actorId, array $input = []): Cancellation
    {
        $actor = in_array($actor, ['customer', 'admin', 'system'], true) ? $actor : 'customer';

        return DB::transaction(function () use ($booking, $actor, $actorId, $input) {
            /** @var Booking $locked */
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            abort_if($locked->status === 'cancelled', 422, 'Booking sudah dibatalkan.');
            abort_if($locked->status === 'completed', 422, 'Booking sudah selesai dan tidak dapat dibatalkan.');

            $decision = $this->policy->evaluate($locked, $actor);

            $overrideAmount = isset($input['override_amount']) && $input['override_amount'] !== ''
                ? (int) $input['override_amount']
                : null;
            $overrideReason = isset($input['override_reason']) ? trim((string) $input['override_reason']) : '';
            $wantsOverride = $actor === 'admin' && $overrideAmount !== null;

            if (! $decision['eligible']) {
                // Satu-satunya jalan keluar: override admin atas booking lunas.
                $isPaidBlock = (bool) ($decision['fully_paid_block'] ?? false);
                abort_unless(
                    $wantsOverride && $isPaidBlock,
                    422,
                    $decision['blocked_reason'] ?? 'Booking ini sudah tidak dapat dibatalkan.'
                );

                abort_if($overrideReason === '', 422, 'Alasan override wajib diisi.');
                abort_if($overrideAmount < 0, 422, 'Nominal override tidak valid.');
                abort_if($overrideAmount > $decision['base_paid'], 422, 'Nominal override melebihi total pembayaran yang diterima.');
            } elseif ($wantsOverride) {
                // Booking eligible tapi admin tetap memberi nominal khusus.
                abort_if($overrideReason === '', 422, 'Alasan override wajib diisi.');
                abort_if($overrideAmount < 0, 422, 'Nominal override tidak valid.');
                abort_if($overrideAmount > $decision['refundable_remaining'], 422, 'Nominal override melebihi sisa yang dapat dikembalikan.');
            }

            $reason = trim((string) ($input['reason'] ?? ''));
            abort_if($reason === '', 422, 'Alasan pembatalan wajib diisi.');
            abort_if(mb_strlen($reason) > 255, 422, 'Alasan pembatalan maksimal 255 karakter.');

            $finalRefund = $wantsOverride ? $overrideAmount : (int) $decision['refund_amount'];
            $original = (int) $decision['base_paid'];

            $locked->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'cancelled_by_type' => $actor,
            ]);

            // Lepaskan tugas operasional yang masih terbuka (histori tetap ada).
            $locked->tasks()
                ->whereNotIn('status', [OperationalTask::STATUS_COMPLETED, OperationalTask::STATUS_CANCELLED])
                ->update(['status' => OperationalTask::STATUS_CANCELLED]);

            // Kembalikan driver yang sedang bekerja untuk booking ini.
            if ($locked->driver_id) {
                $driver = Driver::whereKey($locked->driver_id)->lockForUpdate()->first();
                if ($driver && $driver->isWorking()) {
                    $driver->update(['status' => Driver::STATUS_ACTIVE]);
                }
            }

            // Payment pending/submitted ikut dibatalkan. Payment PAID tidak disentuh.
            Payment::where('booking_id', $locked->id)
                ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUBMITTED])
                ->lockForUpdate()
                ->update(['status' => Payment::STATUS_CANCELLED]);

            $cancellation = Cancellation::create([
                'booking_id' => $locked->id,
                'cancelled_by_type' => $actor,
                'cancelled_by_id' => $actorId,
                'reason_code' => $input['reason_code'] ?? null,
                'reason' => $reason,
                'policy_rule' => $decision['policy_rule'],
                'policy_percent' => $decision['policy_percent'],
                'original_amount' => $original,
                'refund_amount' => $finalRefund,
                'non_refundable_amount' => max(0, $original - $finalRefund),
                'status' => Cancellation::STATUS_CANCELLED,
                'cancelled_at' => now(),
                'override_policy_amount' => $wantsOverride ? (int) $decision['policy_amount'] : null,
                'override_amount' => $wantsOverride ? $finalRefund : null,
                'override_reason' => $wantsOverride ? $overrideReason : null,
                'overridden_by' => $wantsOverride ? $actorId : null,
            ]);

            $refund = null;
            if ($finalRefund > 0) {
                // Idempotensi: satu cancellation hanya punya satu refund.
                $refund = Refund::where('cancellation_id', $cancellation->id)->lockForUpdate()->first();
                if (! $refund) {
                    $lastPaid = Payment::where('booking_id', $locked->id)
                        ->where('status', Payment::STATUS_PAID)
                        ->where('type', '!=', Payment::TYPE_DAMAGE)
                        ->orderByDesc('paid_at')
                        ->orderByDesc('id')
                        ->lockForUpdate()
                        ->first();

                    $refund = Refund::create([
                        'booking_id' => $locked->id,
                        'cancellation_id' => $cancellation->id,
                        'payment_id' => $lastPaid?->id,
                        'refund_code' => Refund::generateCode(),
                        'amount' => $finalRefund,
                        'status' => Refund::STATUS_PENDING,
                        'reason_code' => $input['reason_code'] ?? 'customer_cancellation',
                        'reason' => $reason,
                        'channel' => Refund::CHANNEL_MANUAL,
                    ]);
                }
            }

            $fresh = $locked->fresh();
            $this->notifications->bookingCancelled($fresh, $cancellation);
            if ($refund) {
                $this->notifications->refundCreated($fresh, $refund);
            }

            return $cancellation->fresh();
        });
    }
}
