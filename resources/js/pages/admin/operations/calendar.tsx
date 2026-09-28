import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';

type CalEvent = {
    id: string;
    date: string;
    time: string | null;
    kind: 'delivery' | 'pickup' | 'rental_start' | 'rental_end';
    title: string;
    subtitle: string | null;
    booking_code: string | null;
};

type Props = {
    month: string;
    monthLabel: string;
    weekStart: string;
    events: CalEvent[];
};

const kindStyle: Record<string, string> = {
    delivery: 'bg-sky-100 text-sky-900',
    pickup: 'bg-amber-100 text-amber-900',
    rental_start: 'bg-emerald-100 text-emerald-900',
    rental_end: 'bg-slate-200 text-slate-700',
};

function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function OperationsCalendar() {
    const { month, monthLabel, weekStart, events } = usePage().props as unknown as Props;
    const [selected, setSelected] = useState<CalEvent | null>(null);

    const go = (target: string) => {
        router.get('/admin/operations/calendar', { month: target }, { preserveState: true, replace: true });
    };

    const weeks: string[][] = [];
    const cursor = new Date(`${weekStart}T00:00:00`);
    for (let w = 0; w < 6; w++) {
        const days: string[] = [];
        for (let d = 0; d < 7; d++) {
            days.push(cursor.toISOString().slice(0, 10));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(days);
        if (weeks.length >= 5 && cursor.getMonth() !== Number(month.split('-')[1]) - 1 && cursor.getDate() > 7) break;
    }

    const byDate = new Map<string, CalEvent[]>();
    for (const e of events) {
        const list = byDate.get(e.date) ?? [];
        list.push(e);
        byDate.set(e.date, list);
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const activeMonth = Number(month.split('-')[1]) - 1;

    return (
        <AdminLayout title="Kalender Operasional">
            <Head title="Kalender Operasional" />

            <Link href="/admin/operations" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                <ArrowLeft className="size-4" /> Kembali ke operasional
            </Link>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 capitalize">{monthLabel}</h2>
                <div className="flex items-center gap-1.5">
                    <button type="button" aria-label="Bulan sebelumnya" onClick={() => go(shiftMonth(month, -1))} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                        <ChevronLeft className="size-4" />
                    </button>
                    <button type="button" onClick={() => go(new Date().toISOString().slice(0, 7))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Hari ini
                    </button>
                    <button type="button" aria-label="Bulan berikutnya" onClick={() => go(shiftMonth(month, 1))} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="grid grid-cols-7 border-b border-slate-200 text-center text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
                        <div key={d} className="px-1 py-2.5">{d}</div>
                    ))}
                </div>
                {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-0">
                        {week.map((date) => {
                            const dayEvents = byDate.get(date) ?? [];
                            const inMonth = new Date(`${date}T00:00:00`).getMonth() === activeMonth;
                            return (
                                <div key={date} className={cn('min-h-20 border-r border-slate-100 p-1.5 last:border-0 sm:min-h-24', !inMonth && 'bg-slate-50/60')}>
                                    <p className={cn(
                                        'inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                                        date === todayIso ? 'bg-slate-900 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300',
                                    )}>
                                        {Number(date.slice(8, 10))}
                                    </p>
                                    <div className="mt-1 space-y-1">
                                        {dayEvents.slice(0, 3).map((e) => (
                                            <button
                                                key={e.id}
                                                type="button"
                                                onClick={() => setSelected(e)}
                                                className={cn('block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] font-semibold', kindStyle[e.kind])}
                                            >
                                                {e.time ? `${e.time} ` : ''}{e.title}
                                            </button>
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <p className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} lainnya</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={() => setSelected(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{selected.kind.replace('_', ' ')}{selected.time ? ` · ${selected.time}` : ''}</p>
                        <h3 className="mt-1 text-[15px] font-bold text-slate-900">{selected.title}</h3>
                        {selected.subtitle && <p className="mt-0.5 text-sm text-slate-600">{selected.subtitle}</p>}
                        {selected.booking_code && (
                            <Link href={`/admin/bookings/${selected.booking_code}`} className="mt-4 flex h-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700">
                                Buka {selected.booking_code}
                            </Link>
                        )}
                        <button type="button" onClick={() => setSelected(null)} className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                            Tutup
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
