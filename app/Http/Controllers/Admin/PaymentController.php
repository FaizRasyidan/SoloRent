<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\NotificationService;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentService $payments,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:pending,submitted,paid,rejected,expired,cancelled'],
            'sort' => ['nullable', 'in:newest,oldest,highest,lowest'],
        ]);

        $search = $filters['search'] ?? null;
        $status = $filters['status'] ?? null;
        $sort = $filters['sort'] ?? 'newest';

        $query = Payment::query()->with(['booking:id,booking_code,customer_name,customer_phone,total,status']);

        if ($search) {
            $query->where(fn ($q) => $q
                ->where('payment_code', 'like', "%{$search}%")
                ->orWhereHas('booking', fn ($bq) => $bq
                    ->where('booking_code', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")));
        }
        if ($status) {
            $query->where('status', $status);
        }

        $query = match ($sort) {
            'oldest' => $query->oldest(),
            'highest' => $query->orderByDesc('amount'),
            'lowest' => $query->orderBy('amount'),
            default => $query->latest(),
        };

        $payments = $query->paginate(12)->withQueryString()->through(fn (Payment $p) => [
            'payment_code' => $p->payment_code,
            'booking_code' => $p->booking?->booking_code,
            'customer_name' => $p->booking?->customer_name,
            'amount' => $p->amount,
            'method' => $p->method,
            'type' => $p->type,
            'status' => $p->status,
            'submitted_at' => $p->submitted_at?->format('d M Y H:i'),
            'paid_at' => $p->paid_at?->format('d M Y H:i'),
            'created_at' => $p->created_at->format('d M Y H:i'),
        ]);

        $counts = [
            'all' => Payment::query()->count(),
            'pending' => Payment::where('status', 'pending')->count(),
            'submitted' => Payment::where('status', 'submitted')->count(),
            'paid' => Payment::where('status', 'paid')->count(),
            'rejected' => Payment::where('status', 'rejected')->count(),
        ];

        $todayPaid = (int) Payment::where('status', 'paid')->whereDate('paid_at', today())->sum('amount');

        return Inertia::render('admin/payments/index', [
            'payments' => $payments,
            'filters' => ['search' => $search, 'status' => $status, 'sort' => $sort],
            'counts' => $counts,
            'todayPaid' => $todayPaid,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'booking_code' => ['required', 'string', 'max:20'],
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['required', 'in:bank_transfer,cash'],
            'type' => ['nullable', 'in:deposit,rental,additional,full_payment'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
            'admin_note' => ['nullable', 'string', 'max:500'],
            'proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:'.config('solorent.payment.proof_max_kb', 5120)],
        ], [
            'booking_code.required' => 'Kode booking wajib diisi.',
            'amount.required' => 'Nominal pelunasan wajib diisi.',
            'method.in' => 'Metode pembayaran tidak valid.',
            'proof.mimes' => 'Bukti harus berformat jpg, jpeg, png, webp, atau pdf.',
            'proof.max' => 'Ukuran bukti maksimal 5MB.',
        ]);

        $booking = Booking::where('booking_code', trim($data['booking_code']))->firstOrFail();
        $wasPending = $booking->status === 'pending';

        try {
            $payment = $this->payments->recordSettlement(
                $booking,
                (int) $data['amount'],
                $data['method'],
                $request->user()?->id,
                [
                    'type' => $data['type'] ?? 'full_payment',
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'admin_note' => $data['admin_note'] ?? null,
                ],
                $request->file('proof')
            );
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['amount' => $e->getMessage()])->withInput();
        }

        $freshBooking = $payment->booking()->with(['vehicle'])->first();
        $this->notifications->paymentConfirmed($freshBooking, $payment);
        if ($wasPending && $freshBooking->fresh()->status === 'confirmed') {
            $this->notifications->bookingConfirmed($freshBooking->fresh());
        }

        return redirect()->back()->with('success', "Pelunasan {$payment->payment_code} ({$booking->booking_code}) berhasil dicatat.");
    }

    public function show(Payment $payment): Response
    {
        $payment->load(['booking.vehicle', 'booking.payments', 'verifier:id,name']);
        $booking = $payment->booking;
        $totals = $this->payments->totals($booking);

        return Inertia::render('admin/payments/show', [
            'payment' => [
                'payment_code' => $payment->payment_code,
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer_name,
                'customer_phone' => $booking->customer_phone,
                'customer_email' => $booking->customer_email,
                'amount' => $payment->amount,
                'method' => $payment->method,
                'type' => $payment->type,
                'status' => $payment->status,
                'reference' => $payment->reference,
                'notes' => $payment->notes,
                'admin_note' => $payment->admin_note,
                'rejection_reason' => $payment->rejection_reason,
                'submitted_at' => $payment->submitted_at?->format('d M Y H:i'),
                'paid_at' => $payment->paid_at?->format('d M Y H:i'),
                'verified_at' => $payment->verified_at?->format('d M Y H:i'),
                'verified_by' => $payment->verifier?->name,
                'has_proof' => (bool) $payment->proof_path,
                'proof_name' => $payment->proof_original_name,
                'created_at' => $payment->created_at->format('d M Y H:i'),
            ],
            'booking' => [
                'booking_code' => $booking->booking_code,
                'status' => $booking->status,
                'payment_status' => $booking->payment_status ?? 'unpaid',
                'vehicle_name' => $booking->vehicle?->name,
                'start_date' => $booking->start_date->toDateString(),
                'end_date' => $booking->end_date->toDateString(),
            ],
            'totals' => $totals,
            'history' => $booking->payments->map(fn (Payment $p) => [
                'payment_code' => $p->payment_code,
                'amount' => $p->amount,
                'status' => $p->status,
                'created_at' => $p->created_at->format('d M Y H:i'),
            ])->values()->all(),
        ]);
    }

    public function confirm(Request $request, Payment $payment): RedirectResponse
    {
        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:500'],
        ]);

        $wasPending = $payment->booking->status === 'pending';

        $payment = $this->payments->confirm($payment, $request->user()?->id, $data['admin_note'] ?? null);
        $booking = $payment->booking()->with(['vehicle'])->first();

        if ($payment->isDamage()) {
            $charge = $payment->damageCharge()->firstOrFail();
            $this->notifications->damagePaymentConfirmed($booking, $charge, $payment);
        } else {
            $this->notifications->paymentConfirmed($booking, $payment);
        }
        if ($wasPending && $booking->fresh()->status === 'confirmed') {
            $this->notifications->bookingConfirmed($booking->fresh());
        }

        return redirect()->back()->with('success', "Pembayaran {$payment->payment_code} dikonfirmasi.");
    }

    public function reject(Request $request, Payment $payment): RedirectResponse
    {
        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
            'admin_note' => ['nullable', 'string', 'max:500'],
        ], [
            'rejection_reason.required' => 'Alasan penolakan wajib diisi.',
        ]);

        $payment = $this->payments->reject($payment, $data['rejection_reason'], $request->user()?->id, $data['admin_note'] ?? null);
        $booking = $payment->booking()->first();

        $this->notifications->paymentRejected($booking, $payment);

        return redirect()->back()->with('success', "Pembayaran {$payment->payment_code} ditolak.");
    }

    public function proof(Payment $payment): StreamedResponse
    {
        abort_unless($payment->proof_path, 404, 'Bukti tidak ditemukan.');
        abort_unless(Storage::disk('local')->exists($payment->proof_path), 404, 'File bukti tidak ditemukan.');

        $mime = Storage::disk('local')->mimeType($payment->proof_path) ?? 'application/octet-stream';

        return Storage::disk('local')->response($payment->proof_path, $payment->proof_original_name ?? basename($payment->proof_path), [
            'Content-Type' => $mime,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function invoice(Booking $booking)
    {
        $invoice = $this->payments->ensureInvoice($booking->load(['vehicle', 'items']));

        return Inertia::render('booking-invoice', [
            'booking' => [
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer_name,
                'vehicle_name' => $booking->vehicle?->name,
                'start_date' => $booking->start_date->toDateString(),
                'end_date' => $booking->end_date->toDateString(),
                'duration_days' => $booking->duration_days,
                'price_per_day' => $booking->price_per_day,
                'status' => $booking->status,
                'payment_status' => $booking->payment_status ?? 'unpaid',
            ],
            'totals' => $this->payments->totals($booking),
            'invoice' => [
                'invoice_number' => $invoice->invoice_number,
                'issued_at' => $invoice->issued_at?->format('d M Y H:i'),
                'customer_name' => $invoice->customer_name,
                'vehicle_name' => $invoice->vehicle_name,
            ],
            'outlet' => config('solorent.outlet'),
            'admin' => true,
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
}
