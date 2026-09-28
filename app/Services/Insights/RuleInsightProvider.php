<?php

namespace App\Services\Insights;

use App\Contracts\Insights\InsightProvider;
use App\Models\Vehicle;
use App\Services\Reports\BusinessAnalyticsService;
use App\Services\Reports\ReportService;
use App\Support\Insights\Insight;
use App\Support\Reports\ReportPeriod;

/**
 * Rule-based insight provider (satu-satunya sumber insight saat AI mati).
 * Setiap rule adalah fungsi murni atas agregat READ-ONLY; bahasa faktual
 * Indonesia; setiap rule yang gagal min_sample TIDAK memancarkan apa pun.
 */
class RuleInsightProvider implements InsightProvider
{
    public function __construct(
        private BusinessAnalyticsService $analytics,
        private ReportService $reports,
    ) {}

    /** @param  array<string, mixed>  $context  @return list<Insight> */
    public function provide(array $context): array
    {
        $category = $context['category'] ?? null;
        $vehicleId = isset($context['vehicle']) ? (int) $context['vehicle'] : null;
        $cfg = (array) config('insights.rules', []);

        $out = [];
        foreach ([
            fn () => $this->weekendDemand($cfg['weekend_demand'] ?? [], $category, $vehicleId),
            fn () => $this->bookingGrowth($cfg['booking_growth'] ?? [], $category, $vehicleId),
            fn () => $this->revenueChange($cfg['revenue_change'] ?? [], $category, $vehicleId),
            fn () => $this->fleetUtilization($cfg['fleet_utilization'] ?? [], $category, $vehicleId),
            fn () => $this->topVehicle($cfg['top_vehicle'] ?? [], $category, $vehicleId),
            fn () => $this->repeatCustomer($cfg['repeat_customer'] ?? [], $category, $vehicleId),
            fn () => $this->cancellationRate($cfg['cancellation_rate'] ?? [], $category, $vehicleId),
            fn () => $this->maintenanceFrequency($cfg['maintenance_frequency'] ?? [], $category, $vehicleId),
            fn () => $this->lowStock($cfg['low_stock'] ?? []),
        ] as $rule) {
            try {
                $insight = $rule();
            } catch (\Throwable) {
                continue;
            }
            if ($insight instanceof Insight) {
                $out[] = $insight;
            }
        }

        return $out;
    }

    /** @param array<string, mixed> $cfg */
    private function enabled(array $cfg): bool
    {
        return ($cfg['enabled'] ?? true) === true;
    }

    private function confidence(int $n, int $min): string
    {
        return $n >= 2 * $min ? 'high' : 'medium';
    }

    private function num(int|float $n): string
    {
        return number_format($n, 0, ',', '.');
    }

    private function rupiah(int $n): string
    {
        return 'Rp'.number_format($n, 0, ',', '.');
    }

