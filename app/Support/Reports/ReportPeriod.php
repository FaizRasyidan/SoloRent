<?php

namespace App\Support\Reports;

use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Periode laporan. Seluruh batas dihitung dalam timezone bisnis
 * Asia/Jakarta agar transaksi malam hari WIB tidak jatuh ke
 * tanggal sebelumnya (bug 00:00 UTC).
 */
final class ReportPeriod
{
    public const TIMEZONE = 'Asia/Jakarta';

    public const PRESETS = [
        'today',
        'yesterday',
        'last_7',
        'last_30',
        'this_month',
        'last_month',
        'this_year',
        'custom',
    ];

    public const GROUP_DAY = 'day';

    public const GROUP_WEEK = 'week';

    public const GROUP_MONTH = 'month';

    public const MAX_CUSTOM_DAYS = 400;

    public function __construct(
        public readonly Carbon $from,
        public readonly Carbon $to,
        public readonly string $preset,
        public readonly string $grouping,
    ) {}

    /**
     * @param  array{period?: string|null, from?: string|null, to?: string|null, group?: string|null}  $input
     */
    public static function fromArray(array $input): self
    {
        $tz = self::TIMEZONE;
        $preset = strtolower((string) ($input['period'] ?? 'last_30'));
        if (! in_array($preset, self::PRESETS, true)) {
            $preset = 'last_30';
        }

        $now = Carbon::now($tz);

        [$from, $to] = match ($preset) {
            'today' => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],
            'yesterday' => [$now->copy()->subDay()->startOfDay(), $now->copy()->subDay()->endOfDay()],
            'last_7' => [$now->copy()->subDays(6)->startOfDay(), $now->copy()->endOfDay()],
            'last_30' => [$now->copy()->subDays(29)->startOfDay(), $now->copy()->endOfDay()],
            'this_month' => [$now->copy()->startOfMonth()->startOfDay(), $now->copy()->endOfDay()],
            'last_month' => [
                $now->copy()->subMonthNoOverflow()->startOfMonth()->startOfDay(),
                $now->copy()->subMonthNoOverflow()->endOfMonth()->endOfDay(),
            ],
            'this_year' => [$now->copy()->startOfYear()->startOfDay(), $now->copy()->endOfDay()],
            'custom' => self::resolveCustom($input, $now),
        };

        // Pengaman: from tidak boleh melewati to.
        if ($from->greaterThan($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        $days = (int) ($from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1);
        if ($days > self::MAX_CUSTOM_DAYS) {
            $from = $to->copy()->subDays(self::MAX_CUSTOM_DAYS - 1)->startOfDay();
            $days = self::MAX_CUSTOM_DAYS;
        }

        $group = strtolower((string) ($input['group'] ?? 'auto'));
        if (! in_array($group, [self::GROUP_DAY, self::GROUP_WEEK, self::GROUP_MONTH], true)) {
            $group = $days <= 31 ? self::GROUP_DAY : ($days <= 120 ? self::GROUP_WEEK : self::GROUP_MONTH);
        }

        return new self($from, $to, $preset, $group);
    }

    /**
     * @param  array{from?: string|null, to?: string|null}  $input
     * @return array{0: Carbon, 1: Carbon}
     */
    private static function resolveCustom(array $input, Carbon $now): array
    {
        $tz = self::TIMEZONE;

        try {
            $from = isset($input['from']) && $input['from'] !== null && $input['from'] !== ''
                ? Carbon::parse((string) $input['from'], $tz)->startOfDay()
                : $now->copy()->subDays(29)->startOfDay();
        } catch (\Throwable) {
            $from = $now->copy()->subDays(29)->startOfDay();
        }

        try {
            $to = isset($input['to']) && $input['to'] !== null && $input['to'] !== ''
                ? Carbon::parse((string) $input['to'], $tz)->endOfDay()
                : $now->copy()->endOfDay();
        } catch (\Throwable) {
            $to = $now->copy()->endOfDay();
        }

        return [$from, $to];
    }

    public function days(): int
    {
        return (int) ($this->from->copy()->startOfDay()->diffInDays($this->to->copy()->startOfDay()) + 1);
    }

    public function fromDateString(): string
    {
        return $this->from->copy()->timezone(self::TIMEZONE)->toDateString();
    }

    public function toDateString(): string
    {
        return $this->to->copy()->timezone(self::TIMEZONE)->toDateString();
    }

    public function label(): string
    {
        $from = $this->from->copy()->timezone(self::TIMEZONE);
        $to = $this->to->copy()->timezone(self::TIMEZONE);

        if ($from->toDateString() === $to->toDateString()) {
            return $from->isoFormat('D MMMM YYYY');
        }

        if ($from->month === $to->month && $from->year === $to->year) {
            return $from->format('j').' – '.$to->isoFormat('D MMMM YYYY');
        }

        if ($from->year === $to->year) {
            return $from->isoFormat('D MMM').' – '.$to->isoFormat('D MMM YYYY');
        }

        return $from->isoFormat('D MMM YYYY').' – '.$to->isoFormat('D MMM YYYY');
    }

    /** @return array{from: string, to: string, preset: string, grouping: string, label: string, days: int, timezone: string} */
    public function toArray(): array
    {
        return [
            'from' => $this->fromDateString(),
            'to' => $this->toDateString(),
            'preset' => $this->preset,
            'grouping' => $this->grouping,
            'label' => $this->label(),
            'days' => $this->days(),
            'timezone' => self::TIMEZONE,
        ];
    }

    public function startDateTime(): CarbonInterface
    {
        return $this->from->copy();
    }

    public function endDateTime(): CarbonInterface
    {
        return $this->to->copy();
    }
}
