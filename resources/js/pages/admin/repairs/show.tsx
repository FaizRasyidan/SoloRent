import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    REPAIR_PRIORITY_LABELS,
    REPAIR_STATUS_LABELS,
    type RepairDetail,
} from '@/types';
import { cn } from '@/lib/utils';

type Props = {
    repair: RepairDetail;
    statusLabels: Record<string, string>;
    priorityLabels: Record<string, string>;
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const statusStyle: Record<string, string> = {
    scheduled: 'bg-amber-50 text-amber-800 border-amber-200',
    in_progress: 'bg-sky-50 text-sky-800 border-sky-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const priorityStyle: Record<string, string> = {
    rendah: 'bg-slate-100 text-slate-600 border-slate-200',
    sedang: 'bg-sky-50 text-sky-800 border-sky-200',
    tinggi: 'bg-amber-50 text-amber-800 border-amber-200',
    darurat: 'bg-rose-50 text-rose-800 border-rose-200',
};

const cardCls = 'rounded-2xl border border-slate-200/80 bg-white p-5';
const cardTitleCls = 'text-[15px] font-semibold tracking-tight text-slate-900';

export default function RepairShow() {
    const { repair } = usePage().props as unknown as Props;
    const [busy, setBusy] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);

    const transition = (next: string) => {
        setBusy(next);
        router.patch(`/admin/maintenances/${repair.id}/status`, { status: next }, {
            preserveScroll: true,
            onFinish: () => setBusy(null),
        });
    };

    const isActive = repair.status === 'scheduled' || repair.status === 'in_progress';

    return (
        <AdminLayout title={`Perbaikan #${repair.id}`}>
            <Head title={`Perbaikan ${repair.unit_code ?? ''} — ${repair.title}`} />

            <Link href="/admin/repairs" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                <ArrowLeft className="size-4" /> Kembali ke Perbaikan
            </Link>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                        {repair.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 tabular-nums">
                        Unit {repair.unit_code ?? '—'}{repair.vehicle_name ? ` · ${repair.vehicle_name}` : ''}{repair.plate_number ? ` · ${repair.plate_number}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusStyle[repair.status] ?? ''}>
                            {REPAIR_STATUS_LABELS[repair.status] ?? repair.status}
                        </Badge>
                        <Badge variant="outline" className={priorityStyle[repair.priority] ?? ''}>
                            {REPAIR_PRIORITY_LABELS[repair.priority] ?? repair.priority}
                        </Badge>
                        {repair.is_overdue && (
                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-800">
                                Terlambat
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {repair.status === 'scheduled' && (
                        <Button disabled={busy !== null} onClick={() => transition('in_progress')} className="rounded-xl bg-slate-900 text-white hover:bg-slate-700">
                            {busy === 'in_progress' && <Loader2 className="size-4 animate-spin" />} Mulai — unit nonaktif
                        </Button>
                    )}
                    {repair.status === 'in_progress' && (
                        <Button disabled={busy !== null} onClick={() => transition('completed')} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600">
                            {busy === 'completed' && <Loader2 className="size-4 animate-spin" />} Selesaikan — unit aktif lagi
                        </Button>
                    )}
                    {isActive && (
                        <Button variant="outline" disabled={busy !== null} onClick={() => transition('cancelled')} className="rounded-xl text-rose-600 hover:text-rose-600">
                            Batalkan
                        </Button>
                    )}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                    <section className={cardCls}>
                        <h3 className={cardTitleCls}>Detail Perbaikan</h3>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Biaya</p>
                                <p className="mt-1 font-bold tabular-nums">{rupiah(repair.cost)}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Estimasi</p>
                                <p className="mt-1 font-semibold tabular-nums">{repair.estimated_completed_at ?? '—'}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Mulai</p>
                                <p className="mt-1 font-semibold tabular-nums">{repair.started_at ?? '—'}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Selesai</p>
                                <p className="mt-1 font-semibold tabular-nums">{repair.completed_at ?? '—'}</p>
                            </div>
                        </div>
                        {repair.description && <p className="mt-3 text-sm text-slate-600">{repair.description}</p>}
                        {repair.notes && (
                            <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Catatan: {repair.notes}</p>
                        )}
                        {isActive && (
                            <Button variant="outline" onClick={() => setEditing((v) => !v)} className="mt-3 h-9 rounded-xl text-xs">
                                {editing ? 'Tutup edit' : 'Ubah biaya / prioritas / estimasi'}
                            </Button>
                        )}
                        {editing && isActive && <EditForm repair={repair} onDone={() => setEditing(false)} />}
                    </section>

                    {repair.damages.length > 0 ? (
                        <section className={cardCls}>
                            <h3 className={cardTitleCls}>
                                Rincian Kerusakan
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 tabular-nums">
                                    {repair.damages.length} item digabung
                                </span>
                            </h3>
                            <ul className="mt-3 space-y-2">
                                {repair.damages.map((d) => (
                                    <li key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                                        {d.photo_url && (
                                            <img src={d.photo_url} alt={d.title} loading="lazy" className="size-11 shrink-0 rounded-lg border border-slate-200 object-cover" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-slate-900">{d.title}</p>
                                            {d.description && <p className="truncate text-xs text-slate-500">{d.description}</p>}
                                        </div>
                                        <span className="shrink-0 font-semibold tabular-nums">
                                            Rp{Number(d.repair_cost).toLocaleString('id-ID')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : repair.damage && (
                        <section className={cardCls}>
                            <h3 className={cardTitleCls}>Kerusakan Terkait</h3>
                            <div className="mt-3 flex items-center gap-3">
                                {repair.damage.photo_url && (
                                    <img src={repair.damage.photo_url} alt={repair.damage.title} className="size-16 rounded-xl border border-slate-200 object-cover" />
                                )}
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{repair.damage.title}</p>
                                    <p className="text-xs text-slate-500">Otomatis tercatat dari input kerusakan.</p>
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                <div className="space-y-4">
                    <section className={cn(cardCls, 'lg:sticky lg:top-20')}>
                        <h3 className={cardTitleCls}>Sumber</h3>
                        {repair.booking ? (
                            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Booking</p>
                                <Link href={`/admin/bookings/${repair.booking.booking_code}`} className="mt-1 inline-block font-mono font-bold text-sky-700 hover:underline">
                                    {repair.booking.booking_code}
                                </Link>
                                <p className="mt-1 text-slate-600">{repair.booking.customer_name} · {repair.booking.customer_phone}</p>
                            </div>
                        ) : (
                            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                Input manual — tanpa booking (kerusakan di luar sewa).
                            </p>
                        )}
                        <div className="mt-3">
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Alur status</p>
                            <ol className="mt-2 space-y-1.5 text-[13px]">
                                <li className={repair.started_at ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                                    {repair.started_at ? `✓ Dimulai — ${repair.started_at}` : '○ Belum dimulai'}
                                </li>
                                <li className={repair.completed_at ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                                    {repair.completed_at ? `✓ Selesai — ${repair.completed_at}` : '○ Belum selesai'}
                                </li>
                            </ol>
                        </div>
                    </section>
                </div>
            </div>
        </AdminLayout>
    );
}

function EditForm({ repair, onDone }: { repair: RepairDetail; onDone: () => void }) {
    const form = useForm({
        title: repair.title,
        description: repair.description ?? '',
        cost: String(repair.cost),
        priority: repair.priority,
        estimated_completed_at: repair.estimated_raw ?? '',
        notes: repair.notes ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(`/admin/repairs/${repair.id}`, { preserveScroll: true, onSuccess: onDone });
    };

    return (
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
                <Label>Judul</Label>
                <Input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} className="h-10 rounded-xl bg-white" />
            </div>
            <div className="grid gap-1.5">
                <Label>Biaya (Rp)</Label>
                <Input value={form.data.cost} onChange={(e) => form.setData('cost', e.target.value)} inputMode="numeric" className="h-10 rounded-xl bg-white tabular-nums" />
            </div>
            <div className="grid gap-1.5">
                <Label>Prioritas</Label>
                <select value={form.data.priority} onChange={(e) => form.setData('priority', e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
                    {Object.entries(REPAIR_PRIORITY_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
            </div>
            <div className="grid gap-1.5">
                <Label>Estimasi selesai</Label>
                <Input type="datetime-local" value={form.data.estimated_completed_at} onChange={(e) => form.setData('estimated_completed_at', e.target.value)} className="h-10 rounded-xl bg-white" />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
                <Label>Deskripsi</Label>
                <Input value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} className="h-10 rounded-xl bg-white" />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
                <Label>Catatan</Label>
                <Input value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} className="h-10 rounded-xl bg-white" />
            </div>
            {(form.errors.title || form.errors.cost) && (
                <p className="text-xs text-rose-600 sm:col-span-2">{form.errors.title ?? form.errors.cost}</p>
            )}
            <div className="sm:col-span-2">
                <Button type="submit" disabled={form.processing} className="h-10 rounded-xl bg-slate-900 text-sm text-white hover:bg-slate-700">
                    {form.processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                </Button>
            </div>
        </form>
    );
}
