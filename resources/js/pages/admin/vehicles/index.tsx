import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Bike,
    CarFront,
    ChevronLeft,
    ChevronRight,
    Eye,
    MoreHorizontal,
    Pencil,
    Plus,
    Power,
    Search,
    Trash2,
} from 'lucide-react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { AdminVehicleRow, Paginated, VehicleFilters } from '@/types';
import { cn } from '@/lib/utils';

type Props = {
    vehicles: Paginated<AdminVehicleRow>;
    filters: VehicleFilters;
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

type ConfirmState =
    | { type: 'status'; vehicle: AdminVehicleRow }
    | { type: 'delete'; vehicle: AdminVehicleRow }
    | null;

export default function VehicleIndex() {
    const { vehicles, filters } = usePage().props as unknown as Props;

    const [search, setSearch] = useState(filters.search ?? '');
    const [category, setCategory] = useState(filters.category ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [sort, setSort] = useState(filters.sort);
    const [confirm, setConfirm] = useState<ConfirmState>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                reload({ search });
            }
        }, 450);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const reload = (overrides: Record<string, string>) => {
        router.get(
            '/admin/vehicles',
            {
                search: overrides.search ?? search,
                category: overrides.category ?? category,
                sort,
            status: overrides.status ?? status,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const apply = (key: 'category' | 'status' | 'sort', value: string) => {
        if (key === 'category') setCategory(value);
        if (key === 'status') setStatus(value);
        if (key === 'sort') setSort(value as VehicleFilters['sort']);
        reload({ [key]: value });
    };

    const runConfirm = () => {
        if (!confirm) return;
        setBusy(true);
        const done = () => {
            setBusy(false);
            setConfirm(null);
        };
        if (confirm.type === 'status') {
            const next = confirm.vehicle.status === 'active' ? 'inactive' : 'active';
            router.patch(
                `/admin/vehicles/${confirm.vehicle.slug}/status`,
                { status: next },
                { preserveScroll: true, onFinish: done },
            );
        } else {
            router.delete(`/admin/vehicles/${confirm.vehicle.slug}`, {
                preserveScroll: true,
                onFinish: done,
            });
        }
    };

    return (
        <AdminLayout title="Kendaraan">
            <Head title="Kelola Kendaraan" />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Kendaraan</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Kelola kendaraan yang tersedia untuk disewakan kepada customer.
                    </p>
                </div>
                <Link
                    href="/admin/vehicles/create"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FF9137] px-4 py-2.5 text-sm font-semibold text-[#241203] transition-[transform,background-color] duration-150 ease-out hover:bg-[#ff9f52] active:scale-[0.98]"
                >
                    <Plus className="size-4" /> Tambah Kendaraan
                </Link>
            </div>

            {/* Search + filters */}
            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama, merek, atau model…"
                            aria-label="Cari kendaraan"
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
                        <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Filter kategori">
                            {[
                                { value: '', label: 'Semua' },
                                { value: 'motor', label: 'Motor' },
                                { value: 'mobil', label: 'Mobil' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => apply('category', opt.value)}
                                    className={cn(
                                        'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150',
                                        category === opt.value
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800',
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <select
                            value={status}
                            onChange={(e) => apply('status', e.target.value)}
                            aria-label="Filter status"
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        >
                            <option value="">Semua status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                        <select
                            value={sort}
                            onChange={(e) => apply('sort', e.target.value)}
                            aria-label="Urutkan"
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        >
                            <option value="latest">Terbaru</option>
                            <option value="name_asc">Nama A–Z</option>
                            <option value="name_desc">Nama Z–A</option>
                            <option value="price_asc">Harga terendah</option>
                            <option value="price_desc">Harga tertinggi</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                {vehicles.data.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <CarFront className="size-6" />
                        </div>
                        <p className="mt-4 text-[15px] font-semibold text-slate-900">Belum ada kendaraan</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            {filters.search || filters.category || filters.status
                                ? 'Tidak ada kendaraan yang cocok dengan pencarian atau filter.'
                                : 'Tambahkan kendaraan pertama untuk mulai mengelola katalog SoloRent.'}
                        </p>
                        {!filters.search && !filters.category && !filters.status && (
                            <Link
                                href="/admin/vehicles/create"
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FF9137] px-4 py-2.5 text-sm font-semibold text-[#241203] transition-transform duration-150 ease-out hover:bg-[#ff9f52] active:scale-[0.98]"
                            >
                                <Plus className="size-4" /> Tambah Kendaraan
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs text-slate-500">
                                    <th className="px-5 py-3 font-medium">Kendaraan</th>
                                    <th className="px-4 py-3 font-medium">Kategori</th>
                                    <th className="px-4 py-3 font-medium">Harga / Hari</th>
                                    <th className="px-4 py-3 font-medium">Unit</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        <span className="sr-only">Aksi</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-800">
                                {vehicles.data.map((v) => (
                                    <tr key={v.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                {v.image_url ? (
                                                    <img
                                                        src={v.image_url}
                                                        alt={v.name}
                                                        loading="lazy"
                                                        className="size-11 shrink-0 rounded-xl border border-slate-200 object-cover"
                                                    />
                                                ) : (
                                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                                        {v.category === 'motor' ? (
                                                            <Bike className="size-5" />
                                                        ) : (
                                                            <CarFront className="size-5" />
                                                        )}
                                                    </span>
                                                )}
                                                <div className="min-w-0">
                                                    <Link
                                                        href={`/admin/vehicles/${v.slug}`}
                                                        className="block truncate font-semibold text-slate-900 hover:underline"
                                                    >
                                                        {v.name}
                                                    </Link>
                                                    <p className="truncate text-xs text-slate-500">
                                                        {[v.brand, v.model].filter(Boolean).join(' · ') || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className="bg-slate-50 capitalize">
                                                {v.category}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums">
                                            {rupiah(v.price_per_day)}
                                        </td>
                                        <td className="px-4 py-3 tabular-nums">
                                            <span className="font-semibold">{v.stock}</span>
                                            {v.total_units > 0 && (
                                                <span className="block text-[11px] font-normal text-slate-500">
                                                    {v.active_units}/{v.total_units} unit fisik
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    v.status === 'active'
                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                                }
                                            >
                                                {v.status === 'active' ? 'Aktif' : 'Nonaktif'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        aria-label={`Aksi untuk ${v.name}`}
                                                        className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                                    >
                                                        <MoreHorizontal className="size-4" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/admin/vehicles/${v.slug}`} className="cursor-pointer">
                                                            <Eye className="size-4" /> Lihat
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/admin/vehicles/${v.slug}/edit`} className="cursor-pointer">
                                                            <Pencil className="size-4" /> Edit
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onSelect={() => setConfirm({ type: 'status', vehicle: v })}
                                                        className="cursor-pointer"
                                                    >
                                                        <Power className="size-4" />
                                                        {v.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={() => setConfirm({ type: 'delete', vehicle: v })}
                                                        className="cursor-pointer text-rose-600 focus:text-rose-600"
                                                    >
                                                        <Trash2 className="size-4" /> Hapus
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {vehicles.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5">
                        <p className="text-xs text-slate-500 tabular-nums">
                            Menampilkan {vehicles.from}–{vehicles.to} dari {vehicles.total} kendaraan
                        </p>
                        <div className="flex items-center gap-1.5">
                            <PaginationLink url={vehicles.links[0]?.url ?? null} label="Sebelumnya" icon={<ChevronLeft className="size-4" />} />
                            {vehicles.links
                                .filter((l) => !Number.isNaN(Number(l.label)))
                                .map((l) => (
                                    <PaginationLink key={l.label} url={l.url} label={l.label} active={l.active} />
                                ))}
                            <PaginationLink url={vehicles.links[vehicles.links.length - 1]?.url ?? null} label="Berikutnya" icon={<ChevronRight className="size-4" />} />
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm dialog */}
            <Dialog open={confirm !== null} onOpenChange={(open) => !open && !busy && setConfirm(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {confirm?.type === 'status'
                                ? confirm.vehicle.status === 'active'
                                    ? 'Nonaktifkan kendaraan?'
                                    : 'Aktifkan kendaraan?'
                                : 'Hapus kendaraan?'}
                        </DialogTitle>
                        <DialogDescription>
                            {confirm?.type === 'status' && confirm.vehicle.status === 'active'
                                ? `${confirm.vehicle.name} tidak akan tersedia untuk booking baru. Histori booking tetap tersimpan.`
                                : confirm?.type === 'status'
                                  ? `${confirm.vehicle.name} akan kembali tampil di katalog dan dapat dipesan.`
                                  : confirm !== null && confirm.vehicle.bookings_count > 0
                                    ? `${confirm.vehicle.name} memiliki histori booking sehingga hanya akan diarsipkan, tidak dihapus permanen.`
                                    : `${confirm?.vehicle.name} akan dihapus permanen beserta fotonya.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
                            Batal
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={runConfirm}
                            className={cn(
                                confirm?.type === 'delete'
                                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                                    : 'bg-slate-900 text-white hover:bg-slate-700',
                            )}
                        >
                            {busy ? 'Memproses…' : confirm?.type === 'delete' ? 'Hapus' : 'Ya, lanjutkan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function PaginationLink({
    url,
    label,
    active,
    icon,
}: {
    url: string | null;
    label: string;
    active?: boolean;
    icon?: React.ReactNode;
}) {
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
