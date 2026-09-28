<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\Refund;
use Illuminate\Support\Facades\DB;

/**
 * Pengelolaan refund manual (gateway belum tersedia di project, jadi
 * channel selalu manual dan status tidak pernah diklaim completed
 * sebelum admin benar-benar menyelesaikannya).
 */
class RefundService
{
    public function __construct(private NotificationService $notifications) {}

    /** Sisa jatah refund booking: paid non-damage − refund aktif. */
    public function refundableFor(Booking $booking): int
    {
        $paid = (int) Payment::where('booking_id', $booking->id)
            ->where('status', Payment::STATUS_PAID)
            ->where('type', '!=', Payment::TYPE_DAMAGE)
            ->sum('amount');
        $claimed = (int) Refund::where('booking_id', $booking->id)
            ->whereIn('status', Refund::ACTIVE_STATUSES)
            ->sum('amount');

        return max(0, $paid - $claimed);
    }

    public function process(Refund $refund, ?int $adminId = null): Refund
    {
        return DB::transaction(function () use ($refund, $adminId) {
            /** @var Refund $locked */
            $locked = Refund::whereKey($refund->id)->lockForUpdate()->firstOrFail();

            // Idempotensi: aksi ganda mengembalikan record yang sama.
            if ($locked->status === Refund::STATUS_PROCESSING) {
                return $locked;
            }
            abort_if($locked->status === Refund::STATUS_COMPLETED, 422, 'Refund sudah selesai.');
            abort_unless($locked->status === Refund::STATUS_PENDING, 422, 'Refund ini tidak dapat diproses pada status '.$locked->status.'.');

            $booking = Booking::whereKey($locked->booking_id)->lockForUpdate()->firstOrFail();
            // Validasi kumulatif: refund lain + refund ini tidak boleh melebihi paid.
            $others = (int) Refund::where('booking_id', $booking->id)
                ->whereKeyNot($locked->id)
                ->whereIn('status', Refund::ACTIVE_STATUSES)
                ->sum('amount');
            $paid = (int) Payment::where('booking_id', $booking->id)
                ->where('status', Payment::STATUS_PAID)
                ->where('type', '!=', Payment::TYPE_DAMAGE)
                ->sum('amount');
            abort_if($others + $locked->amount > $paid, 422, 'Total refund melebihi total pembayaran yang diterima.');

            $locked->update([
                'status' => Refund::STATUS_PROCESSING,
                'processed_at' => now(),
                'processed_by' => $adminId,
            ]);

            return $locked->fresh();
        });
    }

    public function complete(Refund $refund, string $reference, ?int $adminId = null): Refund
    {
        $reference = trim($reference);
        abort_if($reference === '', 422, 'Referensi refund wajib diisi.');
        abort_if(mb_strlen($reference) > 150, 422, 'Referensi refund maksimal 150 karakter.');

        return DB::transaction(function () use ($refund, $reference, $adminId) {
            /** @var Refund $locked */
            $locked = Refund::whereKey($refund->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === Refund::STATUS_COMPLETED) {
                return $locked;
            }
            abort_unless(
                in_array($locked->status, [Refund::STATUS_PENDING, Refund::STATUS_PROCESSING], true),
                422,
                'Refund ini tidak dapat diselesaikan pada status '.$locked->status.'.'
            );

            $locked->update([
                'status' => Refund::STATUS_COMPLETED,
                'reference' => $reference,
                'failure_reason' => null,
                'processed_at' => now(),
                'processed_by' => $adminId,
            ]);

            $this->notifications->refundCompleted($locked->booking, $locked->fresh());

            return $locked->fresh();
        });
    }

    public function fail(Refund $refund, string $reason, ?int $adminId = null): Refund
    {
        $reason = trim($reason);
        abort_if($reason === '', 422, 'Alasan kegagalan wajib diisi.');

        return DB::transaction(function () use ($refund, $reason, $adminId) {
            /** @var Refund $locked */
            $locked = Refund::whereKey($refund->id)->lockForUpdate()->firstOrFail();
            abort_if($locked->status === Refund::STATUS_COMPLETED, 422, 'Refund sudah selesai.');

            $locked->update([
                'status' => Refund::STATUS_FAILED,
                'failure_reason' => mb_substr($reason, 0, 500),
                'processed_at' => now(),
                'processed_by' => $adminId,
            ]);

            $this->notifications->refundFailed($locked->booking, $locked->fresh());

            return $locked->fresh();
        });
    }

    public function cancel(Refund $refund, ?int $adminId = null): Refund
    {
        return DB::transaction(function () use ($refund, $adminId) {
            /** @var Refund $locked */
            $locked = Refund::whereKey($refund->id)->lockForUpdate()->firstOrFail();
            abort_if($locked->status === Refund::STATUS_COMPLETED, 422, 'Refund sudah selesai.');

            $locked->update([
                'status' => Refund::STATUS_CANCELLED,
                'processed_at' => now(),
                'processed_by' => $adminId,
            ]);

            return $locked->fresh();
        });
    }
}
