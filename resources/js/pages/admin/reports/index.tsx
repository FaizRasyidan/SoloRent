import { Deferred, Head, router } from '@inertiajs/react';
import {
    Bike,
    CalendarClock,
    CalendarX,
    CarFront,
    ChartNoAxesCombined,
    ClipboardList,
    FileWarning,
    Lightbulb,
    Receipt,
    RotateCcw,
    TrendingUp,
    UserRound,
    Users,
    Wallet,
    Wrench,
} from 'lucide-react';
import AdminLayout from '@/layouts/admin-layout';
import { ReportFilterBar } from '@/components/admin/reports/report-filter-bar';
import {
    ChartSkeleton,
    KpiSkeleton,
    ReportError,
    TableSkeleton,
} from '@/components/admin/reports/report-states';
import { BookingSectionView } from '@/components/admin/reports/sections/booking-section';
import { CancellationSectionView } from '@/components/admin/reports/sections/cancellation-section';
import { CustomerSectionView } from '@/components/admin/reports/sections/customer-section';
import { DamageSectionView } from '@/components/admin/reports/sections/damage-section';
import { DemandSectionView } from '@/components/admin/reports/sections/demand-section';
import { DriverSectionView } from '@/components/admin/reports/sections/driver-section';
import { ForecastSectionView } from '@/components/admin/reports/sections/forecast-section';
import { InsightSectionView } from '@/components/admin/reports/sections/insight-section';
import { MaintenanceSectionView } from '@/components/admin/reports/sections/maintenance-section';
import { OutstandingSectionView } from '@/components/admin/reports/sections/outstanding-section';
import { OverviewSectionView } from '@/components/admin/reports/sections/overview-section';
import { RefundSectionView } from '@/components/admin/reports/sections/refund-section';
import { RevenueSectionView } from '@/components/admin/reports/sections/revenue-section';
import { VehicleSectionView } from '@/components/admin/reports/sections/vehicle-section';
import { cn } from '@/lib/utils';
import type {
    BookingSection,
    CancellationSection,
    CustomerSection,
    DamageSection,
    DemandSection,
    DriverSection,
    ForecastSection,
    MaintenanceSection,
    OutstandingSection,
    OverviewSection,
    RefundSection,
    ReportFilters,
    ReportInsightsSection,
    ReportPeriodInfo,
    ReportTab,
    RevenueSection,
    VehicleOption,
    VehicleSection,
} from '@/types/reports';

const TABS: { value: ReportTab; label: string; icon: typeof Wallet }[] = [
    { value: 'overview', label: 'Overview', icon: ChartNoAxesCombined },
    { value: 'booking', label: 'Booking', icon: ClipboardList },
    { value: 'demand', label: 'Demand', icon: TrendingUp },
    { value: 'revenue', label: 'Revenue', icon: Wallet },
    { value: 'vehicle', label: 'Kendaraan', icon: CarFront },
    { value: 'driver', label: 'Driver', icon: Users },
    { value: 'customer', label: 'Customer', icon: UserRound },
    { value: 'cancellation', label: 'Pembatalan', icon: CalendarX },
    { value: 'refund', label: 'Refund', icon: RotateCcw },
    { value: 'damage', label: 'Damage', icon: FileWarning },
    { value: 'maintenance', label: 'Maintenance', icon: Wrench },
    { value: 'forecast', label: 'Forecast', icon: CalendarClock },
    { value: 'outstanding', label: 'Outstanding', icon: Receipt },
    { value: 'insights', label: 'Insights', icon: Lightbulb },
];

type Props = {
    filters: ReportFilters;
    period: ReportPeriodInfo;
    vehicleOptions: VehicleOption[];
    section: {
        overview?: OverviewSection['overview'];
        bookingTrend?: OverviewSection['bookingTrend'];
        revenueTrend?: OverviewSection['revenueTrend'];
        booking?: BookingSection['booking'];
        customers?: BookingSection['customers'];
        table?: BookingSection['table'];
        demand?: DemandSection['demand'];
        comparison?: DemandSection['comparison'];
        revenue?: RevenueSection['revenue'];
        vehicles?: VehicleSection['vehicles'];
        drivers?: DriverSection['drivers'];
        customerStats?: CustomerSection['customers'];
        topCustomers?: CustomerSection['top'];
        cancellation?: CancellationSection['cancellation'];
        refunds?: RefundSection['refunds'];
        damage?: DamageSection['damage'];
        maintenance?: MaintenanceSection['maintenance'];
        forecast?: ForecastSection['forecast'];
        insights?: ReportInsightsSection['insights'];
        totals?: OutstandingSection['totals'];
        bookings?: OutstandingSection['bookings'];
        damages?: OutstandingSection['damages'];
    };
};

function goTab(filters: ReportFilters, tab: ReportTab) {
    router.get(
        '/admin/reports',
        {
            tab,
            period: filters.period,
            from: filters.period === 'custom' ? filters.from : null,
            to: filters.period === 'custom' ? filters.to : null,
            group: filters.group === 'auto' ? null : filters.group,
            category: filters.category,
            vehicle: filters.vehicle,
        },
        { preserveState: true, replace: true, preserveScroll: false },
    );
}

