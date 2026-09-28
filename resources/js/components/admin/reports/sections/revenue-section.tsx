import { Link } from '@inertiajs/react';
import {
    Banknote,
    CircleDollarSign,
    Receipt,
    RotateCcw,
    TriangleAlert,
    Wallet,
} from 'lucide-react';
import { ReportBarChart } from '@/components/admin/reports/report-bar-chart';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import { ReportTrendChart } from '@/components/admin/reports/report-trend-chart';
import { rupiah } from '@/lib/format';
import { reportHref } from '@/lib/reports';
import type { ReportFilters, RevenueSection } from '@/types/reports';

export function RevenueSectionView({
    section,
    filters,
}: {
    section: RevenueSection;
    filters: ReportFilters;
}) {
    const { revenue } = section;
    const f = revenue.financial;
    const p = revenue.payments;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <KpiTile
                    index={0}
                    icon={Banknote}
                    tone="money"
                    label="Gross Booking"
                    value={rupiah(f.grossPaidBooking)}
                    hint="Total booking paid (non-damage)"
                />
                <KpiTile
                    index={1}
                    icon={RotateCcw}
                    tone="warn"
                    label="Refund Completed"
                    value={`−${rupiah(f.refundedAmount)}`}
                    hint="Dikurangi sekali dari gross"
                    href={reportHref(filters, 'refund')}
                />
                <KpiTile
                    index={2}
                    icon={Wallet}
                    tone="success"
                    label="Net Booking Revenue"
                    value={rupiah(f.netBookingRevenue)}
                    hint="Gross − refund completed"
                />
                <KpiTile
                    index={3}
                    icon={TriangleAlert}
                    tone="danger"
                    label="Damage Payment"
                    value={rupiah(f.damagePaid)}
                    hint={`Ditagih ${rupiah(f.damageCharged)} · bukan rental`}
                    href={reportHref(filters, 'damage')}
                />
                <KpiTile
                    index={4}
                    icon={CircleDollarSign}
                    label="Total Pembayaran"
                    value={rupiah(f.totalCustomerPayments)}
                    hint="Booking paid + damage paid"
                />
                <KpiTile
                    index={5}
                    icon={Receipt}
                    label="Refund Dalam Proses"
                    value={rupiah(f.refundInProcess)}
                    hint="Pending + processing · belum dikurangi"
                    href={reportHref(filters, 'refund', { status: 'pending' })}
                />
            </div>

            <SectionCard
                index={2}
                title="Tren pendapatan harian"
                subtitle="Net = gross − refund · arahkan kursor untuk rincian per titik"
                basis={revenue.basis}
            >
                {f.grossPaidBooking === 0 && f.refundedAmount === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <ReportTrendChart
                        data={revenue.trend.map((t) => ({
                            key: t.key,
                            label: t.label,
                            value: t.net,
                            extra: [
                                {
                                    label: 'Gross',
                                    value: t.gross,
                                    format: rupiah,
                                },
                                {
                                    label: 'Refund',
                                    value: t.refund,
                                    format: rupiah,
                                },
                                ...(t.damage > 0
                                    ? [
                                          {
                                              label: 'Damage',
                                              value: t.damage,
                                              format: rupiah,
                                          },
                                      ]
                                    : []),
                            ],
                        }))}
                        formatValue={rupiah}
                        money
                        color="#1D4ED8"
                        ariaLabel="Grafik tren pendapatan bersih"
                    />
                )}
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                    index={3}
                    title="Rincian pendapatan"
                    subtitle="Rental revenue dan damage revenue dipisahkan"
                    basis={revenue.basis}
                >
                    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-slate-200/70 sm:grid-cols-2">
                        {[
                            {
                                label: 'Booking Revenue (gross)',
                                value: rupiah(f.grossPaidBooking),
                            },
                            {
                                label: 'Refund completed',
                                value: `−${rupiah(f.refundedAmount)}`,
                            },
                            {
                                label: 'Net Booking Revenue',
                                value: rupiah(f.netBookingRevenue),
                            },
                            {
                                label: 'Tertahan dari booking batal',
                                value: rupiah(f.cancelledRetained),
                            },
                            {
                                label: 'Damage Charge ditagihkan',
                                value: rupiah(f.damageCharged),
                            },
                            {
                                label: 'Damage Payment diterima',
                                value: rupiah(f.damagePaid),
                            },
                            {
                                label: 'Total Pembayaran Customer',
                                value: rupiah(f.totalCustomerPayments),
                            },
                            {
                                label: 'Refund dalam proses',
                                value: rupiah(f.refundInProcess),
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

                <SectionCard
                    index={4}
                    title="Status pembayaran"
                    subtitle="Payment non-damage yang dibuat pada periode ini"
                    basis={{ ...revenue.basis, column: 'payments.created_at' }}
                    action={
                        <Link
                            href="/admin/payments"
                            className="text-xs font-semibold text-sky-700 hover:underline"
                        >
                            Kelola payment
                        </Link>
                    }
                >
                    <ReportBarChart
                        items={[
                            { label: 'Berhasil (paid)', value: p.paid },
                            { label: 'Pending + submitted', value: p.pending },
                            { label: 'Ditolak', value: p.failed },
                            { label: 'Expired + cancelled', value: p.expired },
                        ]}
                        formatValue={(n) => `${n} payment`}
                        ariaLabel="Status pembayaran"
                    />
                    <p className="mt-3 text-xs text-slate-500 tabular-nums">
                        Total {p.total} payment pada periode ini.
                    </p>
                </SectionCard>
            </div>

            <SectionCard
                index={5}
                title="Metode pembayaran"
                subtitle="Dari data aktual · hanya metode yang benar-benar dipakai"
                basis={{
                    ...revenue.basis,
                    column: 'payments.paid_at (paid, non-damage)',
                }}
            >
                {revenue.methods.length === 0 ? (
                    <ReportEmpty
                        title="Belum ada data pada periode ini."
                        hint="Coba pilih periode lainnya."
                    />
                ) : (
                    <ReportBarChart
                        items={revenue.methods.map((m) => ({
                            label: `${m.label} · ${m.count}×`,
                            value: m.total,
                        }))}
                        formatValue={rupiah}
                        ariaLabel="Metode pembayaran"
                    />
                )}
            </SectionCard>
        </div>
    );
}
