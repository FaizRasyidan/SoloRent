import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ImagePlus, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import InputError from '@/components/input-error';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminVehicleDetail } from '@/types';
import { cn } from '@/lib/utils';

type Props = {
    vehicle: AdminVehicleDetail | null;
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const inputCls =
    'h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-slate-900/10';
const sectionCls = 'rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6';
const sectionTitleCls = 'text-[15px] font-semibold tracking-tight text-slate-900';
const sectionDescCls = 'mt-0.5 text-xs text-slate-500';

export default function VehicleForm({ vehicle }: Props) {
    const isEdit = vehicle !== null;

    const form = useForm({
        name: vehicle?.name ?? '',
        brand: vehicle?.brand ?? '',
        model: vehicle?.model ?? '',
        category: vehicle?.category ?? 'motor',
        transmission: vehicle?.transmission ?? 'automatic',
        seats: vehicle?.seats ?? 2,
        engine: vehicle?.engine ?? '',
        fuel: vehicle?.fuel ?? '',
        baggage: vehicle?.baggage ?? '',
        price_per_day: vehicle?.price_per_day ?? 0,
        stock: vehicle?.stock ?? 1,
        description: vehicle?.description ?? '',
        status: vehicle?.status ?? 'active',
        featured: (vehicle?.featured ?? false) as boolean,
        benefits: vehicle?.benefits ?? ([] as string[]),
        images: [] as File[],
    });

    const [newBenefit, setNewBenefit] = useState('');
    const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
    const [imageBusy, setImageBusy] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const addBenefit = () => {
        const value = newBenefit.trim();
        if (!value || form.data.benefits.includes(value)) return;
        form.setData('benefits', [...form.data.benefits, value]);
        setNewBenefit('');
    };

    const removeBenefit = (value: string) => {
        form.setData(
            'benefits',
            form.data.benefits.filter((b) => b !== value),
        );
    };

    const onFiles = (files: FileList | null) => {
        if (!files) return;
        const accepted = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 8 - form.data.images.length);
        if (accepted.length === 0) return;
        form.setData('images', [...form.data.images, ...accepted]);
        setPreviews((prev) => [...prev, ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    };

    const removeNewImage = (url: string) => {
        setPreviews((prev) => {
            const target = prev.find((p) => p.url === url);
            if (target) URL.revokeObjectURL(target.url);
            return prev.filter((p) => p.url !== url);
        });
        form.setData(
            'images',
            form.data.images.filter((f) => !previews.find((p) => p.url === url && p.file === f)),
        );
    };

    const setPrimary = (id: number) => {
        setImageBusy(id);
        router.patch(`/admin/vehicle-images/${id}/primary`, {}, { preserveScroll: true, onFinish: () => setImageBusy(null) });
    };

    const deleteImage = (id: number) => {
        setImageBusy(id);
        router.delete(`/admin/vehicle-images/${id}`, { preserveScroll: true, onFinish: () => setImageBusy(null) });
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit && vehicle) {
            form.put(`/admin/vehicles/${vehicle.slug}`, { preserveScroll: true });
        } else {
            form.post('/admin/vehicles', { preserveScroll: true });
        }
    };

    return (
        <AdminLayout title={isEdit ? 'Edit Kendaraan' : 'Tambah Kendaraan'}>
            <Head title={isEdit ? `Edit ${vehicle?.name}` : 'Tambah Kendaraan'} />

            <Link
                href={isEdit && vehicle ? `/admin/vehicles/${vehicle.slug}` : '/admin/vehicles'}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
                <ArrowLeft className="size-4" /> Kembali
            </Link>

            <div className="mt-2">
                <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
                    {isEdit ? 'Edit Kendaraan' : 'Tambah Kendaraan'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    {isEdit
                        ? 'Perbarui informasi kendaraan. Slug dan histori booking tidak berubah.'
                        : 'Lengkapi informasi kendaraan. Setelah disimpan, kendaraan aktif langsung tampil di katalog.'}
                </p>
            </div>

            <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                    {/* Informasi dasar */}
                    <section className={sectionCls}>
                        <h3 className={sectionTitleCls}>Informasi Kendaraan</h3>
                        <p className={sectionDescCls}>Nama, merek, model, dan kategori.</p>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor="name">Nama Kendaraan</Label>
                                <Input id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Honda Vario 160" className={inputCls} />
                                <InputError message={form.errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="brand">Merek</Label>
                                <Input id="brand" value={form.data.brand} onChange={(e) => form.setData('brand', e.target.value)} placeholder="Honda" className={inputCls} />
                                <InputError message={form.errors.brand} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="model">Model</Label>
                                <Input id="model" value={form.data.model} onChange={(e) => form.setData('model', e.target.value)} placeholder="Vario 160" className={inputCls} />
                                <InputError message={form.errors.model} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="category">Kategori</Label>
                                <select id="category" value={form.data.category} onChange={(e) => form.setData('category', e.target.value as 'motor' | 'mobil')} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400">
                                    <option value="motor">Motor</option>
                                    <option value="mobil">Mobil</option>
                                </select>
                                <InputError message={form.errors.category} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="stock">Jumlah Unit</Label>
                                <Input id="stock" type="number" min={0} value={form.data.stock} onChange={(e) => form.setData('stock', Number(e.target.value))} className={inputCls} />
                                <InputError message={form.errors.stock} />
                            </div>
                        </div>
                    </section>

                    {/* Harga */}
                    <section className={sectionCls}>
                        <h3 className={sectionTitleCls}>Harga Rental</h3>
                        <p className={sectionDescCls}>Disimpan sebagai angka, tanpa format rupiah.</p>
                        <div className="mt-4 grid gap-2">
                            <Label htmlFor="price">Harga / Hari (Rp)</Label>
                            <Input id="price" type="number" min={0} step={1000} value={form.data.price_per_day} onChange={(e) => form.setData('price_per_day', Number(e.target.value))} className={cn(inputCls, 'tabular-nums')} />
                            <p className="text-xs text-slate-500 tabular-nums">
                                Pratinjau: <span className="font-semibold text-slate-800">{rupiah(Number(form.data.price_per_day) || 0)} / hari</span>
                            </p>
                            <InputError message={form.errors.price_per_day} />
                        </div>
                    </section>

                    {/* Deskripsi */}
                    <section className={sectionCls}>
                        <h3 className={sectionTitleCls}>Deskripsi</h3>
                        <p className={sectionDescCls}>Tampil di halaman detail customer.</p>
                        <div className="mt-4 grid gap-2">
                            <Label htmlFor="description">Deskripsi</Label>
                            <textarea id="description" rows={4} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} placeholder="Cocok untuk perjalanan dalam kota Solo…" className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400" />
                            <InputError message={form.errors.description} />
                        </div>
                    </section>

                    {/* Spesifikasi */}
                    <section className={sectionCls}>
                        <h3 className={sectionTitleCls}>Spesifikasi</h3>
                        <p className={sectionDescCls}>Mesin, transmisi, kapasitas, bahan bakar, bagasi.</p>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="engine">Mesin</Label>
                                <Input id="engine" value={form.data.engine} onChange={(e) => form.setData('engine', e.target.value)} placeholder="160cc" className={inputCls} />
                                <InputError message={form.errors.engine} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="transmission">Transmisi</Label>
                                <select id="transmission" value={form.data.transmission} onChange={(e) => form.setData('transmission', e.target.value as 'automatic' | 'manual')} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400">
                                    <option value="automatic">Automatic</option>
                                    <option value="manual">Manual</option>
                                </select>
                                <InputError message={form.errors.transmission} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="seats">Kapasitas Penumpang</Label>
                                <Input id="seats" type="number" min={1} max={50} value={form.data.seats} onChange={(e) => form.setData('seats', Number(e.target.value))} className={inputCls} />
                                <InputError message={form.errors.seats} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="fuel">Bahan Bakar</Label>
                                <Input id="fuel" value={form.data.fuel} onChange={(e) => form.setData('fuel', e.target.value)} placeholder="Bensin" className={inputCls} />
                                <InputError message={form.errors.fuel} />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor="baggage">Bagasi</Label>
                                <Input id="baggage" value={form.data.baggage} onChange={(e) => form.setData('baggage', e.target.value)} placeholder="25 liter" className={inputCls} />
                                <InputError message={form.errors.baggage} />
                            </div>
                        </div>
                    </section>

                    {/* Benefit */}
                    <section className={sectionCls}>
                        <h3 className={sectionTitleCls}>Benefit Rental</h3>
                        <p className={sectionDescCls}>Ditampilkan apa adanya di halaman detail customer.</p>
                        <ul className="mt-4 space-y-2">
                            {form.data.benefits.map((b) => (
                                <li key={b} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
                                    <span className="flex-1 text-slate-800">{b}</span>
                                    <button type="button" aria-label={`Hapus benefit ${b}`} onClick={() => removeBenefit(b)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-rose-600">
                                        <Trash2 className="size-4" />
                                    </button>
                                </li>
                            ))}
                            {form.data.benefits.length === 0 && (
                                <li className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-xs text-slate-400">
                                    Belum ada benefit. Contoh: 2 Helm, Jas Hujan, STNK.
                                </li>
                            )}
                        </ul>
                        <div className="mt-3 flex gap-2">
                            <Input value={newBenefit} onChange={(e) => setNewBenefit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())} placeholder="Tambah benefit…" aria-label="Benefit baru" className={inputCls} />
                            <Button type="button" variant="outline" onClick={addBenefit} className="h-11 shrink-0 rounded-xl">
                                <Plus className="size-4" /> Tambah
                            </Button>
                        </div>
                        <InputError message={form.errors.benefits} />
                    </section>
                </div>

                <div className="space-y-4">
                    {/* Foto */}
                    <section className={sectionCls}>
                        <h3 className={sectionTitleCls}>Foto Kendaraan</h3>
                        <p className={sectionDescCls}>JPG, JPEG, PNG, atau WEBP · maks 5MB per foto.</p>

                        {isEdit && vehicle && vehicle.images.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 gap-2.5">
                                {vehicle.images.map((img) => (
                                    <div key={img.id} className="group relative overflow-hidden rounded-xl border border-slate-200">
                                        <img src={img.url} alt={`${vehicle.name} ${img.is_primary ? '(utama)' : ''}`} loading="lazy" className="aspect-square w-full object-cover" />
                                        {img.is_primary && (
                                            <span className="absolute top-2 left-2 rounded-full bg-slate-900/90 px-2.5 py-1 text-[10px] font-bold text-white">
                                                ★ Utama
                                            </span>
                                        )}
                                        <div className="absolute inset-x-2 bottom-2 flex gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                                            {!img.is_primary && (
                                                <button type="button" disabled={imageBusy !== null} onClick={() => setPrimary(img.id)} className="flex-1 rounded-lg bg-white/95 px-2 py-1.5 text-[11px] font-semibold text-slate-800 disabled:opacity-50">
                                                    {imageBusy === img.id ? '…' : 'Jadikan utama'}
                                                </button>
                                            )}
                                            <button type="button" aria-label="Hapus foto" disabled={imageBusy !== null} onClick={() => deleteImage(img.id)} className="rounded-lg bg-white/95 px-2 py-1.5 text-rose-600 disabled:opacity-50">
                                                {imageBusy === img.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {previews.length > 0 && (
                            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                                {previews.map((p) => (
                                    <div key={p.url} className="relative overflow-hidden rounded-xl border border-dashed border-slate-300">
                                        <img src={p.url} alt="Pratinjau foto baru" className="aspect-square w-full object-cover" />
                                        <span className="absolute top-2 left-2 rounded-full bg-[#FF9137] px-2.5 py-1 text-[10px] font-bold text-[#241203]">
                                            Baru
                                        </span>
                                        <button type="button" aria-label="Batalkan foto baru" onClick={() => removeNewImage(p.url)} className="absolute right-2 bottom-2 rounded-lg bg-white/95 px-2 py-1.5 text-rose-600">
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
                        >
                            <ImagePlus className="size-6" />
                            <span className="font-semibold">Klik untuk upload foto</span>
                            <span className="text-xs">atau seret file ke sini belum didukung — gunakan klik</span>
                        </button>
                        <InputError message={form.errors.images} />
                    </section>

                    {/* Status */}
                    <section className={sectionCls}>
                        <h3 className={sectionTitleCls}>Status</h3>
                        <p className={sectionDescCls}>Nonaktif menyembunyikan dari katalog & booking.</p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {[
                                { value: 'active', label: 'Aktif' },
                                { value: 'inactive', label: 'Nonaktif' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => form.setData('status', opt.value as 'active' | 'inactive')}
                                    aria-pressed={form.data.status === opt.value}
                                    className={cn(
                                        'rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                                        form.data.status === opt.value
                                            ? opt.value === 'active'
                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                                : 'border-slate-400 bg-slate-100 text-slate-700'
                                            : 'border-slate-200 text-slate-500 hover:border-slate-300',
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <InputError message={form.errors.status} />
                        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                            <Checkbox checked={form.data.featured} onCheckedChange={(v) => form.setData('featured', v === true)} />
                            <span className="inline-flex items-center gap-1.5">
                                <Star className="size-4 text-amber-500" /> Unggulan (featured)
                            </span>
                        </label>
                    </section>

                    <div className="flex gap-2.5">
                        <Link
                            href={isEdit && vehicle ? `/admin/vehicles/${vehicle.slug}` : '/admin/vehicles'}
                            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            Batal
                        </Link>
                        <Button
                            type="submit"
                            disabled={form.processing}
                            className="h-12 flex-1 rounded-xl bg-[#FF9137] text-[15px] font-semibold text-[#241203] transition-[transform,background-color] duration-150 ease-out hover:bg-[#ff9f52] active:scale-[0.99] disabled:opacity-60"
                        >
                            {form.processing && <Loader2 className="size-4 animate-spin" />}
                            {form.processing ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Kendaraan'}
                        </Button>
                    </div>
                    {Object.keys(form.errors).length > 0 && (
                        <p className="text-center text-xs text-rose-600">
                            Tidak dapat menyimpan kendaraan. Periksa kembali data yang dimasukkan.
                        </p>
                    )}
                </div>
            </form>
        </AdminLayout>
    );
}
