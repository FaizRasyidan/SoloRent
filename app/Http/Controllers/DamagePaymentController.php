<?php

namespace App\Http\Controllers;

use App\Models\DamageCharge;
use App\Models\Payment;
use App\Services\NotificationService;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DamagePaymentController extends Controller
{
    public function __construct(
        private PaymentService $payments,
        private NotificationService $notifications,
    ) {}

    private function verify(DamageCharge $charge, ?string $phone): bool
    {
        if (! $phone) {
            return false;
        }

        return hash_equals(
            strtolower(trim((string) $charge->booking->customer_phone)),
            strtolower(trim($phone))
        );
    }

    public function show(Request $request, DamageCharge $damageCharge): Response
    {
        $phone = $request->query('phone', $request->input('phone'));
        $phone = is_string($phone) ? trim($phone) : '';
        $damageCharge->load(['booking.vehicle', 'items.record', 'payments']);

        if (! $this->verify($damageCharge, $phone)) {
            return Inertia::render('damage-payment', [
                'verified' => false,
                'charge_code' => $damageCharge->charge_code,
                'phone' => $phone,
            ]);
        }

        $booking = $damageCharge->booking;
        $pendingPayment = $damageCharge->payments
            ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUBMITTED])
            ->sortByDesc('id')->first();
        $paidPayment = $damageCharge->payments
            ->where('status', Payment::STATUS_PAID)
            ->sortByDesc('paid_at')->first();

        return Inertia::render('damage-payment', [
            'verified' => true,
            'booking_code' => $booking->booking_code,
            'vehicle_name' => $booking->vehicle?->name,
            'charge' => [
                'charge_code' => $damageCharge->charge_code,
                'total' => $damageCharge->total,
                'paid' => $damageCharge->paidTotal(),
                'outstanding' => $damageCharge->outstanding(),
                'status' => $damageCharge->status,
                'created_at' => $damageCharge->created_at->format('d M Y H:i'),
                'items' => $damageCharge->items->map(fn ($item) => [
                    'description' => $item->description,
                    'record_title' => $item->record?->title,
                    'photo_url' => $item->record?->photoUrl(),
                    'amount' => $item->amount,
                ])->all(),
            ],
            'pending_payment' => $pendingPayment ? [
                'payment_code' => $pendingPayment->payment_code,
                'amount' => $pendingPayment->amount,
                'status' => $pendingPayment->status,
                'created_at' => $pendingPayment->created_at->format('d M Y H:i'),
            ] : null,
            'receipt' => $paidPayment ? [
                'payment_code' => $paidPayment->payment_code,
                'amount' => $paidPayment->amount,
                'paid_at' => $paidPayment->paid_at?->format('d M Y H:i'),
            ] : null,
            'bank' => [
                'bank_name' => config('solorent.payment.bank_name'),
                'account_number' => config('solorent.payment.account_number'),
                'account_holder' => config('solorent.payment.account_holder'),
            ],
            'phone' => $phone,
            'whatsapp_url' => $this->notifications->whatsappUrl($booking, 'Konfirmasi pembayaran kerusakan'),
        ]);
    }

    public function pay(Request $request, DamageCharge $damageCharge): RedirectResponse
    {
        $data = $request->validate([
            'customer_phone' => ['required', 'string', 'max:20'],
            'method' => ['required', 'in:bank_transfer'],
            'notes' => ['nullable', 'string', 'max:500'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:'.config('solorent.payment.proof_max_kb', 5120)],
        ], [
            'customer_phone.required' => 'Nomor WhatsApp wajib diisi.',
            'proof.required' => 'Bukti pembayaran wajib diunggah.',
            'proof.mimes' => 'Bukti harus berformat jpg, jpeg, png, webp, atau pdf.',
            'proof.max' => 'Ukuran bukti maksimal 5MB.',
        ]);

        // IDOR: charge harus milik booking yang terverifikasi code + phone.
        abort_unless($this->verify($damageCharge, $data['customer_phone']), 403, 'Tagihan dan nomor WhatsApp tidak cocok.');

        try {
            $payment = $this->payments->createDamagePayment($damageCharge, $data['method'], [
                'notes' => $data['notes'] ?? null,
            ]);
            $payment = $this->payments->submitProof($payment, $request->file('proof'), [
                'notes' => $data['notes'] ?? null,
            ]);
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['amount' => $e->getMessage()])->withInput();
        }

        $this->notifications->paymentSubmitted($damageCharge->booking->fresh(), $payment);

        return redirect()
            ->route('booking.damage', ['damageCharge' => $damageCharge->charge_code, 'phone' => trim($data['customer_phone'])])
            ->with('success', 'Bukti pembayaran berhasil dikirim. Menunggu verifikasi admin.');
    }
}
