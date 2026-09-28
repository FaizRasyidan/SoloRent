import { Bike, CarFront, CircleDollarSign, Wrench } from 'lucide-react';
import { ReportBarChart } from '@/components/admin/reports/report-bar-chart';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import {
    ReportTableHead,
    ReportTableShell,
} from '@/components/admin/reports/report-table';
import { formatPercent, rupiah } from '@/lib/format';
import type { ReportFilters, VehicleSection } from '@/types/reports';

export function VehicleSectionView({
    section,
    filters: _filters,
}: {
    section: VehicleSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { vehicles } = section;
    const t = vehicles.totals;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    index={0}
                    icon={CarFront}
                    label="Hari Sewa"
                    value={`${t.rental_days} hari`}
                    hint={`dari ${t.capacity_days} hari kapasitas`}
                />
                <KpiTile
                    index={1}
                    icon={CircleDollarSign}
                    tone="money"
                    label="Utilisasi Armada"
                    value={formatPercent(t.utilization)}
                    hint="Hari disewa ÷ hari kapasitas"
                />
                <KpiTile
                    index={2}
                    icon={Wrench}
                    tone="warn"
                    label="Maintenance"
                    value={`${t.maintenance_units} unit`}
                    hint={`${t.maintenance_days} hari · ${rupiah(t.maintenance_cost)}`}
                />
                <KpiTile
                    index={3}
                    icon={Bike}
                    label="Tipe Aktif"
                    value={String(vehicles.rows.length)}
                    hint="Tipe kendaraan pada filter ini"
                />
            </div>

            <SectionCard
                index={2}
                title="Performa kendaraan"
                subtitle="Booking, hari disewa, dan pendapatan per tipe"
                basis={vehicles.basis}
            >
                {vehicles.rows.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya atau ubah filter kendaraan."
                    />
                ) : (
                    <ReportTableShell
                        minWidth={820}
                        label="Tabel performa kendaraan"
                    >
                        <ReportTableHead
                            columns={[
                                { label: 'Kendaraan' },
                                { label: 'Booking', align: 'right' },
                                { label: 'Hari Disewa', align: 'right' },
                                { label: 'Pendapatan', align: 'right' },
                                { label: 'Utilisasi', align: 'right' },
                            ]}
                        />
                        <tbody className="text-slate-800">
                            {vehicles.rows.map((v) => (
                                <tr
                                    key={v.id}
                                    className="border-b border-slate-100 last:border-0"
                                >
                                    <td className="py-3 pr-4">
                                        <p className="flex items-center gap-2 text-sm font-medium">
                                            {v.category === 'motor' ? (
                                                <Bike className="size-4 text-slate-400" />
                                            ) : (
                                                <CarFront className="size-4 text-slate-400" />
                                            )}
                                            {v.name}
                                        </p>
                                        <p className="text-[11px] text-slate-400 capitalize">
                                            {v.category} · {v.capacity_units}{' '}
                                            unit × kapasitas
                                        </p>
                                    </td>
                                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                        {v.bookings}
                                    </td>
                                    <td className="py-3 pr-4 text-right tabular-nums">
                                        {v.rental_days}
                                        <span className="text-slate-400">
                                            {' '}
                                            / {v.capacity_days}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                        {rupiah(v.revenue)}
                                    </td>
                                    <td className="py-3 text-right font-semibold tabular-nums">
                                        {formatPercent(v.utilization)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </ReportTableShell>
                )}
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                    index={3}
                    title="Most rented"
                    subtitle="Tipe dengan booking terbanyak · metrik faktual"
                    basis={vehicles.basis}
                >
                    <ReportBarChart
                        items={vehicles.most_rented.map((v) => ({
                            label: `${v.name} · ${v.bookings} booking`,
                            value: v.rental_days,
                            hint: `${v.rental_days} hari disewa`,
                        }))}
                        formatValue={(n) => `${n} hari`}
                        color="#E8730C"
                        ariaLabel="Kendaraan paling sering disewa"
                        emptyText="Belum ada penyewaan pada periode ini."
                    />
                </SectionCard>
                <SectionCard
                    index={4}
                    title="Low utilization"
                    subtitle="Tipe dengan utilisasi terendah · perlu perhatian"
                    basis={vehicles.basis}
                >
                    <ReportBarChart
                        items={vehicles.low_utilization.map((v) => ({
                            label: `${v.name} · ${v.rental_days} hari`,
                            value: v.utilization,
                        }))}
                        formatValue={formatPercent}
                        color="#64748B"
                        ariaLabel="Kendaraan dengan utilisasi rendah"
                        emptyText="Belum ada data pada periode ini."
                    />
                </SectionCard>
            </div>

            <SectionCard
                index={5}
                title="Dampak maintenance"
                subtitle="Unit, hari, dan biaya dari data aktual"
                basis={{
                    ...vehicles.basis,
                    column: 'maintenance_records (overlap periode)',
                }}
            >
                <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-slate-200/70 sm:grid-cols-3">
                    {[
                        {
                            label: 'Unit maintenance',
                            value: String(t.maintenance_units),
                        },
                        {
                            label: 'Hari maintenance',
                            value: `${t.maintenance_days} hari`,
                        },
                        {
                            label: 'Biaya maintenance',
                            value: rupiah(t.maintenance_cost),
                        },
                    ].map((s) => (
                        <div key={s.label} className="bg-white px-4 py-3.5">
                            <dt className="text-[11px] font-medium text-slate-500">
                                {s.label}
                            </dt>
                            <dd className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
                                {s.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </SectionCard>
        </div>
    );
}
