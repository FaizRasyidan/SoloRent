import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Bike,
    CalendarDays,
    CarFront,
    CircleAlert,
    ClipboardList,
    MapPin,
    Package,
    Truck,
} from 'lucide-react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TaskCard = {
    id: number;
    type: 'delivery' | 'pickup';
    booking_code: string | null;
    customer_name: string | null;
    vehicle_name: string | null;
    staff_name: string | null;
    scheduled_at: string | null;
    address: string | null;
    status: string;
};

type TodayRental = {
    booking_code: string;
    customer_name: string;
    vehicle_name: string | null;
    unit_code: string | null;
    driver_name: string | null;
    start_date: string;
    end_date: string;
    status: string;
};

type Props = {
    today: string;
    kpis: { todayBookings: number; deliveries: number; pickups: number; activeRentals: number; unassigned: number };
    attention: { key: string; label: string; count: number }[];
    board: { scheduled: TaskCard[]; assigned: TaskCard[]; on_the_way: TaskCard[]; completed: TaskCard[] };
    todayRentals: TodayRental[];
};

const columns = [
    { key: 'scheduled', title: 'Menunggu' },
    { key: 'assigned', title: 'Ditugaskan' },
    { key: 'on_the_way', title: 'Dalam Perjalanan' },
    { key: 'completed', title: 'Selesai' },
] as const;

export default function OperationsIndex() {
    const { today, kpis, attention, board, todayRentals } = usePage().props as unknown as Props;

    const kpiCards = [
        { label: 'Booking Hari Ini', value: kpis.todayBookings, icon: ClipboardList },
        { label: 'Pengantaran Aktif', value: kpis.deliveries, icon: Truck },
        { label: 'Pengambilan Aktif', value: kpis.pickups, icon: Package },
        { label: 'Sedang Disewa', value: kpis.activeRentals, icon: CarFront },
        { label: 'Belum Ditugaskan', value: kpis.unassigned, icon: CircleAlert },
    ];

    return (
        <AdminLayout title="Operasional">
            <Head title="Operasional" />

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Operasional</h2>
                    <p className="mt-1 text-sm text-slate-500">Pantau seluruh tugas rental hari ini.</p>
                </div>
                <div className="flex items-center gap-2">
                    <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600">
                        <CalendarDays className="size-3.5" />{today}
                    </p>
                    <Link href="/admin/operations/calendar" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700">
                        Kalender<ArrowRight className="size-3.5" />
                    </Link>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {kpiCards.map((k, i) => (
                    <div key={k.label} className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4" style={{ animationDelay: `${i * 50}ms` }}>
                        <k.icon className="size-4 text-slate-400" />
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{k.value}</p>
                        <p className="text-xs text-slate-500">{k.label}</p>
                    </div>
                ))}
            </div>

            {attention.some((a) => a.count > 0) && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                        <CircleAlert className="size-4" /> Perlu Perhatian
                    </p>
                    <ul className="mt-2 space-y-1 text-[13px] font-medium text-amber-800 tabular-nums">
                        {attention.filter((a) => a.count > 0).map((a) => (
                            <li key={a.key} className="flex items-center gap-1.5">
                                <CircleAlert className="size-3.5 shrink-0" />
                                {a.count} {a.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Task board */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {columns.map((col) => {
                    const cards = board[col.key];
                    return (
                        <section key={col.key} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
                            <header className="flex items-center justify-between px-1 pb-2">
                                <h3 className="text-[13px] font-bold tracking-wide text-slate-700 uppercase">{col.title}</h3>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 tabular-nums">{cards.length}</span>
                            </header>
                            <div className="space-y-2">
                                {cards.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-[11px] text-slate-400">Kosong</p>
                                ) : (
                                    cards.map((t) => (
                                        <article key={t.id} className="rounded-xl border border-slate-200/80 bg-white p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <Link href={t.booking_code ? `/admin/bookings/${t.booking_code}` : '#'} className="font-mono text-[11px] font-bold text-slate-900 hover:underline">
                                                    {t.booking_code}
                                                </Link>
                                                <Badge variant="outline" className="text-[10px]">{t.type === 'delivery' ? 'Antar' : 'Jemput'}</Badge>
                                            </div>
                                            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                                                {t.vehicle_name?.toLowerCase().includes('avanza') || t.vehicle_name?.toLowerCase().includes('brio') || t.vehicle_name?.toLowerCase().includes('innova') || t.vehicle_name?.toLowerCase().includes('xenia') ? <CarFront className="size-3.5 text-slate-400" /> : <Bike className="size-3.5 text-slate-400" />}
                                                {t.vehicle_name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-500">{t.customer_name}</p>
                                            {t.address && <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><MapPin className="mt-0.5 size-3 shrink-0" />{t.address}</p>}
                                            <p className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
                                                {t.scheduled_at ?? 'Tanpa jadwal'} · {t.staff_name ?? <span className="font-semibold text-amber-700">Belum ditugaskan</span>}
                                            </p>
                                            {col.key !== 'completed' && t.staff_name && (
                                                <p className="mt-1.5 text-[11px] text-slate-400">
                                                    Kelola di <Link href={t.booking_code ? `/admin/bookings/${t.booking_code}` : '#'} className="font-semibold text-slate-600 hover:underline">detail booking</Link>
                                                </p>
                                            )}
                                        </article>
                                    ))
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>

            {board.scheduled.length === 0 && board.assigned.length === 0 && board.on_the_way.length === 0 && board.completed.length === 0 && (
                <p className="mt-4 rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-center text-sm text-slate-500">
                    Tidak ada tugas hari ini. Semua operasional sudah selesai.
                </p>
            )}

            {/* Today timeline */}
            <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5">
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Rental Berjalan Hari Ini</h3>
                {todayRentals.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">Tidak ada rental yang berjalan hari ini.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                        {todayRentals.map((r) => (
                            <li key={r.booking_code} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                                <Link href={`/admin/bookings/${r.booking_code}`} className="font-mono text-xs font-bold text-slate-900 hover:underline">{r.booking_code}</Link>
                                <span className="font-medium">{r.vehicle_name}{r.unit_code ? ` · ${r.unit_code}` : ''}</span>
                                <span className="text-slate-500">{r.customer_name}{r.driver_name ? ` · Driver ${r.driver_name}` : ''}</span>
                                <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-[11px] font-semibold', r.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800')}>
                                    {r.status === 'active' ? 'Aktif' : r.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </AdminLayout>
    );
}
