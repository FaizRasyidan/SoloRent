<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Cancellation;
use App\Models\DamageCharge;
use App\Models\NotificationLog;
use App\Models\Payment;
use App\Models\Refund;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Notification foundation: WhatsApp (wa.me fallback manual) + Email (jika terkonfigurasi).
 * Tidak pernah mengklaim terkirim jika integrasi belum aktif — status dicatat jujur.
 */
class NotificationService
{
    public function bookingCreated(Booking $booking): NotificationLog
    {
        $content = $this->render('booking_created', $booking);

        $log = $this->log($booking, null, 'manual', 'booking_created', $booking->customer_phone, $content, 'sent');

        $this->tryMail($booking, $log, 'Booking SoloRent '.$booking->booking_code.' diterima', $content);

        return $log;
    }

    public function paymentSubmitted(Booking $booking, Payment $payment): NotificationLog
    {
        $content = "Halo {$booking->customer_name},\n\nBukti pembayaran {$payment->payment_code} ".
            '('.number_format($payment->amount, 0, ',', '.').') untuk booking '.
            "{$booking->booking_code} telah kami terima dan menunggu verifikasi admin.\n\nTerima kasih.";

        return $this->log($booking, $payment, 'manual', 'payment_submitted', $booking->customer_phone, $content, 'sent');
    }

    public function paymentConfirmed(Booking $booking, Payment $payment): NotificationLog
    {
        $content = "Halo {$booking->customer_name},\n\nPembayaran {$payment->payment_code} ".
            '('.number_format($payment->amount, 0, ',', '.').') untuk booking '.
            "{$booking->booking_code} telah dikonfirmasi. ".
            ($booking->fresh()->status === 'confirmed'
                ? "Booking Anda telah dikonfirmasi (DP 50% terpenuhi).\n\nKendaraan: ".($booking->vehicle?->name ?? '-')
                : 'Terima kasih.');

        $log = $this->log($booking, $payment, 'manual', 'payment_confirmed', $booking->customer_phone, $content, 'sent');
        $this->tryMail($booking, $log, 'Pembayaran '.$payment->payment_code.' dikonfirmasi', $content);

        return $log;
    }

    public function paymentRejected(Booking $booking, Payment $payment): NotificationLog
    {
        $content = "Halo {$booking->customer_name},\n\nPembayaran {$payment->payment_code} untuk booking ".
            "{$booking->booking_code} ditolak.\n\nAlasan: {$payment->rejection_reason}\n\nSilakan lakukan pembayaran kembali.";

        return $this->log($booking, $payment, 'manual', 'payment_rejected', $booking->customer_phone, $content, 'sent');
    }

    public function bookingConfirmed(Booking $booking): NotificationLog
    {
        $content = $this->render('booking_confirmed', $booking);

        $log = $this->log($booking, null, 'manual', 'booking_confirmed', $booking->customer_phone, $content, 'sent');
        $this->tryMail($booking, $log, 'Booking SoloRent '.$booking->booking_code.' dikonfirmasi', $content);

        return $log;
    }

    public function damageChargeCreated(Booking $booking, DamageCharge $charge): NotificationLog
    {
        $content = implode("\n", [
            "Halo {$booking->customer_name},",
            '',
            'Tagihan kerusakan telah dibuat untuk booking Anda.',
            '',
            'Booking: '.$booking->booking_code,
            'Tagihan: '.$charge->charge_code,
            'Total: Rp'.number_format((int) $charge->total, 0, ',', '.'),
            '',
            'Silakan lakukan pembayaran melalui halaman cek booking.',
        ]);

        return $this->log($booking, null, 'manual', 'damage_charge_created', $booking->customer_phone, $content, 'sent');
    }

    public function damagePaymentConfirmed(Booking $booking, DamageCharge $charge, Payment $payment): NotificationLog
    {
        $content = implode("\n", [
            "Halo {$booking->customer_name},",
            '',
            'Pembayaran biaya kerusakan berhasil.',
            '',
            'Tagihan: '.$charge->charge_code,
            'Pembayaran: '.$payment->payment_code,
            'Nominal: Rp'.number_format((int) $payment->amount, 0, ',', '.'),
        ]);

        return $this->log($booking, $payment, 'manual', 'damage_payment_confirmed', $booking->customer_phone, $content, 'sent');
    }

    public function bookingCancelled(Booking $booking, Cancellation $cancellation): NotificationLog
    {
        $content = implode("\n", [
            "Halo {$booking->customer_name},",
            '',
            'Booking Anda telah dibatalkan.',
            '',
            'Kode: '.$booking->booking_code,
            'Alasan: '.($cancellation->reason ?? '-'),
            'Refund: Rp'.number_format((int) $cancellation->refund_amount, 0, ',', '.'),
            $cancellation->refund_amount > 0
                ? 'Status: Sedang diproses.'
                : 'Tidak ada dana yang dapat dikembalikan.',
        ]);

        return $this->log($booking, null, 'manual', 'booking_cancelled', $booking->customer_phone, $content, 'sent', $cancellation);
    }

    public function refundCreated(Booking $booking, Refund $refund): NotificationLog
    {
        $content = implode("\n", [
            "Halo {$booking->customer_name},",
            '',
            'Pengembalian dana sedang diproses.',
            '',
            'Booking: '.$booking->booking_code,
            'Refund: '.$refund->refund_code,
            'Nominal: Rp'.number_format((int) $refund->amount, 0, ',', '.'),
        ]);

        return $this->log($booking, null, 'manual', 'refund_created', $booking->customer_phone, $content, 'sent', null, $refund);
    }

