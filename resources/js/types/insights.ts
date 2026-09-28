export type InsightItem = {
    id: string;
    category: string;
    title: string;
    summary: string;
    evidence: string[];
    recommendation: string;
    confidence: 'high' | 'medium' | 'low';
    priority: number;
    action_url: string;
    generated_by: 'rule' | 'ai';
};

export type InsightPayload = {
    insights: InsightItem[];
    generated_at: string;
    cached?: boolean;
};

export type AttentionEntry = {
    id: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
    count: number;
    action_url: string;
};

export type DashboardKpis = {
    bookings_today: number;
    bookings_pending: number;
    revenue_today: number;
    revenue_count: number;
    active_rentals: number;
    total_units: number;
    attention_count: number;
};

export type DashboardTrendPoint = {
    key: string;
    label: string;
    bookings: number;
    net: number;
};

export type DashboardTrend = {
    range: number;
    metric: 'booking' | 'revenue';
    points: DashboardTrendPoint[];
    period: {
        from: string;
        to: string;
        preset: string;
        grouping: string;
        label: string;
        days: number;
        timezone: string;
    };
};

export type DashboardRecentBooking = {
    id: number;
    booking_code: string;
    customer_name: string;
    vehicle_name: string | null;
    vehicle_category: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    total: number;
};

export const INSIGHT_CATEGORY_LABELS: Record<string, string> = {
    demand: 'Permintaan',
    revenue: 'Pendapatan',
    fleet: 'Armada',
    customer: 'Customer',
    cancellation: 'Pembatalan',
    maintenance: 'Perawatan',
    general: 'Umum',
};
