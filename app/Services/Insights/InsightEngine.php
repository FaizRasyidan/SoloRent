<?php

namespace App\Services\Insights;

use App\Models\Booking;
use App\Services\Reports\BusinessAnalyticsService;
use App\Services\Reports\ReportService;
use App\Support\Insights\Insight;
use App\Support\Reports\ReportPeriod;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Orkestrasi insight: rule selalu jalan, AI opsional; dedupe by id,
 * urut by priority, cap sesuai kebutuhan (dashboard 3, halaman semua).
 * Hasil di-cache 10 menit (config insights.cache_ttl).
 */
class InsightEngine
{
    public function __construct(
        private RuleInsightProvider $rules,
        private AiInsightProvider $ai,
        private BusinessAnalyticsService $analytics,
        private ReportService $reports,
    ) {}

    /**
     * @return array{insights: list<array<string, mixed>>, generated_at: string, cached: bool}
     */
    public function get(?string $category = null, ?int $vehicleId = null, ?int $limit = null): array
    {
        $limit ??= (int) config('insights.dashboard_limit', 3);
        $key = $this->key($category, $vehicleId, $limit);
        $ttl = (int) config('insights.cache_ttl', 600);

        $cached = true;
        $payload = Cache::remember($key, $ttl, function () use (&$cached, $category, $vehicleId, $limit) {
            $cached = false;

            return $this->build($category, $vehicleId, $limit);
        });

        $payload['cached'] = $cached;

        return $payload;
    }

    public function refresh(?string $category = null, ?int $vehicleId = null): void
    {
        foreach ([(int) config('insights.dashboard_limit', 3), 100] as $limit) {
            Cache::forget($this->key($category, $vehicleId, $limit));
        }
    }

    /** @return array{insights: list<array<string, mixed>>, generated_at: string, cached: bool} */
    private function build(?string $category, ?int $vehicleId, int $limit): array
    {
        $context = array_merge(
            ['category' => $category, 'vehicle' => $vehicleId],
            $this->aggregateContext($category, $vehicleId),
        );

        $merged = array_merge(
            $this->rules->provide($context),
            $this->ai->provide($context),
        );

        // Dedupe by id (rule menang bila id sama), urut by priority.
        $seen = [];
        foreach ($merged as $insight) {
            if (! isset($seen[$insight->id])) {
                $seen[$insight->id] = $insight;
            }
        }
        $sorted = array_values($seen);
        usort($sorted, fn (Insight $a, Insight $b) => $a->priority <=> $b->priority);

        $sliced = array_slice($sorted, 0, max(1, $limit));

        return [
            'insights' => array_map(fn (Insight $i) => $i->toArray(), $sliced),
            'generated_at' => Carbon::now(ReportPeriod::TIMEZONE)->toDateTimeString(),
            'cached' => false,
        ];
    }

    private function key(?string $category, ?int $vehicleId, int $limit): string
    {
        $day = Carbon::now(ReportPeriod::TIMEZONE)->toDateString();

        return 'insights:v1:'.$day.':'.($category ?? 'all').':'.($vehicleId ?? 0).':'.$limit;
    }

    /**
     * Agregat minim tanpa PII untuk konteks provider + payload AI.
     *
     * @return array<string, mixed>
     */
    private function aggregateContext(?string $category, ?int $vehicleId): array
    {
        try {
            $period = $this->analytics->windowPeriod(30);
            $prev = $this->analytics->previousPeriod($period);
            [$fromUtc, $toUtc] = [$period->from->copy()->timezone('UTC'), $period->to->copy()->timezone('UTC')];
            [$prevFromUtc, $prevToUtc] = [$prev->from->copy()->timezone('UTC'), $prev->to->copy()->timezone('UTC')];

            $cur = Booking::query()->whereBetween('created_at', [$fromUtc, $toUtc])->count();
            $prevCount = Booking::query()->whereBetween('created_at', [$prevFromUtc, $prevToUtc])->count();
            $fin = $this->reports->financial($period, $category, $vehicleId);
            $prevFin = $this->reports->financial($prev, $category, $vehicleId);
            $cancel = $this->reports->cancellation($period, $category, $vehicleId);
            $vehicles = $this->reports->vehicles($period, $category, $vehicleId);
            $weekend = $this->analytics->weekendSplit($period, $category, $vehicleId);
            $customers = $this->analytics->customerStats($period, $category, $vehicleId);
            $maint = $this->analytics->maintenanceStats($this->analytics->windowPeriod(90), $category, $vehicleId);

            return [
                'period' => $period->fromDateString().'–'.$period->toDateString(),
                'booking_count' => $cur,
                'booking_count_previous' => $prevCount,
                'booking_change_pct' => $prevCount > 0 ? round(($cur - $prevCount) / $prevCount * 100, 2) : null,
                'cancelled' => $cancel['cancelled'],
                'cancellation_rate' => $cancel['rate'],
                'net_revenue' => $fin['netBookingRevenue'],
                'net_revenue_previous' => $prevFin['netBookingRevenue'],
                'revenue_change_pct' => $prevFin['netBookingRevenue'] != 0
                    ? round(($fin['netBookingRevenue'] - $prevFin['netBookingRevenue']) / abs($prevFin['netBookingRevenue']) * 100, 2)
                    : null,
                'utilization_pct' => $vehicles['totals']['utilization'],
                'fleet_types' => count($vehicles['rows']),
                'fleet_units' => $vehicles['totals']['capacity_days'] > 0 && $period->days() > 0
                    ? (int) round($vehicles['totals']['capacity_days'] / $period->days())
                    : 0,
                'weekend_ratio' => $weekend['ratio'],
                'repeat_customer_pct' => $customers['repeat_pct'],
                'maintenance_days' => $maint['days'],
            ];
        } catch (\Throwable) {
            return [];
        }
    }
}
