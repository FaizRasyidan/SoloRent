import type { Paginated } from './vehicle';

export type ReportTab =
    | 'overview'
    | 'booking'
    | 'demand'
    | 'revenue'
    | 'vehicle'
    | 'driver'
    | 'customer'
    | 'cancellation'
    | 'refund'
    | 'damage'
    | 'maintenance'
    | 'forecast'
    | 'outstanding'
    | 'insights';

export type ReportPeriodInfo = {
    from: string;
    to: string;
    preset: string;
    grouping: string;
    label: string;
    days: number;
    timezone: string;
};

export type ReportFilters = {
    period: string;
    from: string;
    to: string;
    group: string;
    category: string | null;
    vehicle: number | null;
    tab: ReportTab;
    status: string | null;
    search: string | null;
};

export type VehicleOption = { id: number; name: string; category: string };

export type BasisInfo = {
    period: string;
    vehicle: string;
    column: string;
    timezone: string;
};

export type TrendCountPoint = { key: string; label: string; count: number };

export type RevenueTrendPoint = {
    key: string;
    label: string;
    gross: number;
    refund: number;
    net: number;
    damage: number;
};

export type AmountTrendPoint = { key: string; label: string; amount: number };

export type OverviewSection = {
    overview: {
        kpis: {
            totalBooking: number;
            netRevenue: number;
            refundCompleted: number;
            damagePaid: number;
            unitsRented: number;
            cancelled: number;
            cancellationRate: number;
            completed: number;
            active: number;
        };
        accounting: {
            grossPaidBooking: number;
            refundedAmount: number;
            netBookingRevenue: number;
            refundInProcess: number;
            damageCharged: number;
            damagePaid: number;
            totalCustomerPayments: number;
            cancelledRetained: number;
        };
        operational: {
            totalTypes: number;
            totalUnits: number;
            maintenanceUnits: number;
            driversAvailable: number;
            driversAssigned: number;
        };
        basis: BasisInfo;
    };
    bookingTrend: TrendCountPoint[];
    revenueTrend: RevenueTrendPoint[];
};

export type BookingSection = {
    booking: {
        counts: Record<string, number>;
        trend: TrendCountPoint[];
        basis: BasisInfo;
    };
    customers: { rows: CustomerRow[]; basis: BasisInfo };
    table: Paginated<BookingDetailRow>;
};

export type CustomerRow = {
    customer_name: string;
    customer_phone: string;
    total_booking: number;
    completed: number;
    cancelled: number;
    total_spent: number;
};

export type BookingDetailRow = {
    booking_code: string;
    customer_name: string;
    customer_phone: string;
    vehicle_name: string | null;
    vehicle_category: string | null;
    start_date: string;
    end_date: string;
    duration_days: number;
    total: number;
    paid: number;
    refunded: number;
    damage: number;
    status: string;
    payment_status: string;
    created_at: string;
};

export type RevenueSection = {
    revenue: {
        financial: OverviewSection['overview']['accounting'];
        trend: RevenueTrendPoint[];
        payments: {
            total: number;
            paid: number;
            pending: number;
            failed: number;
            expired: number;
        };
        methods: {
            method: string;
            label: string;
            count: number;
            total: number;
        }[];
        basis: BasisInfo;
    };
};

export type VehicleRow = {
    id: number;
    name: string;
    category: string;
    bookings: number;
    rental_days: number;
    revenue: number;
    capacity_days: number;
    capacity_units: number;
    utilization: number;
    maintenance_days: number;
    maintenance_cost: number;
};

export type VehicleSection = {
    vehicles: {
        rows: VehicleRow[];
        most_rented: VehicleRow[];
        low_utilization: VehicleRow[];
        totals: {
            rental_days: number;
            capacity_days: number;
            utilization: number;
            maintenance_units: number;
            maintenance_days: number;
            maintenance_cost: number;
        };
        basis: BasisInfo;
    };
};

export type DriverRow = {
    id: number;
    name: string;
    status: string;
    assigned: number;
    completed: number;
    cancelled: number;
    deliveries: number;
    pickups: number;
};

