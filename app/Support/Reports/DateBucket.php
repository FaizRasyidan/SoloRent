<?php

namespace App\Support\Reports;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Bucket tanggal lintas driver database.
 *
 * Dev memakai MySQL, test memakai SQLite in-memory (tanpa fungsi
 * DATE()). Seluruh tren dikelompokkan per hari di SQL memakai
 * ekspresi per driver, lalu di-rollup ke minggu/bulan di PHP —
 * sehingga hasil identik di kedua driver.
 */
final class DateBucket
{
    /** @return list<array{key: string, label: string, start: string, end: string}> */
    public static function buckets(ReportPeriod $period, string $grouping): array
    {
        $tz = ReportPeriod::TIMEZONE;

        return match ($grouping) {
            ReportPeriod::GROUP_WEEK => self::weekBuckets($period, $tz),
            ReportPeriod::GROUP_MONTH => self::monthBuckets($period, $tz),
            default => self::dayBuckets($period, $tz),
        };
    }

    /** @return list<array{key: string, label: string, start: string, end: string}> */
    private static function dayBuckets(ReportPeriod $period, string $tz): array
    {
        $buckets = [];
        $cursor = $period->from->copy()->timezone($tz)->startOfDay();
        $end = $period->to->copy()->timezone($tz)->startOfDay();

        while ($cursor->lessThanOrEqualTo($end)) {
            $buckets[] = [
                'key' => $cursor->toDateString(),
                'label' => $cursor->isoFormat('D MMM'),
                'start' => $cursor->toDateString(),
                'end' => $cursor->toDateString(),
            ];
            $cursor = $cursor->copy()->addDay();
        }

        return $buckets;
    }

    /** @return list<array{key: string, label: string, start: string, end: string}> */
    private static function weekBuckets(ReportPeriod $period, string $tz): array
    {
        $buckets = [];
        $cursor = $period->from->copy()->timezone($tz)->startOfDay();
        $end = $period->to->copy()->timezone($tz)->startOfDay();

        while ($cursor->lessThanOrEqualTo($end)) {
            $weekEnd = $cursor->copy()->addDays(6);
            if ($weekEnd->greaterThan($end)) {
                $weekEnd = $end->copy();
            }

            $sameMonth = $cursor->month === $weekEnd->month;
            $label = $sameMonth
                ? $cursor->format('j').'–'.$weekEnd->format('j M')
                : $cursor->format('j M').'–'.$weekEnd->format('j M');

            $buckets[] = [
                'key' => $cursor->toDateString().'_'.$weekEnd->toDateString(),
                'label' => $label,
                'start' => $cursor->toDateString(),
                'end' => $weekEnd->toDateString(),
            ];

            $cursor = $weekEnd->copy()->addDay();
        }

        return $buckets;
    }

    /** @return list<array{key: string, label: string, start: string, end: string}> */
    private static function monthBuckets(ReportPeriod $period, string $tz): array
    {
        $buckets = [];
        $cursor = $period->from->copy()->timezone($tz)->startOfMonth()->startOfDay();
        $end = $period->to->copy()->timezone($tz)->startOfDay();

        while ($cursor->lessThanOrEqualTo($end)) {
            $monthStart = $cursor->copy()->startOfMonth();
            $monthEnd = $cursor->copy()->endOfMonth();
            $rangeStart = $monthStart->greaterThan($period->from) ? $monthStart : $period->from->copy()->startOfDay();
            $rangeEnd = $monthEnd->lessThan($period->to) ? $monthEnd : $period->to->copy()->startOfDay();

            $buckets[] = [
                'key' => $cursor->format('Y-m'),
                'label' => $cursor->isoFormat('MMM YYYY'),
                'start' => $rangeStart->toDateString(),
                'end' => $rangeEnd->toDateString(),
            ];

            $cursor = $cursor->copy()->addMonthNoOverflow()->startOfMonth();
        }

        return $buckets;
    }

