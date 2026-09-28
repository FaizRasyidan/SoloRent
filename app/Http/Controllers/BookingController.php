<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\Refund;
use App\Models\Vehicle;
use App\Services\CancellationPolicyService;
use App\Services\CancellationService;
use App\Services\NotificationService;
use App\Services\PaymentService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class BookingController extends Controller
{
    public function create(?Vehicle $vehicle = null): Response
    {
        return Inertia::render('booking', [
            'vehicle' => $vehicle ? $this->vehiclePayload($vehicle) : null,
            'vehicles' => Vehicle::query()
                ->where('is_available', true)
                ->where('stock', '>', 0)
                ->orderBy('category')
                ->orderBy('price_per_day')
                ->get()
                ->map(fn (Vehicle $v) => $this->vehiclePayload($v)),
            'areas' => config('solorent.delivery_areas'),
            'outlet' => config('solorent.outlet'),
        ]);
    }

    public function availability(Request $request): JsonResponse
    {
        $data = $request->validate([
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ]);

        $vehicle = Vehicle::findOrFail($data['vehicle_id']);

        if (! $vehicle->is_available) {
            return response()->json([
                'available' => false,
                'units_left' => 0,
                'duration_days' => $this->durationDays($data['start_date'], $data['end_date']),
                'price_per_day' => $vehicle->price_per_day,
                'subtotal' => 0,
                'message' => 'Kendaraan ini sedang tidak tersedia untuk disewakan.',
            ]);
        }

        $duration = $this->durationDays($data['start_date'], $data['end_date']);
        $unitsLeft = $vehicle->stock - $vehicle->activeOverlappingCount($data['start_date'], $data['end_date']);
        $available = $vehicle->is_available && $unitsLeft > 0;

        return response()->json([
            'available' => $available,
            'units_left' => max(0, $unitsLeft),
            'duration_days' => $duration,
            'price_per_day' => $vehicle->price_per_day,
            'subtotal' => $vehicle->price_per_day * $duration,
            'message' => $available
                ? 'Kendaraan tersedia untuk tanggal tersebut.'
                : 'Kendaraan tidak tersedia untuk tanggal tersebut.',
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $areas = collect(config('solorent.delivery_areas'));

        $data = $request->validate([
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'pickup_method' => ['required', 'in:outlet,delivery'],
            'delivery_area' => ['required_if:pickup_method,delivery', 'nullable', 'string', 'in:'.$areas->pluck('name')->implode(',')],
            'delivery_name' => ['required_if:pickup_method,delivery', 'nullable', 'string', 'max:150'],
            'delivery_address' => ['required_if:pickup_method,delivery', 'nullable', 'string', 'max:500'],
            'delivery_district' => ['nullable', 'string', 'max:100'],
            'delivery_note' => ['nullable', 'string', 'max:500'],
            'customer_name' => ['required', 'string', 'max:100'],
            'customer_phone' => ['required', 'string', 'max:20', 'regex:/^[0-9+\-\s]{9,20}$/'],
            'customer_email' => ['nullable', 'email', 'max:150'],
            'identity_number' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:500'],
            'with_driver' => ['nullable', 'boolean'],
            'return_method' => ['required', 'in:outlet,pickup'],
            'return_address' => ['required_if:return_method,pickup', 'nullable', 'string', 'max:500'],
            'return_note' => ['nullable', 'string', 'max:255'],
            'terms' => ['accepted'],
        ], [
            'vehicle_id.required' => 'Pilih kendaraan terlebih dahulu.',
            'start_date.after_or_equal' => 'Tanggal mulai minimal hari ini.',
            'end_date.after_or_equal' => 'Tanggal selesai harus sama atau setelah tanggal mulai.',
            'customer_name.required' => 'Nama lengkap wajib diisi.',
            'customer_phone.required' => 'Nomor WhatsApp wajib diisi.',
            'customer_phone.regex' => 'Format nomor WhatsApp tidak valid.',
            'delivery_area.required_if' => 'Pilih area pengantaran.',
            'delivery_name.required_if' => 'Nama lokasi pengantaran wajib diisi.',
            'delivery_address.required_if' => 'Alamat lengkap pengantaran wajib diisi.',
            'return_address.required_if' => 'Alamat pengambilan kembali wajib diisi.',
            'terms.accepted' => 'Centang persetujuan syarat dan ketentuan.',
        ]);

        $result = DB::transaction(function () use ($data, $areas) {
            $vehicle = Vehicle::whereKey($data['vehicle_id'])->lockForUpdate()->firstOrFail();

            if (! $vehicle->is_available) {
                return redirect()->back()->withErrors([
                    'availability' => 'Kendaraan ini sedang tidak tersedia untuk disewakan.',
                ])->withInput();
            }

            $start = Carbon::parse($data['start_date'])->toDateString();
            $end = Carbon::parse($data['end_date'])->toDateString();
            $duration = $this->durationDays($start, $end);

            if (! $vehicle->isAvailableFor($start, $end)) {
                return redirect()->back()->withErrors([
                    'availability' => 'Maaf, kendaraan ini baru saja dipesan customer lain. Silakan pilih tanggal lain.',
                ])->withInput();
            }

            $price = $vehicle->price_per_day;
            $subtotal = $price * $duration;

            $deliveryFee = 0;
            $deliveryDistrict = $data['delivery_district'] ?? null;
            if ($data['pickup_method'] === 'delivery') {
                $area = $areas->firstWhere('name', $data['delivery_area']);
                $deliveryFee = (int) ($area['fee'] ?? 0);
                $deliveryDistrict = $data['delivery_area'];
            }

            $withDriver = (bool) ($data['with_driver'] ?? false);
            // Dengan driver, pengembalian dikunci ke outlet (server menang atas input manual).
            $returnMethod = $withDriver ? 'outlet' : $data['return_method'];

            $booking = Booking::create([
                'booking_code' => $this->generateCode(),
                'vehicle_id' => $vehicle->id,
                'customer_name' => $data['customer_name'],
                'customer_phone' => $data['customer_phone'],
                'customer_email' => $data['customer_email'] ?? null,
                'identity_number' => $data['identity_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'start_date' => $start,
                'end_date' => $end,
                'duration_days' => $duration,
                'price_per_day' => $price,
                'subtotal' => $subtotal,
                'with_driver' => $withDriver,
                'pickup_method' => $data['pickup_method'],
                'pickup_location' => $data['pickup_method'] === 'outlet' ? config('solorent.outlet.name') : null,
                'delivery_name' => $data['delivery_name'] ?? null,
                'delivery_address' => $data['delivery_address'] ?? null,
                'delivery_district' => $deliveryDistrict,
                'delivery_note' => $data['delivery_note'] ?? null,
                'delivery_fee' => $deliveryFee,
                'return_method' => $returnMethod,
                'return_address' => $returnMethod === 'pickup' ? ($data['return_address'] ?? null) : null,
                'return_note' => $data['return_note'] ?? null,
                'total' => $subtotal + $deliveryFee,
                'deposit_amount' => 0,
                'payment_status' => 'unpaid',
                'status' => 'pending',
                'terms_accepted' => true,
            ]);

            $booking->items()->create([
                'vehicle_id' => $vehicle->id,
                'vehicle_name_snapshot' => $vehicle->name,
                'price_per_day' => $price,
                'duration_days' => $duration,
                'subtotal' => $subtotal,
            ]);

            // Phase 6: invoice snapshot + notification foundation (additive, tanpa ubah flow existing).
            app(PaymentService::class)->ensureInvoice($booking->load(['vehicle', 'items']));
            app(NotificationService::class)->bookingCreated($booking);

            return $booking;
        });

        if ($result instanceof RedirectResponse) {
            return $result;
        }

        return redirect()->route('booking.success', $result);
    }

    public function success(Booking $booking): Response
    {
        $booking->load(['vehicle', 'driver', 'payments', 'invoice']);

        $totals = app(PaymentService::class)->totals($booking);

        return Inertia::render('booking-success', [
            'booking' => $this->bookingPayload($booking),
            'payment' => [
                'payment_status' => $booking->payment_status ?? 'unpaid',
                'grand_total' => $totals['grand_total'],
                'dp_minimum' => $totals['dp_minimum'],
                'dp_percent' => $totals['dp_percent'],
                'outstanding' => $totals['outstanding'],
                'invoice_number' => $booking->invoice?->invoice_number,
            ],
            'whatsapp_url' => $this->whatsappUrl($booking),
        ]);
    }

    public function check(Request $request): Response
    {
        $result = null;

        if ($request->filled(['code', 'phone'])) {
            $booking = Booking::with(['vehicle', 'driver', 'payments', 'invoice'])
                ->where('booking_code', $request->string('code')->toString())
                ->where('customer_phone', $request->string('phone')->toString())
                ->first();

            $result = $booking ? $this->bookingPayload($booking) : false;
        }

        return Inertia::render('booking-check', [
            'result' => $result,
        ]);
    }

    public function checkStore(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'booking_code' => ['required', 'string', 'max:20'],
            'customer_phone' => ['required', 'string', 'max:20'],
        ], [
            'booking_code.required' => 'Kode booking wajib diisi.',
            'customer_phone.required' => 'Nomor WhatsApp wajib diisi.',
        ]);

        return redirect()->route('booking.check', [
            'code' => trim($data['booking_code']),
            'phone' => trim($data['customer_phone']),
        ]);
    }

    /**
     * Customer cancellation (no login — verified by booking code + phone).
     * Nominal SELALU dihitung backend via CancellationService; frontend
     * hanya mengirim reason. Damage charge tidak tersentuh & tidak memblokir.
     */
    public function cancel(Request $request, Booking $booking, CancellationService $cancellations): RedirectResponse
    {
        $reasons = config('solorent.cancellation.reasons.customer', []);

        $data = $request->validate([
            'customer_phone' => ['required', 'string', 'max:20'],
            'cancel_reason' => ['required', 'string', 'max:255'],
            'reason_code' => ['nullable', 'string', 'max:50'],
        ], [
            'customer_phone.required' => 'Nomor WhatsApp wajib diisi.',
            'cancel_reason.required' => 'Alasan pembatalan wajib diisi.',
        ]);

        abort_unless(hash_equals(
            strtolower(trim((string) $booking->customer_phone)),
            strtolower(trim($data['customer_phone']))
        ), 403, 'Kode booking dan nomor WhatsApp tidak cocok.');

        if (($data['reason_code'] ?? null) && $reasons !== [] && ! array_key_exists($data['reason_code'], $reasons)) {
            return redirect()->back()->withErrors(['cancel_reason' => 'Alasan pembatalan tidak valid.'])->withInput();
        }

        try {
            $cancellations->cancel($booking, 'customer', null, [
                'reason_code' => $data['reason_code'] ?? null,
                'reason' => $data['cancel_reason'],
            ]);
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['cancel_reason' => $e->getMessage()])->withInput();
        }

        return redirect()->route('booking.check', [
            'code' => $booking->booking_code,
            'phone' => trim($data['customer_phone']),
        ])->with('success', 'Booking dibatalkan.');
    }

    /**
     * Refund receipt customer (no login — verified by booking phone).
     * IDOR: refund hanya terlihat dengan phone pemilik booking.
     */
    public function refundReceipt(Request $request, Refund $refund): Response
    {
        $phone = $request->query('phone', $request->input('phone'));
        $phone = is_string($phone) ? trim($phone) : '';
        $refund->load(['booking.vehicle', 'cancellation']);

        $verified = $phone !== '' && hash_equals(
            strtolower(trim((string) $refund->booking->customer_phone)),
            strtolower($phone)
        );

        if (! $verified) {
            return Inertia::render('booking-refund', [
                'verified' => false,
                'refund_code' => $refund->refund_code,
                'phone' => $phone,
            ]);
        }

        $booking = $refund->booking;

        return Inertia::render('booking-refund', [
            'verified' => true,
            'refund' => [
                'refund_code' => $refund->refund_code,
                'amount' => $refund->amount,
                'status' => $refund->status,
                'status_label' => $this->refundStatusLabel($refund->status),
                'reference' => $refund->reference,
                'reason' => $refund->reason,
                'processed_at' => $refund->processed_at?->format('d M Y H:i'),
                'created_at' => $refund->created_at->format('d M Y H:i'),
            ],
            'booking' => [
                'booking_code' => $booking->booking_code,
                'vehicle_name' => $booking->vehicle?->name,
                'customer_name' => $booking->customer_name,
                'status' => $booking->status,
            ],
            'cancellation' => $refund->cancellation ? [
                'original_amount' => $refund->cancellation->original_amount,
                'non_refundable_amount' => $refund->cancellation->non_refundable_amount,
                'policy_rule' => $refund->cancellation->policy_rule,
            ] : null,
            'phone' => $phone,
            'manual_note' => config('solorent.refund.manual_only', true)
                ? 'Refund belum tersedia secara otomatis. Admin perlu memproses pengembalian dana secara manual.'
                : null,
            'whatsapp_url' => app(NotificationService::class)->whatsappUrl($booking, 'Konfirmasi pengembalian dana'),
        ]);
    }

    private function refundStatusLabel(string $status): string
    {
        return match ($status) {
            Refund::STATUS_PENDING => 'Menunggu Diproses',
            Refund::STATUS_PROCESSING => 'Sedang Diproses',
            Refund::STATUS_COMPLETED => 'Berhasil Dikembalikan',
            Refund::STATUS_FAILED => 'Gagal Diproses',
            Refund::STATUS_CANCELLED => 'Dibatalkan',
            default => $status,
        };
    }

    private function durationDays(string $start, string $end): int
    {
        return max(1, Carbon::parse($start)->diffInDays(Carbon::parse($end)));
    }

    /** @return array<string, mixed>|null */
    private function damageChargeSummary(Booking $booking): ?array
    {
        $booking->loadMissing(['damageCharges.items', 'damageCharges.payments']);
        $charge = $booking->damageCharges->first(fn ($charge) => $charge->status !== DamageCharge::STATUS_CANCELLED)
            ?? $booking->damageCharges->first();

        if (! $charge) {
            return null;
        }

        return [
            'charge_code' => $charge->charge_code,
            'total' => $charge->total,
            'paid' => $charge->paidTotal(),
            'outstanding' => $charge->outstanding(),
            'status' => $charge->status,
            'items' => $charge->items->map(fn ($item) => [
                'description' => $item->description,
                'amount' => $item->amount,
            ])->all(),
        ];
    }

    private function generateCode(): string
    {
        $prefix = 'SR-'.now()->format('Ymd').'-';
        $sequence = Booking::whereDate('created_at', today())->lockForUpdate()->count() + 1;

        do {
            $code = $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
            $sequence++;
        } while (Booking::where('booking_code', $code)->exists());

        return $code;
    }

    private function vehiclePayload(Vehicle $vehicle): array
    {
        return [
            'id' => $vehicle->id,
            'slug' => $vehicle->slug,
            'name' => $vehicle->name,
            'category' => $vehicle->category,
            'transmission' => $vehicle->transmission,
            'seats' => $vehicle->seats,
            'engine' => $vehicle->engine,
            'baggage' => $vehicle->baggage,
            'price_per_day' => $vehicle->price_per_day,
            'rating' => (float) $vehicle->rating,
            'trips_count' => $vehicle->trips_count,
            'image_url' => $vehicle->primaryImageUrl(),
            'availability' => $vehicle->baseAvailability(),
        ];
    }

    private function bookingPayload(Booking $booking): array
    {
        $totals = app(PaymentService::class)->totals($booking->loadMissing(['payments']));

        return [
            'booking_code' => $booking->booking_code,
            'vehicle_name' => $booking->vehicle?->name ?? $booking->items->first()?->vehicle_name_snapshot,
            'vehicle_slug' => $booking->vehicle?->slug,
            'vehicle_image' => $booking->vehicle?->primaryImageUrl(),
            'customer_name' => $booking->customer_name,
            'customer_phone' => $booking->customer_phone,
            'start_date' => $booking->start_date->toDateString(),
            'end_date' => $booking->end_date->toDateString(),
            'duration_days' => $booking->duration_days,
            'price_per_day' => $booking->price_per_day,
            'subtotal' => $booking->subtotal,
            'with_driver' => (bool) $booking->with_driver,
            'driver_name' => $booking->driver?->name,
            'pickup_method' => $booking->pickup_method,
            'pickup_location' => $booking->pickup_location,
            'delivery_name' => $booking->delivery_name,
            'delivery_address' => $booking->delivery_address,
            'delivery_district' => $booking->delivery_district,
            'delivery_fee' => $booking->delivery_fee,
            'deposit_amount' => (int) ($booking->deposit_amount ?? 0),
            'return_method' => $booking->return_method ?? 'outlet',
            'return_address' => $booking->return_address,
            'damage_charge' => $this->damageChargeSummary($booking),
            'cancellation' => $this->cancellationSummary($booking),
            'total' => $booking->total,
            'status' => $booking->status,
            'payment_status' => $booking->payment_status ?? 'unpaid',
            'paid' => $totals['paid'],
            'outstanding' => $totals['outstanding'],
            'dp_minimum' => $totals['dp_minimum'],
            'dp_percent' => $totals['dp_percent'],
            'invoice_number' => $booking->invoice?->invoice_number,
            'created_at' => $booking->created_at->toDateTimeString(),
        ];
    }

    /** @return array<string, mixed> */
    private function cancellationSummary(Booking $booking): array
    {
        $booking->loadMissing(['cancellation', 'refunds']);
        $cancellation = $booking->cancellation;

        // Preview server-side untuk booking yang belum dibatalkan.
        $preview = $booking->status === 'cancelled'
            ? null
            : app(CancellationPolicyService::class)->evaluate($booking->fresh(), 'customer');

        return [
            'cancelled' => $booking->status === 'cancelled',
            'cancelled_by_type' => $booking->cancelled_by_type,
            'cancel_reason' => $booking->cancel_reason,
            'cancelled_at' => $booking->cancelled_at?->format('d M Y H:i'),
            'preview' => $preview,
            'record' => $cancellation ? [
                'policy_rule' => $cancellation->policy_rule,
                'policy_percent' => $cancellation->policy_percent,
                'original_amount' => $cancellation->original_amount,
                'refund_amount' => $cancellation->refund_amount,
                'non_refundable_amount' => $cancellation->non_refundable_amount,
                'was_overridden' => $cancellation->wasOverridden(),
            ] : null,
            'refunds' => $booking->refunds->map(fn (Refund $refund) => [
                'refund_code' => $refund->refund_code,
                'amount' => $refund->amount,
                'status' => $refund->status,
                'created_at' => $refund->created_at->format('d M Y H:i'),
            ])->all(),
            'reasons' => config('solorent.cancellation.reasons.customer', []),
        ];
    }

    private function whatsappUrl(Booking $booking): string
    {
        $message = implode("\n", [
            'Halo SoloRent,',
            '',
            'Saya ingin mengonfirmasi booking.',
            '',
            'Kode Booking: '.$booking->booking_code,
            'Kendaraan: '.($booking->vehicle?->name ?? '-'),
            'Tanggal: '.$booking->start_date->format('d–m–Y').' s/d '.$booking->end_date->format('d–m–Y'),
            'Durasi: '.$booking->duration_days.' Hari',
            'Nama: '.$booking->customer_name,
        ]);

        return 'https://wa.me/'.config('solorent.outlet.whatsapp').'?text='.rawurlencode($message);
    }
}
