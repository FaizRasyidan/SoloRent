import { Link, router } from '@inertiajs/react';
import { CalendarDays, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type {
    ReportFilters,
    ReportPeriodInfo,
    VehicleOption,
} from '@/types/reports';

const PRESETS: { value: string; label: string }[] = [
    { value: 'today', label: 'Hari Ini' },
    { value: 'yesterday', label: 'Kemarin' },
    { value: 'last_7', label: '7 Hari' },
    { value: 'last_30', label: '30 Hari' },
    { value: 'this_month', label: 'Bulan Ini' },
    { value: 'last_month', label: 'Bulan Lalu' },
    { value: 'this_year', label: 'Tahun Ini' },
    { value: 'custom', label: 'Custom' },
];

export function ReportFilterBar({
    filters,
    period,
    vehicleOptions,
}: {
    filters: ReportFilters;
    period: ReportPeriodInfo;
    vehicleOptions: VehicleOption[];
}) {
    const [from, setFrom] = useState(period.from);
    const [to, setTo] = useState(period.to);
    const [customOpen, setCustomOpen] = useState(filters.period === 'custom');

    const go = (
        patch: Record<string, string | number | null>,
        resetPage = true,
    ) => {
        router.get(
            '/admin/reports',
            {
                period: filters.period,
                from: filters.period === 'custom' ? period.from : null,
                to: filters.period === 'custom' ? period.to : null,
                group: filters.group === 'auto' ? null : filters.group,
                category: filters.category,
                vehicle: filters.vehicle,
                tab: filters.tab,
                status: filters.status,
                search: filters.search,
                ...patch,
                ...(resetPage ? { page: null } : {}),
            },
            { preserveState: true, replace: true, preserveScroll: true },
        );
    };

    const exportHref = (() => {
        const params = new URLSearchParams();
        params.set('period', filters.period);
        if (filters.period === 'custom') {
            params.set('from', period.from);
            params.set('to', period.to);
        }
        if (filters.group !== 'auto') params.set('group', filters.group);
        if (filters.category) params.set('category', filters.category);
        if (filters.vehicle) params.set('vehicle', String(filters.vehicle));
        if (filters.status) params.set('status', filters.status);
        if (filters.search) params.set('search', filters.search);
        params.set(
            'report',
            filters.tab === 'overview' ? 'overview' : filters.tab,
        );
        return `/admin/reports/export?${params.toString()}`;
    })();

    return (
        <div className="print-hidden animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                    <CalendarDays className="size-3.5 text-slate-400" />
                    {period.label} · {period.days} hari ·{' '}
                    {period.timezone.replace('Asia/', '')}
                </p>
                <div className="flex items-center gap-2">
                    <a
                        href={exportHref}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                    >
                        <Download className="size-3.5" /> Export CSV
                    </a>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <Printer className="size-3.5" /> Print
                    </button>
                </div>
            </div>

            <div
                className="mt-3 flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="Pilih periode"
            >
                {PRESETS.map((p) => {
                    const active = filters.period === p.value;
                    return (
                        <button
                            key={p.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                                if (p.value === 'custom') {
                                    setCustomOpen(true);
                                    go({ period: 'custom', from, to });
                                } else {
                                    setCustomOpen(false);
                                    go({
                                        period: p.value,
                                        from: null,
                                        to: null,
                                    });
                                }
                            }}
                            className={cn(
                                'shrink-0 scroll-mx-2 rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                                active
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                            )}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>

            {(customOpen || filters.period === 'custom') && (
                <form
                    className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-[1fr_1fr_auto]"
                    onSubmit={(e) => {
                        e.preventDefault();
                        go({ period: 'custom', from, to });
                    }}
                >
                    <label className="block">
                        <span className="mb-1 block text-[11px] font-medium text-slate-500">
                            Tanggal mulai
                        </span>
                        <input
                            type="date"
                            value={from}
                            max={to}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-[11px] font-medium text-slate-500">
                            Tanggal akhir
                        </span>
                        <input
                            type="date"
                            value={to}
                            min={from}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                        />
                    </label>
                    <button
                        type="submit"
                        className="col-span-2 h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white sm:col-span-1 sm:self-end"
                    >
                        Terapkan
                    </button>
                </form>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">
                        Kategori
                    </span>
                    <select
                        value={filters.category ?? 'all'}
                        onChange={(e) =>
                            go({
                                category:
                                    e.target.value === 'all'
                                        ? null
                                        : e.target.value,
                                vehicle: null,
                            })
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                        <option value="all">Semua Kendaraan</option>
                        <option value="motor">Motor</option>
                        <option value="mobil">Mobil</option>
                    </select>
                </label>
                <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">
                        Kendaraan
                    </span>
                    <select
                        value={filters.vehicle ?? 'all'}
                        onChange={(e) =>
                            go({
                                vehicle:
                                    e.target.value === 'all'
                                        ? null
                                        : Number(e.target.value),
                            })
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                        <option value="all">Semua unit</option>
                        {vehicleOptions.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">
                        Pengelompokan
                    </span>
                    <select
                        value={filters.group}
                        onChange={(e) =>
                            go({
                                group:
                                    e.target.value === 'auto'
                                        ? null
                                        : e.target.value,
                            })
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                        <option value="auto">Otomatis</option>
                        <option value="day">Harian</option>
                        <option value="week">Mingguan</option>
                        <option value="month">Bulanan</option>
                    </select>
                </label>
                <div className="hidden items-end lg:flex">
                    <Link
                        href="/admin/reports"
                        data={{ tab: filters.tab }}
                        preserveState
                        replace
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Reset filter
                    </Link>
                </div>
            </div>
        </div>
    );
}
