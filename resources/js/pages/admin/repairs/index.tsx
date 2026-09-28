import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Eye, Plus, Search, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    REPAIR_PRIORITY_LABELS,
    REPAIR_STATUS_LABELS,
    type Paginated,
    type RepairFilters,
    type RepairRow,
    type RepairUnitOption,
} from '@/types';
import { cn } from '@/lib/utils';

type Props = {
    repairs: Paginated<RepairRow>;
    filters: RepairFilters;
    statusLabels: Record<string, string>;
    priorityLabels: Record<string, string>;
    statusCounts: Record<string, number>;
    units: RepairUnitOption[];
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

export default function RepairIndex() {
    const { repairs, filters, statusCounts, units } = usePage().props as unknown as Props;
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [priority, setPriority] = useState(filters.priority ?? '');
    const [overdueOnly, setOverdueOnly] = useState(filters.overdue === '1');
    const [busy, setBusy] = useState<number | null>(null);
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (search !== (filters.search ?? '')) reload({ search });
        }, 450);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const reload = (overrides: Record<string, string>) => {
        router.get(
            '/admin/repairs',
            {
                search: overrides.search ?? search,
                status: overrides.status ?? status,
                priority: overrides.priority ?? priority,
                overdue: overrides.overdue ?? (overdueOnly ? '1' : ''),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const apply = (key: string, value: string) => {
        if (key === 'status') setStatus(value);
        if (key === 'priority') setPriority(value);
        reload({ [key]: value });
    };

    const toggleOverdue = () => {
        const next = !overdueOnly;
        setOverdueOnly(next);
        reload({ overdue: next ? '1' : '' });
    };

    const transition = (id: number, nextStatus: string) => {
        setBusy(id);
        router.patch(`/admin/maintenances/${id}/status`, { status: nextStatus }, {
            preserveScroll: true,
            onFinish: () => setBusy(null),
        });
    };

    const pillHref = (value: string) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (value) params.set('status', value);
        if (priority) params.set('priority', priority);
        if (overdueOnly) params.set('overdue', '1');
        const qs = params.toString();
        return `/admin/repairs${qs ? `?${qs}` : ''}`;
    };

    return (
        <AdminLayout title="Perbaikan">
            <Head title="Perbaikan Unit" />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Perbaikan</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Pantau semua unit yang diperbaiki dan ubah statusnya dari satu tempat. Kerusakan dari booking otomatis tercatat di sini.
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="rounded-xl bg-slate-900 text-white hover:bg-slate-700">
                    <Plus className="size-4" /> Input Perbaikan Manual
                </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter cepat status perbaikan">
                    <StatusPill active={status === ''} href={pillHref('')} label="Semua" count={statusCounts.all ?? 0} />
                    {Object.entries(REPAIR_STATUS_LABELS).map(([value, label]) => (
                        <StatusPill
                            key={value}
                            active={status === value}
                            href={pillHref(value)}
                            label={label}
                            count={statusCounts[value] ?? 0}
                            tone={value}
                        />
                    ))}
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari unit, judul kerusakan, atau kode booking..."
                            aria-label="Cari perbaikan"
                            className="h-11 rounded-xl pr-9 pl-10"
                        />
                        {search && (
                            <button
                                type="button"
                                aria-label="Bersihkan pencarian"
                                onClick={() => setSearch('')}
                                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md px-1 text-lg leading-none text-slate-400 hover:text-slate-700"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={status}
                            onChange={(e) => apply('status', e.target.value)}
                            aria-label="Filter status"
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        >
                            <option value="">Semua status</option>
                            {Object.entries(REPAIR_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <select
                            value={priority}
                            onChange={(e) => apply('priority', e.target.value)}
                            aria-label="Filter prioritas"
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        >
                            <option value="">Semua prioritas</option>
                            {Object.entries(REPAIR_PRIORITY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={toggleOverdue}
                            aria-pressed={overdueOnly}
                            className={cn(
                                'h-10 rounded-xl border px-3 text-sm font-semibold transition-colors',
                                overdueOnly
                                    ? 'border-rose-600 bg-rose-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                            )}
                        >
                            Terlambat saja
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                {repairs.data.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <Wrench className="size-6" />
                        </div>
                        <p className="mt-4 text-[15px] font-semibold text-slate-900">Belum ada perbaikan</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            Kerusakan dari booking akan otomatis muncul di sini. Atau input manual untuk unit yang rusak di luar sewa.
                        </p>
                        <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-4 rounded-xl">
                            <Plus className="size-4" /> Input Perbaikan Manual
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs text-slate-500">
                                    <th className="px-5 py-3 font-medium">Unit</th>
                                    <th className="px-4 py-3 font-medium">Kerusakan</th>
                                    <th className="px-4 py-3 font-medium">Prioritas</th>
                                    <th className="px-4 py-3 font-medium">Estimasi</th>
                                    <th className="px-4 py-3 text-right font-medium">Biaya</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-800">
                                {repairs.data.map((r) => (
                                    <tr key={r.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                                        <td className="px-5 py-3">
                                            <p className="font-semibold">{r.unit_code ?? '—'}</p>
                                            <p className="text-xs text-slate-500">{r.vehicle_name ?? ''}{r.plate_number ? ` · ${r.plate_number}` : ''}</p>
                                            {r.booking_code && (
                                                <Link href={`/admin/bookings/${r.booking_code}`} className="mt-0.5 inline-block font-mono text-[11px] text-sky-700 hover:underline">
                                                    {r.booking_code}
                                                </Link>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/admin/repairs/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                                            <p className="text-xs text-slate-400 tabular-nums">
                                                {r.created_at}
                                                {r.damage_count > 1 && (
                                                    <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                        {r.damage_count} kerusakan digabung
                                                    </span>
                                                )}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className={priorityStyle[r.priority] ?? ''}>
                                                {REPAIR_PRIORITY_LABELS[r.priority] ?? r.priority}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 tabular-nums">
                                            {r.estimated_completed_at ?? '—'}
                                            {r.is_overdue && (
                                                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                                    Terlambat
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{rupiah(r.cost)}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className={statusStyle[r.status] ?? ''}>
                                                {REPAIR_STATUS_LABELS[r.status] ?? r.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {r.status === 'scheduled' && (
                                                    <Button
                                                        variant="outline"
                                                        disabled={busy !== null}
                                                        onClick={() => transition(r.id, 'in_progress')}
                                                        className="h-8 rounded-lg text-[11px]"
                                                    >
                                                        {busy === r.id ? '…' : 'Mulai'}
                                                    </Button>
                                                )}
                                                {r.status === 'in_progress' && (
                                                    <Button
                                                        variant="outline"
                                                        disabled={busy !== null}
                                                        onClick={() => transition(r.id, 'completed')}
                                                        className="h-8 rounded-lg text-[11px]"
                                                    >
                                                        {busy === r.id ? '…' : 'Selesaikan'}
                                                    </Button>
                                                )}
                                                <Link
                                                    href={`/admin/repairs/${r.id}`}
                                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white hover:bg-slate-700"
                                                >
                                                    <Eye className="size-3.5" /> Detail
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {repairs.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5">
                        <p className="text-xs text-slate-500 tabular-nums">
                            Menampilkan {repairs.from}–{repairs.to} dari {repairs.total} perbaikan
                        </p>
                        <div className="flex items-center gap-1.5">
                            <PageLink url={repairs.links[0]?.url ?? null} label="Sebelumnya" icon={<ChevronLeft className="size-4" />} />
                            {repairs.links.filter((l) => !Number.isNaN(Number(l.label))).map((l) => (
                                <PageLink key={l.label} url={l.url} label={l.label} active={l.active} />
                            ))}
                            <PageLink url={repairs.links[repairs.links.length - 1]?.url ?? null} label="Berikutnya" icon={<ChevronRight className="size-4" />} />
                        </div>
                    </div>
                )}
            </div>

            <CreateRepairDialog open={createOpen} onClose={() => setCreateOpen(false)} units={units} />
        </AdminLayout>
    );
}

function CreateRepairDialog({ open, onClose, units }: { open: boolean; onClose: () => void; units: RepairUnitOption[] }) {
    const form = useForm({
        vehicle_unit_id: '',
        title: '',
        description: '',
        cost: '',
        priority: 'sedang',
        estimated_completed_at: '',
        notes: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/admin/repairs', {
            preserveScroll: true,
            onSuccess: () => { onClose(); form.reset(); },
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Input Perbaikan Manual</DialogTitle>
                    <DialogDescription>
                        Untuk unit rusak di luar sewa — mis. motor belum disewakan tapi perlu diperbaiki. Tanpa booking.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="repair_unit">Unit</Label>
                        <select
                            id="repair_unit"
                            value={form.data.vehicle_unit_id}
                            onChange={(e) => form.setData('vehicle_unit_id', e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                        >
                            <option value="">Pilih unit…</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id} disabled={u.in_maintenance}>
                                    {u.unit_code}{u.vehicle_name ? ` — ${u.vehicle_name}` : ''}{u.in_maintenance ? ' (diperbaiki)' : u.status !== 'active' ? ' (nonaktif)' : ''}
                                </option>
                            ))}
                        </select>
                        {form.errors.vehicle_unit_id && <p className="text-xs text-rose-600">{form.errors.vehicle_unit_id}</p>}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="repair_title">Judul kerusakan</Label>
                        <Input id="repair_title" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="Mis. Rem blong, ban bocor" className="h-11 rounded-xl" />
                        {form.errors.title && <p className="text-xs text-rose-600">{form.errors.title}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="repair_cost">Biaya (Rp)</Label>
                            <Input id="repair_cost" value={form.data.cost} onChange={(e) => form.setData('cost', e.target.value)} placeholder="Mis. 150000" inputMode="numeric" className="h-11 rounded-xl tabular-nums" />
                            {form.errors.cost && <p className="text-xs text-rose-600">{form.errors.cost}</p>}
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="repair_priority">Prioritas</Label>
                            <select
                                id="repair_priority"
                                value={form.data.priority}
                                onChange={(e) => form.setData('priority', e.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                            >
                                {Object.entries(REPAIR_PRIORITY_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                            {form.errors.priority && <p className="text-xs text-rose-600">{form.errors.priority}</p>}
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="repair_eta">Estimasi selesai</Label>
                        <Input id="repair_eta" type="datetime-local" value={form.data.estimated_completed_at} onChange={(e) => form.setData('estimated_completed_at', e.target.value)} className="h-11 rounded-xl" />
                        {form.errors.estimated_completed_at && <p className="text-xs text-rose-600">{form.errors.estimated_completed_at}</p>}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="repair_desc">Deskripsi (opsional)</Label>
                        <Input id="repair_desc" value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} placeholder="Detail kerusakan" className="h-11 rounded-xl" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                        <Button type="submit" disabled={form.processing} className="bg-slate-900 text-white hover:bg-slate-700">
                            {form.processing ? 'Menyimpan…' : 'Jadwalkan Perbaikan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function StatusPill({ active, href, label, count, tone }: { active: boolean; href: string; label: string; count: number; tone?: string }) {
    return (
        <Link
            href={href}
            preserveScroll
            aria-current={active ? 'true' : undefined}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] tabular-nums',
                active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
            )}
        >
            <span className={cn('size-1.5 rounded-full', dotTone(tone, active))} aria-hidden />
            {label}
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                {count}
            </span>
        </Link>
    );
}

function dotTone(tone: string | undefined, active: boolean): string {
    if (active) return 'bg-white';
    switch (tone) {
        case 'scheduled': return 'bg-amber-500';
        case 'in_progress': return 'bg-sky-500';
        case 'completed': return 'bg-emerald-500';
        case 'cancelled': return 'bg-slate-400';
        default: return 'bg-slate-400';
    }
}

function PageLink({ url, label, active, icon }: { url: string | null; label: string; active?: boolean; icon?: React.ReactNode }) {
    if (!url) {
        return (
            <span aria-disabled="true" className="inline-flex h-9 items-center rounded-lg px-2.5 text-sm text-slate-300">
                {icon ?? label}
            </span>
        );
    }
    return (
        <Link
            href={url}
            preserveScroll
            preserveState
            aria-label={typeof icon !== 'undefined' ? label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-colors',
                active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
        >
            {icon ?? label}
        </Link>
    );
}
