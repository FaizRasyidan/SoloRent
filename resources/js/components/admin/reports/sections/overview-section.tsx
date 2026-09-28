import { Link } from '@inertiajs/react';
import {
    Bike,
    CalendarDays,
    CarFront,
    CircleDollarSign,
    ClipboardList,
    RotateCcw,
    TriangleAlert,
    Users,
    Wallet,
} from 'lucide-react';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import { ReportTrendChart } from '@/components/admin/reports/report-trend-chart';
import { formatPercent, rupiah } from '@/lib/format';
import { reportHref } from '@/lib/reports';
import type { OverviewSection, ReportFilters } from '@/types/reports';

export function OverviewSectionView({
    section,
    filters,
}: {
    section: OverviewSection;
    filters: ReportFilters;
}) {
    const { overview, bookingTrend, revenueTrend } = section;
    const k = overview.kpis;
    const a = overview.accounting;
    const o = overview.operational;
    const empty = k.totalBooking === 0 && a.grossPaidBooking === 0;

    return (
        <div className="space-y-4">
            {empty && (
                <ReportEmpty
                    title="Belum ada data pada periode ini."
                    hint="Coba pilih periode lainnya, misalnya 30 hari terakhir atau bulan ini."
                />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <KpiTile
                    index={0}
                    icon={ClipboardList}
                    label="Total Booking"
                    value={String(k.totalBooking)}
                    hint={`${k.completed} selesai · ${k.active} aktif`}
                    href={reportHref(filters, 'booking')}
                />
                <KpiTile
                    index={1}
                    icon={Wallet}
                    tone="money"
                    label="Pendapatan Bersih"
                    value={rupiah(a.netBookingRevenue)}
                    hint={`Gross ${rupiah(a.grossPaidBooking)} − refund ${rupiah(a.refundedAmount)}`}
                    href={reportHref(filters, 'revenue')}
                />
                <KpiTile
                    index={2}
                    icon={RotateCcw}
                    tone="warn"
                    label="Refund"
                    value={rupiah(a.refundedAmount)}
                    hint="Refund completed pada periode ini"
                    href={reportHref(filters, 'refund')}
                />
                <KpiTile
                    index={3}
                    icon={TriangleAlert}
                    tone="danger"
                    label="Damage Charge Dibayar"
                    value={rupiah(a.damagePaid)}
                    hint={`Ditagih ${rupiah(a.damageCharged)} · terpisah dari rental`}
                    href={reportHref(filters, 'damage')}
                />
                <KpiTile
                    index={4}
                    icon={CarFront}
                    tone="info"
                    label="Unit Disewa Saat Ini"
                    value={String(k.unitsRented)}
                    hint="Booking aktif yang sewanya mencakup hari ini"
                    href={reportHref(filters, 'vehicle')}
                />
                <KpiTile
                    index={5}
                    icon={CalendarDays}
                    label="Pembatalan"
                    value={`${k.cancelled} · ${formatPercent(k.cancellationRate)}`}
                    hint={`${k.totalBooking} total booking`}
                    href={reportHref(filters, 'cancellation')}
                />
            </div>

            <SectionCard
                index={2}
                title="Ringkasan keuangan"
                subtitle="Pendapatan rental dan pendapatan damage selalu dipisahkan"
                basis={overview.basis}
                action={
                    <Link
                        href={reportHref(filters, 'revenue')}
                        className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                        Detail revenue
                    </Link>
                }
            >
                <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-slate-200/70 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        {
                            label: 'Booking Revenue (gross)',
                            value: rupiah(a.grossPaidBooking),
                        },
                        {
                            label: 'Refund completed',
                            value: `−${rupiah(a.refundedAmount)}`,
                        },
                        {
                            label: 'Net Booking Revenue',
                            value: rupiah(a.netBookingRevenue),
                        },
                        {
                            label: 'Damage Payment (terpisah)',
                            value: rupiah(a.damagePaid),
                        },
                        {
                            label: 'Total Pembayaran Customer',
                            value: rupiah(a.totalCustomerPayments),
                        },
                        {
                            label: 'Refund dalam proses',
                            value: rupiah(a.refundInProcess),
                        },
                        {
                            label: 'Tertahan dari booking batal',
                            value: rupiah(a.cancelledRetained),
                        },
                        {
                            label: 'Damage ditagihkan',
                            value: rupiah(a.damageCharged),
                        },
                    ].map((s) => (
                        <div key={s.label} className="bg-white px-4 py-3.5">
                            <dt className="text-[11px] font-medium text-slate-500">
                                {s.label}
                            </dt>
                            <dd className="mt-1 text-lg font-semibold tracking-tight text-slate-900 tabular-nums">
                                {s.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                    index={3}
                    title="Tren booking"
                    subtitle="Jumlah booking per periode pengelompokan"
                    basis={{ ...overview.basis, column: 'bookings.created_at' }}
                >
                    <ReportTrendChart
                        data={bookingTrend.map((p) => ({
                            key: p.key,
                            label: p.label,
                            value: p.count,
                        }))}
                        formatValue={(n) => `${n} booking`}
                        ariaLabel="Grafik tren booking"
                    />
                </SectionCard>
                <SectionCard
                    index={4}
                    title="Tren pendapatan bersih"
                    subtitle="Gross dikurangi refund per periode"
                    basis={{
                        ...overview.basis,
                        column: 'payments.paid_at & refunds.processed_at',
                    }}
                >
                    <ReportTrendChart
                        data={revenueTrend.map((p) => ({
                            key: p.key,
                            label: p.label,
                            value: p.net,
                            extra: [
                                {
                                    label: 'Gross',
                                    value: p.gross,
                                    format: rupiah,
                                },
                                {
                                    label: 'Refund',
                                    value: p.refund,
                                    format: rupiah,
                                },
                            ],
                        }))}
                        formatValue={rupiah}
                        money
                        color="#1D4ED8"
                        ariaLabel="Grafik tren pendapatan bersih"
                    />
                </SectionCard>
            </div>

            <SectionCard
                index={5}
                title="Operasional"
                subtitle="Kapasitas armada dan driver saat ini"
                basis={null}
            >
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200/70 sm:grid-cols-3 xl:grid-cols-5">
                    {[
                        {
                            icon: CarFront,
                            label: 'Tipe kendaraan',
                            value: String(o.totalTypes),
                        },
                        {
                            icon: Bike,
                            label: 'Total unit',
                            value: String(o.totalUnits),
                        },
                        {
                            icon: TriangleAlert,
                            label: 'Unit maintenance',
                            value: String(o.maintenanceUnits),
                        },
                        {
                            icon: Users,
                            label: 'Driver tersedia',
                            value: String(o.driversAvailable),
                        },
                        {
                            icon: CircleDollarSign,
                            label: 'Driver ditugaskan',
                            value: String(o.driversAssigned),
                        },
                    ].map((s) => (
                        <div key={s.label} className="bg-white px-4 py-3.5">
                            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                <s.icon className="size-3.5" /> {s.label}
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
