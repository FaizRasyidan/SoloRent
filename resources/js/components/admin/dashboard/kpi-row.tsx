import { CalendarDays, CarFront, CircleAlert, Wallet } from 'lucide-react';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import type { DashboardKpis } from '@/types/insights';

export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
    return (
        <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Indikator utama hari ini"
        >
            <KpiTile
                index={0}
                icon={CalendarDays}
                label="Booking Hari Ini"
                value={String(kpis.bookings_today)}
                hint={`${kpis.bookings_pending} menunggu konfirmasi`}
                href="/admin/bookings?period=today"
            />
            <KpiTile
                index={1}
                icon={Wallet}
                tone="money"
                label="Pendapatan Hari Ini"
                value={`Rp${kpis.revenue_today.toLocaleString('id-ID')}`}
                hint={`${kpis.revenue_count} pembayaran diterima`}
                href="/admin/reports?tab=revenue&period=today"
            />
            <KpiTile
                index={2}
                icon={CarFront}
                tone="info"
                label="Sedang Disewa"
                value={String(kpis.active_rentals)}
                hint={`${kpis.active_rentals} dari ${kpis.total_units} unit terpakai`}
                href="/admin/operations"
            />
            <KpiTile
                index={3}
                icon={CircleAlert}
                tone={kpis.attention_count > 0 ? 'danger' : 'default'}
                label="Perlu Tindakan"
                value={String(kpis.attention_count)}
                hint={
                    kpis.attention_count > 0
                        ? `${kpis.attention_count} item menunggu tindakan`
                        : 'Tidak ada item menunggu tindakan'
                }
                href="#perlu-tindakan"
            />
        </div>
    );
}
