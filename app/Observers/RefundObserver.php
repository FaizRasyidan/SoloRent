<?php

namespace App\Observers;

use App\Models\AdminNotification;
use App\Models\Booking;
use App\Models\Refund;

/**
 * Lonceng admin untuk refund yang gagal diproses — dana customer
 * tertahan dan perlu tindak lanjut manual.
 */
class RefundObserver
{
    public function updated(Refund $refund): void
    {
        if (! $refund->wasChanged('status') || $refund->getAttribute('status') !== Refund::STATUS_FAILED) {
            return;
        }

        /** @var Booking|null $booking */
        $booking = $refund->getRelationValue('booking');
        $bookingCode = '-';
        $customerName = '-';
        if ($booking instanceof Booking) {
            $bookingCode = $booking->booking_code;
            $customerName = $booking->customer_name;
        }
        $reason = trim((string) ($refund->getAttribute('failure_reason') ?? ''));
        $refundCode = (string) $refund->getAttribute('refund_code');

        AdminNotification::create([
            'type' => AdminNotification::TYPE_REFUND_FAILED,
            'level' => AdminNotification::LEVEL_DANGER,
            'title' => 'Refund gagal diproses '.$refundCode,
            'body' => 'Rp'.number_format((int) $refund->getAttribute('amount'), 0, ',', '.').' untuk '.$bookingCode.' ('.$customerName.') tertahan.'.($reason !== '' ? ' Alasan: '.$reason : ''),
            'booking_id' => $refund->getAttribute('booking_id'),
            'refund_id' => $refund->getKey(),
            'action_url' => '/admin/refunds?search='.$refundCode,
        ]);
    }
}
