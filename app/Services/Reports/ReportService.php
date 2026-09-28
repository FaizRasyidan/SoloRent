<?php

namespace App\Services\Reports;

use App\Models\Booking;
use App\Models\Cancellation;
use App\Models\DamageCharge;
use App\Models\Driver;
use App\Models\MaintenanceRecord;
use App\Models\OperationalTask;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Vehicle;
use App\Models\VehicleUnit;
use App\Support\Reports\DateBucket;
use App\Support\Reports\ReportPeriod;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Pusat agregasi laporan Phase 8. READ-ONLY: seluruh method hanya
 * SELECT (COUNT/SUM/GROUP BY). Tidak ada penulisan ke workflow
 * Phase 1–7A.
 *
 * Konvensi tanggal:
 * - Basis hari = Asia/Jakarta. Kolom datetime (created_at, paid_at,
 *   processed_at) difilter memakai batas UTC yang ekuivalen dengan
 *   hari Jakarta, dan dikelompokkan memakai ekspresi SQL yang
 *   mengkonversi UTC → +07:00 (lihat DateBucket::dayExpressionTz).
 * - Kolom DATE (start_date/end_date) tidak punya jam: dipakai langsung.
 */
class ReportService
{
    // ---------- Helpers ----------

    /** @return array{0: Carbon, 1: Carbon} batas UTC ekuivalen hari Jakarta */
    private function rangeUtc(ReportPeriod $period): array
    {
        return [
            $period->from->copy()->timezone('UTC'),
            $period->to->copy()->timezone('UTC'),
        ];
    }

    /** @param  Builder<Booking>  $query  @return Builder<Booking> */
    private function applyBookingVehicleFilter(Builder $query, ?string $category, ?int $vehicleId): Builder
    {
        if ($vehicleId !== null) {
            $query->where('bookings.vehicle_id', $vehicleId);
        }
        if ($category !== null) {
            $query->whereHas('vehicle', fn ($q) => $q->where('category', $category));
        }

        return $query;
    }

    /** @param  Builder<Payment>  $query  @return Builder<Payment> */
    private function applyPaymentVehicleFilter(Builder $query, ?string $category, ?int $vehicleId): Builder
    {
        if ($vehicleId === null && $category === null) {
            return $query;
        }

        return $query->whereHas('booking', function ($bq) use ($category, $vehicleId) {
            if ($vehicleId !== null) {
                $bq->where('bookings.vehicle_id', $vehicleId);
            }
            if ($category !== null) {
                $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
            }
        });
    }

    /** @param  Builder<Refund>  $query  @return Builder<Refund> */
    private function applyRefundVehicleFilter(Builder $query, ?string $category, ?int $vehicleId): Builder
    {
        if ($vehicleId === null && $category === null) {
            return $query;
        }

        return $query->whereHas('booking', function ($bq) use ($category, $vehicleId) {
            if ($vehicleId !== null) {
                $bq->where('bookings.vehicle_id', $vehicleId);
            }
            if ($category !== null) {
                $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
            }
        });
    }

    /** @param  Builder<DamageCharge>  $query  @return Builder<DamageCharge> */
    private function applyDamageVehicleFilter(Builder $query, ?string $category, ?int $vehicleId): Builder
    {
        if ($vehicleId === null && $category === null) {
            return $query;
        }

        return $query->whereHas('booking', function ($bq) use ($category, $vehicleId) {
            if ($vehicleId !== null) {
                $bq->where('bookings.vehicle_id', $vehicleId);
            }
            if ($category !== null) {
                $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
            }
        });
    }

    private function categoryLabel(?string $category): string
    {
        return match ($category) {
            'motor' => 'Motor',
            'mobil' => 'Mobil',
            default => 'Semua kendaraan',
        };
    }

    // ---------- Overview ----------

    /** @return array<string, mixed> */
    public function overview(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $bookingQuery = $this->applyBookingVehicleFilter(Booking::query(), $category, $vehicleId)
            ->whereBetween('bookings.created_at', [$fromUtc, $toUtc]);

        $totalBooking = (clone $bookingQuery)->count();
        $cancelled = (clone $bookingQuery)->where('bookings.status', 'cancelled')->count();
        $completed = (clone $bookingQuery)->where('bookings.status', 'completed')->count();
        $active = (clone $bookingQuery)->where('bookings.status', 'active')->count();

        // Unit disewa saat ini (bukan dibatasi periode): booking aktif yang
        // periode sewanya mencakup hari ini (basis operasional).
        $today = Carbon::now(ReportPeriod::TIMEZONE)->toDateString();
        $unitsRented = $this->applyBookingVehicleFilter(Booking::query(), $category, $vehicleId)
            ->where('bookings.status', 'active')
            ->where('bookings.start_date', '<=', $today)
            ->where('bookings.end_date', '>=', $today)
            ->count();

        $financial = $this->financial($period, $category, $vehicleId);
        $operational = $this->operationalSnapshot($category, $vehicleId);

        $cancellationRate = $totalBooking > 0 ? round($cancelled / $totalBooking * 100, 1) : 0.0;

        return [
            'kpis' => [
                'totalBooking' => $totalBooking,
                'netRevenue' => $financial['netBookingRevenue'],
                'refundCompleted' => $financial['refundedAmount'],
                'damagePaid' => $financial['damagePaid'],
                'unitsRented' => $unitsRented,
                'cancelled' => $cancelled,
                'cancellationRate' => $cancellationRate,
                'completed' => $completed,
                'active' => $active,
            ],
            'accounting' => $financial,
            'operational' => $operational,
            'basis' => $this->basis($period, $category, $vehicleId),
        ];
    }

    /** @return array<string, mixed> */
    private function operationalSnapshot(?string $category, ?int $vehicleId): array
    {
        $vehicleQuery = Vehicle::query()
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicles.id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->where('vehicles.category', $category));

        $totalTypes = (clone $vehicleQuery)->count();
        $totalUnits = (int) (clone $vehicleQuery)->sum('vehicles.stock');

        $maintenanceUnits = MaintenanceRecord::query()
            ->whereIn('status', [MaintenanceRecord::STATUS_SCHEDULED, MaintenanceRecord::STATUS_IN_PROGRESS])
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
            ->distinct('vehicle_unit_id')
            ->count('vehicle_unit_id');

