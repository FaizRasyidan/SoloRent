import type { VehicleUnitRow } from './ops';

export type AdminVehicleImage = {
    id: number;
    url: string;
    is_primary: boolean;
};

export type AdminVehicleRow = {
    id: number;
    slug: string;
    name: string;
    brand: string | null;
    model: string | null;
    category: 'motor' | 'mobil';
    price_per_day: number;
    stock: number;
    total_units: number;
    active_units: number;
    status: 'active' | 'inactive';
    featured: boolean;
    image_url: string | null;
    bookings_count: number;
};

export type AdminVehicleBooking = {
    booking_code: string;
    customer_name: string;
    status: string;
    total: number;
};

export type AdminVehicleDetail = AdminVehicleRow & {
    transmission: 'automatic' | 'manual';
    seats: number;
    engine: string | null;
    fuel: string | null;
    baggage: string | null;
    description: string | null;
    benefits: string[];
    images: AdminVehicleImage[];
    gallery: string[];
    units: VehicleUnitRow[];
    unit_summary: { mode: 'units' | 'stock'; available: number; total: number; rented: number };
    recent_bookings: AdminVehicleBooking[];
};

export type VehicleFilters = {
    search: string | null;
    category: 'motor' | 'mobil' | null;
    status: 'active' | 'inactive' | null;
    sort: 'latest' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
};