export default function ReportsIndex({
    filters,
    period,
    vehicleOptions,
    section,
}: Props) {
    const tab: ReportTab = filters.tab ?? 'overview';

    return (
        <AdminLayout title="Laporan" wide>
            <Head title="Laporan" />

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-slate-900">
                        <Bike className="hidden size-5 text-slate-400 sm:block" />
                        Laporan Bisnis
                    </h2>
                    <p className="mt-1 max-w-xl text-sm text-slate-500">
                        Omzet, transaksi, pembayaran, refund, damage, dan
                        performa armada — dari data aktual.
                    </p>
                </div>
            </div>

            <div className="print-hidden relative mt-4">
                <div
                    className="flex [scrollbar-width:thin] gap-2 overflow-x-auto pb-1"
                    role="tablist"
                    aria-label="Kategori laporan"
                >
                    {TABS.map((t) => {
                        const active = tab === t.value;
                        return (
                            <button
                                key={t.value}
                                role="tab"
                                aria-selected={active}
                                onClick={() => goTab(filters, t.value)}
                                className={cn(
                                    'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                                    active
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                )}
                            >
                                <t.icon className="size-3.5" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#F4F5F7] to-transparent"
                />
            </div>

            <div className="mt-4">
                <ReportFilterBar
                    filters={filters}
                    period={period}
                    vehicleOptions={vehicleOptions}
                />
            </div>

            <div className="mt-4" role="tabpanel" aria-label={`Laporan ${tab}`}>
                <Deferred
                    data={['section']}
                    fallback={
                        <div className="space-y-4">
                            <KpiSkeleton count={tab === 'overview' ? 6 : 4} />
                            <ChartSkeleton />
                            <TableSkeleton />
                        </div>
                    }
                >
                    <SectionBody
                        tab={tab}
                        filters={filters}
                        section={section}
                    />
                </Deferred>
            </div>
        </AdminLayout>
    );
}

function SectionBody({
    tab,
    filters,
    section,
}: {
    tab: ReportTab;
    filters: ReportFilters;
    section: Props['section'];
}) {
    const retry = () =>
        router.visit('/admin/reports', { preserveState: false });

    try {
        switch (tab) {
            case 'booking':
                if (!section.booking || !section.customers || !section.table)
                    throw new Error('empty');
                return (
                    <BookingSectionView
                        section={{
                            booking: section.booking,
                            customers: section.customers,
                            table: section.table,
                        }}
                        filters={filters}
                    />
                );
            case 'demand':
                if (!section.demand || !section.comparison)
                    throw new Error('empty');
                return (
                    <DemandSectionView
                        section={{
                            demand: section.demand,
                            comparison: section.comparison,
                        }}
                        filters={filters}
                    />
                );
            case 'revenue':
                if (!section.revenue) throw new Error('empty');
                return (
                    <RevenueSectionView
                        section={{ revenue: section.revenue }}
                        filters={filters}
                    />
                );
            case 'vehicle':
                if (!section.vehicles) throw new Error('empty');
                return (
                    <VehicleSectionView
                        section={{ vehicles: section.vehicles }}
                        filters={filters}
                    />
                );
            case 'driver':
                if (!section.drivers) throw new Error('empty');
                return (
                    <DriverSectionView
                        section={{ drivers: section.drivers }}
                        filters={filters}
                    />
                );
            case 'customer':
                if (!section.customerStats || !section.topCustomers)
                    throw new Error('empty');
                return (
                    <CustomerSectionView
                        section={{
                            customers: section.customerStats,
                            top: section.topCustomers,
                        }}
                        filters={filters}
                    />
                );
            case 'cancellation':
                if (!section.cancellation || !section.table)
                    throw new Error('empty');
                return (
                    <CancellationSectionView
                        section={{
                            cancellation: section.cancellation,
                            table: section.table as unknown as CancellationSection['table'],
                        }}
                        filters={filters}
                    />
                );
            case 'refund':
                if (!section.refunds || !section.table)
                    throw new Error('empty');
                return (
                    <RefundSectionView
                        section={{
                            refunds: section.refunds,
                            table: section.table as unknown as RefundSection['table'],
                        }}
                        filters={filters}
                    />
                );
            case 'damage':
                if (!section.damage || !section.table) throw new Error('empty');
                return (
                    <DamageSectionView
                        section={{
                            damage: section.damage,
                            table: section.table as unknown as DamageSection['table'],
                        }}
                        filters={filters}
                    />
                );
            case 'maintenance':
                if (!section.maintenance) throw new Error('empty');
                return (
                    <MaintenanceSectionView
                        section={{ maintenance: section.maintenance }}
                        filters={filters}
                    />
                );
            case 'forecast':
                if (!section.forecast) throw new Error('empty');
                return (
                    <ForecastSectionView
                        section={{ forecast: section.forecast }}
                        filters={filters}
                    />
                );
            case 'insights':
                if (!section.insights) throw new Error('empty');
                return (
                    <InsightSectionView
                        section={{ insights: section.insights }}
                        filters={filters}
                    />
                );
            case 'outstanding':
                if (!section.totals || !section.bookings || !section.damages)
                    throw new Error('empty');
                return (
                    <OutstandingSectionView
                        section={{
                            totals: section.totals,
                            bookings: section.bookings,
                            damages: section.damages,
                        }}
                        filters={filters}
                    />
                );
            default:
                if (
                    !section.overview ||
                    !section.bookingTrend ||
                    !section.revenueTrend
                )
                    throw new Error('empty');
                return (
                    <OverviewSectionView
                        section={{
                            overview: section.overview,
                            bookingTrend: section.bookingTrend,
                            revenueTrend: section.revenueTrend,
                        }}
                        filters={filters}
                    />
                );
        }
    } catch {
        return <ReportError onRetry={retry} />;
    }
}
