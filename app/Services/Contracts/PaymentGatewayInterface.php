<?php

namespace App\Services\Contracts;

use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Http\Request;

interface PaymentGatewayInterface
{
    /** Buat sesi pembayaran di gateway (stub hingga provider dipilih). */
    public function createPayment(Booking $booking, Payment $payment): array;

    /** Cek status pembayaran di sisi gateway. */
    public function checkPayment(Payment $payment): array;

    /** Tangani webhook/callback gateway. Harus idempotent + verifikasi signature. */
    public function handleWebhook(Request $request): ?Payment;
}
