<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\NotificationService;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentService $payments,
        private NotificationService $notifications,
    ) {}

    private function verify(Booking $booking, ?string $phone): bool
    {
        if (! $phone) {
            return false;
        }

        return hash_equals(
            strtolower(trim((string) $booking->customer_phone)),
            strtolower(trim($phone))
        );
    }

    public function show(Request $request, Booking $booking): Response
    {
        $phone = $request->query('phone', $request->input('phone'));
        $verified = $this->verify($booking, is_string($phone) ? $phone : null);

        $booking->load(['vehicle', 'payments', 'invoice']);

        if (! $verified) {
            return Inertia::render('booking-payment', [
                'verified' => false,
                'booking_code' => $booking->booking_code,
                'phone' => is_string($phone) ? $phone : '',
            ]);
        }

        $totals = $this->payments->totals($booking);
        $invoice = $this->payments->ensureInvoice($booking);

        $history = $booking->payments->map(fn (Payment $p) => $this->paymentPayload($p, false))->values()->all();

        return Inertia::render('booking-payment', [
            'verified' => true,
            'booking' => $this->bookingPayload($booking, $totals),
            'totals' => $totals,
            'history' => $history,
            'invoice' => [
                'invoice_number' => $invoice->invoice_number,
                'issued_at' => $invoice->issued_at?->format('d M Y H:i'),
            ],
            'bank' => [
                'bank_name' => config('solorent.payment.bank_name'),
                'account_number' => config('solorent.payment.account_number'),
                'account_holder' => config('solorent.payment.account_holder'),
            ],
            'phone' => trim((string) $phone),
            'whatsapp_url' => $this->notifications->whatsappUrl($booking, 'Konfirmasi pembayaran booking'),
        ]);
    }

    public function store(Request $request, Booking $booking): RedirectResponse
    {
        $data = $request->validate([
            'customer_phone' => ['required', 'string', 'max:20'],
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['required', 'in:bank_transfer'],
            'type' => ['nullable', 'in:deposit,rental,additional,full_payment'],
            'notes' => ['nullable', 'string', 'max:500'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:'.config('solorent.payment.proof_max_kb', 5120)],
        ], [
            'customer_phone.required' => 'Nomor WhatsApp wajib diisi.',
            'amount.required' => 'Nominal pembayaran wajib diisi.',
            'proof.required' => 'Bukti pembayaran wajib diunggah.',
            'proof.mimes' => 'Bukti harus berformat jpg, jpeg, png, webp, atau pdf.',
            'proof.max' => 'Ukuran bukti maksimal 5MB.',
        ]);

        abort_unless($this->verify($booking, $data['customer_phone']), 403, 'Kode booking dan nomor WhatsApp tidak cocok.');

        try {
            $payment = $this->payments->createPayment(
                $booking,
                (int) $data['amount'],
                $data['method'],
                $data['type'] ?? 'full_payment',
                [],
                'customer'
            );

            $payment = $this->payments->submitProof($payment, $request->file('proof'), [
                'notes' => $data['notes'] ?? null,
            ]);
        } catch (HttpException $e) {
            // Business-rule violation → kembalikan sebagai validation error agar UX + test konsisten.
            return redirect()->back()->withErrors(['amount' => $e->getMessage()])->withInput();
        }

        $this->notifications->paymentSubmitted($booking->fresh(), $payment);

        return redirect()
            ->route('booking.payment', ['booking' => $booking->booking_code, 'phone' => trim($data['customer_phone'])])
            ->with('success', 'Bukti pembayaran berhasil dikirim. Menunggu verifikasi admin.');
    }

    public function invoice(Request $request, Booking $booking): Response
    {
        $phone = $request->query('phone', $request->input('phone'));
        abort_unless($this->verify($booking, is_string($phone) ? $phone : null), 403, 'Akses invoice tidak diizinkan.');

        $booking->load(['vehicle', 'items', 'payments']);
        $totals = $this->payments->totals($booking);
        $invoice = $this->payments->ensureInvoice($booking);

        return Inertia::render('booking-invoice', [
            'booking' => $this->bookingPayload($booking, $totals),
            'totals' => $totals,
            'invoice' => [
                'invoice_number' => $invoice->invoice_number,
                'issued_at' => $invoice->issued_at?->format('d M Y H:i'),
                'customer_name' => $invoice->customer_name,
                'vehicle_name' => $invoice->vehicle_name,
            ],
            'outlet' => config('solorent.outlet'),
            'phone' => trim((string) $phone),
            'cancellation' => $this->cancellationBanner($booking),
        ]);
    }

    /** @return array<string, mixed>|null */
    private function cancellationBanner(Booking $booking): ?array
    {
        $booking->loadMissing(['cancellation', 'refunds']);
        if ($booking->status !== 'cancelled') {
            return null;
        }

        $refund = $booking->refunds->first();

        return [
            'refund_amount' => (int) ($booking->cancellation?->refund_amount ?? 0),
            'refund_status' => $refund?->status,
            'refund_code' => $refund?->refund_code,
        ];
    }

    /** @return array<string, mixed> */
    private function bookingPayload(Booking $booking, array $totals): array
    {
        return [
            'booking_code' => $booking->booking_code,
            'customer_name' => $booking->customer_name,
            'vehicle_name' => $booking->vehicle?->name ?? $booking->items->first()?->vehicle_name_snapshot,
            'vehicle_image' => $booking->vehicle?->primaryImageUrl(),
            'start_date' => $booking->start_date->toDateString(),
            'end_date' => $booking->end_date->toDateString(),
            'duration_days' => $booking->duration_days,
            'price_per_day' => $booking->price_per_day,
            'status' => $booking->status,
            'payment_status' => $booking->payment_status ?? 'unpaid',
        ];
    }

    /** @return array<string, mixed> */
    private function paymentPayload(Payment $payment, bool $includeAdmin): array
    {
        $payload = [
            'payment_code' => $payment->payment_code,
            'type' => $payment->type,
            'method' => $payment->method,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'submitted_at' => $payment->submitted_at?->format('d M Y H:i'),
            'paid_at' => $payment->paid_at?->format('d M Y H:i'),
            'rejection_reason' => $payment->rejection_reason,
            'created_at' => $payment->created_at->format('d M Y H:i'),
            'has_proof' => (bool) $payment->proof_path,
        ];

        if ($includeAdmin) {
            $payload['admin_note'] = $payment->admin_note;
        }

        return $payload;
    }
}
