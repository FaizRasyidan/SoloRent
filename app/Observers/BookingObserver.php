<?php

namespace App\Observers;

use App\Models\AdminNotification;
use App\Models\Booking;
use App\Models\Vehicle;

/**
 * Lonceng admin untuk siklus booking. Hanya kejadian dari sisi customer
 * yang dicatat — pembatalan oleh admin (cancelled_by_type = admin)
 * tidak memicu notifikasi atas aksi sendiri.
 */
class BookingObserver
{
    public function created(Booking $booking): void
    {
        /** @var Vehicle|null $vehicle */
        $vehicle = $booking->getRelationValue('vehicle');
        $vehicleName = $vehicle instanceof Vehicle ? $vehicle->name : '-';
        $start = $booking->getAttribute('start_date');
        $end = $booking->getAttribute('end_date');

        AdminNotification::create([
            'type' => AdminNotification::TYPE_BOOKING_CREATED,
            'level' => AdminNotification::LEVEL_ACTION,
            'title' => 'Booking baru '.$booking->getAttribute('booking_code'),
            'body' => $booking->getAttribute('customer_name').' memesan '.$vehicleName.' · '.
                ($start instanceof \DateTimeInterface ? $start->format('d M Y') : '-').' – '.
                ($end instanceof \DateTimeInterface ? $end->format('d M Y') : '-').' · Rp'.number_format((int) $booking->getAttribute('total'), 0, ',', '.'),
            'booking_id' => $booking->getKey(),
            'action_url' => '/admin/bookings/'.$booking->getAttribute('booking_code'),
        ]);
    }

    public function updated(Booking $booking): void
    {
        if (! $booking->wasChanged('status') || $booking->getAttribute('status') !== 'cancelled') {
            return;
        }

        // Aksi admin sendiri (panel admin) bukan hal baru — jangan berisik.
        if ($booking->getAttribute('cancelled_by_type') === 'admin') {
            return;
        }

        $reason = trim((string) ($booking->getAttribute('cancel_reason') ?? ''));
        AdminNotification::create([
            'type' => AdminNotification::TYPE_BOOKING_CANCELLED,
            'level' => AdminNotification::LEVEL_WARNING,
            'title' => 'Booking dibatalkan '.$booking->getAttribute('booking_code'),
            'body' => $booking->getAttribute('customer_name').' membatalkan booking.'.($reason !== '' ? ' Alasan: '.$reason : ''),
            'booking_id' => $booking->getKey(),
            'action_url' => '/admin/bookings/'.$booking->getAttribute('booking_code'),
        ]);
    }
}
