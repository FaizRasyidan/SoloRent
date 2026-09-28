import { router } from '@inertiajs/react';
import {
    CalendarCheck,
    CircleCheck,
    ClipboardList,
    Clock3,
    Search,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { ReportBarChart } from '@/components/admin/reports/report-bar-chart';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import {
    ReportPagination,
    ReportTableHead,
    ReportTableShell,
} from '@/components/admin/reports/report-table';
import { ReportTrendChart } from '@/components/admin/reports/report-trend-chart';
import { Badge } from '@/components/ui/badge';
import { formatDateShort, rupiah } from '@/lib/format';
import { reportHref } from '@/lib/reports';
import type { BookingSection, ReportFilters } from '@/types/reports';

const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    confirmed: 'bg-sky-50 text-sky-800 border-sky-200',
    preparing: 'bg-violet-50 text-violet-800 border-violet-200',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

const STATUS_OPTIONS = [
    { value: '', label: 'Semua status' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

export function BookingSectionView({
    section,
    filters,
}: {
    section: BookingSection;
    filters: ReportFilters;
}) {
    const { booking, customers, table } = section;
    const c = booking.counts;
    const [search, setSearch] = useState(filters.search ?? '');

    const goTable = (patch: Record<string, string | null>) => {
        router.get(
            '/admin/reports',
            {
                tab: 'booking',
                period: filters.period,
                from: filters.period === 'custom' ? filters.from : null,
                to: filters.period === 'custom' ? filters.to : null,
                category: filters.category,
                vehicle: filters.vehicle,
                group: filters.group === 'auto' ? null : filters.group,
                status: filters.status,
                search: search || null,
                ...patch,
            },
            { preserveState: true, replace: true, preserveScroll: true },
        );
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
                <KpiTile
                    index={0}
                    icon={ClipboardList}
                    label="Total Booking"
                    value={String(c.total ?? 0)}
                    href={reportHref(filters, 'booking', { status: null })}
                />
                <KpiTile
                    index={1}
                    icon={Clock3}
                    label="Pending"
                    value={String(c.pending ?? 0)}
                    href={reportHref(filters, 'booking', { status: 'pending' })}
                />
                <KpiTile
                    index={2}
                    icon={CalendarCheck}
                    label="Confirmed"
                    value={String(c.confirmed ?? 0)}
                    href={reportHref(filters, 'booking', {
                        status: 'confirmed',
                    })}
                />
                <KpiTile
                    index={3}
                    icon={CalendarCheck}
                    label="Active"
                    value={String(c.active ?? 0)}
                    tone="info"
                    href={reportHref(filters, 'booking', { status: 'active' })}
                />
                <KpiTile
                    index={4}
                    icon={CircleCheck}
                    label="Completed"
                    value={String(c.completed ?? 0)}
                    tone="success"
                    href={reportHref(filters, 'booking', {
                        status: 'completed',
                    })}
                />
                <KpiTile
                    index={5}
                    icon={XCircle}
                    label="Cancelled"
                    value={String(c.cancelled ?? 0)}
                    tone="danger"
                    href={reportHref(filters, 'booking', {
                        status: 'cancelled',
                    })}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="xl:col-span-3">
                    <SectionCard
                        index={2}
                        title="Tren booking"
                        subtitle="Jumlah booking yang dibuat per periode"
                        basis={booking.basis}
                    >
                        {(c.total ?? 0) === 0 ? (
                            <ReportEmpty
                                title="Belum ada data pada periode ini."
                                hint="Coba pilih periode lainnya."
                            />
                        ) : (
                            <ReportTrendChart
                                data={booking.trend.map((p) => ({
                                    key: p.key,
                                    label: p.label,
                                    value: p.count,
                                }))}
                                formatValue={(n) => `${n} booking`}
                                ariaLabel="Grafik tren booking"
                            />
                        )}
                    </SectionCard>
                </div>
                <div className="xl:col-span-2">
                    <SectionCard
                        index={3}
                        title="Komposisi status"
                        subtitle="Perbandingan status booking"
                        basis={booking.basis}
                    >
                        <ReportBarChart
                            items={[
                                'pending',
                                'confirmed',
                                'preparing',
                                'active',
                                'completed',
                                'cancelled',
                            ].map((s) => ({
                                label: s,
                                value: c[s] ?? 0,
                            }))}
                            formatValue={(n) => String(n)}
                            ariaLabel="Komposisi status booking"
                        />
                    </SectionCard>
                </div>
            </div>

            <SectionCard
                index={4}
                title="Detail booking"
                subtitle="Klik angka KPI di atas untuk memfilter tabel ini"
                basis={booking.basis}
                action={
                    <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            goTable({});
                        }}
                    >
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Kode / nama / telepon"
                                aria-label="Cari booking"
                                className="h-9 w-44 rounded-xl border border-slate-200 bg-white pr-2 pl-8 text-xs outline-none focus:border-slate-400 sm:w-52"
                            />
                        </div>
                        <select
                            value={filters.status ?? ''}
                            onChange={(e) =>
                                goTable({ status: e.target.value || null })
                            }
                            aria-label="Filter status"
                            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none"
                        >
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white"
                        >
                            Cari
                        </button>
                    </form>
                }
            >
                {table.data.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya atau ubah filter status."
                    />
                ) : (
                    <>
                        <ReportTableShell
                            minWidth={860}
                            label="Tabel detail booking"
                        >
                            <ReportTableHead
                                columns={[
                                    { label: 'Booking' },
                                    { label: 'Customer' },
                                    { label: 'Kendaraan' },
                                    { label: 'Periode' },
                                    { label: 'Bayar', align: 'right' },
                                    { label: 'Status' },
                                ]}
                            />
                            <tbody className="text-slate-800">
                                {table.data.map((b) => (
                                    <tr
                                        key={b.booking_code}
                                        className="border-b border-slate-100 last:border-0"
                                    >
                                        <td className="py-3 pr-4">
                                            <p className="font-mono text-xs font-bold">
                                                {b.booking_code}
                                            </p>
                                            <p className="text-[11px] text-slate-400 tabular-nums">
                                                {b.created_at}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <p className="text-sm font-medium">
                                                {b.customer_name}
                                            </p>
                                            <p className="font-mono text-[11px] text-slate-400">
                                                {b.customer_phone}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4 text-xs text-slate-500">
                                            {b.vehicle_name ?? '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-xs whitespace-nowrap text-slate-500 tabular-nums">
                                            {formatDateShort(b.start_date)} –{' '}
                                            {formatDateShort(b.end_date)}
                                        </td>
                                        <td className="py-3 pr-4 text-right text-sm font-semibold tabular-nums">
                                            {rupiah(b.paid)}
                                            <p className="text-[11px] font-normal text-slate-400">
                                                dari {rupiah(b.total)}
                                            </p>
                                        </td>
                                        <td className="py-3">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    STATUS_STYLE[b.status] ?? ''
                                                }
                                            >
                                                {b.status}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </ReportTableShell>
                        <ReportPagination links={table.links} />
                    </>
                )}
            </SectionCard>

            <SectionCard
                index={5}
                title="Ringkasan customer"
                subtitle="Dikelompokkan per nomor telepon · tanpa ranking loyalitas"
                basis={customers.basis}
            >
                {customers.rows.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <ReportTableShell
                        minWidth={680}
                        label="Tabel ringkasan customer"
                    >
                        <ReportTableHead
                            columns={[
                                { label: 'Customer' },
                                { label: 'Booking', align: 'right' },
                                { label: 'Selesai', align: 'right' },
                                { label: 'Batal', align: 'right' },
                                { label: 'Total Belanja', align: 'right' },
                            ]}
                        />
                        <tbody className="text-slate-800">
                            {customers.rows.map((r) => (
                                <tr
                                    key={r.customer_phone}
                                    className="border-b border-slate-100 last:border-0"
                                >
                                    <td className="py-3 pr-4">
                                        <p className="text-sm font-medium">
                                            {r.customer_name}
                                        </p>
                                        <p className="font-mono text-[11px] text-slate-400">
                                            {r.customer_phone}
                                        </p>
                                    </td>
                                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                        {r.total_booking}
                                    </td>
                                    <td className="py-3 pr-4 text-right tabular-nums">
                                        {r.completed}
                                    </td>
                                    <td className="py-3 pr-4 text-right tabular-nums">
                                        {r.cancelled}
                                    </td>
                                    <td className="py-3 text-right font-semibold tabular-nums">
                                        {rupiah(r.total_spent)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </ReportTableShell>
                )}
            </SectionCard>
        </div>
    );
}
