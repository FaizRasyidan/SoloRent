import { AlertCircle, Receipt, Wallet } from 'lucide-react';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import {
    ReportPagination,
    ReportTableHead,
    ReportTableShell,
} from '@/components/admin/reports/report-table';
import { formatDateShort, rupiah } from '@/lib/format';
import type { OutstandingSection, ReportFilters } from '@/types/reports';

export function OutstandingSectionView({
    section,
    filters: _filters,
}: {
    section: OutstandingSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { totals, bookings, damages } = section;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiTile
                    index={0}
                    icon={Wallet}
                    tone="warn"
                    label="Booking Belum Lunas"
                    value={rupiah(totals.booking_outstanding)}
                    hint="Unpaid + partial · non-batal"
                />
                <KpiTile
                    index={1}
                    icon={Receipt}
                    tone="danger"
                    label="Damage Outstanding"
                    value={rupiah(totals.damage_outstanding)}
                    hint="Charge terbuka − paid"
                />
                <KpiTile
                    index={2}
                    icon={AlertCircle}
                    tone="money"
                    label="Total Outstanding"
                    value={rupiah(totals.total)}
                    hint="Kewajiban terbuka saat ini"
                />
            </div>

            <p className="text-[11px] text-slate-400">
                Bagian ini tidak dibatasi periode — menampilkan seluruh
                kewajiban terbuka saat ini. Zona waktu{' '}
                {new Intl.DateTimeFormat().resolvedOptions().timeZone}.
            </p>

            <SectionCard
                index={2}
                title="Booking belum lunas"
                subtitle="Customer, kode booking, dan sisa tagihan"
                basis={null}
            >
                {bookings.data.length === 0 ? (
                    <ReportEmpty
                        title="Tidak ada booking yang belum lunas."
                        hint="Semua booking non-batal sudah lunas."
                    />
                ) : (
                    <>
                        <ReportTableShell
                            minWidth={780}
                            label="Tabel booking belum lunas"
                        >
                            <ReportTableHead
                                columns={[
                                    { label: 'Booking' },
                                    { label: 'Customer' },
                                    { label: 'Periode' },
                                    { label: 'Sisa', align: 'right' },
                                    { label: 'Status' },
                                ]}
                            />
                            <tbody className="text-slate-800">
                                {bookings.data.map((b) => (
                                    <tr
                                        key={b.booking_code}
                                        className="border-b border-slate-100 last:border-0"
                                    >
                                        <td className="py-3 pr-4">
                                            <p className="font-mono text-xs font-bold">
                                                {b.booking_code}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {b.vehicle_name ?? '—'}
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
                                        <td className="py-3 pr-4 text-xs whitespace-nowrap text-slate-500 tabular-nums">
                                            {formatDateShort(b.start_date)} –{' '}
                                            {formatDateShort(b.end_date)}
                                        </td>
                                        <td className="py-3 pr-4 text-right">
                                            <p className="text-sm font-semibold tabular-nums">
                                                {rupiah(b.outstanding)}
                                            </p>
                                            <p className="text-[11px] text-slate-400 tabular-nums">
                                                dari {rupiah(b.total)}
                                            </p>
                                        </td>
                                        <td className="py-3 text-xs text-slate-500">
                                            {b.status} · {b.payment_status}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </ReportTableShell>
                        <ReportPagination links={bookings.links} />
                    </>
                )}
            </SectionCard>

            <SectionCard
                index={3}
                title="Damage charge belum dibayar"
                subtitle="Tagihan kerusakan yang masih terbuka"
                basis={null}
            >
                {damages.data.length === 0 ? (
                    <ReportEmpty
                        title="Tidak ada damage charge yang terbuka."
                        hint="Semua tagihan kerusakan sudah lunas."
                    />
                ) : (
                    <>
                        <ReportTableShell
                            minWidth={680}
                            label="Tabel damage outstanding"
                        >
                            <ReportTableHead
                                columns={[
                                    { label: 'Charge' },
                                    { label: 'Customer' },
                                    { label: 'Total', align: 'right' },
                                    { label: 'Sisa', align: 'right' },
                                    { label: 'Status' },
                                ]}
                            />
                            <tbody className="text-slate-800">
                                {damages.data.map((d) => (
                                    <tr
                                        key={d.charge_code}
                                        className="border-b border-slate-100 last:border-0"
                                    >
                                        <td className="py-3 pr-4">
                                            <p className="font-mono text-xs font-bold">
                                                {d.charge_code}
                                            </p>
                                            <p className="font-mono text-[11px] text-slate-400">
                                                {d.booking_code ?? ''}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <p className="text-sm font-medium">
                                                {d.customer_name ?? '—'}
                                            </p>
                                            <p className="font-mono text-[11px] text-slate-400">
                                                {d.customer_phone ?? ''}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4 text-right tabular-nums">
                                            {rupiah(d.total)}
                                        </td>
                                        <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                            {rupiah(d.outstanding)}
                                        </td>
                                        <td className="py-3 text-xs text-slate-500">
                                            {d.status}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </ReportTableShell>
                        <ReportPagination links={damages.links} />
                    </>
                )}
            </SectionCard>
        </div>
    );
}
