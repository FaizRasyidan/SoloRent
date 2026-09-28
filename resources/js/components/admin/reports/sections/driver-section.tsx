import { Package, Truck, Users } from 'lucide-react';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import {
    ReportTableHead,
    ReportTableShell,
} from '@/components/admin/reports/report-table';
import type { DriverSection, ReportFilters } from '@/types/reports';

const STATUS_LABEL: Record<string, string> = {
    active: 'Tersedia',
    working: 'Ditugaskan',
    inactive: 'Nonaktif',
};

export function DriverSectionView({
    section,
    filters: _filters,
}: {
    section: DriverSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { drivers } = section;
    const totalAssigned = drivers.rows.reduce((s, r) => s + r.assigned, 0);
    const totalCompleted = drivers.rows.reduce((s, r) => s + r.completed, 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    index={0}
                    icon={Users}
                    label="Trip Ditugaskan"
                    value={String(totalAssigned)}
                    hint="Booking ber-driver pada periode sewa"
                />
                <KpiTile
                    index={1}
                    icon={Users}
                    tone="success"
                    label="Trip Selesai"
                    value={String(totalCompleted)}
                    hint="Status completed"
                />
                <KpiTile
                    index={2}
                    icon={Truck}
                    tone="info"
                    label="Delivery"
                    value={String(drivers.delivery.total)}
                    hint={`${drivers.delivery.completed} selesai · ${drivers.delivery.pending} berjalan`}
                />
                <KpiTile
                    index={3}
                    icon={Package}
                    label="Pickup"
                    value={String(drivers.pickup.total)}
                    hint={`${drivers.pickup.completed} selesai · ${drivers.pickup.pending} berjalan`}
                />
            </div>

            <SectionCard
                index={2}
                title="Performa driver"
                subtitle="Angka faktual per driver · tanpa skor subjektif"
                basis={drivers.basis}
            >
                {drivers.rows.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data driver."
                        hint="Tambahkan driver dari menu Driver."
                    />
                ) : (
                    <ReportTableShell
                        minWidth={760}
                        label="Tabel performa driver"
                    >
                        <ReportTableHead
                            columns={[
                                { label: 'Driver' },
                                { label: 'Ditugaskan', align: 'right' },
                                { label: 'Selesai', align: 'right' },
                                { label: 'Batal', align: 'right' },
                                { label: 'Delivery', align: 'right' },
                                { label: 'Pickup', align: 'right' },
                            ]}
                        />
                        <tbody className="text-slate-800">
                            {drivers.rows.map((d) => (
                                <tr
                                    key={d.id}
                                    className="border-b border-slate-100 last:border-0"
                                >
                                    <td className="py-3 pr-4">
                                        <p className="text-sm font-medium">
                                            {d.name}
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            {STATUS_LABEL[d.status] ?? d.status}
                                        </p>
                                    </td>
                                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                                        {d.assigned}
                                    </td>
                                    <td className="py-3 pr-4 text-right tabular-nums">
                                        {d.completed}
                                    </td>
                                    <td className="py-3 pr-4 text-right tabular-nums">
                                        {d.cancelled}
                                    </td>
                                    <td className="py-3 pr-4 text-right tabular-nums">
                                        {d.deliveries}
                                    </td>
                                    <td className="py-3 text-right tabular-nums">
                                        {d.pickups}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </ReportTableShell>
                )}
            </SectionCard>

            <SectionCard
                index={3}
                title="Laporan antar–jemput"
                subtitle="Tugas operasional pada periode ini"
                basis={{
                    ...drivers.basis,
                    column: 'operational_tasks.scheduled_at',
                }}
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200/80 p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Truck className="size-4 text-slate-400" /> Delivery
                            · {drivers.delivery.total}
                        </p>
                        <dl className="mt-3 space-y-2 text-xs tabular-nums">
                            <div className="flex justify-between">
                                <dt className="text-slate-500">Selesai</dt>
                                <dd className="font-semibold">
                                    {drivers.delivery.completed}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-slate-500">
                                    Berjalan / menunggu
                                </dt>
                                <dd className="font-semibold">
                                    {drivers.delivery.pending}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-slate-500">Dibatalkan</dt>
                                <dd className="font-semibold">
                                    {drivers.delivery.cancelled}
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Package className="size-4 text-slate-400" /> Pickup
                            · {drivers.pickup.total}
                        </p>
                        <dl className="mt-3 space-y-2 text-xs tabular-nums">
                            <div className="flex justify-between">
                                <dt className="text-slate-500">Selesai</dt>
                                <dd className="font-semibold">
                                    {drivers.pickup.completed}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-slate-500">
                                    Berjalan / menunggu
                                </dt>
                                <dd className="font-semibold">
                                    {drivers.pickup.pending}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-slate-500">Dibatalkan</dt>
                                <dd className="font-semibold">
                                    {drivers.pickup.cancelled}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
