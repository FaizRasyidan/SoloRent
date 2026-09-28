<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Refund;
use App\Services\RefundService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RefundController extends Controller
{
    public const STATUS_LABELS = [
        Refund::STATUS_PENDING => 'Pending',
        Refund::STATUS_PROCESSING => 'Processing',
        Refund::STATUS_COMPLETED => 'Completed',
        Refund::STATUS_FAILED => 'Failed',
        Refund::STATUS_CANCELLED => 'Dibatalkan',
    ];

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:pending,processing,completed,failed,cancelled'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $search = $filters['search'] ?? null;
        $status = $filters['status'] ?? null;
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;

        $query = Refund::query()
            ->with(['booking:id,booking_code,customer_name,customer_phone,status', 'cancellation:id,booking_id,reason,policy_percent'])
            ->when($search, fn ($q) => $q->where(fn ($qq) => $qq
                ->where('refund_code', 'like', "%{$search}%")
                ->orWhere('reference', 'like', "%{$search}%")
                ->orWhereHas('booking', fn ($bq) => $bq
                    ->where('booking_code', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%"))))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->latest();

        $counts = [
            'all' => (clone $query)->count(),
            'pending' => (clone $query)->where('status', Refund::STATUS_PENDING)->count(),
            'processing' => (clone $query)->where('status', Refund::STATUS_PROCESSING)->count(),
            'completed' => (clone $query)->where('status', Refund::STATUS_COMPLETED)->count(),
        ];

        $refunds = $query->paginate(10)->withQueryString()
            ->through(fn (Refund $refund) => [
                'refund_code' => $refund->refund_code,
                'booking_code' => $refund->booking?->booking_code,
                'customer_name' => $refund->booking?->customer_name,
                'customer_phone' => $refund->booking?->customer_phone,
                'amount' => $refund->amount,
                'status' => $refund->status,
                'reference' => $refund->reference,
                'reason' => $refund->reason,
                'failure_reason' => $refund->failure_reason,
                'policy_percent' => $refund->cancellation?->policy_percent,
                'processed_at' => $refund->processed_at?->format('d M Y H:i'),
                'created_at' => $refund->created_at->format('d M Y H:i'),
            ]);

        return Inertia::render('admin/refunds/index', [
            'refunds' => $refunds,
            'filters' => ['search' => $search, 'status' => $status, 'from' => $from, 'to' => $to],
            'statusLabels' => self::STATUS_LABELS,
            'counts' => $counts,
        ]);
    }

    public function process(Refund $refund, Request $request, RefundService $refunds): RedirectResponse
    {
        try {
            $refunds->process($refund, $request->user()?->id);
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['refund' => $e->getMessage()]);
        }

        return redirect()->back()->with('success', "Refund {$refund->refund_code} sedang diproses.");
    }

    public function complete(Request $request, Refund $refund, RefundService $refunds): RedirectResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string', 'max:150'],
        ], ['reference.required' => 'Referensi refund wajib diisi.']);

        try {
            $refunds->complete($refund, $data['reference'], $request->user()?->id);
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['refund' => $e->getMessage()]);
        }

        return redirect()->back()->with('success', "Refund {$refund->refund_code} selesai.");
    }

    public function fail(Request $request, Refund $refund, RefundService $refunds): RedirectResponse
    {
        $data = $request->validate([
            'failure_reason' => ['required', 'string', 'max:500'],
        ], ['failure_reason.required' => 'Alasan kegagalan wajib diisi.']);

        try {
            $refunds->fail($refund, $data['failure_reason'], $request->user()?->id);
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['refund' => $e->getMessage()]);
        }

        return redirect()->back()->with('success', "Refund {$refund->refund_code} ditandai gagal.");
    }
}
