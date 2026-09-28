<?php

namespace App\Services\Reports;

use App\Models\Booking;
use App\Support\Reports\ReportPeriod;
use Carbon\Carbon;

/**
 * Forecast Phase 9: rata-rata bergerak (moving average) dari N bulan
 * kalender penuh terakhir. Selalu berlabel "Estimasi", tidak pernah
 * "Dijamin". "Belum tersedia cukup data" bila riwayat < N bulan penuh.
 * READ-ONLY.
 */
class ForecastService
{
    public function __construct(private ReportService $reports) {}

    /** @return array<string, mixed> */
    public function forecast(?string $category = null, ?int $vehicleId = null): array
    {
        $months = max(1, (int) config('insights.forecast.months', 3));
        $tz = ReportPeriod::TIMEZONE;
        $now = Carbon::now($tz);

        // Bulan berjalan dikecualikan (belum lengkap).
        $cursor = $now->copy()->startOfMonth()->subMonthNoOverflow();

        $history = [];
        for ($i = 0; $i < $months; $i++) {
            $from = $cursor->copy()->startOfMonth()->startOfDay();
            $to = $cursor->copy()->endOfMonth()->endOfDay();
            $period = new ReportPeriod($from, $to, 'custom', ReportPeriod::GROUP_DAY);

            $fin = $this->reports->financial($period, $category, $vehicleId);
            $bookings = Booking::query()
                ->whereBetween('created_at', [
                    $from->copy()->timezone('UTC'),
                    $to->copy()->timezone('UTC'),
                ])
                ->count();

            $history[] = [
                'key' => $cursor->format('Y-m'),
                'label' => $cursor->isoFormat('MMM YYYY'),
                'net' => (int) $fin['netBookingRevenue'],
                'gross' => (int) $fin['grossPaidBooking'],
                'refund' => (int) $fin['refundedAmount'],
                'bookings' => $bookings,
            ];
            $cursor = $cursor->copy()->subMonthNoOverflow();
        }
        $history = array_reverse($history);

        // Kecukupan data: butuh riwayat booking sejak sebelum bulan
        // tertua yang dipakai. Tanpa riwayat sepanjang itu → insufficient.
        $oldestStart = $now->copy()->startOfMonth()->subMonthsNoOverflow($months);
        $hasHistory = Booking::query()
            ->where('created_at', '<', $oldestStart->copy()->timezone('UTC'))
            ->exists();
        $recentActivity = array_sum(array_column($history, 'bookings')) > 0;
        $sufficient = $hasHistory && $recentActivity && count($history) >= $months;

        if (! $sufficient) {
            return [
                'sufficient' => false,
                'message' => 'Belum tersedia cukup data',
                'months_used' => $months,
                'history' => $history,
                'average_net' => null,
                'forecast_next' => null,
                'forecast_label' => null,
            ];
        }

        $average = (int) round(array_sum(array_column($history, 'net')) / $months);
        $next = $now->copy()->addMonthNoOverflow();

        return [
            'sufficient' => true,
            'message' => null,
            'months_used' => $months,
            'history' => $history,
            'average_net' => $average,
            'forecast_next' => $average,
            'forecast_label' => 'Estimasi '.$next->isoFormat('MMMM YYYY'),
        ];
    }
}