    /**
     * Ekspresi SQL pengelompokan per hari untuk kolom datetime/date.
     * Dipakai sebagai selectRaw: `{expr} as day`.
     */
    public static function dayExpression(string $column): string
    {
        $driver = self::driver();

        if ($driver === 'sqlite') {
            return "strftime('%Y-%m-%d', {$column})";
        }

        // MySQL / MariaDB.
        return "DATE({$column})";
    }

    /**
     * Ekspresi SQL pengelompokan per hari untuk kolom datetime (created_at,
     * paid_at, processed_at) dengan konversi UTC → Asia/Jakarta.
     * DB menyimpan UTC (app TZ = UTC); tanpa konversi, transaksi WIB
     * dini hari jatuh ke tanggal sebelumnya (bug 00:00 UTC).
     */
    public static function dayExpressionTz(string $column): string
    {
        $driver = self::driver();

        if ($driver === 'sqlite') {
            return "strftime('%Y-%m-%d', {$column}, '+7 hours')";
        }

        // MySQL / MariaDB — offset notation works without tz tables.
        return "DATE(CONVERT_TZ({$column}, '+00:00', '+07:00'))";
    }

    public static function driver(): string
    {
        try {
            return (string) DB::getDriverName();
        } catch (\Throwable) {
            return (string) config('database.default') === 'sqlite' ? 'sqlite' : 'mysql';
        }
    }

    /**
     * Rollup nilai harian (key Y-m-d => angka) ke bucket minggu/bulan.
     *
     * @param  array<string, int>  $daily
     * @param  list<array{key: string, label: string, start: string, end: string}>  $buckets
     * @return array<int, array{key: string, label: string, value: int}>
     */
    public static function rollup(array $daily, array $buckets, string $grouping): array
    {
        if ($grouping === ReportPeriod::GROUP_DAY) {
            return array_map(fn (array $bucket) => [
                'key' => $bucket['key'],
                'label' => $bucket['label'],
                'value' => (int) ($daily[$bucket['key']] ?? 0),
            ], $buckets);
        }

        return array_map(function (array $bucket) use ($daily) {
            $start = Carbon::parse($bucket['start'], ReportPeriod::TIMEZONE)->startOfDay();
            $end = Carbon::parse($bucket['end'], ReportPeriod::TIMEZONE)->startOfDay();
            $total = 0;
            $cursor = $start->copy();
            while ($cursor->lessThanOrEqualTo($end)) {
                $total += (int) ($daily[$cursor->toDateString()] ?? 0);
                $cursor = $cursor->copy()->addDay();
            }

            return ['key' => $bucket['key'], 'label' => $bucket['label'], 'value' => $total];
        }, $buckets);
    }

    /**
     * Rollup multi-seri harian ke bucket (mis. gross/refund/net per hari).
     *
     * @param  array<string, array<string, int>>  $daily  day => [serie => value]
     * @param  list<array{key: string, label: string, start: string, end: string}>  $buckets
     * @param  list<string>  $series
     * @return array<int, array{key: string, label: string} & array<string, int>>
     */
    public static function rollupMulti(array $daily, array $buckets, string $grouping, array $series): array
    {
        return array_map(function (array $bucket) use ($daily, $grouping, $series) {
            $row = ['key' => $bucket['key'], 'label' => $bucket['label']];
            foreach ($series as $serie) {
                $row[$serie] = 0;
            }

            if ($grouping === ReportPeriod::GROUP_DAY) {
                $day = $daily[$bucket['key']] ?? [];
                foreach ($series as $serie) {
                    $row[$serie] = (int) ($day[$serie] ?? 0);
                }

                return $row;
            }

            $start = Carbon::parse($bucket['start'], ReportPeriod::TIMEZONE)->startOfDay();
            $end = Carbon::parse($bucket['end'], ReportPeriod::TIMEZONE)->startOfDay();
            $cursor = $start->copy();
            while ($cursor->lessThanOrEqualTo($end)) {
                $day = $daily[$cursor->toDateString()] ?? [];
                foreach ($series as $serie) {
                    $row[$serie] += (int) ($day[$serie] ?? 0);
                }
                $cursor = $cursor->copy()->addDay();
            }

            return $row;
        }, $buckets);
    }
}
