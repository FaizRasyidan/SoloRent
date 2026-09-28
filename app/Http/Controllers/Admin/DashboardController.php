<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Vehicle;
use App\Services\Insights\InsightEngine;
use App\Services\Insights\NeedsAttentionService;
use App\Services\Reports\ReportService;
use App\Support\Reports\ReportPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Command Center Phase 9: tepat 4 KPI + 1 tren utama + Smart Insights
 * (maks 3) + Needs Attention (maks 5 tampil) + 5 booking terbaru.
 * Tidak ada widget analisis mandiri — detail ada di /admin/reports.
 */
class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        ReportService $reports,
        InsightEngine $insights,
        NeedsAttentionService $attention,
    ): Response {
        // Rentang & metrik dinormalisasi ke default bersih (bukan error)
        // bila URL diketik manual.
        $range = in_array($request->query('range'), ['7', '30', '90'], true)
            ? (int) $request->query('range')
            : 30;
        $metric = $request->query('metric') === 'revenue' ? 'revenue' : 'booking';

        $tz = ReportPeriod::TIMEZONE;
        $today = Carbon::now($tz)->toDateString();
        $dayStartUtc = Carbon::now($tz)->startOfDay()->timezone('UTC');
        $dayEndUtc = Carbon::now($tz)->endOfDay()->timezone('UTC');

        $blocking = config('solorent.statuses_blocking_availability', ['pending', 'confirmed', 'preparing', 'active']);

        // KPI 1 — Booking hari ini (created_at dalam hari Jakarta).
        $todayBookings = Booking::query()
            ->whereBetween('created_at', [$dayStartUtc, $dayEndUtc])
            ->count();
        $pendingConfirm = Booking::query()->where('status', 'pending')->count();

        // KPI 2 — Pendapatan hari ini (paid_at hari Jakarta, non-damage).
        $todayPaid = (int) Payment::query()
            ->where('status', Payment::STATUS_PAID)
            ->where('type', '!=', Payment::TYPE_DAMAGE)
            ->whereBetween('paid_at', [$dayStartUtc, $dayEndUtc])
            ->sum('amount');
        $todayPaidCount = Payment::query()
            ->where('status', Payment::STATUS_PAID)
            ->where('type', '!=', Payment::TYPE_DAMAGE)
            ->whereBetween('paid_at', [$dayStartUtc, $dayEndUtc])
            ->count();

        // KPI 3 — Sedang disewa: status blocking + periode sewa mencakup hari ini.
        // whereDate (bukan where mentah): kolom DATE tersimpan sebagai
        // datetime-text di SQLite sehingga perbandingan string gagal.
        $activeRentals = Booking::query()
            ->whereIn('status', $blocking)
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->count();
        $totalUnits = (int) Vehicle::query()->sum('stock');

        // KPI 4 + kartu — Needs Attention live (tanpa penyimpanan).
        $attentionItems = $attention->items();

        // Tren utama: booking + revenue digabung per bucket.
        $period = $this->trendPeriod($range);
        $bookingTrend = $reports->booking($period);
        $revenueTrend = $reports->revenue($period);
        $points = $this->mergeTrend($bookingTrend['trend'] ?? [], $revenueTrend['trend'] ?? []);

        // Smart Insights: jendela 30 hari, cache 10 menit.
        $insightPayload = $insights->get(null, null, (int) config('insights.dashboard_limit', 3));

        $recentBookings = Booking::query()
            ->with('vehicle:id,name,category')
            ->latest()
            ->limit(5)
            ->get()
            ->map(function (Booking $booking) {
                /** @var Vehicle|null $vehicle */
                $vehicle = $booking->getRelationValue('vehicle');
                $start = $booking->getAttribute('start_date');
                $end = $booking->getAttribute('end_date');

                return [
                    'id' => $booking->id,
                    'booking_code' => $booking->booking_code,
                    'customer_name' => $booking->customer_name,
                    'vehicle_name' => $vehicle?->name,
                    'vehicle_category' => $vehicle?->category,
                    'start_date' => $start instanceof \DateTimeInterface ? $start->format('Y-m-d') : null,
                    'end_date' => $end instanceof \DateTimeInterface ? $end->format('Y-m-d') : null,
                    'status' => $booking->status,
                    'total' => (int) $booking->total,
                ];
            });

        return Inertia::render('admin/dashboard', [
            'today' => Carbon::now($tz)->isoFormat('dddd, D MMMM YYYY'),
            'kpis' => [
                'bookings_today' => $todayBookings,
                'bookings_pending' => $pendingConfirm,
                'revenue_today' => $todayPaid,
                'revenue_count' => $todayPaidCount,
                'active_rentals' => $activeRentals,
                'total_units' => $totalUnits,
                'attention_count' => count($attentionItems),
            ],
            'trend' => [
                'range' => $range,
                'metric' => $metric,
                'points' => $points,
                'period' => $period->toArray(),
            ],
            'insights' => $insightPayload,
            'attention' => ['items' => $attentionItems],
            'recentBookings' => $recentBookings,
        ]);
    }

    private function trendPeriod(int $range): ReportPeriod
    {
        if ($range === 7) {
            return ReportPeriod::fromArray(['period' => 'last_7', 'group' => 'day']);
        }
        if ($range === 90) {
            $tz = ReportPeriod::TIMEZONE;
            $to = Carbon::now($tz);
            $from = $to->copy()->subDays(89);

            return ReportPeriod::fromArray([
                'period' => 'custom',
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'group' => 'auto',
            ]);
        }

        return ReportPeriod::fromArray(['period' => 'last_30', 'group' => 'day']);
    }

    /**
     * @param  list<array<string, mixed>>  $booking
     * @param  list<array<string, mixed>>  $revenue
     * @return list<array<string, mixed>>
     */
    private function mergeTrend(array $booking, array $revenue): array
    {
        $netByKey = [];
        foreach ($revenue as $row) {
            $netByKey[(string) ($row['key'] ?? '')] = (int) ($row['net'] ?? 0);
        }

        $points = [];
        foreach ($booking as $row) {
            $key = (string) ($row['key'] ?? '');
            $points[] = [
                'key' => $key,
                'label' => (string) ($row['label'] ?? $key),
                'bookings' => (int) ($row['count'] ?? 0),
                'net' => $netByKey[$key] ?? 0,
            ];
        }

        return $points;
    }
}
