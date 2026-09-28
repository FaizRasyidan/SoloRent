<?php

namespace App\Services\Reports;

use App\Models\Booking;
use App\Models\MaintenanceRecord;
use App\Support\Reports\ReportPeriod;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Analitik bisnis Phase 9 (demand, customer, maintenance, comparison).
 * READ-ONLY: hanya SELECT. Memakai ulang ReportService sebagai satu-satunya
 * sumber kebenaran finansial; hanya helper rangeUtc yang diduplikasi
 * (4 baris) agar tidak membuka visibilitas private milik ReportService.
 */
class BusinessAnalyticsService
{
    public function __construct(private ReportService $reports) {}

    /** @return array{0: Carbon, 1: Carbon} */
    private function rangeUtc(ReportPeriod $period): array
    {
        return [
            $period->from->copy()->timezone('UTC'),
            $period->to->copy()->timezone('UTC'),
        ];
    }

    public function previousPeriod(ReportPeriod $period): ReportPeriod
    {
        $days = $period->days();
        $to = $period->from->copy()->subDay()->endOfDay();
        $from = $to->copy()->subDays($days - 1)->startOfDay();

        return new ReportPeriod($from, $to, 'custom', ReportPeriod::GROUP_DAY);
    }

    /** Periode N hari terakhir (untuk insight berbasis jendela). */
    public function windowPeriod(int $days): ReportPeriod
    {
        $tz = ReportPeriod::TIMEZONE;
        $to = Carbon::now($tz)->endOfDay();
        $from = $to->copy()->subDays($days - 1)->startOfDay();

        return new ReportPeriod($from, $to, 'custom', ReportPeriod::GROUP_DAY);
    }

    /**
     * Perbandingan periode berjalan vs periode sebelumnya dengan panjang sama.
     * change_pct memakai rumus ((cur - prev) / prev × 100), null bila prev = 0.
     *
     * @return array<string, mixed>
     */
    public function comparison(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);
        $prev = $this->previousPeriod($period);
        [$prevFromUtc, $prevToUtc] = $this->rangeUtc($prev);

        $curBookings = Booking::query()->whereBetween('created_at', [$fromUtc, $toUtc])->count();
        $prevBookings = Booking::query()->whereBetween('created_at', [$prevFromUtc, $prevToUtc])->count();

        $curFin = $this->reports->financial($period, $category, $vehicleId);
        $prevFin = $this->reports->financial($prev, $category, $vehicleId);

