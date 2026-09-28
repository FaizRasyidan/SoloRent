import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    Bike,
    CarFront,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminVehicleDetail, VehicleUnitRow } from '@/types';
import { cn } from '@/lib/utils';

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

function Spec({ label, value }: { label: string; value: string | number | null }) {
    return (
        <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{value || '—'}</p>
        </div>
    );
}

export default function VehicleShow() {
    const { vehicle } = usePage().props as unknown as { vehicle: AdminVehicleDetail };
    const [activePhoto, setActivePhoto] = useState(vehicle.gallery[0] ?? vehicle.image_url);

    const photos = vehicle.gallery.length > 0 ? vehicle.gallery : vehicle.image_url ? [vehicle.image_url] : [];

    return (
        <AdminLayout title={vehicle.name}>
            <Head title={vehicle.name} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    href="/admin/vehicles"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
                >
                    <ArrowLeft className="size-4" /> Kembali ke daftar
                </Link>
                <Link
                    href={`/admin/vehicles/${vehicle.slug}/edit`}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-slate-700 active:scale-[0.98]"
                >
                    <Pencil className="size-4" /> Edit Kendaraan
                </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                        {activePhoto ? (
                            <img src={activePhoto} alt={vehicle.name} className="aspect-video w-full object-cover" />
                        ) : (
                            <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-slate-50 text-slate-300">
                                {vehicle.category === 'motor' ? <Bike className="size-12" /> : <CarFront className="size-12" />}
                                <span className="text-xs font-semibold tracking-wide uppercase">Belum ada foto</span>
                            </div>
                        )}
                        {photos.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto p-3">
                                {photos.map((url) => (
                                    <button
                                        key={url}
                                        type="button"
                                        onClick={() => setActivePhoto(url)}
                                        aria-label={`Lihat foto ${vehicle.name}`}
                                        className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${activePhoto === url ? 'border-slate-900' : 'border-transparent'}`}
                                    >
                                        <img src={url} alt="" className="size-16 object-cover" loading="lazy" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {vehicle.description && (
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
                            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Deskripsi</h3>
                            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">{vehicle.description}</p>
                        </div>
                    )}

                    {vehicle.recent_bookings.length > 0 && (
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
                            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Booking terakhir</h3>
                            <ul className="mt-3 divide-y divide-slate-100">
                                {vehicle.recent_bookings.map((b) => (
                                    <li key={b.booking_code} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                        <div>
                                            <p className="font-mono text-xs font-semibold text-slate-900">{b.booking_code}</p>
                                            <p className="text-xs text-slate-500">{b.customer_name} · {b.status}</p>
                                        </div>
                                        <p className="font-semibold tabular-nums">{rupiah(b.total)}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                                {vehicle.status === 'active' ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                            <Badge variant="outline" className="bg-slate-50 capitalize">{vehicle.category}</Badge>
                            {vehicle.featured && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">Unggulan</Badge>
                            )}
                        </div>
                        <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">{vehicle.name}</h2>
                        <p className="text-sm text-slate-500">{[vehicle.brand, vehicle.model].filter(Boolean).join(' · ') || '—'}</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                            {rupiah(vehicle.price_per_day)} <span className="text-sm font-normal text-slate-500">/ hari</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-500 tabular-nums">
                            Stok {vehicle.stock} unit · {vehicle.bookings_count} booking tercatat
                        </p>
                        {vehicle.unit_summary.mode === 'units' && (
                            <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 tabular-nums">
                                {vehicle.unit_summary.total} unit fisik ·{' '}
                                <span className="font-semibold text-emerald-700">{vehicle.unit_summary.available} tersedia</span>
                                {' '}· {vehicle.unit_summary.rented} disewa
                            </p>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
                        <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Spesifikasi</h3>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <Spec label="Mesin" value={vehicle.engine} />
                            <Spec label="Transmisi" value={vehicle.transmission === 'automatic' ? 'Automatic' : 'Manual'} />
                            <Spec label="Kapasitas" value={`${vehicle.seats} orang`} />
                            <Spec label="Bahan Bakar" value={vehicle.fuel} />
                            <div className="col-span-2">
                                <Spec label="Bagasi" value={vehicle.baggage} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
                        <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Benefit</h3>
                        {vehicle.benefits.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-400">Belum ada benefit.</p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {vehicle.benefits.map((b) => (
                                    <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                                        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <UnitSection vehicle={vehicle} />
                </div>
            </div>
        </AdminLayout>
    );
}

function UnitSection({ vehicle }: { vehicle: AdminVehicleDetail }) {
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState<number | string | null>(null);
    const form = useForm({ unit_code: '', plate_number: '', status: 'active', notes: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setBusy('new');
        form.post(`/admin/vehicles/${vehicle.slug}/units`, {
            preserveScroll: true,
            onSuccess: () => {
                setAdding(false);
                form.reset();
            },
            onFinish: () => setBusy(null),
        });
    };

    const toggleStatus = (unit: VehicleUnitRow) => {
        setBusy(unit.id);
        router.put(
            `/admin/units/${unit.id}`,
            {
                unit_code: unit.unit_code,
                plate_number: unit.plate_number ?? '',
                status: unit.status === 'active' ? 'inactive' : 'active',
                notes: unit.notes ?? '',
            },
            { preserveScroll: true, onFinish: () => setBusy(null) },
        );
    };

    const remove = (unit: VehicleUnitRow) => {
        setBusy(unit.id);
        router.delete(`/admin/units/${unit.id}`, { preserveScroll: true, onFinish: () => setBusy(null) });
    };

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Unit Fisik</h3>
                    <p className="text-xs text-slate-500">{vehicle.units.length} unit terdaftar · dipakai untuk assignment booking</p>
                </div>
                <Button variant="outline" onClick={() => setAdding((v) => !v)} className="h-9 rounded-xl text-xs">
                    <Plus className="size-3.5" /> Tambah Unit
                </Button>
            </div>

            {adding && (
                <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="unit_code">Kode Unit</Label>
                        <Input id="unit_code" value={form.data.unit_code} onChange={(e) => form.setData('unit_code', e.target.value)} placeholder="VR-001" className="h-10 rounded-xl bg-white" />
                        {form.errors.unit_code && <p className="text-xs text-rose-600">{form.errors.unit_code}</p>}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="plate_number">Plat Nomor (opsional)</Label>
                        <Input id="plate_number" value={form.data.plate_number} onChange={(e) => form.setData('plate_number', e.target.value)} placeholder="AD 1234 XY" className="h-10 rounded-xl bg-white" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="unit_status">Status</Label>
                        <select id="unit_status" value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif — servis</option>
                        </select>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="unit_notes">Catatan (opsional)</Label>
                        <Input id="unit_notes" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} placeholder="Sedang servis" className="h-10 rounded-xl bg-white" />
                    </div>
                    <div className="sm:col-span-2">
                        <Button type="submit" disabled={form.processing || busy !== null} className="h-10 rounded-xl bg-slate-900 text-sm text-white hover:bg-slate-700">
                            {form.processing ? 'Menyimpan…' : 'Simpan Unit'}
                        </Button>
                    </div>
                </form>
            )}

            {vehicle.units.length === 0 && !adding ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">
                    Belum ada unit fisik. Assignment booking memakai kapasitas stok sampai unit didaftarkan.
                </p>
            ) : (
                <ul className="mt-4 space-y-2">
                    {vehicle.units.map((unit) => (
                        <li key={unit.id} className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3.5 py-2.5 text-sm">
                            <div className="min-w-0 flex-1">
                                <p className="font-mono text-[13px] font-bold text-slate-900">{unit.unit_code}</p>
                                <p className="truncate text-xs text-slate-500">
                                    {[unit.plate_number, unit.notes].filter(Boolean).join(' · ') || '—'}
                                </p>
                                {unit.maintenance && (
                                    <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                        Maintenance: {unit.maintenance.title}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleStatus(unit)}
                                disabled={busy !== null}
                                title={unit.status === 'active' ? 'Nonaktifkan (mis. servis)' : 'Aktifkan'}
                                className={cn(
                                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50',
                                    unit.status === 'active'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                        : 'border-slate-200 bg-slate-100 text-slate-500',
                                )}
                            >
                                {unit.status === 'active' ? 'Aktif' : 'Nonaktif'}
                            </button>
                            <button type="button" aria-label={`Hapus ${unit.unit_code}`} disabled={busy !== null} onClick={() => remove(unit)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                                <Trash2 className="size-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
