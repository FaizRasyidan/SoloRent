import { CalendarDays, TrendingUp, Users } from 'lucide-react';
import { ReportBarChart } from '@/components/admin/reports/report-bar-chart';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportTrendChart } from '@/components/admin/reports/report-trend-chart';
import { rupiah } from '@/lib/format';
import type { DemandSection, ReportFilters } from '@/types/reports';

function fmtChange(v: number | null): string {
    if (v === null) return '—';
    const sign = v > 0 ? '+' : '';
    return `${sign}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v)}%`;
}

export function DemandSectionView({
    section,
    filters: _filters,
}: {
    section: DemandSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { demand, comparison } = section;
    const w = demand.weekend;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    index={0}
                    icon={CalendarDays}
                    label="Total Booking"
                    value={String(demand.total)}
                    hint={`${comparison.booking_previous} pada periode sebelumnya`}
                />
                <KpiTile
                    index={1}
                    icon={TrendingUp}
                    tone={
                        comparison.booking_change_pct !== null &&
                        comparison.booking_change_pct >= 0
                            ? 'success'
                            : 'warn'
                    }
                    label="Perubahan Booking"
                    value={fmtChange(comparison.booking_change_pct)}
                    hint="Periode ini vs sebelumnya"
                />
                <KpiTile
                    index={2}
                    icon={Users}
                    label="Rata-rata Akhir Pekan"
                    value={`${w.weekend_avg}/hari`}
                    hint={`${w.weekend_count} booking / ${w.weekend_days} hari`}
                />
                <KpiTile
                    index={3}
                    icon={Users}
                    tone="info"
                    label="Rata-rata Hari Kerja"
                    value={`${w.weekday_avg}/hari`}
                    hint={`${w.weekday_count} booking / ${w.weekday_days} hari`}
                />
            </div>

            <SectionCard
                index={2}
                title="Tren permintaan harian"
                subtitle="Jumlah booking dibuat per hari"
                basis={demand.basis}
            >
                <ReportTrendChart
                    data={demand.trend.map((p) => ({
                        key: p.key,
                        label: p.label,
                        value: p.count,
                    }))}
                    formatValue={(n) => `${Math.round(n)} booking`}
                    ariaLabel="Tren permintaan harian"
                />
            </SectionCard>

            <SectionCard
                index={3}
                title="Perbandingan periode"
                subtitle="Periode berjalan vs periode sebelumnya dengan panjang sama"
            >
                <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-slate-200/70 sm:grid-cols-2">
                    <div className="bg-white p-4">
                        <dt className="text-xs text-slate-500">Booking</dt>
                        <dd className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                            {comparison.booking_current} vs{' '}
                            {comparison.booking_previous} (
                            {fmtChange(comparison.booking_change_pct)})
                        </dd>
                    </div>
                    <div className="bg-white p-4">
                        <dt className="text-xs text-slate-500">
                            Pendapatan bersih
                        </dt>
                        <dd className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                            {rupiah(comparison.revenue_current)} vs{' '}
                            {rupiah(comparison.revenue_previous)} (
                            {fmtChange(comparison.revenue_change_pct)})
                        </dd>
                    </div>
                </dl>
                <p className="mt-2 text-[11px] text-slate-400">
                    Periode pembanding: {comparison.previous.label} · angka
                    perubahan memakai rumus (berjalan − pembanding) ÷ pembanding
                    × 100
                </p>
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                    index={4}
                    title="Permintaan per kategori"
                    subtitle="Motor vs mobil"
                    basis={demand.basis}
                >
                    <ReportBarChart
                        items={[
                            {
                                label: 'Motor',
                                value: demand.by_category.motor ?? 0,
                            },
                            {
                                label: 'Mobil',
                                value: demand.by_category.mobil ?? 0,
                            },
                        ]}
                        formatValue={(n) => `${n} booking`}
                        ariaLabel="Permintaan per kategori"
                    />
                </SectionCard>
                <SectionCard
                    index={5}
                    title="Kendaraan paling diminta"
                    subtitle="Top 10 berdasarkan booking dibuat"
                    basis={demand.basis}
                >
                    <ReportBarChart
                        items={demand.by_vehicle.map((v) => ({
                            label: v.name,
                            value: v.bookings,
                        }))}
                        formatValue={(n) => `${n} booking`}
                        ariaLabel="Kendaraan paling diminta"
                        emptyText="Belum ada booking pada periode ini."
                    />
                </SectionCard>
            </div>

            <p className="text-[11px] text-slate-400">
                Rata-rata akhir pekan = booking Sabtu–Minggu ÷ jumlah hari
                Sabtu–Minggu · rasio akhir pekan vs hari kerja:{' '}
                {w.ratio === null ? '—' : `${w.ratio}×`}
            </p>
        </div>
    );
}