    public function refundCompleted(Booking $booking, Refund $refund): NotificationLog
    {
        $content = implode("\n", [
            "Halo {$booking->customer_name},",
            '',
            'Pengembalian dana berhasil.',
            '',
            'Refund: '.$refund->refund_code,
            'Nominal: Rp'.number_format((int) $refund->amount, 0, ',', '.'),
        ]);

        return $this->log($booking, null, 'manual', 'refund_completed', $booking->customer_phone, $content, 'sent', null, $refund);
    }

    public function refundFailed(Booking $booking, Refund $refund): NotificationLog
    {
        $content = implode("\n", [
            "Halo {$booking->customer_name},",
            '',
            'Pengembalian dana belum berhasil diproses. Admin akan memproses pengembalian dana.',
            '',
            'Refund: '.$refund->refund_code,
            'Nominal: Rp'.number_format((int) $refund->amount, 0, ',', '.'),
        ]);

        return $this->log($booking, null, 'manual', 'refund_failed', $booking->customer_phone, $content, 'sent', null, $refund);
    }

    public function whatsappUrl(Booking $booking, string $context = 'Konfirmasi booking'): string
    {
        $message = implode("\n", [
            'Halo SoloRent,',
            '',
            $context.'.',
            '',
            'Kode Booking: '.$booking->booking_code,
            'Kendaraan: '.($booking->vehicle?->name ?? '-'),
            'Nama: '.$booking->customer_name,
        ]);

        return 'https://wa.me/'.config('solorent.outlet.whatsapp').'?text='.rawurlencode($message);
    }

    private function render(string $type, Booking $booking): string
    {
        $booking->loadMissing(['vehicle']);

        return match ($type) {
            'booking_created' => implode("\n", [
                "Halo {$booking->customer_name},",
                '',
                'Booking SoloRent Anda telah dibuat.',
                '',
                'Booking: '.$booking->booking_code,
                'Kendaraan: '.($booking->vehicle?->name ?? '-'),
                'Tanggal: '.$booking->start_date->format('d M Y').' – '.$booking->end_date->format('d M Y'),
                'Total: Rp'.number_format((int) $booking->total, 0, ',', '.'),
                'DP minimum (50%): Rp'.number_format((int) ceil((int) $booking->total * 50 / 100), 0, ',', '.'),
                '',
                'Silakan lanjutkan pembayaran agar booking dapat dikonfirmasi.',
            ]),
            'booking_confirmed' => implode("\n", [
                "Halo {$booking->customer_name},",
                '',
                'Booking SoloRent Anda telah dikonfirmasi.',
                '',
                'Booking: '.$booking->booking_code,
                'Kendaraan: '.($booking->vehicle?->name ?? '-'),
                'Tanggal: '.$booking->start_date->format('d M Y').' – '.$booking->end_date->format('d M Y'),
                'Status: Confirmed',
                '',
                'Terima kasih.',
            ]),
            default => 'Notifikasi SoloRent untuk booking '.$booking->booking_code,
        };
    }

    private function log(Booking $booking, ?Payment $payment, string $channel, string $type, ?string $recipient, string $content, string $status, ?Cancellation $cancellation = null, ?Refund $refund = null): NotificationLog
    {
        return NotificationLog::create([
            'booking_id' => $booking->id,
            'payment_id' => $payment?->id,
            'refund_id' => $refund?->id,
            'channel' => $channel,
            'type' => $type,
            'recipient' => $recipient,
            'content' => $content,
            'status' => $status,
        ]);
    }

    private function tryMail(Booking $booking, NotificationLog $log, string $subject, string $content): void
    {
        if (! $booking->customer_email) {
            return;
        }

        // MAIL_MAILER=log berarti email hanya dicatat — jangan klaim terkirim via provider.
        $mailer = config('mail.default');
        if (! $mailer || $mailer === 'log') {
            NotificationLog::create([
                'booking_id' => $booking->id,
                'payment_id' => $log->payment_id,
                'channel' => 'email',
                'type' => $log->type,
                'recipient' => $booking->customer_email,
                'content' => $content,
                'status' => 'pending',
                'error' => 'Mail integration belum aktif (mailer=log). Konten dicatat, pengiriman menunggu konfigurasi SMTP.',
            ]);

            return;
        }

        try {
            Mail::raw($content, fn ($m) => $m->to($booking->customer_email)->subject($subject));
            NotificationLog::create([
                'booking_id' => $booking->id,
                'payment_id' => $log->payment_id,
                'channel' => 'email',
                'type' => $log->type,
                'recipient' => $booking->customer_email,
                'content' => $content,
                'status' => 'sent',
            ]);
        } catch (\Throwable $e) {
            Log::warning('Notification mail failed', ['error' => $e->getMessage()]);
            NotificationLog::create([
                'booking_id' => $booking->id,
                'payment_id' => $log->payment_id,
                'channel' => 'email',
                'type' => $log->type,
                'recipient' => $booking->customer_email,
                'content' => $content,
                'status' => 'failed',
                'error' => $e->getMessage(),
            ]);
        }
    }
}
