import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, BadgeCheck, Landmark, ShieldCheck, Upload } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Item = { description: string; record_title: string | null; record_photo_url: string | null; amount: number };

type Props = {
    verified: boolean;
    charge_code: string;
    phone: string;
    booking_code?: string;
    vehicle_name?: string | null;
    charge?: {
        charge_code: string;
        total: number;
        paid: number;
        outstanding: number;
        status: string;
        created_at: string;
        items: Item[];
    };
    pending_payment?: { payment_code: string; amount: number; status: string; created_at: string } | null;
    receipt?: { payment_code: string; amount: number; paid_at: string | null } | null;
    bank?: { bank_name: string; account_number: string; account_holder: string };
    whatsapp_url?: string;
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const statusLabel: Record<string, string> = {
    unpaid: 'Belum Dibayar',
    partial: 'Sebagian Dibayar',
    paid: 'Lunas',
    waived: 'Dibebaskan',
    cancelled: 'Dibatalkan',
};

export default function DamagePayment() {
    const props = usePage().props as unknown as Props;
    const [copied, setCopied] = useState(false);

    const form = useForm({ customer_phone: props.phone ?? '', method: 'bank_transfer', notes: '', proof: null as File | null });

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            /* clipboard tidak tersedia */
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/booking/damage/${props.charge_code}/pay`, { preserveScroll: true });
    };

    const amountError = (form.errors as unknown as Record<string, string | undefined>).amount;

    // ---- Verification gate (code + phone, no login) ----
    if (!props.verified || !props.charge) {
        return (
            <>
                <Head title="Biaya Kerusakan — SoloRent" />
                <VerifyGate chargeCode={props.charge_code} phone={props.phone} />
            </>
        );
    }

    const { charge } = props;
    const isPaid = charge.status === 'paid';
    const isWaived = charge.status === 'waived';
    const isCancelled = charge.status === 'cancelled';

    return (
        <>
            <Head title={`Biaya Kerusakan ${charge.charge_code} — SoloRent`} />
            <div className="mx-auto max-w-xl px-5 py-10 lg:py-14">
                <Link href={`/booking/check?code=${props.booking_code ?? ''}&phone=${props.phone}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]">
                    <ArrowLeft size={16} /> Kembali ke status booking
                </Link>

                <div className="mt-6 rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8">
                    <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">Biaya Kerusakan</p>
                    <h1 className="mt-1 font-mono text-xl font-bold tracking-tight">{charge.charge_code}</h1>
                    <p className="mt-1 text-sm text-stone-500">
                        Booking {props.booking_code} · {props.vehicle_name} · dibuat {charge.created_at}
                    </p>

                    <div className="mt-5 divide-y divide-[#241203]/8 rounded-2xl bg-[#F7F2EB] px-5 text-sm">
                        {charge.items.map((item, i) => (
                            <div key={i} className="py-3">
                                <div className="flex items-center justify-between gap-4">
                                    <dt className="font-semibold">{item.description}</dt>
                                    <dd className="font-semibold tabular-nums">{rupiah(item.amount)}</dd>
                                </div>
                                {item.record_photo_url && (
                                    <img src={item.record_photo_url} alt={item.description} loading="lazy" className="mt-2 h-24 w-full rounded-xl border border-[#241203]/10 object-cover" />
                                )}
                            </div>
                        ))}
                        <div className="flex items-center justify-between gap-4 py-3">
                            <dt className="font-bold">Total Tagihan Tambahan</dt>
                            <dd className="text-lg font-bold tabular-nums">{rupiah(charge.total)}</dd>
                        </div>
                        {charge.paid > 0 && (
                            <div className="flex items-center justify-between gap-4 py-3 text-sm">
                                <dt className="text-stone-500">Sudah dibayar</dt>
                                <dd className="font-semibold text-emerald-700 tabular-nums">{rupiah(charge.paid)}</dd>
                            </div>
                        )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-stone-400">
                        Tagihan ini terpisah dari total booking awal dan tidak mengubah riwayat pembayaran rental.
                    </p>

                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#241203]/10 px-5 py-3.5 text-sm">
                        <span className="font-semibold">Status</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isPaid ? 'bg-emerald-100 text-emerald-800' : isWaived ? 'bg-slate-200 text-slate-600' : isCancelled ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-900'}`}>
                            {statusLabel[charge.status] ?? charge.status}
                        </span>
                    </div>

                    {isPaid && props.receipt && (
                        <div className="mt-4 rounded-2xl bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
                            <p className="flex items-center gap-2 font-bold"><BadgeCheck size={16} /> Pembayaran Berhasil</p>
                            <dl className="mt-2 space-y-1 tabular-nums">
                                <div className="flex justify-between"><dt>Tagihan</dt><dd className="font-mono font-bold">{charge.charge_code}</dd></div>
                                <div className="flex justify-between"><dt>Pembayaran</dt><dd className="font-mono font-bold">{props.receipt.payment_code}</dd></div>
                                <div className="flex justify-between"><dt>Nominal</dt><dd className="font-bold">{rupiah(props.receipt.amount)}</dd></div>
                                <div className="flex justify-between"><dt>Lunas pada</dt><dd>{props.receipt.paid_at}</dd></div>
                            </dl>
                        </div>
                    )}

                    {!isPaid && !isWaived && !isCancelled && props.pending_payment && (
                        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-900">
                            <p className="font-bold">Menunggu verifikasi admin</p>
                            <p>Pembayaran {props.pending_payment.payment_code} ({rupiah(props.pending_payment.amount)}) sudah kami terima dan sedang diverifikasi.</p>
                        </div>
                    )}

                    {!isPaid && !isWaived && !isCancelled && !props.pending_payment && (
                        <form onSubmit={submit} className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-dashed border-[#241203]/20 p-4 text-sm">
                                <p className="flex items-center gap-2 font-bold"><Landmark size={15} /> Transfer ke rekening outlet</p>
                                <p className="mt-1.5 tabular-nums">{props.bank?.bank_name} · {props.bank?.account_number}</p>
                                <p className="text-stone-500">a.n. {props.bank?.account_holder}</p>
                                <button type="button" onClick={() => copy(props.bank?.account_number ?? '')} className="pressable mt-2 rounded-full border border-[#241203]/15 bg-white px-3.5 py-1.5 text-xs font-semibold">
                                    {copied ? 'Tersalin' : 'Salin nomor rekening'}
                                </button>
                                <p className="mt-2 font-bold tabular-nums">Transfer tepat {rupiah(charge.outstanding)}</p>
                            </div>
                            <div>
                                <Label htmlFor="proof">Bukti pembayaran</Label>
                                <Input id="proof" type="file" accept="image/jpeg,image/png,image/webp,.pdf" onChange={(e) => form.setData('proof', e.target.files?.[0] ?? null)} className="mt-1.5 h-12 rounded-2xl" />
                                <InputError message={form.errors.proof} />
                            </div>
                            <div>
                                <Label htmlFor="notes">Catatan (opsional)</Label>
                                <Input id="notes" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} placeholder="Contoh: transfer dari BCA" className="mt-1.5 h-12 rounded-2xl" />
                            </div>
                            {amountError && (
                                <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">{amountError}</p>
                            )}
                            <Button type="submit" disabled={form.processing} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF9137] text-sm font-bold text-[#241203] hover:bg-[#ff9f52] disabled:opacity-50">
                                <Upload size={15} /> {form.processing ? 'Mengirim…' : `Bayar ${rupiah(charge.outstanding)}`}
                            </Button>
                        </form>
                    )}

                    {(isWaived || isCancelled) && (
                        <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-center text-[13px] font-semibold text-slate-600">
                            {isWaived ? 'Tagihan ini dibebaskan oleh admin.' : 'Tagihan ini sudah tidak aktif.'}
                        </p>
                    )}

                    <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-stone-400">
                        <ShieldCheck size={13} /> Nominal pembayaran ditentukan sistem dan tidak dapat diubah.
                    </p>
                </div>
            </div>
        </>
    );
}

function VerifyGate({ chargeCode, phone }: { chargeCode: string; phone: string }) {
    const gate = useForm({ phone });
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        gate.get(`/booking/damage/${chargeCode}`, { preserveState: true });
    };
    return (
        <div className="mx-auto max-w-xl px-5 py-10 lg:py-14">
            <div className="rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8">
                <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">Verifikasi Tagihan</p>
                <h1 className="mt-1 font-mono text-xl font-bold">{chargeCode}</h1>
                <p className="mt-1 text-sm text-stone-500">Masukkan nomor WhatsApp yang dipakai saat booking untuk melihat tagihan.</p>
                <form onSubmit={submit} className="mt-5 space-y-4">
                    <div>
                        <Label htmlFor="gate_phone">Nomor WhatsApp</Label>
                        <Input id="gate_phone" value={gate.data.phone} onChange={(e) => gate.setData('phone', e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" className="mt-1.5 h-12 rounded-2xl" />
                    </div>
                    <Button type="submit" disabled={gate.processing} className="h-12 w-full rounded-2xl bg-[#FF9137] text-sm font-bold text-[#241203] hover:bg-[#ff9f52]">
                        Lihat Tagihan
                    </Button>
                </form>
            </div>
        </div>
    );
}