    /** @param  array<string, mixed>  $cfg */
    private function weekendDemand(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $weeks = max(1, (int) ($cfg['window_weeks'] ?? 4));
        $min = (int) ($cfg['min_sample'] ?? 8);
        $ratioNeed = (float) ($cfg['ratio'] ?? 1.20);

        $period = $this->analytics->windowPeriod($weeks * 7);
        $split = $this->analytics->weekendSplit($period, $category, $vehicleId);
        $total = $split['weekend_count'] + $split['weekday_count'];
        if ($total < $min || ($split['ratio'] ?? null) === null) {
            return null;
        }
        if ((float) $split['ratio'] < $ratioNeed) {
            return null;
        }

        $pct = round(((float) $split['ratio'] - 1) * 100);

        return new Insight(
            id: 'weekend_demand',
            category: 'demand',
            title: "Permintaan akhir pekan {$pct}% di atas hari kerja",
            summary: "Rata-rata {$split['weekend_avg']} booking/hari akhir pekan vs {$split['weekday_avg']} booking/hari kerja dalam {$weeks} minggu terakhir.",
            evidence: [
                "Based on: {$this->num($total)} bookings",
                "Periode {$weeks}-minggu ({$period->fromDateString()}–{$period->toDateString()})",
                "Akhir pekan: {$this->num($split['weekend_count'])} booking / {$split['weekend_days']} hari",
                "Hari kerja: {$this->num($split['weekday_count'])} booking / {$split['weekday_days']} hari",
            ],
            recommendation: 'Pertimbangkan kesiapan unit dan driver untuk Jumat–Minggu berikutnya.',
            confidence: $this->confidence($total, $min),
            priority: (int) ($cfg['priority'] ?? 10),
            actionUrl: '/admin/reports?tab=demand',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function bookingGrowth(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $days = max(7, (int) ($cfg['window_days'] ?? 30));
        $min = (int) ($cfg['min_sample'] ?? 20);
        $need = (float) ($cfg['change_pct'] ?? 20.0);

        $period = $this->analytics->windowPeriod($days);
        $cmp = $this->analytics->comparison($period, $category, $vehicleId);
        $cur = (int) $cmp['booking_current'];
        $prev = (int) $cmp['booking_previous'];
        if ($cur < $min || $prev < $min || $cmp['booking_change_pct'] === null) {
            return null;
        }
        $change = (float) $cmp['booking_change_pct'];
        if (abs($change) < $need) {
            return null;
        }
        $arah = $change > 0 ? 'naik' : 'turun';
        $pct = number_format(abs($change), 0, ',', '.');

        return new Insight(
            id: 'booking_growth',
            category: 'demand',
            title: "Booking {$arah} {$pct}% vs {$days} hari sebelumnya",
            summary: "{$this->num($cur)} booking dalam {$days} hari terakhir vs {$this->num($prev)} booking pada {$days} hari sebelumnya.",
            evidence: [
                "Based on: {$this->num($cur + $prev)} bookings",
                "Periode berjalan: {$period->fromDateString()}–{$period->toDateString()}",
                "Periode pembanding: {$this->num($prev)} booking",
            ],
            recommendation: $change > 0
                ? 'Pastikan ketersediaan unit mengikuti laju permintaan.'
                : 'Periksa kanal pemesanan dan ketersediaan unit pada periode tersebut.',
            confidence: $this->confidence(min($cur, $prev), $min),
            priority: (int) ($cfg['priority'] ?? 20),
            actionUrl: '/admin/reports?tab=booking',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function revenueChange(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $days = max(7, (int) ($cfg['window_days'] ?? 30));
        $minNet = (int) ($cfg['min_net'] ?? 1000000);
        $need = (float) ($cfg['change_pct'] ?? 20.0);

        $period = $this->analytics->windowPeriod($days);
        $cmp = $this->analytics->comparison($period, $category, $vehicleId);
        $cur = (int) $cmp['revenue_current'];
        $prev = (int) $cmp['revenue_previous'];
        if ($cur < $minNet || $prev < $minNet || $cmp['revenue_change_pct'] === null) {
            return null;
        }
        $change = (float) $cmp['revenue_change_pct'];
        if (abs($change) < $need) {
            return null;
        }
        $arah = $change > 0 ? 'naik' : 'turun';
        $pct = number_format(abs($change), 0, ',', '.');

        return new Insight(
            id: 'revenue_change',
            category: 'revenue',
            title: "Pendapatan bersih {$arah} {$pct}% vs {$days} hari sebelumnya",
            summary: "{$this->rupiah($cur)} dalam {$days} hari terakhir vs {$this->rupiah($prev)} pada periode sebelumnya.",
            evidence: [
                'Based on: pembayaran paid non-damage dikurangi refund completed',
                "Periode {$days}-hari ({$period->fromDateString()}–{$period->toDateString()})",
                "Periode berjalan: {$this->rupiah($cur)}",
                "Periode pembanding: {$this->rupiah($prev)}",
            ],
            recommendation: $change > 0
                ? 'Pantau refund dan outstanding agar net tetap terjaga.'
                : 'Periksa pembatalan, refund, dan booking belum dibayar pada periode tersebut.',
            confidence: $this->confidence((int) ($cur / max(1, $minNet)), 1) === 'high' ? 'high' : 'medium',
            priority: (int) ($cfg['priority'] ?? 30),
            actionUrl: '/admin/reports?tab=revenue',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function fleetUtilization(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $days = max(7, (int) ($cfg['window_days'] ?? 30));
        $high = (float) ($cfg['high_pct'] ?? 70.0);
        $low = (float) ($cfg['low_pct'] ?? 30.0);
        $minCap = (int) ($cfg['min_capacity_days'] ?? 10);

        $period = $this->analytics->windowPeriod($days);
        $data = $this->reports->vehicles($period, $category, $vehicleId);
        $totals = $data['totals'];
        $capacity = (int) $totals['capacity_days'];
        if ($capacity < $minCap) {
            return null;
        }
        $util = (float) $totals['utilization'];
        if ($util >= $high) {
            $kondisi = "mencapai {$this->num($util)}%";
        } elseif ($util <= $low) {
            $kondisi = "berada di {$this->num($util)}%";
        } else {
            return null;
        }

        return new Insight(
            id: 'fleet_utilization',
            category: 'fleet',
            title: "Utilisasi armada {$kondisi}",
            summary: "{$this->num($totals['rental_days'])} hari sewa dari {$this->num($capacity)} hari kapasitas dalam {$days} hari terakhir.",
            evidence: [
                "Based on: {$this->num($totals['rental_days'])} hari sewa",
                "Periode {$days}-hari ({$period->fromDateString()}–{$period->toDateString()})",
                "Kapasitas: {$this->num($capacity)} hari (unit aktif × hari)",
            ],
            recommendation: $util >= $high
                ? 'Pertimbangkan penambahan unit atau penyesuaian harga pada puncak permintaan.'
                : 'Pertimbangkan promosi atau penyesuaian harga untuk mengisi kapasitas kosong.',
            confidence: $this->confidence($capacity, $minCap),
            priority: (int) ($cfg['priority'] ?? 40),
            actionUrl: '/admin/reports?tab=vehicle',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function topVehicle(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $days = max(7, (int) ($cfg['window_days'] ?? 30));
        $need = (float) ($cfg['utilization_pct'] ?? 80.0);
        $minCap = (int) ($cfg['min_capacity_days'] ?? 10);

        $period = $this->analytics->windowPeriod($days);
        $data = $this->reports->vehicles($period, $category, $vehicleId);
        $rows = array_filter(
            $data['rows'],
            fn (array $r) => (float) $r['utilization'] >= $need && (int) $r['capacity_days'] >= $minCap
        );
        if ($rows === []) {
            return null;
        }
        usort($rows, fn ($a, $b) => $b['utilization'] <=> $a['utilization']);
        $top = $rows[0];

        return new Insight(
            id: 'top_vehicle_'.$top['id'],
            category: 'fleet',
            title: "{$top['name']} tersewa {$this->num($top['utilization'])}% dari kapasitasnya",
            summary: "{$this->num($top['rental_days'])} hari sewa dari {$this->num($top['capacity_days'])} hari kapasitas dalam {$days} hari terakhir.",
            evidence: [
                "Based on: {$this->num($top['bookings'])} bookings",
                "Periode {$days}-hari ({$period->fromDateString()}–{$period->toDateString()})",
                "Utilisasi: {$this->num($top['utilization'])}% ({$this->num($top['rental_days'])}/{$this->num($top['capacity_days'])} hari)",
            ],
            recommendation: 'Pastikan unit kendaraan ini mendapat prioritas perawatan terjadwal.',
            confidence: $this->confidence((int) $top['capacity_days'], $minCap),
            priority: (int) ($cfg['priority'] ?? 50),
            actionUrl: '/admin/reports?tab=vehicle',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function repeatCustomer(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $days = max(7, (int) ($cfg['window_days'] ?? 30));
        $need = (float) ($cfg['repeat_pct'] ?? 20.0);
        $min = (int) ($cfg['min_sample'] ?? 20);

        $period = $this->analytics->windowPeriod($days);
        $stats = $this->analytics->customerStats($period, $category, $vehicleId);
        if ($stats['total_bookings'] < $min || (float) $stats['repeat_pct'] < $need) {
            return null;
        }

        return new Insight(
            id: 'repeat_customer',
            category: 'customer',
            title: "{$this->num($stats['repeat_pct'])}% customer memesan ≥2 kali",
            summary: "{$this->num($stats['repeat_customers'])} dari {$this->num($stats['total_customers'])} customer unik memiliki ≥2 booking dalam {$days} hari terakhir.",
            evidence: [
                "Based on: {$this->num($stats['total_bookings'])} bookings",
                "Periode {$days}-hari ({$period->fromDateString()}–{$period->toDateString()})",
                "Customer berulang: {$this->num($stats['repeat_customers'])} dari {$this->num($stats['total_customers'])} unik",
            ],
            recommendation: 'Pertahankan kualitas layanan pada customer yang kembali menyewa.',
            confidence: $this->confidence($stats['total_bookings'], $min),
            priority: (int) ($cfg['priority'] ?? 60),
            actionUrl: '/admin/reports?tab=customer',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function cancellationRate(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $days = max(7, (int) ($cfg['window_days'] ?? 30));
        $need = (float) ($cfg['rate_pct'] ?? 25.0);
        $min = (int) ($cfg['min_sample'] ?? 20);

        $period = $this->analytics->windowPeriod($days);
        $data = $this->reports->cancellation($period, $category, $vehicleId);
        if ($data['total'] < $min || (float) $data['rate'] < $need) {
            return null;
        }

        return new Insight(
            id: 'cancellation_rate',
            category: 'cancellation',
            title: "Tingkat pembatalan {$this->num($data['rate'])}%",
            summary: "{$this->num($data['cancelled'])} dari {$this->num($data['total'])} booking dibatalkan dalam {$days} hari terakhir.",
            evidence: [
                "Based on: {$this->num($data['total'])} bookings",
                "Periode {$days}-hari ({$period->fromDateString()}–{$period->toDateString()})",
                "Dibatalkan: {$this->num($data['cancelled'])} booking",
            ],
            recommendation: 'Periksa alasan pembatalan dominan pada tab Pembatalan.',
            confidence: $this->confidence($data['total'], $min),
            priority: (int) ($cfg['priority'] ?? 70),
            actionUrl: '/admin/reports?tab=cancellation',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function maintenanceFrequency(array $cfg, ?string $category, ?int $vehicleId): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $days = max(30, (int) ($cfg['window_days'] ?? 90));
        $minRecords = (int) ($cfg['min_records'] ?? 2);
        $minDays = (int) ($cfg['min_days'] ?? 3);

        $period = $this->analytics->windowPeriod($days);
        $stats = $this->analytics->maintenanceStats($period, $category, $vehicleId);
        $hits = array_values(array_filter(
            $stats['per_unit'],
            fn (array $u) => $u['records'] >= $minRecords && $u['days'] >= $minDays
        ));
        if ($hits === []) {
            return null;
        }
        usort($hits, fn ($a, $b) => $b['days'] <=> $a['days']);
        $top = $hits[0];
        $label = trim($top['vehicle_name'].' '.($top['unit_code'] ?? ''));

        return new Insight(
            id: 'maintenance_unit_'.$top['unit_id'],
            category: 'maintenance',
            title: "{$label} masuk perawatan {$this->num($top['records'])} kali ({$this->num($top['days'])} hari)",
            summary: "Unit {$label} mencatat {$this->num($top['records'])} record perawatan dengan total {$this->num($top['days'])} hari downtime dalam {$days} hari terakhir.",
            evidence: [
                "Based on: {$this->num($stats['count'])} record perawatan",
                "Periode {$days}-hari ({$period->fromDateString()}–{$period->toDateString()})",
                "Unit: {$this->num($top['records'])} record, {$this->num($top['days'])} hari",
            ],
            recommendation: 'Jadwalkan pemeriksaan menyeluruh untuk unit tersebut.',
            confidence: $this->confidence($top['records'] + $top['days'], $minRecords + $minDays),
            priority: (int) ($cfg['priority'] ?? 80),
            actionUrl: '/admin/reports?tab=maintenance',
        );
    }

    /** @param  array<string, mixed>  $cfg */
    private function lowStock(array $cfg): ?Insight
    {
        if (! $this->enabled($cfg)) {
            return null;
        }
        $maxStock = (int) ($cfg['max_stock'] ?? 1);
        $maxItems = max(1, (int) ($cfg['max_items'] ?? 5));

        $rows = Vehicle::query()
            ->where('is_available', true)
            ->where('stock', '<=', $maxStock)
            ->orderBy('stock')
            ->limit($maxItems)
            ->get(['id', 'name', 'stock']);

        if ($rows->isEmpty()) {
            return null;
        }
        $names = $rows->map(fn (Vehicle $v) => "{$v->name} (sisa {$v->stock})")->all();

        return new Insight(
            id: 'low_stock',
            category: 'fleet',
            title: "{$rows->count()} tipe kendaraan hampir habis",
            summary: 'Tipe berikut tersisa ≤'.$maxStock.' unit tersedia: '.implode(', ', $names).'.',
            evidence: [
                'Based on: stok tipe kendaraan tersedia saat ini',
                'Dihitung dari kolom stock tipe berstatus tersedia',
                implode('; ', $names),
            ],
            recommendation: 'Periksa ketersediaan unit dan jadwal pengembalian terdekat.',
            confidence: 'high',
            priority: (int) ($cfg['priority'] ?? 90),
            actionUrl: '/admin/reports?tab=vehicle',
        );
    }

    public function periodForWindow(int $days): ReportPeriod
    {
        return $this->analytics->windowPeriod($days);
    }
}
