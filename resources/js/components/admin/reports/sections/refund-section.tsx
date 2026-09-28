import { Link, router } from '@inertiajs/react';
import { CircleCheck, Clock3, RotateCcw, XCircle } from 'lucide-react';
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
import { rupiah } from '@/lib/format';
import type { RefundSection, ReportFilters } from '@/types/reports';

const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    processing: 'bg-sky-50 text-sky-800 border-sky-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    failed: 'bg-rose-50 text-rose-800 border-rose-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function RefundSectionView({
    section,
    filters,
}: {
    section: RefundSection;
    filters: ReportFilters;
}) {
    const { refunds, table } = section;
    const c = refunds.counts;

    const goStatus = (status: string | null) => {
        router.get(
            '/admin/reports',
            {
                tab: 'refund',
                period: filters.period,
                from: filters.period === 'custom' ? filters.from : null,
                to: filters.period === 'custom' ? filters.to : null,
                category: filters.category,
                vehicle: filters.vehicle,
                group: filters.group === 'auto' ? null : filters.group,
                status,
            },
            { preserveState: true, replace: true, preserveScroll: true },
        );
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                <KpiTile
                    index={0}
                    icon={RotateCcw}
                    label="Pengajuan"
                    value={String(c.requests)}
                    hint={`Dalam proses ${rupiah(refunds.in_process)}`}
                />
                <KpiTile
                    index={1}
                    icon={Clock3}
                    tone="warn"
                    label="Pending"
                    value={String(c.pending)}
                    hint="Menunggu diproses"
                />
                <KpiTile
                    index={2}
                    icon={Clock3}
                    tone="info"
                    label="Processing"
                    value={String(c.processing)}
                    hint="Sedang diproses"
                />
                <KpiTile
                    index={3}
                    icon={CircleCheck}
                    tone="success"
                    label="Completed"
                    value={String(c.completed)}
                    hint={rupiah(refunds.total_completed)}
                />
                <KpiTile
                    index={4}
                    icon={XCircle}
                    tone="danger"
                    label="Failed"
                    value={String(c.failed)}
                    hint="Gagal · lihat alasan"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="xl:col-span-3">
                    <SectionCard
                        index={2}
                        title="Tren refund"
                        subtitle="Refund completed per periode"
                        basis={refunds.basis}
                    >
                        {refunds.total_completed === 0 ? (
                            <ReportEmpty
                                title="Belum ada data pada periode ini."
                                hint="Coba pilih periode lainnya."
                            />
                        ) : (
                            <ReportTrendChart
                                data={refunds.trend.map((t) => ({
                                    key: t.key,
                                    label: t.label,
                                    value: t.amount,
                                }))}
                                formatValue={rupiah}
                                money
                                color="#0284C7"
                                ariaLabel="Grafik tren refund"
                            />
                        )}
                    </SectionCard>
                </div>
                <div className="xl:col-span-2">
                    <SectionCard
                        index={3}
                        title="Ringkasan nominal"
                        subtitle="Completed mengurangi net · dalam proses tidak"
                        basis={refunds.basis}
                    >
                        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-slate-200/70">
                            {[
                                {
                                    label: 'Completed (mengurangi net)',
                                    value: rupiah(refunds.total_completed),
                                },
                                {
                                    label: 'Dalam proses (belum dikurangi)',
                                    value: rupiah(refunds.in_process),
                                },
                            ].map((s) => (
                                <div
                                    key={s.label}
                                    className="bg-white px-4 py-3.5"
                                >
                                    <dt className="text-[11px] font-medium text-slate-500">
                                        {s.label}
                                    </dt>
                                    <dd className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
                                        {s.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {[
                                { v: null, label: 'Semua' },
                                { v: 'pending', label: 'Pending' },
                                { v: 'processing', label: 'Processing' },
                                { v: 'completed', label: 'Completed' },
                                { v: 'failed', label: 'Failed' },
                            ].map((o) => (
                                <button
                                    key={o.label}
                                    type="button"
                                    onClick={() => goStatus(o.v)}
                                    aria-pressed={
                                        (filters.status ?? null) === o.v
                                    }
                                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${(filters.status ?? null) === o.v ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            </div>

            <SectionCard
                index={4}
                title="Daftar refund"
                subtitle="Satu refund dihitung satu kali"
                basis={refunds.basis}
                action={
                    <Link
                        href="/admin/refunds"
                        className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                        Kelola refund
                    </Link>
                }
            >
                {table.data.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya atau ubah filter status."
                    />
                ) : (
                    <>
                        <ReportTableShell minWidth={720} label="Tabel refund">
                            <ReportTableHead
                                columns={[
                                    { label: 'Refund' },
                                    { label: 'Booking / Customer' },
                                    { label: 'Nominal', align: 'right' },
                                    { label: 'Status' },
                                ]}
                            />
                            <tbody className="text-slate-800">
                                {table.data.map((r) => (
                                    <tr
                                        key={r.refund_code}
                                        className="border-b border-slate-100 last:border-0"
                                    >
                                        <td className="py-3 pr-4">
                                            <p className="font-mono text-xs font-bold">
                                                {r.refund_code}
                                            </p>
                                            <p className="text-[11px] text-slate-400 tabular-nums">
                                                {r.created_at}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <p className="font-mono text-xs font-semibold">
                                                {r.booking_code ?? '—'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {r.customer_name ?? '—'}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                            {rupiah(r.amount)}
                                        </td>
                                        <td className="py-3">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    STATUS_STYLE[r.status] ?? ''
                                                }
                                            >
                                                {r.status}
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
        </div>
    );
}