        $driversAvailable = Driver::where('status', Driver::STATUS_ACTIVE)->count();
        $driversAssigned = Driver::where('status', Driver::STATUS_WORKING)->count();

        return [
            'totalTypes' => $totalTypes,
            'totalUnits' => $totalUnits,
            'maintenanceUnits' => $maintenanceUnits,
            'driversAvailable' => $driversAvailable,
            'driversAssigned' => $driversAssigned,
        ];
    }

    // ---------- Financial (sumber kebenaran tunggal) ----------

    /** @return array<string, int> */
    public function financial(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $gross = (int) $this->applyPaymentVehicleFilter(
            Payment::query()->where('status', Payment::STATUS_PAID)
                ->where('type', '!=', Payment::TYPE_DAMAGE)
                ->whereBetween('paid_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->sum('amount');

        $refunded = (int) $this->applyRefundVehicleFilter(
            Refund::query()->where('status', Refund::STATUS_COMPLETED)
                ->whereBetween('processed_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->sum('amount');

        $refundInProcess = (int) $this->applyRefundVehicleFilter(
            Refund::query()->whereIn('status', [Refund::STATUS_PENDING, Refund::STATUS_PROCESSING])
                ->whereBetween('created_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->sum('amount');

        $damagePaid = (int) Payment::query()
            ->where('type', Payment::TYPE_DAMAGE)
            ->where('status', Payment::STATUS_PAID)
            ->whereBetween('paid_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null || $category !== null, function ($q) use ($vehicleId, $category) {
                $q->whereHas('damageCharge.booking', function ($bq) use ($vehicleId, $category) {
                    if ($vehicleId !== null) {
                        $bq->where('bookings.vehicle_id', $vehicleId);
                    }
                    if ($category !== null) {
                        $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
                    }
                });
            })
            ->sum('amount');

        $damageCharged = (int) $this->applyDamageVehicleFilter(
            DamageCharge::query()
                ->whereNotIn('status', [DamageCharge::STATUS_WAIVED, DamageCharge::STATUS_CANCELLED])
                ->whereBetween('created_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->sum('total');

        // Bagian yang tertahan dari booking batal: gross paid pada booking
        // cancelled (paid_at ∈ P) dikurangi refund completed-nya
        // (processed_at ∈ P). Ditampilkan sebagai baris sendiri agar aturan
        // pengakuan terlihat, bukan disembunyikan di dalam net.
        $grossOnCancelled = (int) $this->applyPaymentVehicleFilter(
            Payment::query()->where('status', Payment::STATUS_PAID)
                ->where('type', '!=', Payment::TYPE_DAMAGE)
                ->whereBetween('paid_at', [$fromUtc, $toUtc])
                ->whereHas('booking', fn ($bq) => $bq->where('status', 'cancelled')),
            $category, $vehicleId
        )->sum('amount');

        $refundedOnCancelled = (int) $this->applyRefundVehicleFilter(
            Refund::query()->where('status', Refund::STATUS_COMPLETED)
                ->whereBetween('processed_at', [$fromUtc, $toUtc])
                ->whereHas('booking', fn ($bq) => $bq->where('status', 'cancelled')),
            $category, $vehicleId
        )->sum('amount');

        $cancelledRetained = max(0, $grossOnCancelled - $refundedOnCancelled);

        return [
            'grossPaidBooking' => $gross,
            'refundedAmount' => $refunded,
            'netBookingRevenue' => $gross - $refunded,
            'refundInProcess' => $refundInProcess,
            'damageCharged' => $damageCharged,
            'damagePaid' => $damagePaid,
            'totalCustomerPayments' => $gross + $damagePaid,
            'cancelledRetained' => $cancelledRetained,
        ];
    }

    // ---------- Booking ----------

    /** @return array<string, mixed> */
    public function booking(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $base = $this->applyBookingVehicleFilter(Booking::query(), $category, $vehicleId)
            ->whereBetween('bookings.created_at', [$fromUtc, $toUtc]);

        $counts = ['total' => (clone $base)->count()];
        foreach (['pending', 'confirmed', 'preparing', 'active', 'completed', 'cancelled'] as $status) {
            $counts[$status] = (clone $base)->where('bookings.status', $status)->count();
        }

        $dayExpr = DateBucket::dayExpressionTz('bookings.created_at');
        $daily = (clone $base)
            ->selectRaw("{$dayExpr} as day, COUNT(*) as c")
            ->groupBy('day')
            ->pluck('c', 'day')
            ->map(fn ($v) => (int) $v)
            ->all();

        $buckets = DateBucket::buckets($period, $period->grouping);
        $trend = DateBucket::rollup($daily, $buckets, $period->grouping);

        return [
            'counts' => $counts,
            'trend' => array_map(fn (array $row) => [
                'key' => $row['key'],
                'label' => $row['label'],
                'count' => $row['value'],
            ], $trend),
            'basis' => $this->basis($period, $category, $vehicleId, 'bookings.created_at'),
        ];
    }

    /**
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    public function bookingRows(
        ReportPeriod $period,
        ?string $category = null,
        ?int $vehicleId = null,
        ?string $status = null,
        ?string $search = null,
        int $perPage = 15,
    ): LengthAwarePaginator {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $query = Booking::query()
            ->with(['vehicle:id,name,category'])
            ->withSum(['payments as paid_sum' => fn ($q) => $q
                ->where('status', Payment::STATUS_PAID)
                ->where('type', '!=', Payment::TYPE_DAMAGE)], 'amount')
            ->withSum(['refunds as refunded_sum' => fn ($q) => $q
                ->where('status', Refund::STATUS_COMPLETED)], 'amount')
            ->withSum(['damageCharges as damage_sum' => fn ($q) => $q
                ->whereNotIn('status', [DamageCharge::STATUS_WAIVED, DamageCharge::STATUS_CANCELLED])], 'total')
            ->whereBetween('bookings.created_at', [$fromUtc, $toUtc])
            ->when($status, fn ($q) => $q->where('bookings.status', $status))
            ->when($search, fn ($q) => $q->where(fn ($qq) => $qq
                ->where('booking_code', 'like', "%{$search}%")
                ->orWhere('customer_name', 'like', "%{$search}%")
                ->orWhere('customer_phone', 'like', "%{$search}%")))
            ->latest();

        $this->applyBookingVehicleFilter($query, $category, $vehicleId);

        return $query->paginate($perPage)->withQueryString()->through(function (Booking $booking) {
            /** @var Vehicle|null $vehicle */
            $vehicle = $booking->getRelationValue('vehicle');

            return [
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer_name,
                'customer_phone' => $booking->customer_phone,
                'vehicle_name' => $vehicle?->name,
                'vehicle_category' => $vehicle?->category,
                'start_date' => $this->dateString($booking->getAttribute('start_date')),
                'end_date' => $this->dateString($booking->getAttribute('end_date')),
                'duration_days' => $booking->duration_days,
                'total' => (int) $booking->total,
                'paid' => (int) ($booking->getAttribute('paid_sum') ?? 0),
                'refunded' => (int) ($booking->getAttribute('refunded_sum') ?? 0),
                'damage' => (int) ($booking->getAttribute('damage_sum') ?? 0),
                'status' => $booking->status,
                'payment_status' => $booking->payment_status ?? 'unpaid',
                'created_at' => $booking->created_at->format('d M Y H:i'),
            ];
        });
    }

    /** @return array<string, mixed> */
    public function customers(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null, int $limit = 10): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $bookingAgg = Booking::query()
            ->selectRaw('customer_phone, MAX(customer_name) as customer_name, COUNT(*) as total_booking, '
                ."SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, "
                ."SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->groupBy('customer_phone')
            ->get()
            ->keyBy('customer_phone');

        $paidAgg = Payment::query()
            ->selectRaw('bookings.customer_phone as customer_phone, SUM(payments.amount) as total_paid')
            ->join('bookings', 'bookings.id', '=', 'payments.booking_id')
            ->where('payments.status', Payment::STATUS_PAID)
            ->where('payments.type', '!=', Payment::TYPE_DAMAGE)
            ->whereBetween('payments.paid_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('bookings.vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('booking.vehicle', fn ($vq) => $vq->where('category', $category)))
            ->groupBy('bookings.customer_phone')
            ->pluck('total_paid', 'customer_phone');

        $rows = $bookingAgg->map(function (Booking $row) use ($paidAgg) {
            $phone = (string) $row->getAttribute('customer_phone');

            return [
                'customer_name' => (string) $row->getAttribute('customer_name'),
                'customer_phone' => $phone,
                'total_booking' => (int) $row->getAttribute('total_booking'),
                'completed' => (int) $row->getAttribute('completed'),
                'cancelled' => (int) $row->getAttribute('cancelled'),
                'total_spent' => (int) ($paidAgg[$phone] ?? 0),
            ];
        })->sortByDesc('total_spent')->values()->take($limit)->all();

        return [
            'rows' => $rows,
            'basis' => $this->basis($period, $category, $vehicleId, 'customer_phone sebagai identitas'),
        ];
    }

    // ---------- Revenue ----------

    /** @return array<string, mixed> */
    public function revenue(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);
        $financial = $this->financial($period, $category, $vehicleId);

        $grossExpr = DateBucket::dayExpressionTz('payments.paid_at');
        $grossDaily = $this->applyPaymentVehicleFilter(
            Payment::query()->where('status', Payment::STATUS_PAID)
                ->where('type', '!=', Payment::TYPE_DAMAGE)
                ->whereBetween('paid_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->selectRaw("{$grossExpr} as day, SUM(amount) as s")->groupBy('day')
            ->pluck('s', 'day')->map(fn ($v) => (int) $v)->all();

        $refundExpr = DateBucket::dayExpressionTz('refunds.processed_at');
        $refundDaily = $this->applyRefundVehicleFilter(
            Refund::query()->where('status', Refund::STATUS_COMPLETED)
                ->whereBetween('processed_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->selectRaw("{$refundExpr} as day, SUM(amount) as s")->groupBy('day')
            ->pluck('s', 'day')->map(fn ($v) => (int) $v)->all();

        $damageExpr = DateBucket::dayExpressionTz('payments.paid_at');
        $damageDaily = Payment::query()
            ->where('type', Payment::TYPE_DAMAGE)
            ->where('status', Payment::STATUS_PAID)
            ->whereBetween('paid_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null || $category !== null, function ($q) use ($vehicleId, $category) {
                $q->whereHas('damageCharge.booking', function ($bq) use ($vehicleId, $category) {
                    if ($vehicleId !== null) {
                        $bq->where('bookings.vehicle_id', $vehicleId);
                    }
                    if ($category !== null) {
                        $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
                    }
                });
            })
            ->selectRaw("{$damageExpr} as day, SUM(amount) as s")->groupBy('day')
            ->pluck('s', 'day')->map(fn ($v) => (int) $v)->all();

        $days = array_unique(array_merge(array_keys($grossDaily), array_keys($refundDaily), array_keys($damageDaily)));
        $daily = [];
        foreach ($days as $day) {
            $daily[$day] = [
                'gross' => (int) ($grossDaily[$day] ?? 0),
                'refund' => (int) ($refundDaily[$day] ?? 0),
                'damage' => (int) ($damageDaily[$day] ?? 0),
            ];
        }

        $buckets = DateBucket::buckets($period, $period->grouping);
        $trend = DateBucket::rollupMulti($daily, $buckets, $period->grouping, ['gross', 'refund', 'damage']);
        $trend = array_map(fn (array $row) => [
            'key' => $row['key'],
            'label' => $row['label'],
            'gross' => $row['gross'],
            'refund' => $row['refund'],
            'net' => $row['gross'] - $row['refund'],
            'damage' => $row['damage'],
        ], $trend);

        // Payment report: hitung status dari payment yang DIBUAT pada periode.
        $payBase = $this->applyPaymentVehicleFilter(
            Payment::query()->where('type', '!=', Payment::TYPE_DAMAGE)
                ->whereBetween('created_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        );
        $paymentCounts = [
            'total' => (clone $payBase)->count(),
            'paid' => (clone $payBase)->where('status', Payment::STATUS_PAID)->count(),
            'pending' => (clone $payBase)->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUBMITTED])->count(),
            'failed' => (clone $payBase)->where('status', Payment::STATUS_REJECTED)->count(),
            'expired' => (clone $payBase)->whereIn('status', [Payment::STATUS_EXPIRED, Payment::STATUS_CANCELLED])->count(),
        ];

        $methodExpr = $this->applyPaymentVehicleFilter(
            Payment::query()->where('status', Payment::STATUS_PAID)
                ->where('type', '!=', Payment::TYPE_DAMAGE)
                ->whereBetween('paid_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->selectRaw('method, COUNT(*) as c, SUM(amount) as s')->groupBy('method')->get();

        $methods = $methodExpr->map(fn (Payment $row) => [
            'method' => (string) $row->getAttribute('method'),
            'label' => $this->paymentMethodLabel((string) $row->getAttribute('method')),
            'count' => (int) $row->getAttribute('c'),
            'total' => (int) $row->getAttribute('s'),
        ])->sortByDesc('total')->values()->all();

        return [
            'financial' => $financial,
            'trend' => $trend,
            'payments' => $paymentCounts,
            'methods' => $methods,
            'basis' => $this->basis($period, $category, $vehicleId, 'payments.paid_at & refunds.processed_at'),
        ];
    }

    private function paymentMethodLabel(string $method): string
    {
        return match ($method) {
            'bank_transfer' => 'Bank Transfer',
            'cash' => 'Cash',
            default => ucfirst(str_replace('_', ' ', $method)),
        };
    }

    // ---------- Vehicles ----------

    /** @return array<string, mixed> */
    public function vehicles(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);
        $fromDate = $period->fromDateString();
        $toDate = $period->toDateString();
        $days = $period->days();

        $vehicleQuery = Vehicle::query()
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicles.id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->where('vehicles.category', $category))
            ->orderBy('vehicles.name');

        /** @var Collection<int, Vehicle> $vehicles */
        $vehicles = $vehicleQuery->get(['vehicles.id', 'vehicles.name', 'vehicles.category', 'vehicles.stock', 'vehicles.price_per_day']);

        $bookingCounts = Booking::query()
            ->selectRaw('vehicle_id, COUNT(*) as c')
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->where('status', '!=', 'cancelled')
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->groupBy('vehicle_id')
            ->pluck('c', 'vehicle_id');

        $allBookingCounts = Booking::query()
            ->selectRaw('vehicle_id, COUNT(*) as c')
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->groupBy('vehicle_id')
            ->pluck('c', 'vehicle_id');

        $revenueByVehicle = Payment::query()
            ->selectRaw('bookings.vehicle_id as vehicle_id, SUM(payments.amount) as s')
            ->join('bookings', 'bookings.id', '=', 'payments.booking_id')
            ->where('payments.status', Payment::STATUS_PAID)
            ->where('payments.type', '!=', Payment::TYPE_DAMAGE)
            ->whereBetween('payments.paid_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null, fn ($q) => $q->where('bookings.vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('booking.vehicle', fn ($vq) => $vq->where('category', $category)))
            ->groupBy('bookings.vehicle_id')
            ->pluck('s', 'vehicle_id');

        // Hari sewa: booking non-batal yang overlap periode (kolom DATE).
        $overlapping = Booking::query()
            ->select(['id', 'vehicle_id', 'start_date', 'end_date'])
            ->where('status', '!=', 'cancelled')
            ->where('start_date', '<=', $toDate)
            ->where('end_date', '>=', $fromDate)
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->get();

        $rentalDaysByVehicle = [];
        foreach ($overlapping as $booking) {
            $start = max($this->dateString($booking->getAttribute('start_date')), $fromDate);
            $end = min($this->dateString($booking->getAttribute('end_date')), $toDate);
            $dayCount = (int) (Carbon::parse($start)->diffInDays(Carbon::parse($end)) + 1);
            $vehicleKey = (int) $booking->getAttribute('vehicle_id');
            $rentalDaysByVehicle[$vehicleKey] = ($rentalDaysByVehicle[$vehicleKey] ?? 0) + max(0, $dayCount);
        }

        // Unit aktif per kendaraan (untuk kapasitas).
        $activeUnits = VehicleUnit::query()
            ->selectRaw('vehicle_id, COUNT(*) as c')
            ->where('status', VehicleUnit::STATUS_ACTIVE)
            ->when($vehicleId !== null, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->groupBy('vehicle_id')
            ->pluck('c', 'vehicle_id');

        // Maintenance yang overlap periode. Peta unit → kendaraan diambil
        // via pluck agar tidak bergantung pada inferensi relasi.
        $unitVehicleMap = VehicleUnit::query()->pluck('vehicle_id', 'id');

        $maintenances = MaintenanceRecord::query()
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
            ->get(['id', 'vehicle_unit_id', 'cost', 'status', 'started_at', 'completed_at', 'estimated_completed_at', 'created_at']);

        $maintDaysByVehicle = [];
        $maintCostByVehicle = [];
        $maintUnits = [];
        $totalMaintDays = 0;
        $totalMaintCost = 0;
        foreach ($maintenances as $record) {
            $unitId = $record->getAttribute('vehicle_unit_id');
            $vehicleKey = $unitId !== null ? ($unitVehicleMap[$unitId] ?? null) : null;
            if ($vehicleKey === null) {
                continue;
            }
            [$mStart, $mEnd] = $this->maintenanceWindow($record, $period);
            // Hanya yang overlap periode.
            if ($mEnd < $fromDate || $mStart > $toDate) {
                continue;
            }
            $clampedStart = max($mStart, $fromDate);
            $clampedEnd = min($mEnd, $toDate);
            $dayCount = (int) (Carbon::parse($clampedStart)->diffInDays(Carbon::parse($clampedEnd)) + 1);
            $dayCount = max(0, $dayCount);
            $cost = (int) $record->getAttribute('cost');

            $maintDaysByVehicle[$vehicleKey] = ($maintDaysByVehicle[$vehicleKey] ?? 0) + $dayCount;
            $maintCostByVehicle[$vehicleKey] = ($maintCostByVehicle[$vehicleKey] ?? 0) + $cost;
            if ($unitId !== null) {
                $maintUnits[$unitId] = true;
            }
            $totalMaintDays += $dayCount;
            $totalMaintCost += $cost;
        }

        $rows = [];
        $totalRentalDays = 0;
        $totalCapacity = 0;
        foreach ($vehicles as $vehicle) {
            $units = (int) ($activeUnits[$vehicle->id] ?? 0);
            $capacityUnits = $units > 0 ? $units : max(0, (int) $vehicle->stock);
            $capacityDays = $capacityUnits * $days;
            $rentalDays = (int) ($rentalDaysByVehicle[$vehicle->id] ?? 0);
            $utilization = $capacityDays > 0 ? round($rentalDays / $capacityDays * 100, 1) : 0.0;

            $totalRentalDays += $rentalDays;
            $totalCapacity += $capacityDays;

            $rows[] = [
                'id' => $vehicle->id,
                'name' => $vehicle->name,
                'category' => $vehicle->category,
                'bookings' => (int) ($allBookingCounts[$vehicle->id] ?? 0),
                'rental_days' => $rentalDays,
                'revenue' => (int) ($revenueByVehicle[$vehicle->id] ?? 0),
                'capacity_days' => $capacityDays,
                'capacity_units' => $capacityUnits,
                'utilization' => $utilization,
                'maintenance_days' => (int) ($maintDaysByVehicle[$vehicle->id] ?? 0),
                'maintenance_cost' => (int) ($maintCostByVehicle[$vehicle->id] ?? 0),
            ];
        }

        usort($rows, fn ($a, $b) => $b['bookings'] <=> $a['bookings'] ?: $b['rental_days'] <=> $a['rental_days']);
        $mostRented = array_slice($rows, 0, 5);

        $byUtil = $rows;
        usort($byUtil, fn ($a, $b) => $a['utilization'] <=> $b['utilization']);
        $lowUtilization = array_slice($byUtil, 0, 5);

        return [
            'rows' => $rows,
            'most_rented' => $mostRented,
            'low_utilization' => $lowUtilization,
            'totals' => [
                'rental_days' => $totalRentalDays,
                'capacity_days' => $totalCapacity,
                'utilization' => $totalCapacity > 0 ? round($totalRentalDays / $totalCapacity * 100, 1) : 0.0,
                'maintenance_units' => count($maintUnits),
                'maintenance_days' => $totalMaintDays,
                'maintenance_cost' => $totalMaintCost,
            ],
            'basis' => $this->basis($period, $category, $vehicleId, 'overlap start_date–end_date'),
        ];
    }

    /** @return array{0: string, 1: string} */
    private function maintenanceWindow(MaintenanceRecord $record, ReportPeriod $period): array
    {
        $tz = ReportPeriod::TIMEZONE;

        $startedRaw = $record->getAttribute('started_at');
        $completedRaw = $record->getAttribute('completed_at');
        $estimatedRaw = $record->getAttribute('estimated_completed_at');

        if ($startedRaw instanceof Carbon) {
            $start = $startedRaw->copy()->timezone($tz)->toDateString();
        } elseif (is_string($startedRaw) && $startedRaw !== '') {
            $start = Carbon::parse($startedRaw, $tz)->toDateString();
        } else {
            $start = $record->created_at->copy()->timezone($tz)->toDateString();
        }

        if ($completedRaw instanceof Carbon) {
            $end = $completedRaw->copy()->timezone($tz)->toDateString();
        } elseif (is_string($completedRaw) && $completedRaw !== '') {
            $end = Carbon::parse($completedRaw, $tz)->toDateString();
        } elseif ($estimatedRaw instanceof Carbon) {
            $end = $estimatedRaw->copy()->timezone($tz)->toDateString();
        } elseif (is_string($estimatedRaw) && $estimatedRaw !== '') {
            $end = Carbon::parse($estimatedRaw, $tz)->toDateString();
        } elseif ($record->isActive()) {
            $end = $period->to->copy()->timezone($tz)->toDateString();
        } else {
            $end = $start;
        }

        return [$start, $end];
    }

    // ---------- Drivers & delivery ----------

    /** @return array<string, mixed> */
    public function drivers(ReportPeriod $period): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);
        $fromDate = $period->fromDateString();
        $toDate = $period->toDateString();

        // Trip rental: booking ber-driver yang overlap periode sewa.
        $trips = Booking::query()
            ->selectRaw('driver_id, COUNT(*) as assigned, '
                ."SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, "
                ."SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
            ->whereNotNull('driver_id')
            ->where('start_date', '<=', $toDate)
            ->where('end_date', '>=', $fromDate)
            ->groupBy('driver_id')
            ->get()
            ->keyBy('driver_id');

        // Tugas antar/jemput per driver (scheduled_at ∈ P, fallback created_at).
        $taskRows = OperationalTask::query()
            ->selectRaw('driver_id, type, COUNT(*) as c')
            ->whereNotNull('driver_id')
            ->where(fn ($q) => $q
                ->whereBetween('scheduled_at', [$fromUtc, $toUtc])
                ->orWhere(fn ($qq) => $qq->whereNull('scheduled_at')->whereBetween('created_at', [$fromUtc, $toUtc])))
            ->groupBy('driver_id', 'type')
            ->get();

        $deliveriesByDriver = [];
        $pickupsByDriver = [];
        foreach ($taskRows as $row) {
            $driverKey = (int) $row->getAttribute('driver_id');
            if ($row->getAttribute('type') === OperationalTask::TYPE_DELIVERY) {
                $deliveriesByDriver[$driverKey] = (int) $row->getAttribute('c');
            } else {
                $pickupsByDriver[$driverKey] = (int) $row->getAttribute('c');
            }
        }

        /** @var Collection<int, Driver> $drivers */
        $drivers = Driver::query()->orderBy('name')->get(['id', 'name', 'status']);

        $rows = [];
        foreach ($drivers as $driver) {
            /** @var Booking|null $trip */
            $trip = $trips[$driver->id] ?? null;
            $rows[] = [
                'id' => $driver->id,
                'name' => $driver->name,
                'status' => $driver->status,
                'assigned' => (int) ($trip?->getAttribute('assigned') ?? 0),
                'completed' => (int) ($trip?->getAttribute('completed') ?? 0),
                'cancelled' => (int) ($trip?->getAttribute('cancelled') ?? 0),
                'deliveries' => (int) ($deliveriesByDriver[$driver->id] ?? 0),
                'pickups' => (int) ($pickupsByDriver[$driver->id] ?? 0),
            ];
        }

        usort($rows, fn ($a, $b) => $b['assigned'] <=> $a['assigned']);

        // Laporan delivery/pickup keseluruhan.
        $taskBase = OperationalTask::query()
            ->where(fn ($q) => $q
                ->whereBetween('scheduled_at', [$fromUtc, $toUtc])
                ->orWhere(fn ($qq) => $qq->whereNull('scheduled_at')->whereBetween('created_at', [$fromUtc, $toUtc])));

        $deliveryBase = (clone $taskBase)->where('type', OperationalTask::TYPE_DELIVERY);
        $pickupBase = (clone $taskBase)->where('type', OperationalTask::TYPE_PICKUP);

        $delivery = [
            'total' => (clone $deliveryBase)->count(),
            'completed' => (clone $deliveryBase)->where('status', OperationalTask::STATUS_COMPLETED)->count(),
            'pending' => (clone $deliveryBase)->whereNotIn('status', [OperationalTask::STATUS_COMPLETED, OperationalTask::STATUS_CANCELLED])->count(),
            'cancelled' => (clone $deliveryBase)->where('status', OperationalTask::STATUS_CANCELLED)->count(),
        ];
        $pickup = [
            'total' => (clone $pickupBase)->count(),
            'completed' => (clone $pickupBase)->where('status', OperationalTask::STATUS_COMPLETED)->count(),
            'pending' => (clone $pickupBase)->whereNotIn('status', [OperationalTask::STATUS_COMPLETED, OperationalTask::STATUS_CANCELLED])->count(),
            'cancelled' => (clone $pickupBase)->where('status', OperationalTask::STATUS_CANCELLED)->count(),
        ];

        return [
            'rows' => $rows,
            'delivery' => $delivery,
            'pickup' => $pickup,
            'basis' => $this->basis($period, null, null, 'overlap sewa & tasks.scheduled_at'),
        ];
    }

    // ---------- Cancellation ----------

    /** @return array<string, mixed> */
    public function cancellation(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $base = $this->applyBookingVehicleFilter(Booking::query(), $category, $vehicleId)
            ->whereBetween('bookings.created_at', [$fromUtc, $toUtc]);

        $total = (clone $base)->count();
        $cancelled = (clone $base)->where('bookings.status', 'cancelled')->count();
        $rate = $total > 0 ? round($cancelled / $total * 100, 1) : 0.0;

        $reasonRows = Cancellation::query()
            ->selectRaw('reason_code, COUNT(*) as c')
            ->whereBetween('cancelled_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null || $category !== null, function ($q) use ($vehicleId, $category) {
                $q->whereHas('booking', function ($bq) use ($vehicleId, $category) {
                    if ($vehicleId !== null) {
                        $bq->where('bookings.vehicle_id', $vehicleId);
                    }
                    if ($category !== null) {
                        $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
                    }
                });
            })
            ->groupBy('reason_code')
            ->get();

        $labels = array_merge(
            config('solorent.cancellation.reasons.customer', []),
            config('solorent.cancellation.reasons.admin', [])
        );

        $reasons = $reasonRows->map(fn (Cancellation $row) => [
            'code' => (string) ($row->getAttribute('reason_code') ?? 'other'),
            'label' => (string) ($labels[$row->getAttribute('reason_code')] ?? $row->getAttribute('reason_code') ?? 'Lainnya'),
            'count' => (int) $row->getAttribute('c'),
        ])->sortByDesc('count')->values()->all();

        return [
            'total' => $total,
            'cancelled' => $cancelled,
            'rate' => $rate,
            'reasons' => $reasons,
            'basis' => $this->basis($period, $category, $vehicleId, 'bookings.created_at'),
        ];
    }

    /** @return LengthAwarePaginator<int, array<string, mixed>> */
    public function cancellationRows(
        ReportPeriod $period,
        ?string $category = null,
        ?int $vehicleId = null,
        int $perPage = 15,
    ): LengthAwarePaginator {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $query = Booking::query()
            ->with(['vehicle:id,name', 'cancellation'])
            ->where('bookings.status', 'cancelled')
            ->whereBetween('bookings.created_at', [$fromUtc, $toUtc])
            ->latest();

        $this->applyBookingVehicleFilter($query, $category, $vehicleId);

        return $query->paginate($perPage)->withQueryString()->through(function (Booking $booking) {
            /** @var Vehicle|null $vehicle */
            $vehicle = $booking->getRelationValue('vehicle');
            /** @var Cancellation|null $cancellation */
            $cancellation = $booking->getRelationValue('cancellation');

            return [
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer_name,
                'vehicle_name' => $vehicle?->name,
                'start_date' => $this->dateString($booking->getAttribute('start_date')),
                'end_date' => $this->dateString($booking->getAttribute('end_date')),
                'total' => (int) $booking->total,
                'reason' => $cancellation?->reason ?? $booking->cancel_reason,
                'cancelled_by' => $cancellation?->cancelled_by_type ?? $booking->cancelled_by_type,
                'refund_amount' => (int) ($cancellation?->refund_amount ?? 0),
                'cancelled_at' => $cancellation?->cancelled_at?->format('d M Y H:i')
                    ?? $booking->cancelled_at?->format('d M Y H:i'),
            ];
        });
    }

    // ---------- Refunds ----------

    /** @return array<string, mixed> */
    public function refunds(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $base = $this->applyRefundVehicleFilter(Refund::query(), $category, $vehicleId)
            ->whereBetween('created_at', [$fromUtc, $toUtc]);

        $counts = [
            'requests' => (clone $base)->count(),
            'pending' => (clone $base)->where('status', Refund::STATUS_PENDING)->count(),
            'processing' => (clone $base)->where('status', Refund::STATUS_PROCESSING)->count(),
            'completed' => (clone $base)->where('status', Refund::STATUS_COMPLETED)->count(),
            'failed' => (clone $base)->where('status', Refund::STATUS_FAILED)->count(),
        ];

        $totalCompleted = (int) $this->applyRefundVehicleFilter(
            Refund::query()->where('status', Refund::STATUS_COMPLETED)
                ->whereBetween('processed_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->sum('amount');

        $inProcess = (int) $this->applyRefundVehicleFilter(
            Refund::query()->whereIn('status', [Refund::STATUS_PENDING, Refund::STATUS_PROCESSING])
                ->whereBetween('created_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->sum('amount');

        $dayExpr = DateBucket::dayExpressionTz('refunds.processed_at');
        $daily = $this->applyRefundVehicleFilter(
            Refund::query()->where('status', Refund::STATUS_COMPLETED)
                ->whereBetween('processed_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->selectRaw("{$dayExpr} as day, SUM(amount) as s")->groupBy('day')
            ->pluck('s', 'day')->map(fn ($v) => (int) $v)->all();

        $buckets = DateBucket::buckets($period, $period->grouping);
        $trend = DateBucket::rollup($daily, $buckets, $period->grouping);

        return [
            'counts' => $counts,
            'total_completed' => $totalCompleted,
            'in_process' => $inProcess,
            'trend' => array_map(fn (array $row) => [
                'key' => $row['key'],
                'label' => $row['label'],
                'amount' => $row['value'],
            ], $trend),
            'basis' => $this->basis($period, $category, $vehicleId, 'refunds.processed_at'),
        ];
    }

    /** @return LengthAwarePaginator<int, array<string, mixed>> */
    public function refundRows(
        ReportPeriod $period,
        ?string $category = null,
        ?int $vehicleId = null,
        ?string $status = null,
        int $perPage = 15,
    ): LengthAwarePaginator {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $query = Refund::query()
            ->with(['booking:id,booking_code,customer_name'])
            ->whereBetween('refunds.created_at', [$fromUtc, $toUtc])
            ->when($status, fn ($q) => $q->where('refunds.status', $status))
            ->latest();

        $this->applyRefundVehicleFilter($query, $category, $vehicleId);

        return $query->paginate($perPage)->withQueryString()->through(function (Refund $refund) {
            /** @var Booking|null $booking */
            $booking = $refund->getRelationValue('booking');

            return [
                'refund_code' => $refund->refund_code,
                'booking_code' => $booking?->booking_code,
                'customer_name' => $booking?->customer_name,
                'amount' => (int) $refund->amount,
                'status' => $refund->status,
                'reference' => $refund->reference,
                'processed_at' => $refund->processed_at?->format('d M Y H:i'),
                'created_at' => $refund->created_at->format('d M Y H:i'),
            ];
        });
    }

    // ---------- Damage ----------

    /** @return array<string, mixed> */
    public function damage(ReportPeriod $period, ?string $category = null, ?int $vehicleId = null): array
    {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $base = $this->applyDamageVehicleFilter(DamageCharge::query(), $category, $vehicleId)
            ->whereBetween('created_at', [$fromUtc, $toUtc])
            ->whereNotIn('status', [DamageCharge::STATUS_WAIVED, DamageCharge::STATUS_CANCELLED]);

        $cases = (clone $base)->count();
        $charged = (int) (clone $base)->sum('total');

        $paid = (int) Payment::query()
            ->where('type', Payment::TYPE_DAMAGE)
            ->where('status', Payment::STATUS_PAID)
            ->whereBetween('paid_at', [$fromUtc, $toUtc])
            ->when($vehicleId !== null || $category !== null, function ($q) use ($vehicleId, $category) {
                $q->whereHas('damageCharge.booking', function ($bq) use ($vehicleId, $category) {
                    if ($vehicleId !== null) {
                        $bq->where('bookings.vehicle_id', $vehicleId);
                    }
                    if ($category !== null) {
                        $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
                    }
                });
            })
            ->sum('amount');

        $dayExpr = DateBucket::dayExpressionTz('damage_charges.created_at');
        $daily = $this->applyDamageVehicleFilter(
            DamageCharge::query()->whereNotIn('status', [DamageCharge::STATUS_WAIVED, DamageCharge::STATUS_CANCELLED])
                ->whereBetween('created_at', [$fromUtc, $toUtc]),
            $category, $vehicleId
        )->selectRaw("{$dayExpr} as day, SUM(total) as s")->groupBy('day')
            ->pluck('s', 'day')->map(fn ($v) => (int) $v)->all();

        $buckets = DateBucket::buckets($period, $period->grouping);
        $trend = DateBucket::rollup($daily, $buckets, $period->grouping);

        return [
            'cases' => $cases,
            'charged' => $charged,
            'paid' => $paid,
            'outstanding' => max(0, $charged - $paid),
            'trend' => array_map(fn (array $row) => [
                'key' => $row['key'],
                'label' => $row['label'],
                'amount' => $row['value'],
            ], $trend),
            'basis' => $this->basis($period, $category, $vehicleId, 'damage_charges.created_at & damage paid_at'),
        ];
    }

    /** @return LengthAwarePaginator<int, array<string, mixed>> */
    public function damageRows(
        ReportPeriod $period,
        ?string $category = null,
        ?int $vehicleId = null,
        int $perPage = 15,
    ): LengthAwarePaginator {
        [$fromUtc, $toUtc] = $this->rangeUtc($period);

        $query = DamageCharge::query()
            ->with(['booking:id,booking_code,customer_name'])
            ->withSum(['payments as paid_sum' => fn ($q) => $q->where('status', Payment::STATUS_PAID)], 'amount')
            ->whereBetween('damage_charges.created_at', [$fromUtc, $toUtc])
            ->latest();

        $this->applyDamageVehicleFilter($query, $category, $vehicleId);

        return $query->paginate($perPage)->withQueryString()->through(function (DamageCharge $charge) {
            /** @var Booking|null $booking */
            $booking = $charge->getRelationValue('booking');
            $paid = (int) ($charge->getAttribute('paid_sum') ?? 0);

            return [
                'charge_code' => $charge->charge_code,
                'booking_code' => $booking?->booking_code,
                'customer_name' => $booking?->customer_name,
                'total' => (int) $charge->total,
                'paid' => $paid,
                'outstanding' => max(0, (int) $charge->total - $paid),
                'status' => $charge->status,
                'created_at' => $charge->created_at->format('d M Y H:i'),
            ];
        });
    }

    // ---------- Outstanding (tidak dibatasi periode) ----------

    /** @return array<string, mixed> */
    public function outstandingTotals(?string $category = null, ?int $vehicleId = null): array
    {
        $bookingOutstanding = (int) Booking::query()
            ->selectRaw('COALESCE(SUM(bookings.total - COALESCE(paid.paid_sum, 0)), 0) as agg')
            ->leftJoin(DB::raw('(SELECT booking_id, SUM(amount) as paid_sum FROM payments WHERE status = \'paid\' AND type != \'damage\' GROUP BY booking_id) as paid'), 'paid.booking_id', '=', 'bookings.id')
            ->whereNotIn('bookings.status', ['cancelled', 'completed'])
            ->whereIn('bookings.payment_status', ['unpaid', 'partial'])
            ->when($vehicleId !== null, fn ($q) => $q->where('bookings.vehicle_id', $vehicleId))
            ->when($category !== null, fn ($q) => $q->whereHas('vehicle', fn ($vq) => $vq->where('category', $category)))
            ->value('agg');

        $damageCharges = DamageCharge::query()
            ->whereIn('status', [DamageCharge::STATUS_UNPAID, DamageCharge::STATUS_PARTIAL])
            ->when($vehicleId !== null || $category !== null, function ($q) use ($vehicleId, $category) {
                $q->whereHas('booking', function ($bq) use ($vehicleId, $category) {
                    if ($vehicleId !== null) {
                        $bq->where('bookings.vehicle_id', $vehicleId);
                    }
                    if ($category !== null) {
                        $bq->whereHas('vehicle', fn ($vq) => $vq->where('category', $category));
                    }
                });
            })
            ->withSum(['payments as paid_sum' => fn ($q) => $q->where('status', Payment::STATUS_PAID)], 'amount')
            ->get(['id', 'total']);

        $damageOutstanding = $damageCharges->sum(fn (DamageCharge $charge) => max(0, (int) $charge->total - (int) ($charge->getAttribute('paid_sum') ?? 0)));

        return [
            'booking_outstanding' => max(0, $bookingOutstanding),
            'damage_outstanding' => max(0, (int) $damageOutstanding),
            'total' => max(0, $bookingOutstanding) + max(0, (int) $damageOutstanding),
        ];
    }

    /** @return LengthAwarePaginator<int, array<string, mixed>> */
    public function outstandingBookings(?string $category = null, ?int $vehicleId = null, int $perPage = 15): LengthAwarePaginator
    {
        $query = Booking::query()
            ->with(['vehicle:id,name'])
            ->withSum(['payments as paid_sum' => fn ($q) => $q
                ->where('status', Payment::STATUS_PAID)
                ->where('type', '!=', Payment::TYPE_DAMAGE)], 'amount')
            ->whereNotIn('bookings.status', ['cancelled', 'completed'])
            ->whereIn('bookings.payment_status', ['unpaid', 'partial'])
            ->latest();

        $this->applyBookingVehicleFilter($query, $category, $vehicleId);

        return $query->paginate($perPage)->withQueryString()->through(function (Booking $booking) {
            /** @var Vehicle|null $vehicle */
            $vehicle = $booking->getRelationValue('vehicle');
            $paid = (int) ($booking->getAttribute('paid_sum') ?? 0);

            return [
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer_name,
                'customer_phone' => $booking->customer_phone,
                'vehicle_name' => $vehicle?->name,
                'start_date' => $this->dateString($booking->getAttribute('start_date')),
                'end_date' => $this->dateString($booking->getAttribute('end_date')),
                'total' => (int) $booking->total,
                'paid' => $paid,
                'outstanding' => max(0, (int) $booking->total - $paid),
                'status' => $booking->status,
                'payment_status' => $booking->payment_status ?? 'unpaid',
            ];
        });
    }

    /** @return LengthAwarePaginator<int, array<string, mixed>> */
    public function outstandingDamages(?string $category = null, ?int $vehicleId = null, int $perPage = 15): LengthAwarePaginator
    {
        $query = DamageCharge::query()
            ->with(['booking:id,booking_code,customer_name,customer_phone'])
            ->withSum(['payments as paid_sum' => fn ($q) => $q->where('status', Payment::STATUS_PAID)], 'amount')
            ->whereIn('status', [DamageCharge::STATUS_UNPAID, DamageCharge::STATUS_PARTIAL])
            ->latest();

        $this->applyDamageVehicleFilter($query, $category, $vehicleId);

        return $query->paginate($perPage)->withQueryString()->through(function (DamageCharge $charge) {
            /** @var Booking|null $booking */
            $booking = $charge->getRelationValue('booking');
            $paid = (int) ($charge->getAttribute('paid_sum') ?? 0);

            return [
                'charge_code' => $charge->charge_code,
                'booking_code' => $booking?->booking_code,
                'customer_name' => $booking?->customer_name,
                'customer_phone' => $booking?->customer_phone,
                'total' => (int) $charge->total,
                'paid' => $paid,
                'outstanding' => max(0, (int) $charge->total - $paid),
                'status' => $charge->status,
            ];
        });
    }

    // ---------- Vehicle options (filter dropdown) ----------

    /** @return array<int, array{id: int, name: string, category: string}> */
    public function vehicleOptions(?string $category = null): array
    {
        return Vehicle::query()
            ->when($category !== null, fn ($q) => $q->where('category', $category))
            ->orderBy('name')
            ->get(['id', 'name', 'category'])
            ->map(fn (Vehicle $vehicle) => [
                'id' => $vehicle->id,
                'name' => $vehicle->name,
                'category' => $vehicle->category,
            ])->all();
    }

    // ---------- Basis caption ----------

    private function dateString(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return (string) $value;
    }

    /** @return array<string, string> */
    private function basis(ReportPeriod $period, ?string $category, ?int $vehicleId, string $column = ''): array
    {
        $vehicleName = null;
        if ($vehicleId !== null) {
            $vehicleName = Vehicle::whereKey($vehicleId)->value('name');
        }

        return [
            'period' => $period->label(),
            'vehicle' => $vehicleName ?? $this->categoryLabel($category),
            'column' => $column,
            'timezone' => ReportPeriod::TIMEZONE,
        ];
    }
}
