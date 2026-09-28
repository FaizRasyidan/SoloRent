import { CalendarX, CircleAlert, Percent } from 'lucide-react';
import { ReportBarChart } from '@/components/admin/reports/report-bar-chart';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import {
    ReportPagination,
    ReportTableHead,
    ReportTableShell,
} from '@/components/admin/reports/report-table';
import { formatDateShort, formatPercent, rupiah } from '@/lib/format';
import type { CancellationSection, ReportFilters } from '@/types/reports';

export function CancellationSectionView({
    section,
    filters: _filters,
}: {
    section: CancellationSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { cancellation, table } = section;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiTile
                    index={0}
                    icon={CalendarX}
                    label="Total Booking"
                    value={String(cancellation.total)}
                    hint="Dibuat pada periode ini"
                />
                <KpiTile
                    index={1}
                    icon={CircleAlert}
                    tone="danger"
                    label="Dibatalkan"
                    value={String(cancellation.cancelled)}
                    hint="Status cancelled"
                />
                <KpiTile
                    index={2}
                    icon={Percent}
                    tone="warn"
                    label="Tingkat Pembatalan"
                    value={formatPercent(cancellation.rate)}
                    hint="Cancelled ÷ total × 100"
                />
            </div>

            <SectionCard
                index={2}
                title="Alasan pembatalan"
                subtitle="Dikelompokkan dari kode alasan · label dari konfigurasi"
                basis={cancellation.basis}
            >
                <ReportBarChart
                    items={cancellation.reasons.map((r) => ({
                        label: r.label,
                        value: r.count,
                    }))}
                    formatValue={(n) => `${n} booking`}
                    color="#E11D48"
                    ariaLabel="Alasan pembatalan"
                    emptyText="Belum ada pembatalan pada periode ini."
                />
            </SectionCard>

            <SectionCard
                index={3}
                title="Booking yang dibatalkan"
                subtitle="Nominal refund mengikuti kebijakan yang berlaku"
                basis={cancellation.basis}
            >
                {table.data.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <>
                        <ReportTableShell
                            minWidth={780}
                            label="Tabel booking batal"
                        >
                            <ReportTableHead
                                columns={[
                                    { label: 'Booking' },
                                    { label: 'Customer' },
                                    { label: 'Periode' },
                                    { label: 'Alasan' },
                                    { label: 'Refund', align: 'right' },
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
                                                {b.cancelled_at ?? ''}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <p className="text-sm font-medium">
                                                {b.customer_name}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {b.vehicle_name ?? '—'}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4 text-xs whitespace-nowrap text-slate-500 tabular-nums">
                                            {formatDateShort(b.start_date)} –{' '}
                                            {formatDateShort(b.end_date)}
                                        </td>
                                        <td className="max-w-52 py-3 pr-4 text-xs text-slate-500">
                                            <p
                                                className="truncate"
                                                title={b.reason ?? ''}
                                            >
                                                {b.reason ?? '—'}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {b.cancelled_by ?? ''}
                                            </p>
                                        </td>
                                        <td className="py-3 text-right text-sm font-semibold tabular-nums">
                                            {rupiah(b.refund_amount)}
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