export type DriverSection = {
    drivers: {
        rows: DriverRow[];
        delivery: {
            total: number;
            completed: number;
            pending: number;
            cancelled: number;
        };
        pickup: {
            total: number;
            completed: number;
            pending: number;
            cancelled: number;
        };
        basis: BasisInfo;
    };
};

export type CancellationSection = {
    cancellation: {
        total: number;
        cancelled: number;
        rate: number;
        reasons: { code: string; label: string; count: number }[];
        basis: BasisInfo;
    };
    table: Paginated<{
        booking_code: string;
        customer_name: string;
        vehicle_name: string | null;
        start_date: string;
        end_date: string;
        total: number;
        reason: string | null;
        cancelled_by: string | null;
        refund_amount: number;
        cancelled_at: string | null;
    }>;
};

export type RefundSection = {
    refunds: {
        counts: {
            requests: number;
            pending: number;
            processing: number;
            completed: number;
            failed: number;
        };
        total_completed: number;
        in_process: number;
        trend: AmountTrendPoint[];
        basis: BasisInfo;
    };
    table: Paginated<{
        refund_code: string;
        booking_code: string | null;
        customer_name: string | null;
        amount: number;
        status: string;
        reference: string | null;
        processed_at: string | null;
        created_at: string;
    }>;
};

export type DamageSection = {
    damage: {
        cases: number;
        charged: number;
        paid: number;
        outstanding: number;
        trend: AmountTrendPoint[];
        basis: BasisInfo;
    };
    table: Paginated<{
        charge_code: string;
        booking_code: string | null;
        customer_name: string | null;
        total: number;
        paid: number;
        outstanding: number;
        status: string;
        created_at: string;
    }>;
};

export type OutstandingSection = {
    totals: {
        booking_outstanding: number;
        damage_outstanding: number;
        total: number;
    };
    bookings: Paginated<{
        booking_code: string;
        customer_name: string;
        customer_phone: string;
        vehicle_name: string | null;
        start_date: string;
        end_date: string;
        total: number;
        paid: number;
        outstanding: number;
        status: string;
        payment_status: string;
    }>;
    damages: Paginated<{
        charge_code: string;
        booking_code: string | null;
        customer_name: string | null;
        customer_phone: string | null;
        total: number;
        paid: number;
        outstanding: number;
        status: string;
    }>;
};

export type DemandSection = {
    demand: {
        trend: TrendCountPoint[];
        total: number;
        weekend: {
            weekend_count: number;
            weekday_count: number;
            weekend_days: number;
            weekday_days: number;
            weekend_avg: number;
            weekday_avg: number;
            ratio: number | null;
        };
        by_category: Record<string, number>;
        by_vehicle: { vehicle_id: number; name: string; bookings: number }[];
        basis: BasisInfo;
    };
    comparison: {
        booking_current: number;
        booking_previous: number;
        booking_change_pct: number | null;
        revenue_current: number;
        revenue_previous: number;
        revenue_change_pct: number | null;
        previous: ReportPeriodInfo;
    };
};

export type CustomerSection = {
    customers: {
        total_bookings: number;
        total_customers: number;
        repeat_customers: number;
        repeat_pct: number;
        avg_duration: number;
        avg_value: number;
        top: CustomerRow[];
        basis: BasisInfo;
    };
    top: { rows: CustomerRow[]; basis: BasisInfo };
};

export type MaintenanceSection = {
    maintenance: {
        count: number;
        days: number;
        cost: number;
        units: number;
        per_unit: {
            unit_id: number | null;
            unit_code: string;
            vehicle_name: string;
            records: number;
            days: number;
            cost: number;
        }[];
    };
};

export type ForecastSection = {
    forecast: {
        sufficient: boolean;
        message: string | null;
        months_used: number;
        history: {
            key: string;
            label: string;
            net: number;
            gross: number;
            refund: number;
            bookings: number;
        }[];
        average_net: number | null;
        forecast_next: number | null;
        forecast_label: string | null;
    };
};

export type ReportInsightsSection = {
    insights: {
        insights: {
            id: string;
            category: string;
            title: string;
            summary: string;
            evidence: string[];
            recommendation: string;
            confidence: string;
            priority: number;
            action_url: string;
            generated_by: string;
        }[];
        generated_at: string;
    };
};
