import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Banknote,
    CheckCircle2,
    CircleAlert,
    Clock3,
    Copy,
    MessageCircle,
    Receipt,
    ShieldCheck,
    Upload,
    Wallet,
    XCircle,
    Check,
} from 'lucide-react';
import { useState } from 'react';
import { VehicleImage } from '@/components/customer/vehicle-image';
import { useReveal } from '@/hooks/use-reveal';
import { formatRangeID, rupiah } from '@/lib/format';

type Totals = {
    subtotal: number;
    delivery_fee: number;
    driver_fee: number;
    additional_fee: number;
    deposit_amount: number;
    grand_total: number;
    paid: number;
    outstanding: number;
    dp_percent: number;
    dp_minimum: number;
    dp_satisfied: boolean;
    fully_paid: boolean;
};

type BookingMini = {
    booking_code: string;
    customer_name: string;
    vehicle_name: string | null;
    vehicle_image: string | null;
    start_date: string;
    end_date: string;
    duration_days: number;
    price_per_day: number;
    status: string;
    payment_status: string;
};

type HistoryItem = {
    payment_code: string;
    type: string;
    method: string;
    amount: number;
    status: string;
    submitted_at: string | null;
    paid_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    has_proof: boolean;
};

type Props =
    | { verified: false; booking_code: string; phone: string }
    | {
          verified: true;
          booking: BookingMini;
          totals: Totals;
          history: HistoryItem[];
          invoice: { invoice_number: string; issued_at: string | null };
          bank: { bank_name: string; account_number: string; account_holder: string };
          phone: string;
          whatsapp_url: string;
      };

const statusMeta: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Menunggu Pembayaran', cls: 'bg-amber-100 text-amber-800' },
    submitted: { label: 'Menunggu Verifikasi', cls: 'bg-sky-100 text-sky-800' },
    paid: { label: 'Lunas', cls: 'bg-emerald-100 text-emerald-800' },
    rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-700' },
    expired: { label: 'Kedaluarsa', cls: 'bg-stone-200 text-stone-600' },
    cancelled: { label: 'Dibatalkan', cls: 'bg-stone-200 text-stone-600' },
};

const payStatusMeta: Record<string, { label: string; cls: string }> = {
    unpaid: { label: 'Belum Dibayar', cls: 'bg-[#FFFC8C] text-[#241203]' },
    partial: { label: 'Sebagian (DP)', cls: 'bg-[#70FFD2]/50 text-[#0B6B4F]' },
    paid: { label: 'Lunas', cls: 'bg-[#0B6B4F] text-white' },
};

export default function BookingPayment(props: Props) {
    useReveal();

    if (!props.verified) {
        return <VerifyGate booking_code={props.booking_code} phone={props.phone} />;
    }

    return <PaymentContent {...props} />;
}

function VerifyGate({ booking_code, phone }: { booking_code: string; phone: string }) {
    const form = useForm({ phone });
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.get(`/booking/${booking_code}/payment?phone=${encodeURIComponent(form.data.phone)}`);
    };

    return (
        <>
            <Head title={`Pembayaran ${booking_code} — SoloRent`} />
            <div className="mx-auto max-w-2xl px-5 py-10 lg:py-14">
                <Link href="/booking/check" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]">
                    <ArrowLeft size={16} /> Cek Booking
                </Link>
                <div
                    className="mt-5 rounded-[28px] border border-[#241203]/10 bg-white p-7 text-center sm:p-10"
                    data-reveal="scale"
                >
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FF9137]/15">
                        <ShieldCheck size={30} className="text-[#C2570B]" />
                    </span>
                    <h1 className="mt-5 text-3xl font-bold tracking-[-0.02em]">
                        Verifikasi Pembayaran
                    </h1>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">
                        Masukkan nomor WhatsApp yang dipakai saat booking{' '}
                        <span className="font-mono font-bold">{booking_code}</span> untuk melihat tagihan.
                    </p>
                    <form onSubmit={submit} className="mx-auto mt-6 max-w-sm space-y-4 text-left">
                        <div>
                            <label htmlFor="phone" className="text-xs font-bold tracking-wide text-stone-500 uppercase">
                                Nomor WhatsApp
                            </label>
                            <input
                                id="phone"
                                value={form.data.phone}
                                onChange={(e) => form.setData('phone', e.target.value)}
                                placeholder="08xxxxxxxxxx"
                                inputMode="tel"
                                autoComplete="tel"
                                className="mt-1.5 h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-medium outline-none placeholder:text-stone-400 focus:border-[#FF9137]"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={form.processing || !form.data.phone.trim()}
                            className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FF9137] text-sm font-bold text-[#241203] disabled:opacity-50"
                        >
                            Lihat Tagihan <ArrowRight size={16} />
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}

