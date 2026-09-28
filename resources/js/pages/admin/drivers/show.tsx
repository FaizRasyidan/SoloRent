import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, ClipboardList, Phone } from 'lucide-react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';

type Upcoming = {
    booking_code: string;
    vehicle_name: string | null;
    customer_name: string;
    start_date: string;
    end_date: string;
    status: string;
};

type TaskRow = {
    id: number;
    type: string;
    booking_code: string | null;
    scheduled_at: string | null;
    status: string;
};

type Props = {
    driver: {
        id: number;
        name: string;
        whatsapp: string;
        sim_type: string;
        sim_number: string | null;
        notes: string | null;
        status: string;
        upcoming: Upcoming[];
        tasks: TaskRow[];
    };
};

const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export default function DriverShow() {
    const { driver } = usePage().props as unknown as Props;

    return (
        <AdminLayout title={driver.name}>
            <Head title={driver.name} />

            <Link href="/admin/drivers" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                <ArrowLeft className="size-4" /> Kembali ke daftar
            </Link>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
                            {driver.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{driver.name}</h2>
                            <Badge variant="outline" className={driver.status === 'active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : driver.status === 'working' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                                {driver.status === 'active' ? '● Aktif' : driver.status === 'working' ? '● Bekerja' : '● Nonaktif'}
                            </Badge>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-slate-600 tabular-nums"><Phone className="size-4 text-slate-400" />{driver.whatsapp}</p>
                        <p className="text-slate-600">SIM {driver.sim_type}{driver.sim_number ? ` · ${driver.sim_number}` : ''}</p>
                        {driver.notes && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{driver.notes}</p>}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <p className="text-xl font-bold text-slate-900 tabular-nums">{driver.upcoming.length}</p>
                            <p className="text-[11px] text-slate-500">Rental mendatang</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <p className="text-xl font-bold text-slate-900 tabular-nums">{driver.tasks.length}</p>
                            <p className="text-[11px] text-slate-500">Tugas tercatat</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 xl:col-span-2">
                    <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">
                        <CalendarDays className="size-4 text-slate-400" /> Jadwal & Riwayat Tugas
                    </h3>
                    {driver.upcoming.length === 0 && driver.tasks.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                            Belum ada jadwal. Driver tersedia untuk penugasan baru.
                        </p>
                    ) : (
                        <ul className="mt-3 space-y-2.5">
                            {driver.upcoming.map((b) => (
                                <li key={b.booking_code} className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3.5 py-3 text-sm">
                                    <ClipboardList className="size-4 shrink-0 text-slate-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-xs font-semibold text-slate-900">{b.booking_code} · {b.vehicle_name}</p>
                                        <p className="text-xs text-slate-500 tabular-nums">{fmtDate(b.start_date)} – {fmtDate(b.end_date)} · {b.customer_name}</p>
                                    </div>
                                    <Link href={`/admin/bookings/${b.booking_code}`} className="shrink-0 text-xs font-semibold text-slate-700 hover:underline">
                                        Buka
                                    </Link>
                                </li>
                            ))}
                            {driver.tasks.map((t) => (
                                <li key={`t-${t.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3.5 py-3 text-sm">
                                    <CalendarDays className="size-4 shrink-0 text-slate-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-slate-900">
                                            {t.type === 'delivery' ? 'Antar' : 'Jemput'} · {t.booking_code} · {t.scheduled_at ?? 'tanpa jadwal'}
                                        </p>
                                        <p className="text-xs text-slate-500">{t.status}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </AdminLayout>
    );
}
