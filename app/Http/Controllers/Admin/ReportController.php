<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReportFilterRequest;
use App\Services\Insights\InsightEngine;
use App\Services\Reports\BusinessAnalyticsService;
use App\Services\Reports\ForecastService;
use App\Services\Reports\ReportExportService;
use App\Services\Reports\ReportService;
use App\Support\Reports\ReportPeriod;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        private ReportService $reports,
        private ReportExportService $export,
        private BusinessAnalyticsService $analytics,
        private ForecastService $forecast,
        private InsightEngine $insights,
    ) {}

    public function index(ReportFilterRequest $request): Response
    {
        $input = $request->reportInput();
        $period = ReportPeriod::fromArray($input);
        $category = $input['category'];
        $vehicleId = $input['vehicle'];
        /** @var string $tab */
        $tab = $input['tab'];

        $shared = [
            'filters' => [
                'period' => $period->preset,
                'from' => $period->fromDateString(),
                'to' => $period->toDateString(),
                'group' => $period->grouping,
                'category' => $category,
                'vehicle' => $vehicleId,
                'tab' => $tab,
                'status' => $input['status'],
                'search' => $input['search'],
            ],
            'period' => $period->toArray(),
            'vehicleOptions' => $this->reports->vehicleOptions($category),
        ];

        $section = match ($tab) {
            'booking' => [
                'booking' => $this->reports->booking($period, $category, $vehicleId),
                'customers' => $this->reports->customers($period, $category, $vehicleId),
                'table' => $this->reports->bookingRows($period, $category, $vehicleId, $input['status'], $input['search']),
            ],
            'demand' => [
                'demand' => $this->analytics->demand($period, $category, $vehicleId),
                'comparison' => $this->analytics->comparison($period, $category, $vehicleId),
            ],
            'revenue' => [
                'revenue' => $this->reports->revenue($period, $category, $vehicleId),
            ],
            'vehicle' => [
                'vehicles' => $this->reports->vehicles($period, $category, $vehicleId),
            ],
            'driver' => [
                'drivers' => $this->reports->drivers($period),
            ],
            'customer' => [
                'customerStats' => $this->analytics->customerStats($period, $category, $vehicleId),
                'topCustomers' => $this->reports->customers($period, $category, $vehicleId, 10),
            ],
            'cancellation' => [
                'cancellation' => $this->reports->cancellation($period, $category, $vehicleId),
                'table' => $this->reports->cancellationRows($period, $category, $vehicleId),
            ],
            'refund' => [
                'refunds' => $this->reports->refunds($period, $category, $vehicleId),
                'table' => $this->reports->refundRows($period, $category, $vehicleId, $input['status']),
            ],
            'damage' => [
                'damage' => $this->reports->damage($period, $category, $vehicleId),
                'table' => $this->reports->damageRows($period, $category, $vehicleId),
            ],
            'maintenance' => [
                'maintenance' => $this->analytics->maintenanceStats($period, $category, $vehicleId),
            ],
            'forecast' => [
                'forecast' => $this->forecast->forecast($category, $vehicleId),
            ],
            'insights' => [
                'insights' => $this->insights->get($category, $vehicleId, 100),
            ],
            'outstanding' => [
                'totals' => $this->reports->outstandingTotals($category, $vehicleId),
                'bookings' => $this->reports->outstandingBookings($category, $vehicleId),
                'damages' => $this->reports->outstandingDamages($category, $vehicleId),
            ],
            default => [
                'overview' => $this->reports->overview($period, $category, $vehicleId),
                'bookingTrend' => $this->reports->booking($period, $category, $vehicleId)['trend'],
                'revenueTrend' => $this->reports->revenue($period, $category, $vehicleId)['trend'],
            ],
        };

        return Inertia::render('admin/reports/index', array_merge($shared, ['section' => $section]));
    }

    public function export(ReportFilterRequest $request): StreamedResponse
    {
        $input = $request->reportInput();
        $period = ReportPeriod::fromArray($input);
        /** @var string $report */
        $report = $input['report'] ?? $input['tab'] ?? 'booking';
        if ($report === 'overview' && ($input['tab'] ?? 'overview') !== 'overview') {
            $report = (string) ($input['tab'] ?? 'booking');
        }

        $built = $this->export->build($report, $period, $input['category'], $input['vehicle'], $input['status'], $input['search']);

        $user = $request->user();
        Log::info('report.export', [
            'admin_id' => $user?->id,
            'admin_name' => $user?->name,
            'report' => $report,
            'from' => $period->fromDateString(),
            'to' => $period->toDateString(),
            'category' => $input['category'],
            'vehicle' => $input['vehicle'],
            'format' => 'csv',
            'rows' => count($built['rows']),
            'ip' => $request->ip(),
        ]);

        $filename = $built['filename'];
        $header = $built['header'];
        $rows = $built['rows'];

        return response()->streamDownload(function () use ($header, $rows) {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }
            // BOM agar Excel membuka id-ID dengan benar.
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $header);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