function PaymentContent({
    booking,
    totals,
    history,
    invoice,
    bank,
    phone,
    whatsapp_url,
}: Extract<Props, { verified: true }>) {
    const [copied, setCopied] = useState<string | null>(null);
    const payMeta = payStatusMeta[booking.payment_status] ?? payStatusMeta.unpaid;

    // Jalur customer hanya untuk DP — pelunasan via admin/outlet.
    const dpRemaining = Math.max(0, Math.min(totals.dp_minimum - totals.paid, totals.outstanding));

    const form = useForm({
        customer_phone: phone,
        amount: dpRemaining,
        method: 'bank_transfer',
        type: 'full_payment',
        notes: '',
        proof: null as File | null,
    });

    const copy = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(key);
        window.setTimeout(() => setCopied(null), 1800);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, customer_phone: phone, amount: dpRemaining }));
        form.post(`/booking/${booking.booking_code}/payment`, { forceFormData: true });
    };

    const lastRejected = [...history].reverse().find((h) => h.status === 'rejected');
    const hasOpen = history.some((h) => h.status === 'pending' || h.status === 'submitted');
    const latestSubmitted = [...history].reverse().find((h) => h.status === 'submitted');

    return (
        <>
            <Head title={`Pembayaran ${booking.booking_code} — SoloRent`} />
            <div className="mx-auto max-w-2xl px-5 py-10 lg:py-14">
                <Link
                    href={`/booking/success/${booking.booking_code}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]"
                >
                    <ArrowLeft size={16} /> Kembali
                </Link>

                <div
                    className="mt-5 rounded-[28px] border border-[#241203]/10 bg-white p-7 text-center sm:p-10"
                    data-reveal="scale"
                >
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FF9137]/15">
                        <Wallet size={30} className="text-[#C2570B]" />
                    </span>
                    <h1 className="mt-5 text-3xl font-bold tracking-[-0.02em]">
                        Pembayaran Booking
                    </h1>
                    <p className="mt-2 font-mono text-sm font-bold text-stone-500">{booking.booking_code}</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-500">
                        {booking.vehicle_name} · {formatRangeID(booking.start_date, booking.end_date)} · {booking.duration_days} hari
                    </p>

                    <p className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <span className={`inline-block rounded-full px-4 py-1.5 text-xs font-bold ${payMeta.cls}`}>
                            {booking.payment_status === 'paid' ? '✓ Lunas' : `Pembayaran: ${payMeta.label}`}
                        </span>
                        {totals.dp_satisfied ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#70FFD2]/50 px-4 py-1.5 text-xs font-bold text-[#0B6B4F]">
                                <CheckCircle2 size={13} /> DP {totals.dp_percent}% terpenuhi
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFC8C] px-4 py-1.5 text-xs font-bold text-[#241203]">
                                <Clock3 size={13} /> DP {totals.dp_percent}% wajib untuk konfirmasi
                            </span>
                        )}
                        {!totals.fully_paid && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-4 py-1.5 text-xs font-bold text-stone-600">
                                <Clock3 size={13} /> Unit dipakai setelah lunas
                            </span>
                        )}
                    </p>

                    <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#241203]/10 p-4 text-left">
                        <VehicleImage
                            src={booking.vehicle_image}
                            alt={booking.vehicle_name ?? 'Kendaraan'}
                            category="motor"
                            className="h-16 w-22 shrink-0 rounded-xl"
                        />
                        <div className="min-w-0">
                            <p className="truncate font-bold">{booking.vehicle_name}</p>
                            <p className="mt-0.5 text-[13px] text-stone-500 tabular-nums">
                                {rupiah(booking.price_per_day)} / hari × {booking.duration_days} hari
                            </p>
                            <p className="mt-0.5 text-[13px] font-semibold text-[#0B6B4F] tabular-nums">
                                Sudah dibayar {rupiah(totals.paid)} · Sisa {rupiah(totals.outstanding)}
                            </p>
                        </div>
                    </div>

                    <dl className="mt-4 space-y-1.5 rounded-2xl bg-[#F7F2EB] p-5 text-left text-sm tabular-nums">
                        <div className="flex justify-between text-stone-600">
                            <dt>Rental</dt>
                            <dd>{rupiah(totals.subtotal)}</dd>
                        </div>
                        <div className="flex justify-between text-stone-600">
                            <dt>Delivery</dt>
                            <dd>{rupiah(totals.delivery_fee)}</dd>
                        </div>
                        <div className="flex justify-between text-stone-600">
                            <dt>Driver</dt>
                            <dd>{rupiah(totals.driver_fee)}</dd>
                        </div>
                        <div className="flex justify-between text-stone-600">
                            <dt>
                                Deposit <span className="text-xs text-stone-400">(bukan pendapatan rental)</span>
                            </dt>
                            <dd>{rupiah(totals.deposit_amount)}</dd>
                        </div>
                        <div className="flex justify-between border-t border-[#241203]/10 pt-2 text-base font-bold text-[#241203]">
                            <dt>Total</dt>
                            <dd>{rupiah(totals.grand_total)}</dd>
                        </div>
                    </dl>

                    <div className="mt-4 rounded-2xl border border-[#FF9137]/40 bg-[#FF9137]/8 p-4 text-left text-sm">
                        <p className="flex items-center gap-2 font-bold">
                            <Banknote size={15} className="text-[#C2570B]" />
                            DP minimum {totals.dp_percent}%: {rupiah(totals.dp_minimum)}
                        </p>
                        <p className="mt-1 text-[13px] leading-6 text-stone-600">
                            DP mengamankan booking (dikonfirmasi otomatis setelah terverifikasi admin).
                            Sisa pelunasan dibayar melalui admin/outlet — unit baru boleh dipakai setelah LUNAS penuh.
                        </p>
                    </div>

                    {totals.fully_paid && (
                        <div className="mt-4 rounded-2xl bg-[#70FFD2]/25 p-5" role="status">
                            <CheckCircle2 size={30} className="mx-auto text-[#0B6B4F]" />
                            <p className="mt-2 font-bold text-[#0B6B4F]">Pembayaran Berhasil — Lunas</p>
                            <p className="mt-1 text-sm text-stone-600 tabular-nums">
                                Booking {booking.booking_code} · {rupiah(totals.grand_total)}
                            </p>
                            <div className="mt-4 grid grid-cols-2 gap-2.5">
                                <Link
                                    href={`/booking/${booking.booking_code}/invoice?phone=${encodeURIComponent(phone)}`}
                                    className="pressable flex items-center justify-center gap-1.5 rounded-full bg-[#0B6B4F] py-3 text-sm font-bold text-white"
                                >
                                    <Receipt size={15} /> Lihat Invoice
                                </Link>
                                <Link
                                    href={`/booking/check?code=${booking.booking_code}&phone=${encodeURIComponent(phone)}`}
                                    className="pressable rounded-full border border-[#241203]/15 py-3 text-sm font-semibold"
                                >
                                    Lihat Booking
                                </Link>
                            </div>
                        </div>
                    )}

                    {latestSubmitted && !totals.fully_paid && (
                        <div className="mt-4 rounded-2xl bg-[#F7F2EB] p-5" role="status">
                            <Clock3 size={28} className="mx-auto text-[#C2570B]" />
                            <p className="mt-2 font-bold">Pembayaran Diterima</p>
                            <p className="mt-1 text-sm text-stone-600 tabular-nums">
                                {latestSubmitted.payment_code} · {rupiah(latestSubmitted.amount)} · Menunggu Verifikasi
                            </p>
                            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-6 text-stone-500">
                                Kami akan memperbarui status setelah admin memverifikasi bukti transfer.
                            </p>
                            <a
                                href={whatsapp_url}
                                target="_blank"
                                rel="noreferrer"
                                className="pressable mx-auto mt-4 flex max-w-xs items-center justify-center gap-2 rounded-full bg-[#0B6B4F] py-3.5 text-sm font-bold text-white"
                            >
                                <MessageCircle size={15} /> Konfirmasi via WhatsApp
                            </a>
                        </div>
                    )}

                    {lastRejected && !hasOpen && !totals.dp_satisfied && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
                            <p className="flex items-center justify-center gap-2 font-bold text-red-800">
                                <XCircle size={17} /> Pembayaran Ditolak
                            </p>
                            <p className="mt-1 text-sm text-red-700">Alasan: {lastRejected.rejection_reason ?? '-'}</p>
                            <p className="mt-1 text-[13px] text-red-600">Silakan kirim ulang bukti DP di bawah.</p>
                        </div>
                    )}

                    {totals.dp_satisfied && !totals.fully_paid && (
                        <div className="mt-4 rounded-2xl bg-[#70FFD2]/25 p-5" role="status">
                            <CheckCircle2 size={28} className="mx-auto text-[#0B6B4F]" />
                            <p className="mt-2 font-bold text-[#0B6B4F]">DP Terpenuhi</p>
                            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-600">
                                Booking {booking.booking_code} sudah dikonfirmasi. Sisa{' '}
                                <strong className="tabular-nums">{rupiah(totals.outstanding)}</strong> dibayar
                                melalui admin/outlet.
                            </p>
                            <p className="mt-1 text-[13px] text-stone-500">Unit diserahkan setelah pelunasan lunas dan terverifikasi.</p>
                        </div>
                    )}

                    {!totals.dp_satisfied && !hasOpen && (
                        <form onSubmit={submit} className="mt-4 rounded-2xl border border-[#241203]/10 p-5 text-left" data-reveal="scale">
                            <p className="flex items-center gap-2 font-bold">
                                <Banknote size={15} className="text-[#C2570B]" />
                                Bayar DP {totals.dp_percent}%
                            </p>

                            <div className="mt-3 rounded-2xl bg-[#F7F2EB] p-5 text-center">
                                <p className="text-[11px] font-bold tracking-[0.16em] text-stone-500 uppercase">
                                    Nominal DP (fix)
                                </p>
                                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                                    {rupiah(dpRemaining)}
                                </p>
                                <p className="mt-1 text-xs text-stone-500">
                                    Sudah ditetapkan, tidak dapat diubah. Sisa pelunasan via admin/outlet.
                                </p>
                            </div>

                            <div className="mt-4 rounded-2xl bg-[#F7F2EB] p-4 text-sm leading-6">
                                <p className="font-bold">Transfer Bank — {bank.bank_name}</p>
                                <p className="flex items-center gap-2 font-mono text-base font-bold tabular-nums">
                                    {bank.account_number}
                                    <button
                                        type="button"
                                        onClick={() => copy(bank.account_number, 'rek')}
                                        aria-label="Salin nomor rekening"
                                        className="rounded-full border border-[#241203]/15 bg-white px-3 py-1 text-xs font-semibold"
                                    >
                                        {copied === 'rek' ? 'Tersalin' : <Copy size={12} />}
                                    </button>
                                </p>
                                <p className="text-stone-600">a.n. {bank.account_holder}</p>
                            </div>

                            <div className="mt-4">
                                <label
                                    htmlFor="proof"
                                    className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-[#241203]/20 p-4 text-sm hover:border-[#FF9137]"
                                >
                                    <Upload size={18} className="shrink-0 text-[#C2570B]" />
                                    <span className="min-w-0 flex-1 truncate">
                                        {form.data.proof ? form.data.proof.name : 'Upload Bukti Pembayaran — jpg, png, webp, pdf (maks 5MB)'}
                                    </span>
                                </label>
                                <input
                                    id="proof"
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                                    className="sr-only"
                                    onChange={(e) => form.setData('proof', e.target.files?.[0] ?? null)}
                                />
                                {form.errors.proof && <p className="mt-1.5 text-xs font-medium text-red-600">{form.errors.proof}</p>}
                            </div>
                            <div className="mt-4">
                                <input
                                    id="notes"
                                    value={form.data.notes}
                                    onChange={(e) => form.setData('notes', e.target.value)}
                                    placeholder="Catatan (opsional) — contoh: transfer dari BCA a.n. Budi"
                                    aria-label="Catatan (opsional)"
                                    maxLength={500}
                                    className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none placeholder:text-stone-400 focus:border-[#FF9137]"
                                />
                            </div>

                            {form.errors.amount && <p className="mt-3 text-center text-xs font-medium text-red-600">{form.errors.amount}</p>}
                            {form.errors.customer_phone && <p className="mt-1.5 text-center text-xs font-medium text-red-600">{form.errors.customer_phone}</p>}
                            {(form.errors as Record<string, string>).availability && (
                                <p className="mt-3 flex items-start justify-center gap-2 text-xs font-medium text-red-600">
                                    <CircleAlert size={14} className="mt-0.5 shrink-0" />{(form.errors as Record<string, string>).availability}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={form.processing || dpRemaining <= 0}
                                className="pressable mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF9137] py-4 text-sm font-bold text-[#241203] disabled:opacity-50"
                            >
                                {form.processing ? 'Mengirim…' : 'Kirim Bukti DP'} <ArrowRight size={16} />
                            </button>
                            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-stone-500">
                                <ShieldCheck size={13} /> Bukti diverifikasi admin sebelum status menjadi Lunas.
                            </p>
                        </form>
                    )}

                    <div className="mt-4 rounded-2xl border border-[#241203]/10 p-4 text-left">
                        <p className="flex items-center gap-2 text-[15px] font-bold">
                            <Receipt size={15} className="text-[#C2570B]" /> Riwayat Pembayaran
                        </p>
                        {history.length === 0 ? (
                            <p className="mt-2 text-sm text-stone-500">Belum ada pembayaran untuk booking ini.</p>
                        ) : (
                            <ol className="mt-3 space-y-2.5">
                                {history.map((h) => {
                                    const m = statusMeta[h.status] ?? statusMeta.pending;
                                    return (
                                        <li key={h.payment_code} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F2EB] px-4 py-3 text-sm">
                                            <div className="min-w-0 text-left">
                                                <p className="font-mono text-[13px] font-bold">{h.payment_code}</p>
                                                <p className="text-xs text-stone-500 tabular-nums">
                                                    {rupiah(h.amount)} · {h.created_at}
                                                    {h.paid_at ? ` · Lunas ${h.paid_at}` : ''}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${m.cls}`}>{m.label}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                            <Link
                                href={`/booking/${booking.booking_code}/invoice?phone=${encodeURIComponent(phone)}`}
                                className="pressable flex items-center justify-center gap-1.5 rounded-full border border-[#241203]/15 py-3 text-sm font-semibold"
                            >
                                <Receipt size={14} /> Invoice
                            </Link>
                            <button
                                onClick={() => copy(booking.booking_code, 'code')}
                                className="pressable flex items-center justify-center gap-1.5 rounded-full border border-[#241203]/15 py-3 text-sm font-semibold"
                                aria-label="Salin kode booking"
                            >
                                {copied === 'code' ? (
                                    <>
                                        <Check size={14} className="text-[#0B6B4F]" /> Tersalin
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} /> Salin Kode
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="mt-3 text-center text-xs text-stone-400 tabular-nums">Invoice {invoice.invoice_number}</p>
                    </div>

                    <a
                        href={whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="pressable mt-6 flex items-center justify-center gap-2 rounded-full bg-[#0B6B4F] py-4 text-sm font-bold text-white"
                    >
                        <MessageCircle size={17} />
                        Konfirmasi via WhatsApp
                    </a>
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                        <Link
                            href={`/booking/check?code=${booking.booking_code}&phone=${encodeURIComponent(phone)}`}
                            className="pressable rounded-full border border-[#241203]/15 py-3 text-sm font-semibold"
                        >
                            Cek Status
                        </Link>
                        <Link
                            href="/vehicles"
                            className="pressable flex items-center justify-center gap-1.5 rounded-full border border-[#241203]/15 py-3 text-sm font-semibold"
                        >
                            Katalog
                            <ArrowRight size={15} />
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
