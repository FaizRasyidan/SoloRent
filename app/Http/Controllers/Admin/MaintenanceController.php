<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreMaintenanceRequest;
use App\Models\Booking;
use App\Models\DamageRecord;
use App\Models\MaintenanceRecord;
use App\Models\VehicleUnit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceController extends Controller
{
    public const STATUS_LABELS = [
        'scheduled' => 'Dijadwalkan',
        'in_progress' => 'Berjalan',
        'completed' => 'Selesai',
        'cancelled' => 'Dibatalkan',
    ];

    public const PRIORITY_LABELS = [
        'rendah' => 'Rendah',
        'sedang' => 'Sedang',
        'tinggi' => 'Tinggi',
        'darurat' => 'Darurat',
    ];

    // ---------- Pusat Perbaikan ----------

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:scheduled,in_progress,completed,cancelled'],
            'priority' => ['nullable', 'in:rendah,sedang,tinggi,darurat'],
            'overdue' => ['nullable', 'in:1,0,true,false'],
        ]);

        $search = $filters['search'] ?? null;
        $status = $filters['status'] ?? null;
        $priority = $filters['priority'] ?? null;
        $overdueOnly = in_array($filters['overdue'] ?? null, ['1', 'true', true], true);

        $base = fn () => MaintenanceRecord::query()
            ->when($search, fn ($q) => $q->where(fn ($qq) => $qq
                ->where('title', 'like', "%{$search}%")
                ->orWhereHas('unit', fn ($uq) => $uq->where('unit_code', 'like', "%{$search}%"))
                ->orWhereHas('booking', fn ($bq) => $bq->where('booking_code', 'like', "%{$search}%"))))
            ->when($priority, fn ($q) => $q->where('priority', $priority))
            ->when($overdueOnly, fn ($q) => $q
                ->whereNotNull('estimated_completed_at')
                ->where('estimated_completed_at', '<', now())
                ->whereIn('status', [MaintenanceRecord::STATUS_SCHEDULED, MaintenanceRecord::STATUS_IN_PROGRESS]));

        $baseQuery = $base();
        $statusCounts = ['all' => (clone $baseQuery)->count()];
        foreach (array_keys(self::STATUS_LABELS) as $state) {
            $statusCounts[$state] = (clone $baseQuery)->where('status', $state)->count();
        }

        $repairs = (clone $baseQuery)
            ->with(['unit.vehicle:id,name', 'booking:id,booking_code,customer_name', 'damageRecord:id,title,photo_path'])
            ->when($status, fn ($q) => $q->where('status', $status))
            // Darurat dulu, lalu estimasi terdekat, lalu terbaru.
            ->orderByRaw("CASE priority WHEN 'darurat' THEN 0 WHEN 'tinggi' THEN 1 WHEN 'sedang' THEN 2 ELSE 3 END")
            ->orderByRaw('estimated_completed_at IS NULL, estimated_completed_at ASC')
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (MaintenanceRecord $record) => $this->row($record));

        $units = VehicleUnit::query()
            ->with('vehicle:id,name')
            ->orderBy('unit_code')
            ->get(['id', 'vehicle_id', 'unit_code', 'plate_number', 'status'])
            ->map(fn (VehicleUnit $unit) => [
                'id' => $unit->id,
                'unit_code' => $unit->unit_code,
                'plate_number' => $unit->plate_number,
                'vehicle_name' => $unit->vehicle?->name,
                'status' => $unit->status,
                'in_maintenance' => $unit->hasActiveMaintenance(),
            ])->all();

        return Inertia::render('admin/repairs/index', [
            'repairs' => $repairs,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'priority' => $priority,
                'overdue' => $overdueOnly ? '1' : null,
            ],
            'statusLabels' => self::STATUS_LABELS,
            'priorityLabels' => self::PRIORITY_LABELS,
            'statusCounts' => $statusCounts,
            'units' => $units,
        ]);
    }

    public function show(MaintenanceRecord $maintenance): Response
    {
        $maintenance->load(['unit.vehicle:id,name', 'booking:id,booking_code,customer_name,customer_phone,status', 'damageRecord']);

        return Inertia::render('admin/repairs/show', [
            'repair' => $this->detail($maintenance),
            'statusLabels' => self::STATUS_LABELS,
            'priorityLabels' => self::PRIORITY_LABELS,
        ]);
    }

    /** Perbaikan manual tanpa booking — mis. motor belum disewakan tapi rusak. */
    public function storeStandalone(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'vehicle_unit_id' => ['required', 'integer', 'exists:vehicle_units,id'],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'cost' => ['required', 'integer', 'min:0', 'max:100000000'],
            'priority' => ['nullable', 'in:rendah,sedang,tinggi,darurat'],
            'estimated_completed_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'vehicle_unit_id.required' => 'Pilih unit kendaraan.',
            'title.required' => 'Judul perbaikan wajib diisi.',
            'cost.required' => 'Biaya perbaikan wajib diisi.',
            'cost.integer' => 'Biaya harus berupa angka.',
            'cost.min' => 'Biaya tidak boleh negatif.',
            'priority.in' => 'Prioritas tidak valid.',
            'estimated_completed_at.date' => 'Estimasi selesai tidak valid.',
        ]);

        $unit = VehicleUnit::findOrFail($data['vehicle_unit_id']);

        $record = DB::transaction(function () use ($data, $unit, $request) {
            $lockedUnit = VehicleUnit::whereKey($unit->id)->lockForUpdate()->firstOrFail();

            $inUse = $lockedUnit->bookings()->where('status', 'active')->exists();
            abort_if($inUse, 422, "Unit {$lockedUnit->unit_code} sedang dipakai rental aktif.");

            return MaintenanceRecord::create([
                'vehicle_unit_id' => $lockedUnit->id,
                'booking_id' => null,
                'damage_record_id' => null,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'cost' => $data['cost'],
                'priority' => $data['priority'] ?? MaintenanceRecord::PRIORITY_SEDANG,
                'estimated_completed_at' => $data['estimated_completed_at'] ?? null,
                'status' => MaintenanceRecord::STATUS_SCHEDULED,
                'source' => MaintenanceRecord::SOURCE_MANUAL,
                'unit_status_before' => $lockedUnit->status,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);
        });

        return redirect()->route('admin.repairs.show', $record->id)
            ->with('success', "Perbaikan '{$record->title}' dijadwalkan untuk unit {$unit->unit_code}.");
    }

    /** Koreksi biaya / prioritas / estimasi selama masih berjalan. */
    public function update(Request $request, MaintenanceRecord $maintenance): RedirectResponse
    {
        abort_unless($maintenance->isActive(), 422, 'Hanya perbaikan aktif yang dapat diubah.');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'cost' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'priority' => ['nullable', 'in:rendah,sedang,tinggi,darurat'],
            'estimated_completed_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'priority.in' => 'Prioritas tidak valid.',
            'estimated_completed_at.date' => 'Estimasi selesai tidak valid.',
        ]);

        $maintenance->update(array_filter($data, fn ($v) => $v !== null) + ['notes' => $data['notes'] ?? $maintenance->notes]);

        return redirect()->back()->with('success', 'Data perbaikan diperbarui.');
    }

    public function store(StoreMaintenanceRequest $request, Booking $booking): RedirectResponse
    {
        // Default ke unit yang dipakai booking ini bila tidak disebut eksplisit.
        $unitId = $request->validated('vehicle_unit_id') ?? $booking->vehicle_unit_id;
        abort_unless($unitId, 422, 'Booking ini belum memiliki unit yang ditugaskan.');

        $unit = VehicleUnit::findOrFail($unitId);
        abort_if($unit->vehicle_id !== $booking->vehicle_id, 403, 'Unit tidak sesuai dengan kendaraan booking ini.');

        $record = DB::transaction(function () use ($request, $booking, $unit) {
            $lockedUnit = VehicleUnit::whereKey($unit->id)->lockForUpdate()->firstOrFail();

            // Maintenance tidak boleh dibuat untuk unit yang sedang dipakai rental aktif.
            $inUse = $lockedUnit->bookings()
                ->where('status', 'active')
                ->whereKeyNot($booking->id)
                ->exists();
            abort_if($inUse, 422, "Unit {$lockedUnit->unit_code} sedang dipakai rental aktif.");

            return MaintenanceRecord::create([
                'vehicle_unit_id' => $lockedUnit->id,
                'booking_id' => $booking->id,
                'damage_record_id' => $request->validated('damage_record_id'),
                'title' => $request->validated('title'),
                'description' => $request->validated('description'),
                'cost' => $request->validated('cost'),
                'priority' => $request->validated('priority') ?? MaintenanceRecord::PRIORITY_SEDANG,
                'estimated_completed_at' => $request->validated('estimated_completed_at'),
                'status' => MaintenanceRecord::STATUS_SCHEDULED,
                'source' => MaintenanceRecord::SOURCE_MANUAL,
                'unit_status_before' => $lockedUnit->status,
                'created_by' => $request->user()->id,
            ]);
        });

        return redirect()->back()->with('success', "Maintenance '{$record->title}' dijadwalkan untuk unit {$unit->unit_code}.");
    }

    public function transition(Request $request, MaintenanceRecord $maintenance): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:scheduled,in_progress,completed,cancelled'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        abort_unless($maintenance->canTransitionTo($data['status']), 422, 'Perubahan status maintenance tidak valid.');

        DB::transaction(function () use ($maintenance, $data) {
            $locked = MaintenanceRecord::whereKey($maintenance->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->canTransitionTo($data['status']), 422, 'Perubahan status maintenance tidak valid.');

            $updates = ['status' => $data['status']];
            if ($data['notes'] ?? null) {
                $updates['notes'] = $data['notes'];
            }

            if ($data['status'] === MaintenanceRecord::STATUS_IN_PROGRESS) {
                $updates['started_at'] = now();
                // Unit keluar dari pool ketersediaan selama perbaikan.
                if ($locked->vehicle_unit_id) {
                    VehicleUnit::whereKey($locked->vehicle_unit_id)->update(['status' => VehicleUnit::STATUS_INACTIVE]);
                }
            }

            if ($data['status'] === MaintenanceRecord::STATUS_COMPLETED) {
                $updates['completed_at'] = now();
                // Unit kembali aktif jika sebelumnya aktif.
                if ($locked->vehicle_unit_id && $locked->unit_status_before === VehicleUnit::STATUS_ACTIVE) {
                    VehicleUnit::whereKey($locked->vehicle_unit_id)->update(['status' => VehicleUnit::STATUS_ACTIVE]);
                }
            }

            $locked->update($updates);
        });

        $labels = [
            MaintenanceRecord::STATUS_IN_PROGRESS => 'dimulai. Unit tidak tersedia untuk booking baru.',
            MaintenanceRecord::STATUS_COMPLETED => 'selesai. Unit kembali tersedia.',
            MaintenanceRecord::STATUS_CANCELLED => 'dibatalkan.',
            MaintenanceRecord::STATUS_SCHEDULED => 'dijadwalkan ulang.',
        ];

        return redirect()->back()->with('success', 'Maintenance '.$labels[$data['status']]);
    }

    /** @return array<string, mixed> */
    private function row(MaintenanceRecord $record): array
    {
        return [
            'id' => $record->id,
            'title' => $record->title,
            'unit_code' => $record->unit?->unit_code,
            'plate_number' => $record->unit?->plate_number,
            'vehicle_name' => $record->unit?->vehicle?->name,
            'booking_code' => $record->booking?->booking_code,
            'cost' => (int) $record->cost,
            'priority' => $record->priority ?? MaintenanceRecord::PRIORITY_SEDANG,
            'status' => $record->status,
            'damage_count' => $this->groupDamageCount($record),
            'estimated_completed_at' => $record->estimated_completed_at?->format('d M Y H:i'),
            'estimated_raw' => $record->estimated_completed_at?->format('Y-m-d\TH:i'),
            'is_overdue' => $record->isOverdue(),
            'created_at' => $record->created_at->format('d M Y H:i'),
        ];
    }

    /** @return array<string, mixed> */
    private function detail(MaintenanceRecord $record): array
    {
        return [
            ...$this->row($record),
            'description' => $record->description,
            'notes' => $record->notes,
            'started_at' => $record->started_at?->format('d M Y H:i'),
            'completed_at' => $record->completed_at?->format('d M Y H:i'),
            'booking' => $record->booking ? [
                'booking_code' => $record->booking->booking_code,
                'customer_name' => $record->booking->customer_name,
                'customer_phone' => $record->booking->customer_phone,
                'status' => $record->booking->status,
            ] : null,
            'damage' => $record->damageRecord ? [
                'id' => $record->damageRecord->id,
                'title' => $record->damageRecord->title,
                'photo_url' => $record->damageRecord->photoUrl(),
            ] : null,
            'damages' => $this->groupDamages($record),
        ];
    }

    /** Jumlah kerusakan dalam grup yang sama (booking+unit). */
    private function groupDamageCount(MaintenanceRecord $record): int
    {
        if (! $record->isAuto() || ! $record->booking_id || ! $record->vehicle_unit_id) {
            return $record->damage_record_id ? 1 : 0;
        }

        return DamageRecord::where('booking_id', $record->booking_id)
            ->where('vehicle_unit_id', $record->vehicle_unit_id)
            ->count();
    }

    /** @return list<array<string, mixed>> */
    private function groupDamages(MaintenanceRecord $record): array
    {
        if (! $record->isAuto() || ! $record->booking_id || ! $record->vehicle_unit_id) {
            return [];
        }

        return DamageRecord::where('booking_id', $record->booking_id)
            ->where('vehicle_unit_id', $record->vehicle_unit_id)
            ->orderBy('id')
            ->get()
            ->map(fn (DamageRecord $d) => [
                'id' => $d->id,
                'title' => $d->title,
                'description' => $d->description,
                'repair_cost' => (int) $d->repair_cost,
                'photo_url' => $d->photoUrl(),
            ])->all();
    }
}
