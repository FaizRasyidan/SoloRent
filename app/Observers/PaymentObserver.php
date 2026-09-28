<?php

namespace App\Observers;

use App\Models\AdminNotification;
use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\Payment;

/**
 * Lonceng admin untuk pembayaran customer yang masuk (butuh verifikasi).
 * Pembayaran yang dibuat admin (recordSettlement = paid langsung) dan
 * transisi admin (confirm/reject) tidak memicu notifikasi.
 */
class PaymentObserver
{
    public function created(Payment $payment): void
    {
        if ($payment->getAttribute('status') === Payment::STATUS_SUBMITTED) {
            $this->notifySubmitted($payment);
        }
    }

    public function updated(Payment $payment): void
    {
        if (! $payment->wasChanged('status') || $payment->getAttribute('status') !== Payment::STATUS_SUBMITTED) {
            return;
        }

        $this->notifySubmitted($payment);
    }

    private function notifySubmitted(Payment $payment): void
    {
        /** @var Booking|null $booking */
        $booking = $payment->getRelationValue('booking');
        $bookingCode = '-';
        $customerName = '-';
        if ($booking instanceof Booking) {
            $bookingCode = $booking->booking_code;
            $customerName = $booking->customer_name;
        }
        $amount = 'Rp'.number_format((int) $payment->getAttribute('amount'), 0, ',', '.');
        $paymentCode = (string) $payment->getAttribute('payment_code');

        if ($payment->isDamage()) {
            /** @var DamageCharge|null $charge */
            $charge = $payment->getRelationValue('damageCharge');
            $chargeCode = $charge instanceof DamageCharge ? $charge->charge_code : '-';
            AdminNotification::create([
                'type' => AdminNotification::TYPE_DAMAGE_PAYMENT_SUBMITTED,
                'level' => AdminNotification::LEVEL_ACTION,
                'title' => 'Pembayaran kerusakan menunggu verifikasi',
                'body' => $paymentCode.' '.$amount.' untuk '.$chargeCode.' · booking '.$bookingCode.' ('.$customerName.')',
                'booking_id' => $payment->getAttribute('booking_id'),
                'payment_id' => $payment->getKey(),
                'damage_charge_id' => $payment->getAttribute('damage_charge_id'),
                'action_url' => '/admin/payments/'.$paymentCode,
            ]);

            return;
        }

        AdminNotification::create([
            'type' => AdminNotification::TYPE_PAYMENT_SUBMITTED,
            'level' => AdminNotification::LEVEL_ACTION,
            'title' => 'Pembayaran menunggu verifikasi',
            'body' => $paymentCode.' '.$amount.' untuk '.$bookingCode.' ('.$customerName.')',
            'booking_id' => $payment->getAttribute('booking_id'),
            'payment_id' => $payment->getKey(),
            'action_url' => '/admin/payments/'.$paymentCode,
        ]);
    }
}
