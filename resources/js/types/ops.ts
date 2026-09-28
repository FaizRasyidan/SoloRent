export const BOOKING_STATUS_LABELS: Record<string, string> = {
    pending: 'Menunggu Konfirmasi',
    confirmed: 'Dikonfirmasi',
    preparing: 'Siap Diserahkan',
    active: 'Sedang Disewa',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
    scheduled: 'Dijadwalkan',
    assigned: 'Ditugaskan',
    on_the_way: 'Dalam Perjalanan',
    arrived: 'Tiba',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
};

export type AdminBookingRow = {
    booking_code: string;
    customer_name: string;
    customer_phone: string;
    vehicle_name: string | null;
    unit_code: string | null;
    driver_name: string | null;
    start_date: string;
    end_date: string;
    duration_days: number;
    pickup_method: 'outlet' | 'delivery';
    with_driver: boolean;
    status: string;
    payment_status: string;
    total: number;
    created_at: string;
    open_damage: {
        charge_code: string;
        status: string;
        outstanding: number;
    } | null;
};

export type BookingFilters = {
    search: string | null;
    status: string | null;
    payment_status?: string | null;
    cancellation?: string | null;
    period: string | null;
    from: string | null;
    to: string | null;
    driver?: string | null;
};

export type OpsTask = {
    id: number;
    type: 'delivery' | 'pickup';
    staff_name: string | null;
    staff_id: number | null;
    scheduled_at: string | null;
    address: string | null;
    status: string;
    notes: string | null;
};

export type BookingTimelineStep = {
    label: string;
    at: string | null;
    done: boolean;
    current: boolean;
};

export type AdminBookingDetail = AdminBookingRow & {
    customer_email: string | null;
    vehicle_slug: string | null;
    price_per_day: number;
    subtotal: number;
    delivery_name: string | null;
    delivery_address: string | null;
    delivery_district: string | null;
    delivery_note: string | null;
    delivery_fee: number;
    deposit_amount: number;
    return_method: 'outlet' | 'pickup';
    return_address: string | null;
    return_note: string | null;
    notes: string | null;
    availability: {
        mode: 'units' | 'stock';
        available: number;
        total: number;
        rented: number;
    } | null;
    tasks: OpsTask[];
    timeline: BookingTimelineStep[];
    readiness: string[];
    handover: {
        checklist: string[];
        notes: string | null;
        photos: string[];
        completed_at: string | null;
    };
    return: {
        condition: string | null;
        fuel: string | null;
        notes: string | null;
        photos: string[];
        returned_at: string | null;
    };
    cancel_reason: string | null;
    cancelled_by_type: string | null;
    damages: DamageRecordRow[];
    damage_charges: DamageChargeRow[];
    maintenances: MaintenanceRow[];
};

export type AssignableUnit = {
    id: number;
    unit_code: string;
    plate_number: string | null;
    status: string;
    in_maintenance: boolean;
    maintenance_title: string | null;
    available: boolean;
    blocking_booking: {
        booking_code: string;
        start_date: string;
        end_date: string;
    } | null;
};

export type AssignableDriver = {
    id: number;
    name: string;
    status: string;
    available: boolean;
    blocking_booking: {
        booking_code: string;
        start_date: string;
        end_date: string;
    } | null;
};

export type AdminDriverRow = {
    id: number;
    name: string;
    whatsapp: string;
    sim_type: string;
    status: string;
    active_bookings_count: number;
    today_tasks_count: number;
};

export type VehicleUnitRow = {
    id: number;
    unit_code: string;
    plate_number: string | null;
    status: string;
    notes: string | null;
    maintenance: { title: string; status: string } | null;
};

export type DamageRecordRow = {
    id: number;
    unit_code: string | null;
    title: string;
    description: string | null;
    repair_cost: number;
    photo_url: string | null;
    created_at: string;
};

export type DamageChargeItemRow = {
    id: number;
    record_id: number | null;
    record_title: string | null;
    record_photo_url: string | null;
    description: string;
    amount: number;
};

export type DamagePaymentRow = {
    payment_code: string;
    amount: number;
    method: string;
    status: string;
    paid_at: string | null;
    submitted_at: string | null;
    has_proof: boolean;
    rejection_reason: string | null;
    created_at: string;
};

export type DamageChargeRow = {
    id: number;
    charge_code: string;
    subtotal: number;
    total: number;
    paid: number;
    outstanding: number;
    status: string;
    locked: boolean;
    notes: string | null;
    waived_reason: string | null;
    created_at: string;
    items: DamageChargeItemRow[];
    payments: DamagePaymentRow[];
};

export type MaintenanceRow = {
    id: number;
    unit_code: string | null;
    title: string;
    description: string | null;
    cost: number;
    priority: string;
    status: string;
    damage_count: number;
    started_at: string | null;
    completed_at: string | null;
    estimated_completed_at: string | null;
    notes: string | null;
};

export const REPAIR_STATUS_LABELS: Record<string, string> = {
    scheduled: 'Dijadwalkan',
    in_progress: 'Berjalan',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
};

export const REPAIR_PRIORITY_LABELS: Record<string, string> = {
    rendah: 'Rendah',
    sedang: 'Sedang',
    tinggi: 'Tinggi',
    darurat: 'Darurat',
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Dibatalkan',
};

export type CancellationPreview = {
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
};

export type RefundRow = {
    refund_code: string;
    amount: number;
    status: string;
    reference: string | null;
    reason: string | null;
    failure_reason: string | null;
    processed_at: string | null;
    created_at: string;
};

export type CancellationPayload = {
    cancelled: boolean;
    preview: CancellationPreview | null;
    assignment_warnings: string[];
    fully_paid: boolean;
    record: {
        cancelled_by_type: string;
        reason_code: string | null;
        reason: string | null;
        policy_rule: string | null;
        policy_percent: number;
        original_amount: number;
        refund_amount: number;
        non_refundable_amount: number;
        cancelled_at: string | null;
        was_overridden: boolean;
        override_policy_amount: number | null;
        override_amount: number | null;
        override_reason: string | null;
    } | null;
    refunds: RefundRow[];
};

export type AdminRefundRow = {
    refund_code: string;
    booking_code: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    amount: number;
    status: string;
    reference: string | null;
    reason: string | null;
    failure_reason: string | null;
    policy_percent: number | null;
    processed_at: string | null;
    created_at: string;
};

export type RepairRow = {
    id: number;
    title: string;
    unit_code: string | null;
    plate_number: string | null;
    vehicle_name: string | null;
    booking_code: string | null;
    cost: number;
    priority: string;
    status: string;
    damage_count: number;
    estimated_completed_at: string | null;
    estimated_raw: string | null;
    is_overdue: boolean;
    created_at: string;
};

export type RepairDetail = RepairRow & {
    description: string | null;
    notes: string | null;
    started_at: string | null;
    completed_at: string | null;
    booking: {
        booking_code: string;
        customer_name: string;
        customer_phone: string;
        status: string;
    } | null;
    damage: { id: number; title: string; photo_url: string | null } | null;
    damages: {
        id: number;
        title: string;
        description: string | null;
        repair_cost: number;
        photo_url: string | null;
    }[];
};

export type RepairFilters = {
    search: string | null;
    status: string | null;
    priority: string | null;
    overdue: string | null;
};

export type RepairUnitOption = {
    id: number;
    unit_code: string;
    plate_number: string | null;
    vehicle_name: string | null;
    status: string;
    in_maintenance: boolean;
};
