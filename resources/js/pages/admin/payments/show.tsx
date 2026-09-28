import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
    payment: {
        payment_code: string;
        booking_code: string;
        customer_name: string;
        customer_phone: string;
        customer_email: string | null;
        amount: number;
        method: string;
        type: string;
        status: string;
        reference: string | null;
        notes: string | null;
        admin_note: string | null;
        rejection_reason: string | null;
        submitted_at: string | null;
        paid_at: string | null;
        verified_at: string | null;
        verified_by: string | null;
        has_proof: boolean;
        proof_name: string | null;
        created_at: string;
    };
    booking: { booking_code: string; status: string; payment_status: string; vehicle_name: string | null; start_date: string; end_date: string };
    totals: { grand_total: number; paid: number; outstanding: number; dp_minimum: number; dp_percent: number };
    history: { payment_code: string; amount: number; status: string; created_at: string }[];
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    submitted: 'bg-sky-50 text-sky-800 border-sky-200',
    paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200',
    expired: 'bg-slate-100 text-slate-500 border-slate-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function PaymentShow({ payment, booking, totals, history }: Props) {
    const [rejectOpen, setRejectOpen] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const rejectForm = useForm({ rejection_reason: '', admin_note: '' });
    const noteForm = useForm({ admin_note: payment.admin_note ?? '' });

    const confirm = () => {
        setBusy('confirm');
        router.post(
            `/admin/payments/${payment.payment_code}/confirm`,
            { admin_note: noteForm.data.admin_note || null },
            { preserveScroll: true, onFinish: () => setBusy(null) },
        );
    };

    const reject = (e: React.FormEvent) => {
        e.preventDefault();
        rejectForm.post(`/admin/payments/${payment.payment_code}/reject`, { preserveScroll: true, onSuccess: () => setRejectOpen(false) });
    };

    const canAct = payment.status === 'submitted';

    return (
        <AdminLayout title={`Payment ${payment.payment_code}`}>
            <Head title={`Payment ${payment.payment_code}`} />
            <Link href="/admin/payments" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
                <ArrowLeft className="size-4" /> Kembali ke pembayaran
            </Link>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-mono text-xl font-bold tracking-tight">{payment.payment_code}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusStyle[payment.status] ?? ''}>{payment.status}</Badge>
                        <span className="text-xs text-slate-500">
                            Booking <Link href={`/admin/bookings/${booking.booking_code}`} className="font-mono font-semibold text-slate-800 hover:underline">{booking.booking_code}</Link>
                        </span>
                    </div>
                </div>
                {canAct && (
                    <div className="flex gap-2">
                        <Button variant="outline" disabled={busy !== null} onClick={() => setRejectOpen(true)} className="rounded-xl text-rose-600 hover:text-rose-600">
                            Tolak
                        </Button>
                        <Button disabled={busy !== null} onClick={confirm} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600">
                            <ShieldCheck className="size-4" /> {busy === 'confirm' ? 'Memproses…' : 'Konfirmasi Pembayaran'}
                        </Button>
                    </div>
                )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
                        <h3 className="text-[15px] font-semibold">Detail Pembayaran</h3>
                        <dl className="mt-3 grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                            <Detail label="Customer" value={payment.customer_name} />
                            <Detail label="WhatsApp" value={payment.customer_phone} mono />
                            <Detail label="Jumlah" value={rupiah(payment.amount)} strong />
                            <Detail label="Metode" value={payment.method === 'bank_transfer' ? 'Transfer Bank' : payment.method} />
                            <Detail label="Tipe" value={payment.type} />
                            <Detail label="Dikirim" value={payment.submitted_at ?? '-'} />
                            <Detail label="Dibayar" value={payment.paid_at ?? '-'} />
                            <Detail label="Diverifikasi" value={payment.verified_at ? `${payment.verified_at}${payment.verified_by ? ` · ${payment.verified_by}` : ''}` : '-'} />
                        </dl>
                        {payment.notes && <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">Catatan customer: “{payment.notes}”</p>}
                        {payment.rejection_reason && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">Alasan penolakan: {payment.rejection_reason}</p>}

                        <div className="mt-4 grid gap-2">
                            <Label htmlFor="admin_note">Catatan Verifikasi (internal — tidak tampil ke customer)</Label>
                            <textarea
                                id="admin_note"
                                rows={2}
                                value={noteForm.data.admin_note}
                                onChange={(e) => noteForm.setData('admin_note', e.target.value)}
                                placeholder="Contoh: mutasi cocok 375.000 dari Budi"
                                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                            />
                        </div>

                        {payment.has_proof && (
                            <a
                                href={`/admin/payments/${payment.payment_code}/proof`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                            >
                                <Download className="size-4" /> Lihat Bukti {payment.proof_name ? `(${payment.proof_name})` : ''}
                            </a>
                        )}
                    </section>

                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
                        <h3 className="text-[15px] font-semibold">Riwayat Pembayaran Booking</h3>
                        <ol className="mt-3 space-y-2">
                            {history.map((h) => (
                                <li key={h.payment_code} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                                    <span className="font-mono text-xs font-bold">{h.payment_code} · <span className="tabular-nums">{rupiah(h.amount)}</span></span>
                                    <Badge variant="outline" className={statusStyle[h.status] ?? ''}>{h.status}</Badge>
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>

                <div>
                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:sticky lg:top-20">
                        <h3 className="text-[15px] font-semibold">Ringkasan Tagihan</h3>
                        <dl className="mt-3 space-y-1.5 text-sm tabular-nums">
                            <div className="flex justify-between text-slate-600"><dt>Total Tagihan</dt><dd>{rupiah(totals.grand_total)}</dd></div>
                            <div className="flex justify-between text-slate-600"><dt>Dibayar</dt><dd className="font-semibold text-emerald-700">{rupiah(totals.paid)}</dd></div>
                            <div className="flex justify-between font-bold"><dt>Sisa</dt><dd>{rupiah(totals.outstanding)}</dd></div>
                            <div className="flex justify-between text-slate-600"><dt>DP {totals.dp_percent}%</dt><dd>{rupiah(totals.dp_minimum)}</dd></div>
                        </dl>
                        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
                            Booking {booking.status} · Pembayaran {booking.payment_status}. Konfirmasi DP otomatis mengubah booking pending → confirmed.
                        </p>
                        <Link href={`/admin/bookings/${booking.booking_code}`} className="mt-3 block rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold hover:bg-slate-50">
                            Buka Detail Booking
                        </Link>
                    </section>
                </div>
            </div>

            <Dialog open={rejectOpen} onOpenChange={(o) => !o && setRejectOpen(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tolak Pembayaran?</DialogTitle>
                        <DialogDescription>Customer akan melihat alasan ini dan dapat membayar kembali tanpa kehilangan histori.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={reject} className="grid gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="rejection_reason">Alasan Penolakan *</Label>
                            <Input
                                id="rejection_reason"
                                value={rejectForm.data.rejection_reason}
                                onChange={(e) => rejectForm.setData('rejection_reason', e.target.value)}
                                placeholder="Contoh: Nominal transfer tidak sesuai"
                                className="h-11 rounded-xl"
                            />
                            {rejectForm.errors.rejection_reason && <p className="text-xs text-rose-600">{rejectForm.errors.rejection_reason}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={rejectForm.processing} className="bg-rose-600 text-white hover:bg-rose-500">
                                {rejectForm.processing ? 'Memproses…' : 'Tolak Pembayaran'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function Detail({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
    return (
        <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
            <p className={`mt-1 ${strong ? 'font-bold' : 'font-medium'} text-slate-900 ${mono ? 'font-mono text-[13px]' : 'text-sm'}`}>{value}</p>
        </div>
    );
}