        return [
            'booking_current' => $curBookings,
            'booking_previous' => $prevBookings,
            'booking_change_pct' => $prevBookings > 0
                ? round(($curBookings - $prevBookings) / $prevBookings * 100, 2)
                : null,
            'revenue_current' => $curFin['netBookingRevenue'],
            'revenue_previous' => $prevFin['netBookingRevenue'],
            'revenue_change_pct' => $prevFin['netBookingRevenue'] != 0
                ? round(($curFin['netBookingRevenue'] - $prevFin['netBookingRevenue']) / abs($prevFin['netBookingRevenue']) * 100, 2)
                : null,
            'previous' => $prev->toArray(),
        ];
    }

    /**
     * Agregat demand: tren harian (reuse ReportService), akhir pekan vs
     * hari kerja, per kategori, per kendaraan.
     *
     * @return array<string, mixed>
     */
    public function demand(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        $booking = $this->reports->booking($period, $category, $vehicleId);
        $weekend = $this->weekendSplit($period, $category, $vehicleId);
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $byCategory = Booking::query()
            ->selectRaw('vehicles.category as category, COUNT(*) as c')
            ->join('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->whereBetween('bookings.created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('bookings.vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->where('vehicles.category', $category))
            ->groupBy('vehicles.category')
            ->pluck('c', 'category')
            ->map(fn ($v) => (int) $v)
            ->all();

        $byVehicle = Booking::query()
            ->selectRaw('bookings.vehicle_id as vehicle_id, vehicles.name as name, COUNT(*) as c')
            ->join('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->whereBetween('bookings.created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('bookings.vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->where('vehicles.category', $category))
            ->groupBy('bookings.vehicle_id', 'vehicles.name')
            ->orderByDesc('c')
            ->limit(10)
            ->get()
            ->map(fn (Booking $row) => [
                'vehicle_id' => (int) $row->getAttribute('vehicle_id'),
                'name' => (string) $row->getAttribute('name'),
                'bookings' => (int) $row->getAttribute('c'),
            ])
            ->all();

        return [
            'trend' => $booking['trend'],
            'total' => $booking['counts']['total'] ?? 0,
            'weekend' => $weekend,
            'by_category' => $byCategory,
            'by_vehicle' => $byVehicle,
            'basis' => $booking['basis'],
        ];
    }

    /**
     * Split akhir pekan (Sabtu–Minggu) vs hari kerja (Senin–Jumat)
     * berdasarkan created_at dalam zona Asia/Jakarta.
     *
     * @return array<string, mixed>
     */
    public function weekendSplit(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);
        $tz = ReportPeriod::TIMEZONE;

        $rows = Booking::query()
            ->select(['created_at'])
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->get(['created_at']);

        $weekend = 0;
        $weekday = 0;
        foreach ($rows as $booking) {
            /** @var Carbon|null $at */
            $at = $booking->getAttribute('created_at');
            if ($at === null) {
                continue;
            }
            $dow = $at->copy()->timezone($tz)->dayOfWeekIso; // 1=Senin..7=Minggu
            if ($dow >= 6) {
                $weekend++;
            } else {
                $weekday++;
            }
        }

        // Jumlah hari Sabtu/Minggu vs Senin–Jumat dalam periode (denominator rata-rata).
        $weekendDays = 0;
        $weekdayDays = 0;
        $cursor = $period->from->copy()->timezone($tz)->startOfDay();
        $end = $period->to->copy()->timezone($tz)->startOfDay();
        while ($cursor->lessThanOrEqualTo($end)) {
            if ($cursor->dayOfWeekIso >= 6) {
                $weekendDays++;
            } else {
                $weekdayDays++;
            }
            $cursor = $cursor->copy()->addDay();
        }

        $weekendAvg = $weekendDays > 0 ? $weekend / $weekendDays : 0.0;
        $weekdayAvg = $weekdayDays > 0 ? $weekday / $weekdayDays : 0.0;

        return [
            'weekend_count' => $weekend,
            'weekday_count' => $weekday,
            'weekend_days' => $weekendDays,
            'weekday_days' => $weekdayDays,
            'weekend_avg' => round($weekendAvg, 2),
            'weekday_avg' => round($weekdayAvg, 2),
            'ratio' => $weekdayAvg > 0 ? round($weekendAvg / $weekdayAvg, 2) : null,
        ];
    }

    /**
     * Statistik customer berbasis customer_phone sebagai identitas
     * (tidak ada tabel customers).
     *
     * @return array<string, mixed>
     */
    public function customerStats(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $grouped = Booking::query()
            ->selectRaw('customer_phone, COUNT(*) as c')
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->groupBy('customer_phone')
            ->pluck('c', 'customer_phone');

        $totalCustomers = $grouped->count();
        $repeatCustomers = $grouped->filter(fn ($c) => (int) $c >= 2)->count();
        $totalBookings = (int) $grouped->sum(fn ($c) => (int) $c);

        $avgDuration = Booking::query()
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->avg('duration_days');

        $avgValue = Booking::query()
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->avg('total');

        $top = $this->reports->customers($period, $category, $vehicleId, 10);

        return [
            'total_bookings' => $totalBookings,
            'total_customers' => $totalCustomers,
            'repeat_customers' => $repeatCustomers,
            'repeat_pct' => $totalCustomers > 0 ? round($repeatCustomers / $totalCustomers * 100, 1) : 0.0,
            'avg_duration' => $avgDuration !== null ? round((float) $avgDuration, 1) : 0.0,
            'avg_value' => $avgValue !== null ? (int) round((float) $avgValue) : 0,
            'top' => $top['rows'],
            'basis' => $top['basis'],
        ];
    }

    /**
     * Statistik maintenance per unit dalam periode.
     *
     * @return array<string, mixed>
     */
    public function maintenanceStats(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);
        $tz = ReportPeriod::TIMEZONE;
        $fromDate = $period->fromDateString();
        $toDate = $period->toDateString();

        $records = MaintenanceRecord::query()
            ->with(['unit:id,unit_code,vehicle_id', 'unit.vehicle:id,name'])
            ->whereBetween('maintenance_records.created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null || $category !== null, function ($q) use ($vehicleId, $category) {
                $q->whereHas('unit.vehicle', function ($vq) use ($vehicleId, $category) {
                    if ($vehicleId !== null) {
                        $vq->where('vehicles.id', $vehicleId);
                    }
                    if ($category !== null) {
                        $vq->where('vehicles.category', $category);
                    }
                });
            })
            ->get();

        $perUnit = [];
        $totalDays = 0;
        $totalCost = 0;
        foreach ($records as $record) {
            $days = $this->recordDays($record, $fromDate, $toDate, $tz);
            $totalDays += $days;
            $totalCost += (int) $record->getAttribute('cost');
            $unitId = $record->getAttribute('vehicle_unit_id');
            $unit = $record->getRelationValue('unit');
            $vehicle = $unit?->getRelationValue('vehicle');
            $key = $unitId !== null ? (string) $unitId : 'unknown';
            if (! isset($perUnit[$key])) {
                $perUnit[$key] = [
                    'unit_id' => $unitId,
                    'unit_code' => $unit?->getAttribute('unit_code') ?? '—',
                    'vehicle_name' => $vehicle?->getAttribute('name') ?? '—',
                    'records' => 0,
                    'days' => 0,
                    'cost' => 0,
                ];
            }
            $perUnit[$key]['records']++;
            $perUnit[$key]['days'] += $days;
            $perUnit[$key]['cost'] += (int) $record->getAttribute('cost');
        }

        $rows = array_values($perUnit);
        usort($rows, fn ($a, $b) => $b['days'] <=> $a['days'] ?: $b['records'] <=> $a['records']);

        return [
            'count' => $records->count(),
            'days' => $totalDays,
            'cost' => $totalCost,
            'units' => count($rows),
            'per_unit' => $rows,
        ];
    }

    private function recordDays(MaintenanceRecord $record, string $fromDate, string $toDate, string $tz): int
    {
        $startedRaw = $record->getAttribute('started_at');
        $completedRaw = $record->getAttribute('completed_at');
        $estimatedRaw = $record->getAttribute('estimated_completed_at');

        $start = $startedRaw instanceof CarbonInterface
            ? Carbon::parse($startedRaw, $tz)->toDateString()
            : (is_string($startedRaw) && $startedRaw !== '' ? Carbon::parse($startedRaw, $tz)->toDateString() : $record->created_at->copy()->timezone($tz)->toDateString());

        if ($completedRaw instanceof CarbonInterface) {
            $end = Carbon::parse($completedRaw, $tz)->toDateString();
        } elseif (is_string($completedRaw) && $completedRaw !== '') {
            $end = Carbon::parse($completedRaw, $tz)->toDateString();
        } elseif ($estimatedRaw instanceof CarbonInterface) {
            $end = Carbon::parse($estimatedRaw, $tz)->toDateString();
        } elseif (is_string($estimatedRaw) && $estimatedRaw !== '') {
            $end = Carbon::parse($estimatedRaw, $tz)->toDateString();
        } elseif ($record->isActive()) {
            $end = $toDate;
        } else {
            $end = $start;
        }

        $clampedStart = max($start, $fromDate);
        $clampedEnd = min($end, $toDate);
        if ($clampedEnd < $clampedStart) {
            return 0;
        }

        return (int) (Carbon::parse($clampedStart)->diffInDays(Carbon::parse($clampedEnd)) + 1);
    }
}
