import { CircleDollarSign, FileWarning, Receipt, Wallet } from 'lucide-react';
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
import type { DamageSection, ReportFilters } from '@/types/reports';

const STATUS_STYLE: Record<string, string> = {
    unpaid: 'bg-rose-50 text-rose-800 border-rose-200',
    partial: 'bg-amber-50 text-amber-800 border-amber-200',
    paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    waived: 'bg-slate-100 text-slate-500 border-slate-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function DamageSectionView({
    section,
    filters: _filters,
}: {
    section: DamageSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { damage, table } = section;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    index={0}
                    icon={FileWarning}
                    label="Kasus Damage"
                    value={String(damage.cases)}
                    hint="Charge aktif pada periode ini"
                />
                <KpiTile
                    index={1}
                    icon={Receipt}
                    label="Total Ditagihkan"
                    value={rupiah(damage.charged)}
                    hint="Charge − waived/cancelled"
                />
                <KpiTile
                    index={2}
                    icon={Wallet}
                    tone="success"
                    label="Sudah Dibayar"
                    value={rupiah(damage.paid)}
                    hint="Damage payment paid"
                />
                <KpiTile
                    index={3}
                    icon={CircleDollarSign}
                    tone="danger"
                    label="Outstanding"
                    value={rupiah(damage.outstanding)}
                    hint="Ditagih − dibayar"
                />
            </div>

            <SectionCard
                index={2}
                title="Tren damage"
                subtitle="Nominal charge per periode · terpisah dari rental revenue"
                basis={damage.basis}
            >
                {damage.charged === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <ReportTrendChart
                        data={damage.trend.map((t) => ({
                            key: t.key,
                            label: t.label,
                            value: t.amount,
                        }))}
                        formatValue={rupiah}
                        money
                        color="#DC2626"
                        ariaLabel="Grafik tren damage charge"
                    />
                )}
            </SectionCard>

            <SectionCard
                index={3}
                title="Daftar damage charge"
                subtitle="Outstanding = total − paid"
                basis={damage.basis}
            >
                {table.data.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <>
                        <ReportTableShell
                            minWidth={720}
                            label="Tabel damage charge"
                        >
                            <ReportTableHead
                                columns={[
                                    { label: 'Charge' },
                                    { label: 'Booking / Customer' },
                                    { label: 'Total', align: 'right' },
                                    { label: 'Outstanding', align: 'right' },
                                    { label: 'Status' },
                                ]}
                            />
                            <tbody className="text-slate-800">
                                {table.data.map((d) => (
                                    <tr
                                        key={d.charge_code}
                                        className="border-b border-slate-100 last:border-0"
                                    >
                                        <td className="py-3 pr-4">
                                            <p className="font-mono text-xs font-bold">
                                                {d.charge_code}
                                            </p>
                                            <p className="text-[11px] text-slate-400 tabular-nums">
                                                {d.created_at}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <p className="font-mono text-xs font-semibold">
                                                {d.booking_code ?? '—'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {d.customer_name ?? '—'}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                            {rupiah(d.total)}
                                        </td>
                                        <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                            {rupiah(d.outstanding)}
                                        </td>
                                        <td className="py-3">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    STATUS_STYLE[d.status] ?? ''
                                                }
                                            >
                                                {d.status}
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
