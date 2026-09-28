import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminDriverRow, Paginated } from '@/types';

type Props = { drivers: Paginated<AdminDriverRow> };

export default function DriverIndex() {
    const { drivers } = usePage().props as unknown as Props;
    const [dialog, setDialog] = useState<null | { mode: 'create' } | { mode: 'edit'; driver: AdminDriverRow }>(null);
    const [deleting, setDeleting] = useState<number | null>(null);

    const remove = (id: number) => {
        setDeleting(id);
        router.delete(`/admin/drivers/${id}`, { preserveScroll: true, onFinish: () => setDeleting(null) });
    };

    return (
        <AdminLayout title="Driver">
            <Head title="Kelola Driver" />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Driver</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Kelola driver yang dapat ditugaskan ke rental.
                    </p>
                </div>
                <Button onClick={() => setDialog({ mode: 'create' })} className="rounded-xl bg-[#FF9137] font-semibold text-[#241203] hover:bg-[#ff9f52]">
                    <Plus className="size-4" /> Tambah Driver
                </Button>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                {drivers.data.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <UserRound className="size-6" />
                        </div>
                        <p className="mt-4 text-[15px] font-semibold text-slate-900">Belum ada driver</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            Tambahkan driver untuk dapat menugaskan driver pada rental.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs text-slate-500">
                                    <th className="px-5 py-3 font-medium">Nama</th>
                                    <th className="px-4 py-3 font-medium">WhatsApp</th>
                                    <th className="px-4 py-3 font-medium">SIM</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Tugas Hari Ini</th>
                                    <th className="px-4 py-3 text-right font-medium"><span className="sr-only">Aksi</span></th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-800">
                                {drivers.data.map((d) => (
                                    <tr key={d.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                                        <td className="px-5 py-3">
                                            <Link href={`/admin/drivers/${d.id}`} className="font-semibold text-slate-900 hover:underline">
                                                {d.name}
                                            </Link>
                                            <p className="text-xs text-slate-500 tabular-nums">{d.active_bookings_count} rental aktif</p>
                                        </td>
                                        <td className="px-4 py-3 tabular-nums">{d.whatsapp}</td>
                                        <td className="px-4 py-3">SIM {d.sim_type}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className={d.status === 'active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : d.status === 'working' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                                                {d.status === 'active' ? 'Aktif' : d.status === 'working' ? '● Bekerja' : 'Nonaktif'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 tabular-nums">{d.today_tasks_count} tugas</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <button type="button" aria-label={`Edit ${d.name}`} onClick={() => setDialog({ mode: 'edit', driver: d })} className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                                                    <Pencil className="size-4" />
                                                </button>
                                                <button type="button" aria-label={`Hapus ${d.name}`} disabled={deleting !== null} onClick={() => remove(d.id)} className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <DriverDialog dialog={dialog} onClose={() => setDialog(null)} />
        </AdminLayout>
    );
}

function DriverDialog({ dialog, onClose }: { dialog: { mode: 'create' } | { mode: 'edit'; driver: AdminDriverRow } | null; onClose: () => void }) {
    const driver = dialog?.mode === 'edit' ? dialog.driver : null;

    return (
        <Dialog open={dialog !== null} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{driver ? 'Edit Driver' : 'Tambah Driver'}</DialogTitle>
                </DialogHeader>
                {dialog && <DriverForm key={driver ? `edit-${driver.id}` : 'create'} driver={driver} onClose={onClose} />}
            </DialogContent>
        </Dialog>
    );
}

function DriverForm({ driver, onClose }: { driver: AdminDriverRow | null; onClose: () => void }) {
    const form = useForm({
        name: driver?.name ?? '',
        whatsapp: driver?.whatsapp ?? '',
        sim_type: driver?.sim_type ?? 'A',
        sim_number: '',
        notes: '',
        status: driver?.status ?? 'active',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (driver) {
            // Status "bekerja" dikunci sistem — kirim nilai valid, backend mempertahankannya.
            form.transform((d) => ({ ...d, status: driver.status === 'working' ? 'active' : d.status }));
            form.put(`/admin/drivers/${driver.id}`, { preserveScroll: true, onSuccess: onClose });
        } else {
            form.post('/admin/drivers', { preserveScroll: true, onSuccess: onClose });
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="driver_name">Nama</Label>
                <Input id="driver_name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className="h-11 rounded-xl" />
                {form.errors.name && <p className="text-xs text-rose-600">{form.errors.name}</p>}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="driver_wa">Nomor WhatsApp</Label>
                <Input id="driver_wa" value={form.data.whatsapp} onChange={(e) => form.setData('whatsapp', e.target.value)} placeholder="08xxxxxxxxxx" className="h-11 rounded-xl" />
                {form.errors.whatsapp && <p className="text-xs text-rose-600">{form.errors.whatsapp}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                    <Label htmlFor="driver_sim">Jenis SIM</Label>
                    <select id="driver_sim" value={form.data.sim_type} onChange={(e) => form.setData('sim_type', e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
                        {['A', 'B', 'C'].map((s) => (
                            <option key={s} value={s}>SIM {s}</option>
                        ))}
                    </select>
                    {form.errors.sim_type && <p className="text-xs text-rose-600">{form.errors.sim_type}</p>}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="driver_status">Status</Label>
                    {driver?.status === 'working' ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
                            ● Bekerja — dikunci sistem, kembali Aktif otomatis setelah rental selesai/dibatalkan.
                        </p>
                    ) : (
                        <select id="driver_status" value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                    )}
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="driver_sim_number">Nomor SIM (opsional)</Label>
                <Input id="driver_sim_number" value={form.data.sim_number} onChange={(e) => form.setData('sim_number', e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="driver_notes">Catatan (opsional)</Label>
                <textarea id="driver_notes" rows={2} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" disabled={form.processing} onClick={onClose}>Batal</Button>
                <Button type="submit" disabled={form.processing} className="bg-slate-900 text-white hover:bg-slate-700">
                    {form.processing ? 'Menyimpan…' : 'Simpan'}
                </Button>
            </DialogFooter>
        </form>
    );
}
