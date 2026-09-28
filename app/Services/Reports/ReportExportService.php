<?php

namespace App\Services\Reports;

use App\Services\Insights\InsightEngine;
use App\Support\Reports\ReportPeriod;
use Illuminate\Support\Collection;

/**
 * Menyusun header + baris CSV dari definisi yang sama dengan
 * angka di layar (satu sumber kebenaran: ReportService).
 */
class ReportExportService
{
    public const MAX_ROWS = 2000;

    public function __construct(
        private ReportService $reports,
        private ?BusinessAnalyticsService $analytics = null,
        private ?ForecastService $forecast = null,
        private ?InsightEngine $insights = null,
    ) {}

    /**
     * @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>}
     */
    public function build(string $report, ReportPeriod $period, ?string $category = null, ?int $vehicleId = null, ?string $status = null, ?string $search = null): array
    {
        $slug = "{$period->fromDateString()}_{$period->toDateString()}";

        return match ($report) {
            'revenue' => $this->revenue($period, $category, $vehicleId, $slug),
            'vehicle' => $this->vehicles($period, $category, $vehicleId, $slug),
            'driver' => $this->drivers($period, $slug),
            'cancellation' => $this->cancellations($period, $category, $vehicleId, $slug),
            'refund' => $this->refunds($period, $category, $vehicleId, $status, $slug),
            'damage' => $this->damages($period, $category, $vehicleId, $slug),
            'outstanding' => $this->outstanding($category, $vehicleId, $slug),
            'customers', 'customer' => $this->customers($period, $category, $vehicleId, $slug),
            'demand' => $this->demand($period, $category, $vehicleId, $slug),
            'maintenance' => $this->maintenance($period, $category, $vehicleId, $slug),
            'forecast' => $this->forecastCsv($category, $vehicleId, $slug),
            'insights' => $this->insightsCsv($category, $vehicleId, $slug),
            'overview' => $this->overview($period, $category, $vehicleId, $slug),
            default => $this->bookings($period, $category, $vehicleId, $status, $search, $slug),
        };
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function bookings(ReportPeriod $period, ?string $category, ?int $vehicleId, ?string $status, ?string $search, string $slug): array
    {
        $rows = $this->reports->bookingRows($period, $category, $vehicleId, $status, $search, self::MAX_ROWS);

        /** @var Collection<int, array<string, mixed>> $items */
        $items = collect($rows->items());

        return [
            'filename' => "solorent-booking-{$slug}.csv",
            'header' => ['Booking Code', 'Customer', 'Phone', 'Vehicle', 'Category', 'Start', 'End', 'Days', 'Total', 'Paid', 'Refunded', 'Damage', 'Status', 'Payment', 'Created'],
            'rows' => $items->map(fn (array $r) => [
                $r['booking_code'], $r['customer_name'], $r['customer_phone'],
                $r['vehicle_name'] ?? '', $r['vehicle_category'] ?? '',
                $r['start_date'], $r['end_date'], $r['duration_days'],
                $r['total'], $r['paid'], $r['refunded'], $r['damage'],
                $r['status'], $r['payment_status'], $r['created_at'],
            ])->all(),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function customers(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->reports->customers($period, $category, $vehicleId, self::MAX_ROWS);

        return [
            'filename' => "solorent-customers-{$slug}.csv",
            'header' => ['Customer', 'Phone', 'Total Booking', 'Completed', 'Cancelled', 'Total Spent'],
            'rows' => array_map(fn (array $r) => [
                $r['customer_name'], $r['customer_phone'], $r['total_booking'],
                $r['completed'], $r['cancelled'], $r['total_spent'],
            ], $data['rows']),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function revenue(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->reports->revenue($period, $category, $vehicleId);

        return [
            'filename' => "solorent-revenue-{$slug}.csv",
            'header' => ['Period', 'Label', 'Gross Booking', 'Refund', 'Net Booking', 'Damage Paid'],
            'rows' => array_map(fn (array $row) => [
                $row['key'], $row['label'], $row['gross'], $row['refund'], $row['net'], $row['damage'],
            ], $data['trend']),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function vehicles(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->reports->vehicles($period, $category, $vehicleId);

        return [
            'filename' => "solorent-vehicles-{$slug}.csv",
            'header' => ['Vehicle', 'Category', 'Bookings', 'Rental Days', 'Revenue', 'Capacity Days', 'Utilization %', 'Maintenance Days', 'Maintenance Cost'],
            'rows' => array_map(fn (array $r) => [
                $r['name'], $r['category'], $r['bookings'], $r['rental_days'], $r['revenue'],
                $r['capacity_days'], $r['utilization'], $r['maintenance_days'], $r['maintenance_cost'],
            ], $data['rows']),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function drivers(ReportPeriod $period, string $slug): array
    {
        $data = $this->reports->drivers($period);

        return [
            'filename' => "solorent-drivers-{$slug}.csv",
            'header' => ['Driver', 'Status', 'Assigned', 'Completed', 'Cancelled', 'Deliveries', 'Pickups'],
            'rows' => array_map(fn (array $r) => [
                $r['name'], $r['status'], $r['assigned'], $r['completed'],
                $r['cancelled'], $r['deliveries'], $r['pickups'],
            ], $data['rows']),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function cancellations(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $rows = $this->reports->cancellationRows($period, $category, $vehicleId, self::MAX_ROWS);

        /** @var Collection<int, array<string, mixed>> $items */
        $items = collect($rows->items());

        return [
            'filename' => "solorent-cancellation-{$slug}.csv",
            'header' => ['Booking Code', 'Customer', 'Vehicle', 'Start', 'End', 'Total', 'Reason', 'Cancelled By', 'Refund', 'Cancelled At'],
            'rows' => $items->map(fn (array $r) => [
                $r['booking_code'], $r['customer_name'], $r['vehicle_name'] ?? '',
                $r['start_date'], $r['end_date'], $r['total'],
                $r['reason'] ?? '', $r['cancelled_by'] ?? '', $r['refund_amount'], $r['cancelled_at'] ?? '',
            ])->all(),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function refunds(ReportPeriod $period, ?string $category, ?int $vehicleId, ?string $status, string $slug): array
    {
        $rows = $this->reports->refundRows($period, $category, $vehicleId, $status, self::MAX_ROWS);

        /** @var Collection<int, array<string, mixed>> $items */
        $items = collect($rows->items());

        return [
            'filename' => "solorent-refund-{$slug}.csv",
            'header' => ['Refund Code', 'Booking Code', 'Customer', 'Amount', 'Status', 'Reference', 'Processed At', 'Created At'],
            'rows' => $items->map(fn (array $r) => [
                $r['refund_code'], $r['booking_code'] ?? '', $r['customer_name'] ?? '',
                $r['amount'], $r['status'], $r['reference'] ?? '',
                $r['processed_at'] ?? '', $r['created_at'],
            ])->all(),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function damages(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $rows = $this->reports->damageRows($period, $category, $vehicleId, self::MAX_ROWS);

        /** @var Collection<int, array<string, mixed>> $items */
        $items = collect($rows->items());

        return [
            'filename' => "solorent-damage-{$slug}.csv",
            'header' => ['Charge Code', 'Booking Code', 'Customer', 'Total', 'Paid', 'Outstanding', 'Status', 'Created At'],
            'rows' => $items->map(fn (array $r) => [
                $r['charge_code'], $r['booking_code'] ?? '', $r['customer_name'] ?? '',
                $r['total'], $r['paid'], $r['outstanding'], $r['status'], $r['created_at'],
            ])->all(),
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function outstanding(?string $category, ?int $vehicleId, string $slug): array
    {
        $bookings = $this->reports->outstandingBookings($category, $vehicleId, self::MAX_ROWS);
        $damages = $this->reports->outstandingDamages($category, $vehicleId, self::MAX_ROWS);

        $rows = [];
        foreach ($bookings->items() as $r) {
            /** @var array<string, mixed> $r */
            $rows[] = ['BOOKING', $r['booking_code'], $r['customer_name'], $r['customer_phone'] ?? '', $r['vehicle_name'] ?? '', $r['total'], $r['paid'], $r['outstanding'], $r['payment_status']];
        }
        foreach ($damages->items() as $r) {
            /** @var array<string, mixed> $r */
            $rows[] = ['DAMAGE', $r['charge_code'].' ('.($r['booking_code'] ?? '').')', $r['customer_name'] ?? '', $r['customer_phone'] ?? '', '', $r['total'], $r['paid'], $r['outstanding'], $r['status']];
        }

        return [
            'filename' => "solorent-outstanding-{$slug}.csv",
            'header' => ['Type', 'Code', 'Customer', 'Phone', 'Vehicle', 'Total', 'Paid', 'Outstanding', 'Status'],
            'rows' => $rows,
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function overview(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->reports->overview($period, $category, $vehicleId);
        $kpis = $data['kpis'];
        $accounting = $data['accounting'];

        $rows = [
            ['Total Booking', $kpis['totalBooking']],
            ['Net Booking Revenue', $accounting['netBookingRevenue']],
            ['Gross Paid Booking', $accounting['grossPaidBooking']],
            ['Refund Completed', $accounting['refundedAmount']],
            ['Damage Paid', $accounting['damagePaid']],
            ['Total Customer Payments', $accounting['totalCustomerPayments']],
            ['Unit Disewa (saat ini)', $kpis['unitsRented']],
            ['Cancelled', $kpis['cancelled']],
            ['Cancellation Rate %', $kpis['cancellationRate']],
        ];

        return [
            'filename' => "solorent-overview-{$slug}.csv",
            'header' => ['Metric', 'Value'],
            'rows' => $rows,
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function demand(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->analytics?->demand($period, $category, $vehicleId)
            ?? $this->reports->booking($period, $category, $vehicleId);

        $trend = $data['trend'] ?? [];
        $rows = array_map(fn (array $row) => [
            $row['key'] ?? '', $row['label'] ?? '', $row['count'] ?? 0,
        ], $trend);

        return [
            'filename' => "solorent-demand-{$slug}.csv",
            'header' => ['Period', 'Label', 'Bookings'],
            'rows' => $rows,
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function maintenance(ReportPeriod $period, ?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->analytics?->maintenanceStats($period, $category, $vehicleId);

        $rows = array_map(fn (array $r) => [
            $r['unit_code'] ?? '', $r['vehicle_name'] ?? '',
            $r['records'] ?? 0, $r['days'] ?? 0, $r['cost'] ?? 0,
        ], $data['per_unit'] ?? []);

        return [
            'filename' => "solorent-maintenance-{$slug}.csv",
            'header' => ['Unit', 'Vehicle', 'Records', 'Downtime Days', 'Cost'],
            'rows' => $rows,
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function forecastCsv(?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->forecast?->forecast($category, $vehicleId);

        $rows = array_map(fn (array $h) => [
            $h['key'] ?? '', $h['label'] ?? '', $h['bookings'] ?? 0,
            $h['gross'] ?? 0, $h['refund'] ?? 0, $h['net'] ?? 0,
        ], $data['history'] ?? []);
        if (($data['sufficient'] ?? false) && isset($data['forecast_next'])) {
            $rows[] = ['ESTIMASI', $data['forecast_label'] ?? '', '', '', '', $data['forecast_next']];
        }

        return [
            'filename' => "solorent-forecast-{$slug}.csv",
            'header' => ['Period', 'Label', 'Bookings', 'Gross', 'Refund', 'Net (Estimasi)'],
            'rows' => $rows,
        ];
    }

    /** @return array{filename: string, header: list<string>, rows: array<int, list<string|int|float>>} */
    private function insightsCsv(?string $category, ?int $vehicleId, string $slug): array
    {
        $data = $this->insights?->get($category, $vehicleId, 100);

        $rows = array_map(fn (array $i) => [
            $i['id'] ?? '', $i['category'] ?? '', $i['title'] ?? '',
            $i['summary'] ?? '', implode(' | ', $i['evidence'] ?? []),
            $i['recommendation'] ?? '', $i['confidence'] ?? '',
        ], $data['insights'] ?? []);

        return [
            'filename' => "solorent-insights-{$slug}.csv",
            'header' => ['ID', 'Category', 'Title', 'Summary', 'Evidence', 'Recommendation', 'Confidence'],
            'rows' => $rows,
        ];
    }
}
