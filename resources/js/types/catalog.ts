export type Availability = 'available' | 'limited' | 'unavailable';

export interface VehicleDTO {
    id: number;
    slug: string;
    name: string;
    category: 'motor' | 'mobil';
    transmission: 'automatic' | 'manual';
    seats: number;
    engine: string | null;
    baggage: string | null;
    price_per_day: number;
    rating: number;
    trips_count: number;
    image_url: string | null;
    availability: Availability;
    /** Sisa unit untuk periode filter (null bila tanpa filter tanggal). */
    period_available: number | null;
}

export interface VehicleDetailDTO extends VehicleDTO {
    gallery: string[];
    description: string | null;
    benefits: string[];
    stock: number;
}

export interface DeliveryArea {
    name: string;
    fee: number;
}

export interface OutletInfo {
    name: string;
    address: string;
    city: string;
    hours: string;
    phone: string;
    whatsapp: string;
    email: string;
}

export type PickupMethod = 'outlet' | 'delivery';

export type BookingStatus =
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'active'
    | 'completed'
    | 'cancelled';

export interface DamageChargeSummary {
    charge_code: string;
    total: number;
    paid: number;
    outstanding: number;
    status: string;
    items: { description: string; amount: number }[];
}

export interface CancellationPreview {
    eligible: boolean;
    blocked_reason: string | null;
    fully_paid_block: boolean;
    policy_percent: number;
    policy_rule: string;
    original_amount: number;
    policy_amount: number;
    refund_amount: number;
    non_refundable_amount: number;
    description: string;
}

export interface CancellationSummary {
    cancelled: boolean;
    cancelled_by_type: string | null;
    cancel_reason: string | null;
    cancelled_at: string | null;
    preview: CancellationPreview | null;
    record: {
        policy_rule: string | null;
        policy_percent: number;
        original_amount: number;
        refund_amount: number;
        non_refundable_amount: number;
        was_overridden: boolean;
    } | null;
    refunds: { refund_code: string; amount: number; status: string; created_at: string }[];
    reasons: Record<string, string>;
}

export interface BookingDTO {
    booking_code: string;
    vehicle_name: string | null;
    vehicle_slug: string | null;
    vehicle_image: string | null;
    customer_name: string;
    customer_phone: string;
    start_date: string;
    end_date: string;
    duration_days: number;
    price_per_day: number;
    subtotal: number;
    with_driver: boolean;
    driver_name: string | null;
    pickup_method: PickupMethod;
    pickup_location: string | null;
    delivery_name: string | null;
    delivery_address: string | null;
    delivery_district: string | null;
    delivery_fee: number;
    deposit_amount: number;
    return_method: 'outlet' | 'pickup';
    return_address: string | null;
    damage_charge: DamageChargeSummary | null;
    cancellation: CancellationSummary | null;
    total: number;
    status: BookingStatus;
    payment_status: 'unpaid' | 'partial' | 'paid';
    paid?: number;
    outstanding?: number;
    dp_minimum?: number;
    dp_percent?: number;
    invoice_number?: string | null;
    created_at: string;
}
