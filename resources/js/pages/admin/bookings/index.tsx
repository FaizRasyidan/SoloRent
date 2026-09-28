import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Eye,
    Plus,
    Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    BOOKING_STATUS_LABELS,
    type AdminBookingRow,
    type BookingFilters,
    type Paginated,
} from '@/types';
import { cn } from '@/lib/utils';

type Props = {
    bookings: Paginated<AdminBookingRow>;
    filters: BookingFilters & { payment_status?: string | null };
    statusLabels: Record<string, string>;
    statusCounts: Record<string, number>;
    paymentStatusLabels: Record<string, string>;
    cancellationLabels: Record<string, string>;
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(n);

const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
    });

const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    confirmed: 'bg-sky-50 text-sky-800 border-sky-200',
    preparing: 'bg-violet-50 text-violet-800 border-violet-200',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

const periodOptions = [
    { value: '', label: 'Semua tanggal' },
    { value: 'today', label: 'Hari ini' },
    { value: 'tomorrow', label: 'Besok' },
    { value: 'week', label: 'Minggu ini' },
    { value: 'month', label: 'Bulan ini' },
    { value: 'custom', label: 'Custom' },
];

export default function BookingIndex() {
    const { bookings, filters, statusCounts } = usePage()
        .props as unknown as Props;

    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [period, setPeriod] = useState(filters.period ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [driver, setDriver] = useState(filters.driver ?? '');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                reload({ search });
            }
        }, 450);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const reload = (overrides: Record<string, string>) => {
        router.get(
            '/admin/bookings',
            {
                search: overrides.search ?? search,
                status: overrides.status ?? status,
                period: overrides.period ?? period,
                from: overrides.from ?? from,
                to: overrides.to ?? to,
                driver: overrides.driver ?? driver,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const apply = (key: string, value: string) => {
        if (key === 'status') setStatus(value);
        if (key === 'period') setPeriod(value);
        if (key === 'from') setFrom(value);
        if (key === 'to') setTo(value);
        if (key === 'driver') setDriver(value);
        reload({ [key]: value });
    };

    const pillHref = (value: string) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (value) params.set('status', value);
        if (period) params.set('period', period);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (driver) params.set('driver', driver);
        const qs = params.toString();
        return `/admin/bookings${qs ? `?${qs}` : ''}`;
    };

    return (
        <AdminLayout title="Booking">
            <Head title="Kelola Booking" />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
                        Booking
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Kelola seluruh pemesanan kendaraan dan proses rental
                        customer.
                    </p>
                </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4">
                {/* Status quick-filter pills */}
                <div
                    className="mb-3 flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Filter cepat status booking"
                >
                    <StatusPill
                        active={status === ''}
                        href={pillHref('')}
                        label="Semua"
                        count={statusCounts.all ?? 0}
                    />
                    {Object.entries(BOOKING_STATUS_LABELS).map(
                        ([value, label]) => (
                            <StatusPill
                                key={value}
                                active={status === value}
                                href={pillHref(value)}
                                label={label}
                                count={statusCounts[value] ?? 0}
                                tone={value}
                            />
                        ),
                    )}
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari booking, customer, atau kendaraan..."
                            aria-label="Cari booking"
                            className="h-11 rounded-xl pr-9 pl-10"
                        />
                        {search && (
                            <button
                                type="button"
                                aria-label="Bersihkan pencarian"
                                onClick={() => setSearch('')}
                                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md px-1 text-lg leading-none text-slate-400 hover:text-slate-700"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={period}
                            onChange={(e) => apply('period', e.target.value)}
                            aria-label="Filter tanggal"
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        >
                            {periodOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={driver}
                            onChange={(e) => apply('driver', e.target.value)}
                            aria-label="Filter driver"
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        >
                            <option value="">Semua driver</option>
                            <option value="unassigned">
                                Belum dapat driver
                            </option>
                            <option value="assigned">Sudah ada driver</option>
                        </select>
                        {period === 'custom' && (
                            <>
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) =>
                                        apply('from', e.target.value)
                                    }
                                    aria-label="Tanggal mulai"
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                                />
                                <input
                                    type="date"
                                    value={to}
                                    onChange={(e) =>
                                        apply('to', e.target.value)
                                    }
                                    aria-label="Tanggal selesai"
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                {bookings.data.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <CalendarDays className="size-6" />
                        </div>
                        <p className="mt-4 text-[15px] font-semibold text-slate-900">
                            Belum ada booking
                        </p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            Booking customer akan muncul di halaman ini.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs text-slate-500">
                                    <th className="px-5 py-3 font-medium">
                                        Booking
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Kendaraan
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Periode
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Layanan
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Total
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-800">
                                {bookings.data.map((b) => (
                                    <tr
                                        key={b.booking_code}
                                        className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                                    >
                                        <td className="px-5 py-3">
                                            <Link
                                                href={`/admin/bookings/${b.booking_code}`}
                                                className="font-mono text-xs font-semibold text-slate-900 hover:underline"
                                            >
                                                {b.booking_code}
                                            </Link>
                                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                                                {b.unit_code
                                                    ? `Unit ${b.unit_code}`
                                                    : 'Unit —'}
                                                {b.driver_name
                                                    ? ` · ${b.driver_name}`
                                                    : ''}
                                            </p>
                                            {b.open_damage && (
                                                <Link
                                                    href={`/admin/bookings/${b.booking_code}`}
                                                    title={`Tagihan kerusakan ${b.open_damage.charge_code}`}
                                                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 tabular-nums hover:bg-amber-200"
                                                >
                                                    DC · Rp
                                                    {Number(
                                                        b.open_damage
                                                            .outstanding,
                                                    ).toLocaleString('id-ID')}
                                                </Link>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium">
                                                {b.customer_name}
                                            </p>
                                            <p className="text-xs text-slate-500 tabular-nums">
                                                {b.customer_phone}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {b.vehicle_name ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">
                                            {fmtDate(b.start_date)} –{' '}
                                            {fmtDate(b.end_date)}
                                            <span className="text-xs text-slate-400">
                                                {' '}
                                                · {b.duration_days} hari
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                <Badge
                                                    variant="outline"
                                                    className="bg-slate-50 text-[11px]"
                                                >
                                                    {b.pickup_method ===
                                                    'delivery'
                                                        ? 'Diantar'
                                                        : 'Ambil di toko'}
                                                </Badge>
                                                {b.with_driver && (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-amber-200 bg-amber-50 text-[11px] text-amber-800"
                                                    >
                                                        + Driver
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    statusStyle[b.status] ?? ''
                                                }
                                            >
                                                {BOOKING_STATUS_LABELS[
                                                    b.status
                                                ] ?? b.status}
                                            </Badge>
                                            <p className="mt-1">
                                                <span
                                                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${b.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : b.payment_status === 'partial' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}
                                                >
                                                    {b.payment_status === 'paid'
                                                        ? 'Lunas'
                                                        : b.payment_status ===
                                                            'partial'
                                                          ? 'DP Sebagian'
                                                          : 'Belum Bayar'}
                                                </span>
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                            {rupiah(b.total)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={`/admin/bookings/${b.booking_code}`}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white transition-[transform,background-color] duration-150 ease-out hover:bg-slate-700 active:scale-[0.97]"
                                            >
                                                <Eye className="size-3.5" />
                                                Kelola Status
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {bookings.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5">
                        <p className="text-xs text-slate-500 tabular-nums">
                            Menampilkan {bookings.from}–{bookings.to} dari{' '}
                            {bookings.total} booking
                        </p>
                        <div className="flex items-center gap-1.5">
                            <PageLink
                                url={bookings.links[0]?.url ?? null}
                                label="Sebelumnya"
                                icon={<ChevronLeft className="size-4" />}
                            />
                            {bookings.links
                                .filter((l) => !Number.isNaN(Number(l.label)))
                                .map((l) => (
                                    <PageLink
                                        key={l.label}
                                        url={l.url}
                                        label={l.label}
                                        active={l.active}
                                    />
                                ))}
                            <PageLink
                                url={
                                    bookings.links[bookings.links.length - 1]
                                        ?.url ?? null
                                }
                                label="Berikutnya"
                                icon={<ChevronRight className="size-4" />}
                            />
                        </div>
                    </div>
                )}
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <Plus className="size-3.5" /> Booking manual belum diperlukan —
                booking dibuat customer dari halaman publik.
            </p>
        </AdminLayout>
    );
}

function StatusPill({
    active,
    href,
    label,
    count,
    tone,
}: {
    active: boolean;
    href: string;
    label: string;
    count: number;
    tone?: string;
}) {
    return (
        <Link
            href={href}
            preserveScroll
            aria-current={active ? 'true' : undefined}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97]',
                active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
            )}
        >
            <span
                className={cn('size-1.5 rounded-full', dotTone(tone, active))}
                aria-hidden
            />
            {label}
            <span
                className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500',
                )}
            >
                {count}
            </span>
        </Link>
    );
}

function dotTone(tone: string | undefined, active: boolean): string {
    if (active) return 'bg-white';
    switch (tone) {
        case 'pending':
            return 'bg-amber-500';
        case 'confirmed':
            return 'bg-sky-500';
        case 'preparing':
            return 'bg-violet-500';
        case 'active':
            return 'bg-emerald-500';
        case 'completed':
            return 'bg-slate-400';
        case 'cancelled':
            return 'bg-rose-500';
        default:
            return 'bg-slate-400';
    }
}

function PageLink({
    url,
    label,
    active,
    icon,
}: {
    url: string | null;
    label: string;
    active?: boolean;
    icon?: React.ReactNode;
}) {
    if (!url) {
        return (
            <span
                aria-disabled="true"
                className="inline-flex h-9 items-center rounded-lg px-2.5 text-sm text-slate-300"
            >
                {icon ?? label}
            </span>
        );
    }
    return (
        <Link
            href={url}
            preserveScroll
            preserveState
            aria-label={typeof icon !== 'undefined' ? label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-colors',
                active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
            )}
        >
            {icon ?? label}
        </Link>
    );
}
