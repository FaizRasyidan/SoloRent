import { Head, Link } from '@inertiajs/react';
import { CalendarDays } from 'lucide-react';
import { KpiRow } from '@/components/admin/dashboard/kpi-row';
import { NeedsAttention } from '@/components/admin/dashboard/needs-attention';
import { RecentBookings } from '@/components/admin/dashboard/recent-bookings';
import { SmartInsights } from '@/components/admin/dashboard/smart-insights';
import { TrendPanel } from '@/components/admin/dashboard/trend-panel';
import AdminLayout from '@/layouts/admin-layout';
import type {
    AttentionEntry,
    DashboardKpis,
    DashboardRecentBooking,
    DashboardTrend,
    InsightItem,
} from '@/types/insights';

type Props = {
    today: string;
    kpis: DashboardKpis;
    trend: DashboardTrend;
    insights: {
        insights: InsightItem[];
        generated_at: string;
        cached?: boolean;
    };
    attention: { items: AttentionEntry[] };
    recentBookings: DashboardRecentBooking[];
};

export default function AdminDashboard({
    today,
    kpis,
    trend,
    insights,
    attention,
    recentBookings,
}: Props) {
    return (
        <AdminLayout title="Dashboard">
            <Head title="Admin Dashboard" />

            {/* Header + maksimal 2 quick actions (tanpa angka, tanpa duplikasi) */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 sm:text-2xl">
                        Selamat datang kembali, Admin
                    </h2>
                    <p className="mt-1 max-w-xl text-sm text-slate-500">
                        Ringkasan operasional hari ini · Zona Jakarta.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/admin/payments?status=submitted"
                        className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                    >
                        Verifikasi Pembayaran
                    </Link>
                    <Link
                        href="/admin/refunds?status=pending"
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Proses Refund
                    </Link>
                    <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600">
                        <CalendarDays className="size-3.5" />
                        {today}
                    </p>
                </div>
            </div>

            {/* 4 KPI */}
            <div className="mt-6">
                <KpiRow kpis={kpis} />
            </div>

            {/* Mobile: KPI → insights → attention → tren → recent (via order).
                Desktop: dua kolom bersarang (kiri: tren + recent, kanan:
                insights + attention) agar tidak ada sisa ruang antar baris.
                `contents` membuat kartu jadi item grid luar di mobile. */}
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="contents xl:col-span-8 xl:block xl:space-y-4">
                    <div className="order-3">
                        <TrendPanel trend={trend} />
                    </div>
                    <div className="order-4">
                        <RecentBookings rows={recentBookings} />
                    </div>
                </div>
                <div className="contents xl:col-span-4 xl:block xl:space-y-4">
                    <div className="order-1">
                        <SmartInsights
                            items={insights.insights}
                            generatedAt={insights.generated_at}
                        />
                    </div>
                    <div className="order-2">
                        <NeedsAttention items={attention.items} />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
