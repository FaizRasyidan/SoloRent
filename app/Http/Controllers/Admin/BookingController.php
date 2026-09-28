<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\DamageChargeItem;
use App\Models\DamageRecord;
use App\Models\Driver;
use App\Models\MaintenanceRecord;
use App\Models\OperationalTask;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Vehicle;
use App\Models\VehicleUnit;
use App\Services\CancellationPolicyService;
use App\Services\CancellationService;
use App\Services\NotificationService;
use App\Services\PaymentService;
use App\Services\RepairService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class BookingController extends Controller
{
    public const HANDOVER_ITEMS = [
        'body' => 'Body kendaraan',
        'lampu' => 'Lampu',
        'ban' => 'Ban',
        'rem' => 'Rem',
        'spion' => 'Spion',
        'stnk' => 'STNK',
        'kunci' => 'Kunci',
        'bbm' => 'BBM',
    ];

    public const STATUS_LABELS = [
        'pending' => 'Menunggu Konfirmasi',
        'confirmed' => 'Dikonfirmasi',
        'preparing' => 'Siap Diserahkan',
        'active' => 'Sedang Disewa',
        'completed' => 'Selesai',
        'cancelled' => 'Dibatalkan',
    ];

    // ---------- List ----------

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:pending,confirmed,preparing,active,completed,cancelled'],
            'payment_status' => ['nullable', 'in:unpaid,partial,paid'],
            'cancellation' => ['nullable', 'in:cancelled,refund_pending,refund_processing,refund_completed'],
            'period' => ['nullable', 'in:today,tomorrow,week,month,custom'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'driver' => ['nullable', 'in:assigned,unassigned'],
        ]);

        $search = $filters['search'] ?? null;
        $status = $filters['status'] ?? null;
        $paymentStatus = $filters['payment_status'] ?? null;
        $cancellation = $filters['cancellation'] ?? null;
        $period = $filters['period'] ?? null;
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;
        $driver = $filters['driver'] ?? null;

        [$rangeStart, $rangeEnd] = $this->resolvePeriod($period, $from, $to);

        $applyCancellation = fn ($query) => match ($cancellation) {
            'cancelled' => $query->where('status', 'cancelled'),
            'refund_pending' => $query->whereHas('refunds', fn ($rq) => $rq->where('status', Refund::STATUS_PENDING)),
            'refund_processing' => $query->whereHas('refunds', fn ($rq) => $rq->where('status', Refund::STATUS_PROCESSING)),
            'refund_completed' => $query->whereHas('refunds', fn ($rq) => $rq->where('status', Refund::STATUS_COMPLETED)),
            default => $query,
        };

        // Filter driver read-only: unassigned = butuh driver tapi belum
        // punya (with_driver + driver_id null + status blocking).
        $blockingDriver = config('solorent.statuses_blocking_availability', ['pending', 'confirmed', 'preparing', 'active']);
        /** @var list<string> $blockingDriver */
        $applyDriver = function (Builder $query) use ($driver, $blockingDriver): Builder {
            if ($driver === 'unassigned') {
                return $query->where('with_driver', true)
                    ->whereNull('driver_id')
                    ->whereIn('status', $blockingDriver);
            }
            if ($driver === 'assigned') {
                return $query->whereNotNull('driver_id');
            }

            return $query;
        };

        $base = fn () => $applyDriver($applyCancellation(Booking::query()
            ->when($search, fn ($query) => $query->where(fn ($q) => $q
                ->where('booking_code', 'like', "%{$search}%")
                ->orWhere('customer_name', 'like', "%{$search}%")
                ->orWhere('customer_phone', 'like', "%{$search}%")
                ->orWhereHas('vehicle', fn ($vq) => $vq->where('name', 'like', "%{$search}%"))))
            ->when($rangeStart && $rangeEnd, fn ($query) => $query
                ->where('start_date', '<=', $rangeEnd)
                ->where('end_date', '>=', $rangeStart))
            ->when($paymentStatus, fn ($query) => $query->where('payment_status', $paymentStatus))));

        $baseQuery = $base();
        $statusCounts = ['all' => (clone $baseQuery)->count()];
        foreach (array_keys(self::STATUS_LABELS) as $state) {
            $statusCounts[$state] = (clone $baseQuery)->where('status', $state)->count();
        }

        $bookings = (clone $baseQuery)
            ->with(['vehicle:id,name,category', 'unit:id,unit_code', 'driver:id,name', 'damageCharges.payments'])
            ->when($status, fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Booking $booking) => $this->row($booking));

        return Inertia::render('admin/bookings/index', [
            'bookings' => $bookings,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'payment_status' => $paymentStatus,
                'cancellation' => $cancellation,
                'period' => $period,
                'from' => $from,
                'to' => $to,
                'driver' => $driver,
            ],
            'statusLabels' => self::STATUS_LABELS,
            'statusCounts' => $statusCounts,
            'paymentStatusLabels' => ['unpaid' => 'Belum Dibayar', 'partial' => 'Sebagian', 'paid' => 'Lunas'],
            'cancellationLabels' => [
                'cancelled' => 'Dibatalkan',
                'refund_pending' => 'Refund Pending',
                'refund_processing' => 'Refund Processing',
                'refund_completed' => 'Refund Completed',
            ],
        ]);
    }

    // ---------- Detail ----------

    public function show(Booking $booking): Response
    {
        $booking->load(['vehicle', 'unit', 'driver', 'tasks.driver', 'payments', 'invoice', 'damageCharges.items.record', 'damageCharges.payments', 'damageRecords.unit', 'maintenances.unit', 'cancellation', 'refunds']);

        $start = $booking->start_date->toDateString();
        $end = $booking->end_date->toDateString();

        $units = $booking->vehicle
            ? $booking->vehicle->units()->orderBy('unit_code')->get()->map(fn (VehicleUnit $unit) => [
                'id' => $unit->id,
                'unit_code' => $unit->unit_code,
                'plate_number' => $unit->plate_number,
                'status' => $unit->status,
                'in_maintenance' => $unit->hasActiveMaintenance(),
                'maintenance_title' => $unit->activeMaintenance()?->title,
                'available' => $unit->isAvailableFor($start, $end, $booking->id),
                'blocking_booking' => ($blocker = $unit->blockingBooking($start, $end, $booking->id))
                    ? ['booking_code' => $blocker->booking_code, 'start_date' => $blocker->start_date->toDateString(), 'end_date' => $blocker->end_date->toDateString()]
                    : null,
            ])->all()
            : [];

        $drivers = Driver::query()->orderBy('name')->get()->map(fn (Driver $driver) => [
            'id' => $driver->id,
            'name' => $driver->name,
            'status' => $driver->status,
            'available' => $driver->isAvailableFor($start, $end, $booking->id),
            'blocking_booking' => ($blocker = $driver->blockingBooking($start, $end, $booking->id))
                ? ['booking_code' => $blocker->booking_code, 'start_date' => $blocker->start_date->toDateString(), 'end_date' => $blocker->end_date->toDateString()]
                : null,
        ])->all();

        $staffOptions = Driver::query()->where('status', Driver::STATUS_ACTIVE)->orderBy('name')
            ->get(['id', 'name'])->all();

        return Inertia::render('admin/bookings/show', [
            'booking' => $this->detail($booking),
            'units' => $units,
            'drivers' => $drivers,
            'staffOptions' => $staffOptions,
            'statusLabels' => self::STATUS_LABELS,
            'handoverItems' => self::HANDOVER_ITEMS,
            'payment' => $this->paymentSummary($booking),
            'cancellation' => $this->cancellationPayload($booking),
            'cancelReasons' => config('solorent.cancellation.reasons.admin', []),
            'refundStatuses' => [
                Refund::STATUS_PENDING => 'Pending',
                Refund::STATUS_PROCESSING => 'Processing',
                Refund::STATUS_COMPLETED => 'Completed',
                Refund::STATUS_FAILED => 'Failed',
                Refund::STATUS_CANCELLED => 'Dibatalkan',
            ],
            'taskStatuses' => [
                OperationalTask::STATUS_SCHEDULED => 'Dijadwalkan',
                OperationalTask::STATUS_ASSIGNED => 'Ditugaskan',
                OperationalTask::STATUS_ON_THE_WAY => 'Dalam Perjalanan',
                OperationalTask::STATUS_ARRIVED => 'Tiba',
                OperationalTask::STATUS_COMPLETED => 'Selesai',
                OperationalTask::STATUS_CANCELLED => 'Dibatalkan',
            ],
        ]);
    }

    // ---------- Status flow ----------

    public function confirm(Booking $booking): RedirectResponse
    {
        abort_unless($booking->status === 'pending', 422, 'Hanya booking pending yang dapat dikonfirmasi.');

        // DP 50% mengamankan booking (confirmed). Unit baru boleh dipakai setelah LUNAS
        // penuh — ditegakkan di Ready / Handover / Activate, bukan di konfirmasi manual.
        // Konfirmasi manual tetap diizinkan sebagai override admin (backward-compatible Phase 5).
        // Jalur utama customer: DP lunas → auto-confirm via PaymentService::syncBookingPayment.
        DB::transaction(function () use ($booking) {
            $booking->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            if ($booking->pickup_method === 'delivery' && ! $booking->tasks()->where('type', OperationalTask::TYPE_DELIVERY)->exists()) {
                $booking->tasks()->create([
                    'type' => OperationalTask::TYPE_DELIVERY,
                    'address' => trim(implode(', ', array_filter([
                        $booking->delivery_name, $booking->delivery_address,
                        $booking->delivery_district, $booking->delivery_note,
                    ]))) ?: null,
                    'scheduled_at' => $booking->start_date->copy()->setTime(9, 0),
                    'status' => OperationalTask::STATUS_SCHEDULED,
                ]);
            }

            if (($booking->return_method ?? 'outlet') === 'pickup' && ! $booking->tasks()->where('type', OperationalTask::TYPE_PICKUP)->exists()) {
                $booking->tasks()->create([
                    'type' => OperationalTask::TYPE_PICKUP,
                    'address' => $booking->return_address,
                    'scheduled_at' => $booking->end_date->copy()->setTime(17, 0),
                    'status' => OperationalTask::STATUS_SCHEDULED,
                ]);
            }
        });

        return redirect()->back()->with('success', 'Booking berhasil dikonfirmasi.');
    }

    public function cancel(Request $request, Booking $booking, CancellationService $cancellations): RedirectResponse
    {
        $reasons = config('solorent.cancellation.reasons.admin', []);

        $data = $request->validate([
            'cancel_reason' => ['required', 'string', 'max:255'],
            'reason_code' => ['nullable', 'string', 'max:50'],
            'override_amount' => ['nullable', 'integer', 'min:0'],
            'override_reason' => ['nullable', 'string', 'max:500'],
        ], ['cancel_reason.required' => 'Alasan pembatalan wajib diisi.']);

        if (($data['reason_code'] ?? null) && $reasons !== [] && ! array_key_exists($data['reason_code'], $reasons)) {
            return redirect()->back()->withErrors(['cancel_reason' => 'Alasan pembatalan tidak valid.'])->withInput();
        }

        // Damage charge tidak memblokir dan tidak tersentuh pembatalan.
        try {
            $cancellations->cancel($booking, 'admin', $request->user()?->id, [
                'reason_code' => $data['reason_code'] ?? null,
                'reason' => $data['cancel_reason'],
                'override_amount' => $data['override_amount'] ?? null,
                'override_reason' => $data['override_reason'] ?? null,
            ]);
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['cancel_reason' => $e->getMessage()])->withInput();
        }

        return redirect()->back()->with('success', 'Booking dibatalkan dan tidak lagi memblokir ketersediaan.');
    }

    public function markReady(Booking $booking): RedirectResponse
    {
        abort_unless($booking->status === 'confirmed', 422, 'Hanya booking yang dikonfirmasi dapat disiapkan.');

        $missing = $this->readinessGaps($booking->fresh(['tasks']));

        if ($missing !== []) {
            return redirect()->back()->withErrors(['readiness' => 'Belum siap: '.implode(', ', $missing).'.']);
        }

        $booking->update(['status' => 'preparing', 'prepared_at' => now()]);

        return redirect()->back()->with('success', 'Booking siap diserahkan.');
    }

    public function activate(Booking $booking): RedirectResponse
    {
        abort_unless($booking->status === 'preparing', 422, 'Serah terima hanya untuk booking yang siap.');
        abort_unless($booking->handover_completed_at, 422, 'Lengkapi serah terima kendaraan terlebih dahulu.');
        abort_unless($booking->fresh()->isFullyPaid(), 422, 'Rental belum boleh aktif: booking harus lunas terlebih dahulu.');

        $booking->update(['status' => 'active', 'activated_at' => now()]);

        return redirect()->back()->with('success', 'Rental aktif. Kendaraan sedang disewa.');
    }

    // ---------- Assignment ----------

    public function assignUnit(Request $request, Booking $booking): RedirectResponse
    {
        abort_unless(in_array($booking->status, ['confirmed', 'preparing'], true), 422, 'Unit hanya dapat ditugaskan pada booking confirmed/preparing.');

        $data = $request->validate([
            'vehicle_unit_id' => ['required', 'integer', 'exists:vehicle_units,id'],
        ], ['vehicle_unit_id.required' => 'Pilih unit kendaraan.']);

        $unit = VehicleUnit::findOrFail($data['vehicle_unit_id']);

        // IDOR protection: unit must belong to the booking's vehicle.
        abort_if($unit->vehicle_id !== $booking->vehicle_id, 403, 'Unit tidak sesuai dengan kendaraan booking ini.');

        if (! $unit->isActive()) {
            return redirect()->back()->withErrors(['unit' => "Unit {$unit->unit_code} sedang nonaktif."]);
        }

        $start = $booking->start_date->toDateString();
        $end = $booking->end_date->toDateString();

        // Final re-check inside a lock to prevent double assignment.
        $assigned = DB::transaction(function () use ($booking, $unit, $start, $end) {
            $freshUnit = VehicleUnit::whereKey($unit->id)->lockForUpdate()->firstOrFail();
            $freshBooking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            if (! $freshUnit->isActive()) {
                return 'inactive';
            }
            if ($freshUnit->vehicle_id !== $freshBooking->vehicle_id) {
                return 'mismatch';
            }
            if (! $freshUnit->isAvailableFor($start, $end, $freshBooking->id)) {
                return 'conflict';
            }

            $freshBooking->update([
                'vehicle_unit_id' => $freshUnit->id,
                'unit_assigned_at' => now(),
            ]);

            return 'ok';
        });

        return match ($assigned) {
            'ok' => redirect()->back()->with('success', "Unit {$unit->unit_code} berhasil ditugaskan."),
            'inactive' => redirect()->back()->withErrors(['unit' => "Unit {$unit->unit_code} sedang nonaktif."]),
            'mismatch' => redirect()->back()->withErrors(['unit' => 'Unit tidak sesuai dengan kendaraan booking ini.']),
            default => redirect()->back()->withErrors(['unit' => $this->unitConflictMessage($unit, $booking)]),
        };
    }

    public function assignDriver(Request $request, Booking $booking): RedirectResponse
    {
        abort_unless(in_array($booking->status, ['confirmed', 'preparing'], true), 422, 'Driver hanya dapat ditugaskan pada booking confirmed/preparing.');
        abort_unless($booking->with_driver, 422, 'Booking ini tidak membutuhkan driver.');

        $data = $request->validate([
            'driver_id' => ['required', 'integer', 'exists:drivers,id'],
        ], ['driver_id.required' => 'Pilih driver.']);

        $driver = Driver::findOrFail($data['driver_id']);

        if (! $driver->isActive()) {
            return redirect()->back()->withErrors(['driver' => $driver->isWorking()
                ? "Driver {$driver->name} sedang bekerja dan tidak dapat ditugaskan."
                : "Driver {$driver->name} sedang nonaktif."]);
        }

        $start = $booking->start_date->toDateString();
        $end = $booking->end_date->toDateString();

        $autoTasks = 0;
        $assigned = DB::transaction(function () use ($booking, $driver, $start, $end, &$autoTasks) {
            $freshDriver = Driver::whereKey($driver->id)->lockForUpdate()->firstOrFail();
            $freshBooking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            if (! $freshDriver->isActive()) {
                return $freshDriver->isWorking() ? 'working' : 'inactive';
            }
            if (! $freshDriver->isAvailableFor($start, $end, $freshBooking->id)) {
                return 'conflict';
            }

            // Kembalikan driver lama ke aktif bila diganti.
            $previousDriverId = $freshBooking->driver_id;
            if ($previousDriverId && $previousDriverId !== $freshDriver->id) {
                $previous = Driver::whereKey($previousDriverId)->lockForUpdate()->first();
                if ($previous && $previous->isWorking()) {
                    $previous->update(['status' => Driver::STATUS_ACTIVE]);
                }
            }

            $freshBooking->update([
                'driver_id' => $freshDriver->id,
                'driver_assigned_at' => now(),
            ]);

            // Driver yang ditugaskan berstatus bekerja — tidak dapat ditempatkan di mana-mana.
            $freshDriver->update(['status' => Driver::STATUS_WORKING]);

            // Tugas antar/jemput otomatis ikut driver rental (yang belum ada
            // petugasnya, atau masih dipegang driver rental sebelumnya).
            $openTasks = OperationalTask::where('booking_id', $freshBooking->id)
                ->whereNotIn('status', [OperationalTask::STATUS_COMPLETED, OperationalTask::STATUS_CANCELLED])
                ->lockForUpdate()
                ->get();
            foreach ($openTasks as $openTask) {
                if ($openTask->driver_id !== null && $openTask->driver_id !== $previousDriverId) {
                    continue;
                }
                $openTask->update([
                    'driver_id' => $freshDriver->id,
                    'status' => $openTask->status === OperationalTask::STATUS_SCHEDULED
                        ? OperationalTask::STATUS_ASSIGNED
                        : $openTask->status,
                ]);
                $autoTasks++;
            }

            return 'ok';
        });

        return match ($assigned) {
            'ok' => redirect()->back()->with('success', $autoTasks > 0
                ? "Driver {$driver->name} berhasil ditugaskan. {$autoTasks} tugas antar/jemput otomatis ikut driver ini."
                : "Driver {$driver->name} berhasil ditugaskan."),
            'inactive' => redirect()->back()->withErrors(['driver' => "Driver {$driver->name} sedang nonaktif."]),
            'working' => redirect()->back()->withErrors(['driver' => "Driver {$driver->name} sedang bekerja dan tidak dapat ditugaskan."]),
            default => redirect()->back()->withErrors(['driver' => $this->driverConflictMessage($driver, $booking)]),
        };
    }

    // ---------- Handover & return ----------

    public function handover(Request $request, Booking $booking): RedirectResponse
    {
        abort_unless($booking->status === 'preparing', 422, 'Serah terima hanya untuk booking yang siap.');
        abort_unless($booking->fresh()->isFullyPaid(), 422, 'Unit belum boleh diserahkan: booking harus lunas terlebih dahulu.');

        $items = array_keys(self::HANDOVER_ITEMS);

        $data = $request->validate([
            'checklist' => ['required', 'array'],
            'checklist.*' => ['in:'.implode(',', $items)],
            'handover_notes' => ['nullable', 'string', 'max:1000'],
            'handover_photos' => ['nullable', 'array', 'max:5'],
            'handover_photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ], [
            'checklist.required' => 'Centang seluruh checklist serah terima.',
            'handover_photos.*.image' => 'File harus berupa gambar.',
            'handover_photos.*.mimes' => 'Foto harus berformat jpg, jpeg, png, atau webp.',
            'handover_photos.*.max' => 'Ukuran tiap foto maksimal 5MB.',
        ]);

        if (count(array_unique($data['checklist'])) !== count($items)) {
            return redirect()->back()->withErrors(['checklist' => 'Centang seluruh checklist serah terima.']);
        }

        DB::transaction(function () use ($booking, $data) {
            $photos = $booking->handover_photos ?? [];
            foreach ($data['handover_photos'] ?? [] as $file) {
                $photos[] = $file->store('handovers', 'public');
            }

            $booking->update([
                'handover_checklist' => array_values(array_unique($data['checklist'])),
                'handover_notes' => $data['handover_notes'] ?? null,
                'handover_photos' => $photos,
                'handover_completed_at' => now(),
            ]);
        });

        return redirect()->back()->with('success', 'Serah terima selesai. Booking dapat diaktifkan.');
    }

    public function returnInspection(Request $request, Booking $booking): RedirectResponse
    {
        abort_unless($booking->status === 'active', 422, 'Pemeriksaan pengembalian hanya untuk rental aktif.');

        $data = $request->validate([
            'return_condition' => ['required', 'in:normal,damage'],
            'return_fuel' => ['required', 'string', 'max:20'],
            'return_notes' => ['nullable', 'string', 'max:1000'],
            'return_photos' => ['nullable', 'array', 'max:5'],
            'return_photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'damages' => ['required_if:return_condition,damage', 'array', 'max:10'],
            'damages.*.title' => ['required_with:damages', 'string', 'max:150'],
            'damages.*.description' => ['nullable', 'string', 'max:2000'],
            'damages.*.repair_cost' => ['required_with:damages', 'integer', 'min:0', 'max:100000000'],
            'damages.*.photo' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ], [
            'return_condition.required' => 'Pilih kondisi kendaraan.',
            'return_condition.in' => 'Kondisi tidak valid.',
            'return_fuel.required' => 'Isi level BBM.',
            'return_photos.*.image' => 'File harus berupa gambar.',
            'return_photos.*.mimes' => 'Foto harus berformat jpg, jpeg, png, atau webp.',
            'return_photos.*.max' => 'Ukuran tiap foto maksimal 5MB.',
            'damages.required_if' => 'Tambahkan minimal satu kerusakan.',
            'damages.*.title.required_with' => 'Judul kerusakan wajib diisi.',
            'damages.*.repair_cost.required_with' => 'Biaya perbaikan wajib diisi.',
            'damages.*.repair_cost.integer' => 'Biaya perbaikan harus berupa angka.',
            'damages.*.repair_cost.min' => 'Biaya perbaikan tidak boleh negatif.',
            'damages.*.photo.image' => 'File harus berupa gambar.',
            'damages.*.photo.mimes' => 'Foto harus berformat jpg, jpeg, png, atau webp.',
            'damages.*.photo.max' => 'Ukuran tiap foto maksimal 5MB.',
        ]);

        $charge = DB::transaction(function () use ($booking, $data, $request) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status === 'active', 422, 'Pemeriksaan pengembalian hanya untuk rental aktif.');

            $photos = [];
            foreach ($data['return_photos'] ?? [] as $file) {
                $photos[] = $file->store('returns', 'public');
            }

            $locked->update([
                'return_condition' => $data['return_condition'],
                'return_fuel' => $data['return_fuel'],
                'return_notes' => $data['return_notes'] ?? null,
                'return_photos' => $photos,
                'returned_at' => now(),
                // Rental selesai secara operasional walau damage charge masih outstanding.
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            // Rental selesai — driver kembali aktif dan dapat ditugaskan lagi.
            if ($locked->driver_id) {
                $driver = Driver::whereKey($locked->driver_id)->lockForUpdate()->first();
                if ($driver && $driver->isWorking()) {
                    $driver->update(['status' => Driver::STATUS_ACTIVE]);
                }
            }

            $charge = null;
            foreach ($data['damages'] ?? [] as $index => $damage) {
                $photo = $request->file("damages.{$index}.photo");
                $record = DamageRecord::create([
                    'booking_id' => $locked->id,
                    'vehicle_unit_id' => $locked->vehicle_unit_id,
                    'title' => $damage['title'],
                    'description' => $damage['description'] ?? null,
                    'repair_cost' => $damage['repair_cost'],
                    'photo_path' => $photo ? $photo->store('damages', 'public') : null,
                    'created_by' => $request->user()->id,
                ]);

                $charge = $locked->openDamageCharge() ?? DamageCharge::create([
                    'booking_id' => $locked->id,
                    'charge_code' => DamageCharge::generateCode(),
                    'status' => DamageCharge::STATUS_UNPAID,
                    'created_by' => $request->user()->id,
                ]);
                $charge->items()->create([
                    'damage_record_id' => $record->id,
                    'description' => $record->title,
                    'amount' => $record->repair_cost,
                ]);
            }

            // Opsi A (ringkas): seluruh kerusakan satu unit digabung jadi 1 entri Perbaikan.
            if (! empty($data['damages'] ?? [])) {
                app(RepairService::class)->syncAutoGroup($locked->id, $locked->vehicle_unit_id, $request->user()->id);
            }
            $charge?->recalculate();

            return $charge?->fresh();
        });

        if ($charge) {
            app(NotificationService::class)->damageChargeCreated($booking->fresh(), $charge);
        }

        return redirect()->back()->with(
            'success',
            $charge
                ? 'Pengembalian selesai. Tagihan kerusakan '.$charge->charge_code.' dibuat.'
                : 'Pengembalian selesai. Rental ditutup.'
        );
    }

    // ---------- Payloads ----------

    /** @return array<string, mixed> */
    /** @return array<string, mixed> */
    private function cancellationPayload(Booking $booking): array
    {
        $booking->loadMissing(['cancellation', 'refunds']);
        $cancellation = $booking->cancellation;

        $preview = $booking->status === 'cancelled'
            ? null
            : app(CancellationPolicyService::class)->evaluate($booking->fresh(), 'admin');

        // Warning assignment operasional aktif (Butir 68).
        $warnings = [];
        if ($booking->vehicle_unit_id && $booking->unit) {
            $warnings[] = "Unit {$booking->unit->unit_code} sudah ditugaskan.";
        }
        if ($booking->driver_id && $booking->driver) {
            $warnings[] = "Driver {$booking->driver->name} sudah ditugaskan.";
        }
        $openTasks = $booking->tasks->filter(fn (OperationalTask $task) => $task->isOpen())->values();
        foreach ($openTasks as $task) {
            $warnings[] = $task->type === OperationalTask::TYPE_DELIVERY
                ? 'Tugas pengantaran masih terbuka.'
                : 'Tugas pengambilan masih terbuka.';
        }

        return [
            'cancelled' => $booking->status === 'cancelled',
            'preview' => $preview,
            'assignment_warnings' => $warnings,
            'fully_paid' => $booking->isFullyPaid(),
            'record' => $cancellation ? [
                'cancelled_by_type' => $cancellation->cancelled_by_type,
                'reason_code' => $cancellation->reason_code,
                'reason' => $cancellation->reason,
                'policy_rule' => $cancellation->policy_rule,
                'policy_percent' => $cancellation->policy_percent,
                'original_amount' => $cancellation->original_amount,
                'refund_amount' => $cancellation->refund_amount,
                'non_refundable_amount' => $cancellation->non_refundable_amount,
                'cancelled_at' => $cancellation->cancelled_at?->format('d M Y H:i'),
                'was_overridden' => $cancellation->wasOverridden(),
                'override_policy_amount' => $cancellation->override_policy_amount,
                'override_amount' => $cancellation->override_amount,
                'override_reason' => $cancellation->override_reason,
            ] : null,
            'refunds' => $booking->refunds->map(fn (Refund $refund) => [
                'refund_code' => $refund->refund_code,
                'amount' => $refund->amount,
                'status' => $refund->status,
                'reference' => $refund->reference,
                'reason' => $refund->reason,
                'failure_reason' => $refund->failure_reason,
                'processed_at' => $refund->processed_at?->format('d M Y H:i'),
                'created_at' => $refund->created_at->format('d M Y H:i'),
            ])->all(),
        ];
    }

    private function row(Booking $booking): array
    {
        $openCharge = $booking->relationLoaded('damageCharges')
            ? $booking->damageCharges->first(fn (DamageCharge $charge) => $charge->isOpen())
            : $booking->openDamageCharge();

        return [
            'booking_code' => $booking->booking_code,
            'customer_name' => $booking->customer_name,
            'customer_phone' => $booking->customer_phone,
            'vehicle_name' => $booking->vehicle?->name,
            'unit_code' => $booking->unit?->unit_code,
            'driver_name' => $booking->driver?->name,
            'start_date' => $booking->start_date->toDateString(),
            'end_date' => $booking->end_date->toDateString(),
            'duration_days' => $booking->duration_days,
            'pickup_method' => $booking->pickup_method,
            'with_driver' => (bool) $booking->with_driver,
            'status' => $booking->status,
            'payment_status' => $booking->payment_status ?? 'unpaid',
            'total' => $booking->total,
            'created_at' => $booking->created_at->toDateTimeString(),
            'open_damage' => $openCharge ? [
                'charge_code' => $openCharge->charge_code,
                'status' => $openCharge->status,
                'outstanding' => $openCharge->outstanding(),
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    private function detail(Booking $booking): array
    {
        $start = $booking->start_date->toDateString();
        $end = $booking->end_date->toDateString();

        return [
            ...$this->row($booking),
            'customer_email' => $booking->customer_email,
            'vehicle_slug' => $booking->vehicle?->slug,
            'price_per_day' => $booking->price_per_day,
            'subtotal' => $booking->subtotal,
            'delivery_name' => $booking->delivery_name,
            'delivery_address' => $booking->delivery_address,
            'delivery_district' => $booking->delivery_district,
            'delivery_note' => $booking->delivery_note,
            'delivery_fee' => $booking->delivery_fee,
            'deposit_amount' => (int) ($booking->deposit_amount ?? 0),
            'return_method' => $booking->return_method ?? 'outlet',
            'return_address' => $booking->return_address,
            'return_note' => $booking->return_note,
            'notes' => $booking->notes,
            'availability' => $booking->vehicle ? $booking->vehicle->availabilitySummary($start, $end) : null,
            'tasks' => $booking->tasks->map(fn (OperationalTask $task) => [
                'id' => $task->id,
                'type' => $task->type,
                'staff_name' => $task->driver?->name,
                'staff_id' => $task->driver_id,
                'scheduled_at' => $task->scheduled_at?->format('Y-m-d H:i'),
                'address' => $task->address,
                'status' => $task->status,
                'notes' => $task->notes,
            ])->all(),
            'timeline' => $this->timeline($booking),
            'readiness' => $this->readinessGaps($booking),
            'handover' => [
                'checklist' => $booking->handover_checklist ?? [],
                'notes' => $booking->handover_notes,
                'photos' => $this->photoUrls($booking->handover_photos ?? []),
                'completed_at' => $booking->handover_completed_at?->format('d M Y H:i'),
            ],
            'return' => [
                'condition' => $booking->return_condition,
                'fuel' => $booking->return_fuel,
                'notes' => $booking->return_notes,
                'photos' => $this->photoUrls($booking->return_photos ?? []),
                'returned_at' => $booking->returned_at?->format('d M Y H:i'),
            ],
            'cancel_reason' => $booking->cancel_reason,
            'cancelled_by_type' => $booking->cancelled_by_type,
            'damages' => $booking->damageRecords->map(fn (DamageRecord $record) => [
                'id' => $record->id,
                'unit_code' => $record->unit?->unit_code,
                'title' => $record->title,
                'description' => $record->description,
                'repair_cost' => $record->repair_cost,
                'photo_url' => $record->photoUrl(),
                'created_at' => $record->created_at->format('d M Y H:i'),
            ])->all(),
            'damage_charges' => $booking->damageCharges->map(fn (DamageCharge $charge) => $this->damageChargePayload($charge))->all(),
            'maintenances' => $booking->maintenances->map(fn (MaintenanceRecord $record) => [
                'id' => $record->id,
                'unit_code' => $record->unit?->unit_code,
                'title' => $record->title,
                'description' => $record->description,
                'cost' => $record->cost,
                'priority' => $record->priority ?? MaintenanceRecord::PRIORITY_SEDANG,
                'status' => $record->status,
                'damage_count' => $record->isAuto() && $record->booking_id && $record->vehicle_unit_id
                    ? DamageRecord::where('booking_id', $record->booking_id)->where('vehicle_unit_id', $record->vehicle_unit_id)->count()
                    : ($record->damage_record_id ? 1 : 0),
                'started_at' => $record->started_at?->format('d M Y H:i'),
                'completed_at' => $record->completed_at?->format('d M Y H:i'),
                'estimated_completed_at' => $record->estimated_completed_at?->format('d M Y H:i'),
                'notes' => $record->notes,
            ])->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function damageChargePayload(DamageCharge $charge): array
    {
        $charge->loadMissing(['items.record', 'payments']);

        return [
            'id' => $charge->id,
            'charge_code' => $charge->charge_code,
            'subtotal' => $charge->subtotal,
            'total' => $charge->total,
            'paid' => $charge->paidTotal(),
            'outstanding' => $charge->outstanding(),
            'status' => $charge->status,
            'locked' => $charge->isLocked(),
            'notes' => $charge->notes,
            'waived_reason' => $charge->waived_reason,
            'created_at' => $charge->created_at->format('d M Y H:i'),
            'items' => $charge->items->map(fn (DamageChargeItem $item) => [
                'id' => $item->id,
                'record_id' => $item->damage_record_id,
                'record_title' => $item->record?->title,
                'record_photo_url' => $item->record?->photoUrl(),
                'description' => $item->description,
                'amount' => $item->amount,
            ])->all(),
            'payments' => $charge->payments->map(fn (Payment $payment) => [
                'payment_code' => $payment->payment_code,
                'amount' => $payment->amount,
                'method' => $payment->method,
                'status' => $payment->status,
                'paid_at' => $payment->paid_at?->format('d M Y H:i'),
                'submitted_at' => $payment->submitted_at?->format('d M Y H:i'),
                'has_proof' => (bool) $payment->proof_path,
                'rejection_reason' => $payment->rejection_reason,
                'created_at' => $payment->created_at->format('d M Y H:i'),
            ])->all(),
        ];
    }

    /** @return list<array{label: string, at: string|null, done: bool, current: bool}> */
    private function timeline(Booking $booking): array
    {
        $fmt = fn ($value) => $value ? $value->format('d M Y H:i') : null;

        if ($booking->status === 'cancelled') {
            $booking->loadMissing(['cancellation', 'refunds']);
            $steps = [
                ['label' => 'Booking dibuat', 'at' => $fmt($booking->created_at)],
                ['label' => 'Booking dikonfirmasi', 'at' => $fmt($booking->confirmed_at)],
                ['label' => 'Unit ditugaskan'.($booking->unit ? " ({$booking->unit->unit_code})" : ''), 'at' => $fmt($booking->unit_assigned_at)],
                ['label' => $booking->with_driver
                    ? 'Driver ditugaskan'.($booking->driver ? " ({$booking->driver->name})" : '')
                    : 'Tanpa driver', 'at' => $fmt($booking->driver_assigned_at)],
                ['label' => 'Siap diserahkan', 'at' => $fmt($booking->prepared_at)],
                ['label' => 'Kendaraan diterima', 'at' => $fmt($booking->handover_completed_at)],
                ['label' => 'Sedang disewa', 'at' => $fmt($booking->activated_at)],
                ['label' => 'Booking dibatalkan'.($booking->cancel_reason ? " — {$booking->cancel_reason}" : ''), 'at' => $fmt($booking->cancelled_at)],
            ];

            foreach ($booking->refunds as $refund) {
                $steps[] = ['label' => "Refund {$refund->refund_code} dibuat (Rp".number_format($refund->amount, 0, ',', '.').')', 'at' => $fmt($refund->created_at)];
                if ($refund->processed_at && in_array($refund->status, [Refund::STATUS_PROCESSING, Refund::STATUS_COMPLETED, Refund::STATUS_FAILED], true)) {
                    $steps[] = ['label' => "Refund {$refund->refund_code} diproses", 'at' => $fmt($refund->processed_at)];
                }
                if ($refund->status === Refund::STATUS_COMPLETED) {
                    $steps[] = ['label' => "Refund {$refund->refund_code} selesai", 'at' => $fmt($refund->processed_at)];
                }
            }

            return array_map(fn ($step, $i) => [
                'label' => $step['label'],
                'at' => $step['at'],
                'done' => $step['at'] !== null,
                'current' => $i === count($steps) - 1,
            ], $steps, array_keys($steps));
        }

        $order = ['pending', 'confirmed', 'preparing', 'active', 'completed'];
        $stage = array_search($booking->status, $order, true);

        $steps = [
            ['label' => 'Booking dibuat', 'at' => $fmt($booking->created_at)],
            ['label' => 'Booking dikonfirmasi', 'at' => $fmt($booking->confirmed_at)],
            ['label' => 'Unit ditugaskan'.($booking->unit ? " ({$booking->unit->unit_code})" : ''), 'at' => $fmt($booking->unit_assigned_at)],
            ['label' => $booking->with_driver
                ? 'Driver ditugaskan'.($booking->driver ? " ({$booking->driver->name})" : '')
                : 'Tanpa driver', 'at' => $fmt($booking->driver_assigned_at)],
            ['label' => 'Siap diserahkan', 'at' => $fmt($booking->prepared_at)],
            ['label' => 'Kendaraan diterima', 'at' => $fmt($booking->handover_completed_at)],
            ['label' => 'Sedang disewa', 'at' => $fmt($booking->activated_at)],
            ['label' => 'Pengembalian'.($booking->returned_at ? " ({$booking->returned_at->format('d M Y')})" : ''), 'at' => $fmt($booking->returned_at)],
            ['label' => 'Selesai', 'at' => $fmt($booking->completed_at)],
            ...$this->damageTimelineSteps($booking),
        ];

        // Map each step to the furthest stage it belongs to.
        $stepStage = [0, 1, 1, 1, 2, 2, 3, 4, 4, ...array_fill(0, count($this->damageTimelineSteps($booking)), 4)];

        return array_map(fn ($step, $i) => [
            'label' => $step['label'],
            'at' => $step['at'],
            'done' => $step['at'] !== null,
            'current' => $stepStage[$i] === $stage && $step['at'] === null,
        ], $steps, array_keys($steps));
    }

    /** @return list<array{label: string, at: string|null}> */
    private function damageTimelineSteps(Booking $booking): array
    {
        $fmt = fn ($value) => $value ? $value->format('d M Y H:i') : null;
        $steps = [];

        foreach ($booking->damageCharges as $charge) {
            $steps[] = ['label' => "Tagihan kerusakan {$charge->charge_code} dibuat", 'at' => $fmt($charge->created_at)];
            $paid = $charge->payments->where('status', Payment::STATUS_PAID)->sortByDesc('paid_at')->first();
            if ($paid) {
                $steps[] = ['label' => "Damage payment {$paid->payment_code} lunas", 'at' => $fmt($paid->paid_at)];
            }
        }

        return $steps;
    }

    /** @return list<string> unmet readiness requirements */
    private function readinessGaps(Booking $booking): array
    {
        $gaps = [];

        // Aturan sewa: DP 50% mengamankan booking (confirmed), tetapi unit
        // baru boleh dipakai setelah LUNAS penuh. Ready = pintu masuk pemakaian unit.
        $booking->loadMissing(['payments']);
        if (! $booking->isFullyPaid()) {
            $short = $booking->outstanding();
            $gaps[] = 'pelunasan (sisa Rp'.number_format($short, 0, ',', '.').')';
        }

        if (! $booking->vehicle_unit_id) {
            $gaps[] = 'unit kendaraan';
        }
        if ($booking->with_driver && ! $booking->driver_id) {
            $gaps[] = 'driver';
        }
        foreach ($booking->tasks as $task) {
            if ($task->isOpen() && ! $task->driver_id) {
                $gaps[] = $task->type === OperationalTask::TYPE_DELIVERY ? 'petugas pengantaran' : 'petugas pengambilan';
            }
        }

        return $gaps;
    }

    /** @return array<string, mixed> */
    private function paymentSummary(Booking $booking): array
    {
        $booking->loadMissing(['payments', 'invoice', 'vehicle']);
        $service = app(PaymentService::class);
        $totals = $service->totals($booking);

        return [
            'totals' => $totals,
            'invoice_number' => $booking->invoice?->invoice_number,
            'history' => $booking->payments->map(fn (Payment $p) => [
                'payment_code' => $p->payment_code,
                'amount' => $p->amount,
                'method' => $p->method,
                'type' => $p->type,
                'status' => $p->status,
                'submitted_at' => $p->submitted_at?->format('d M Y H:i'),
                'paid_at' => $p->paid_at?->format('d M Y H:i'),
                'rejection_reason' => $p->rejection_reason,
                'has_proof' => (bool) $p->proof_path,
                'created_at' => $p->created_at->format('d M Y H:i'),
            ])->values()->all(),
        ];
    }

    /** @return array{0: string, 1: string}|array{null, null} */
    private function resolvePeriod(?string $period, ?string $from, ?string $to): array
    {
        $today = today();

        return match ($period) {
            'today' => [$today->toDateString(), $today->toDateString()],
            'tomorrow' => [$today->copy()->addDay()->toDateString(), $today->copy()->addDay()->toDateString()],
            'week' => [$today->copy()->startOfWeek()->toDateString(), $today->copy()->endOfWeek()->toDateString()],
            'month' => [$today->copy()->startOfMonth()->toDateString(), $today->copy()->endOfMonth()->toDateString()],
            'custom' => [$from, $to],
            default => [null, null],
        };
    }

    private function unitConflictMessage(VehicleUnit $unit, Booking $booking): string
    {
        if ($unit->hasActiveMaintenance()) {
            $title = $unit->activeMaintenance()?->title ?? 'perbaikan';

            return "Unit {$unit->unit_code} sedang maintenance ({$title}) dan tidak tersedia untuk booking baru.";
        }

        $blocker = $unit->blockingBooking(
            $booking->start_date->toDateString(),
            $booking->end_date->toDateString(),
            $booking->id
        );

        if ($blocker) {
            return "Unit {$unit->unit_code} tidak tersedia pada periode ".
                "{$booking->start_date->format('d M Y')}–{$booking->end_date->format('d M Y')}. ".
                "Unit tersebut dipakai booking {$blocker->booking_code}.";
        }

        return "Unit {$unit->unit_code} tidak tersedia pada periode tersebut.";
    }

    private function driverConflictMessage(Driver $driver, Booking $booking): string
    {
        $blocker = $driver->blockingBooking(
            $booking->start_date->toDateString(),
            $booking->end_date->toDateString(),
            $booking->id
        );

        if ($blocker) {
            return "Driver {$driver->name} tidak tersedia pada periode ".
                "{$booking->start_date->format('d M Y')}–{$booking->end_date->format('d M Y')}. ".
                "Driver tersebut memiliki booking {$blocker->booking_code}.";
        }

        return "Driver {$driver->name} tidak tersedia pada periode tersebut.";
    }

    /** @return list<string> */
    private function photoUrls(array $paths): array
    {
        return array_values(array_filter(array_map(
            fn ($path) => $path ? Vehicle::resolveImageUrl((string) $path) : null,
            $paths
        )));
    }
}
