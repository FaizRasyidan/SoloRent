import { router } from '@inertiajs/react';
import { ReportTrendChart } from '@/components/admin/reports/report-trend-chart';
import { rupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardTrend } from '@/types/insights';

const RANGES = [
    { value: 7, label: '7 hari' },
    { value: 30, label: '30 hari' },
    { value: 90, label: '90 hari' },
];

export function TrendPanel({ trend }: { trend: DashboardTrend }) {
    const metric = trend.metric === 'revenue' ? 'revenue' : 'booking';

    const go = (patch: { range?: number; metric?: string }) => {
        router.get(
            '/admin/dashboard',
            { range: trend.range, metric, ...patch },
            { preserveState: true, replace: true, preserveScroll: true },
        );
    };

    const data = trend.points.map((p) => ({
        key: p.key,
        label: p.label,
        value: metric === 'revenue' ? p.net : p.bookings,
    }));

    const totalBooking = trend.points.reduce((s, p) => s + p.bookings, 0);
    const totalNet = trend.points.reduce((s, p) => s + p.net, 0);
    const summary =
        metric === 'revenue'
            ? `Total pendapatan bersih ${rupiah(totalNet)} dalam ${trend.period.days} hari.`
            : `Total ${totalBooking} booking dalam ${trend.period.days} hari.`;

    return (
        <section
            aria-label="Tren booking dan pendapatan"
            className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                        Tren Booking &amp; Pendapatan
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {trend.period.label} · {trend.period.days} hari ·{' '}
                        {trend.period.timezone.replace('Asia/', '')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div
                        className="flex rounded-full border border-slate-200 p-0.5"
                        role="group"
                        aria-label="Metrik tren"
                    >
                        {(
                            [
                                { value: 'booking', label: 'Booking' },
                                { value: 'revenue', label: 'Pendapatan' },
                            ] as const
                        ).map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                aria-pressed={metric === m.value}
                                onClick={() => go({ metric: m.value })}
                                className={cn(
                                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                                    metric === m.value
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-600 hover:bg-slate-100',
                                )}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    <div
                        className="flex rounded-full border border-slate-200 p-0.5"
                        role="group"
                        aria-label="Rentang tren"
                    >
                        {RANGES.map((r) => (
                            <button
                                key={r.value}
                                type="button"
                                aria-pressed={trend.range === r.value}
                                onClick={() => go({ range: r.value })}
                                className={cn(
                                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                                    trend.range === r.value
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-600 hover:bg-slate-100',
                                )}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-3">
                <ReportTrendChart
                    data={data}
                    height={180}
                    formatValue={(n) =>
                        metric === 'revenue'
                            ? rupiah(Math.round(n))
                            : String(Math.round(n))
                    }
                    money={metric === 'revenue'}
                    ariaLabel={`Grafik tren ${metric === 'revenue' ? 'pendapatan bersih' : 'booking'} ${trend.period.label}`}
                />
                <p className="mt-2 text-xs text-slate-500" role="status">
                    {summary}
                </p>
            </div>
        </section>
    );
}
