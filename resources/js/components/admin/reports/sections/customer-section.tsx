import { Clock3, Repeat2, Users, Wallet } from 'lucide-react';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import {
    ReportTableHead,
    ReportTableShell,
} from '@/components/admin/reports/report-table';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import { formatPercent, rupiah } from '@/lib/format';
import type { CustomerSection, ReportFilters } from '@/types/reports';

export function CustomerSectionView({
    section,
    filters: _filters,
}: {
    section: CustomerSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { customers } = section;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    index={0}
                    icon={Users}
                    label="Total Customer"
                    value={String(customers.total_customers)}
                    hint={`${customers.total_bookings} booking (identitas = no. HP)`}
                />
                <KpiTile
                    index={1}
                    icon={Repeat2}
                    tone="success"
                    label="Customer Berulang"
                    value={formatPercent(customers.repeat_pct)}
                    hint={`${customers.repeat_customers} customer memesan ≥2 kali`}
                />
                <KpiTile
                    index={2}
                    icon={Clock3}
                    label="Rata-rata Durasi"
                    value={`${customers.avg_duration} hari`}
                    hint="Rata-rata duration_days booking"
                />
                <KpiTile
                    index={3}
                    icon={Wallet}
                    tone="money"
                    label="Rata-rata Nilai"
                    value={rupiah(customers.avg_value)}
                    hint="Rata-rata total per booking"
                />
            </div>

            <SectionCard
                index={2}
                title="Customer teratas"
                subtitle="Berdasarkan total pembayaran paid non-damage pada periode ini"
                basis={customers.basis}
            >
                {customers.top.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <ReportTableShell
                        minWidth={680}
                        label="Tabel customer teratas"
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
                            {customers.top.map((c) => (
                                <tr
                                    key={c.customer_phone}
                                    className="border-b border-slate-100 last:border-0"
                                >
                                    <td className="py-3 pr-4">
                                        <p className="text-sm font-medium">
                                            {c.customer_name}
                                        </p>
                                        <p className="font-mono text-[11px] text-slate-400">
                                            {c.customer_phone}
                                        </p>
                                    </td>
                                    <td className="py-3 text-right text-sm tabular-nums">
                                        {c.total_booking}
                                    </td>
                                    <td className="py-3 text-right text-sm tabular-nums">
                                        {c.completed}
                                    </td>
                                    <td className="py-3 text-right text-sm tabular-nums">
                                        {c.cancelled}
                                    </td>
                                    <td className="py-3 text-right text-sm font-semibold tabular-nums">
                                        {rupiah(c.total_spent)}
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
