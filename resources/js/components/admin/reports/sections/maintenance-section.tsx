import { CalendarClock, CircleDollarSign, Timer, Wrench } from 'lucide-react';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import {
    ReportTableHead,
    ReportTableShell,
} from '@/components/admin/reports/report-table';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import { rupiah } from '@/lib/format';
import type { MaintenanceSection, ReportFilters } from '@/types/reports';

export function MaintenanceSectionView({
    section,
    filters: _filters,
}: {
    section: MaintenanceSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { maintenance } = section;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    index={0}
                    icon={Wrench}
                    label="Record Perawatan"
                    value={String(maintenance.count)}
                    hint="Dibuat pada periode ini"
                />
                <KpiTile
                    index={1}
                    icon={Timer}
                    tone="warn"
                    label="Downtime"
                    value={`${maintenance.days} hari`}
                    hint={`${maintenance.units} unit terdampak`}
                />
                <KpiTile
                    index={2}
                    icon={CircleDollarSign}
                    tone="money"
                    label="Biaya Perawatan"
                    value={rupiah(maintenance.cost)}
                    hint="Total kolom cost"
                />
                <KpiTile
                    index={3}
                    icon={CalendarClock}
                    tone="info"
                    label="Unit Terdampak"
                    value={String(maintenance.units)}
                    hint="Unit unik dengan record"
                />
            </div>

            <SectionCard
                index={2}
                title="Downtime per unit"
                subtitle="Diurutkan dari downtime terlama"
            >
                {maintenance.per_unit.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <ReportTableShell
                        minWidth={680}
                        label="Tabel downtime per unit"
                    >
                        <ReportTableHead
                            columns={[
                                { label: 'Unit' },
                                { label: 'Record', align: 'right' },
                                { label: 'Downtime', align: 'right' },
                                { label: 'Biaya', align: 'right' },
                            ]}
                        />
                        <tbody className="text-slate-800">
                            {maintenance.per_unit.map((u) => (
                                <tr
                                    key={String(u.unit_id ?? u.unit_code)}
                                    className="border-b border-slate-100 last:border-0"
                                >
                                    <td className="py-3 pr-4">
                                        <p className="font-mono text-xs font-bold">
                                            {u.unit_code}
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            {u.vehicle_name}
                                        </p>
                                    </td>
                                    <td className="py-3 text-right text-sm tabular-nums">
                                        {u.records}
                                    </td>
                                    <td className="py-3 text-right text-sm tabular-nums">
                                        {u.days} hari
                                    </td>
                                    <td className="py-3 text-right text-sm font-semibold tabular-nums">
                                        {rupiah(u.cost)}
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
