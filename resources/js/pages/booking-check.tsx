import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Check,
    CircleAlert,
    Copy,
    MapPin,
    Navigation,
    Receipt,
    RotateCcw,
    Search,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useReveal } from '@/hooks/use-reveal';
import { formatRangeID, rupiah } from '@/lib/format';
import type { BookingDTO, BookingStatus } from '@/types/catalog';

const timelineSteps = [
    'Booking dibuat',
    'Menunggu konfirmasi',
    'Booking dikonfirmasi',
    'Kendaraan disiapkan',
    'Rental aktif',
    'Rental selesai',
];

function stageIndex(status: BookingStatus): number {
    switch (status) {
        case 'pending':
            return 1;
        case 'confirmed':
            return 2;
        case 'preparing':
            return 3;
        case 'active':
            return 4;
        case 'completed':
            return 5;
        default:
            return -1;
    }
}

export default function BookingCheck({
    result,
}: {
    result: BookingDTO | false | null;
}) {
    useReveal();
    const [copied, setCopied] = useState(false);
    const form = useForm({ booking_code: '', customer_phone: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/booking/check');
    };

    const copy = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
        } catch {
            /* clipboard tidak tersedia */
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const stage = result ? stageIndex(result.status) : -1;

    return (
        <>
            <Head title="Cek Status Booking — SoloRent" />
            <div className="mx-auto max-w-xl px-5 py-10 lg:py-14">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]"
                >
                    <ArrowLeft size={16} /> Beranda
                </Link>

                <div
                    className="mt-6 rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8"
                    data-reveal="scale"
                >
                    <h1 className="text-2xl font-bold tracking-tight">
                        Cek Status Booking
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                        Lacak status pesanan kendaraanmu. Tanpa login.
                    </p>

                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div>
                            <label
                                htmlFor="booking_code"
                                className="text-xs font-bold tracking-wide text-stone-500 uppercase"
                            >
                                Kode Booking
                            </label>
                            <input
                                id="booking_code"
                                value={form.data.booking_code}
                                onChange={(e) =>
                                    form.setData('booking_code', e.target.value)
                                }
                                placeholder="Contoh: SR-20260925-0001"
                                autoComplete="off"
                                className="mt-1.5 h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-semibold tracking-wide uppercase outline-none placeholder:font-normal placeholder:text-stone-400 placeholder:normal-case focus:border-[#FF9137]"
                            />
                            {form.errors.booking_code && (
                                <p className="mt-1.5 text-xs font-medium text-red-600">
                                    {form.errors.booking_code}
                                </p>
                            )}
                        </div>
                        <div>
                            <label
                                htmlFor="customer_phone"
                                className="text-xs font-bold tracking-wide text-stone-500 uppercase"
                            >
                                Nomor WhatsApp
                            </label>
                            <input
                                id="customer_phone"
                                value={form.data.customer_phone}
                                onChange={(e) =>
                                    form.setData(
                                        'customer_phone',
                                        e.target.value,
                                    )
                                }
                                placeholder="08xxxxxxxxxx"
                                inputMode="tel"
                                autoComplete="tel"
                                className="mt-1.5 h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-medium outline-none placeholder:text-stone-400 focus:border-[#FF9137]"
                            />
                            {form.errors.customer_phone && (
                                <p className="mt-1.5 text-xs font-medium text-red-600">
                                    {form.errors.customer_phone}
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF9137] text-sm font-bold text-[#241203] disabled:opacity-50"
                        >
                            <Search size={16} />
                            {form.processing ? 'Mencari…' : 'Cek Status'}
                        </button>
                    </form>

                    {result === false && (
                        <div className="animate-fade-up mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
                            <p className="flex items-center gap-2 font-bold">
                                <CircleAlert size={16} />
                                Booking tidak ditemukan
                            </p>
                            <p className="mt-1">
                                Periksa kembali kode booking dan nomor WhatsApp
                                yang dipakai saat memesan.
                            </p>
                        </div>
                    )}

                    {result && (
                        <div className="animate-fade-up mt-6 rounded-2xl bg-[#F7F2EB] p-5 sm:p-6">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">
                                        {result.booking_code}
                                    </p>
                                    <p className="mt-0.5 text-[15px] font-bold">
                                        {result.vehicle_name}
                                    </p>
                                </div>
                                <button
                                    onClick={() => copy(result.booking_code)}
                                    className="pressable flex shrink-0 items-center gap-1.5 rounded-full border border-[#241203]/15 bg-white px-3.5 py-2 text-xs font-semibold"
                                >
                                    {copied ? (
                                        <>
                                            <Check
                                                size={13}
                                                className="text-[#0B6B4F]"
                                            />
                                            Tersalin
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={13} />
                                            Salin
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="mt-4 space-y-2 text-[13px] text-stone-600">
                                <p className="flex items-center gap-2">
                                    <CalendarDays size={14} />
                                    {formatRangeID(
                                        result.start_date,
                                        result.end_date,
                                    )}{' '}
                                    · {result.duration_days} hari
                                </p>
                                <p className="flex items-center gap-2">
                                    <MapPin size={14} />
                                    {result.pickup_method === 'outlet'
                                        ? 'Ambil di Outlet'
                                        : `Diantar — ${result.delivery_district ?? ''}`}
                                </p>
                                {result.with_driver && (
                                    <p className="flex items-center gap-2">
                                        <Navigation size={14} />
                                        Dengan Driver
                                        {result.driver_name ? ` — ${result.driver_name}` : ' (segera dikonfirmasi)'}
                                    </p>
                                )}
                                <p className="flex items-center gap-2">
                                    <RotateCcw size={14} />
                                    {result.return_method === 'pickup'
                                        ? `Dijemput — ${result.return_address ?? 'lokasi customer'}`
                                        : 'Kembali ke Outlet'}
                                </p>
                                <p className="font-bold text-[#241203] tabular-nums">
                                    Total {rupiah(result.total)}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span
                                        className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold ${
                                            result.payment_status === 'paid'
                                                ? 'bg-[#0B6B4F] text-white'
                                                : result.payment_status === 'partial'
                                                  ? 'bg-sky-100 text-sky-800'
                                                  : 'bg-amber-100 text-amber-800'
                                        }`}
                                    >
                                        {result.payment_status === 'paid'
                                            ? '✓ Lunas'
                                            : result.payment_status === 'partial'
                                              ? `DP Sebagian · Sisa ${rupiah(result.outstanding ?? 0)}`
                                              : 'Menunggu Pembayaran'}
                                    </span>
                                    {result.payment_status !== 'paid' && (
                                        <Link
                                            href={`/booking/${result.booking_code}/payment?phone=${encodeURIComponent(result.customer_phone)}`}
                                            className="pressable inline-flex items-center gap-1.5 rounded-full bg-[#FF9137] px-4 py-2 text-[12px] font-bold text-[#241203]"
                                        >
                                            <Wallet size={13} /> Bayar / Lihat Tagihan
                                        </Link>
                                    )}
                                    {result.invoice_number && (
                                        <Link
                                            href={`/booking/${result.booking_code}/invoice?phone=${encodeURIComponent(result.customer_phone)}`}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-[#241203]/15 bg-white px-4 py-2 text-[12px] font-semibold"
                                        >
                                            <Receipt size={13} /> Invoice
                                        </Link>
                                    )}
                                </div>
                                {result.payment_status !== 'paid' && (
                                    <p className="text-xs text-stone-500">
                                        DP minimum {result.dp_percent ?? 50}% ({rupiah(result.dp_minimum ?? 0)}) untuk konfirmasi booking. Unit baru bisa dipakai setelah lunas.
                                    </p>
                                )}
                            </div>

                            {result.damage_charge && (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="text-[11px] font-bold tracking-[0.14em] text-amber-800 uppercase">
                                        Biaya Tambahan — Kerusakan
                                    </p>
                                    <p className="mt-1 font-mono text-xs font-bold text-amber-950">
                                        {result.damage_charge.charge_code}
                                    </p>
                                    <div className="mt-2 space-y-1 text-[13px] text-amber-900">
                                        {result.damage_charge.items.map((item, i) => (
                                            <p key={i} className="flex justify-between gap-3">
                                                <span>{item.description}</span>
                                                <span className="font-semibold tabular-nums">{rupiah(item.amount)}</span>
                                            </p>
                                        ))}
                                    </div>
                                    <p className="mt-2 flex justify-between border-t border-amber-200 pt-2 text-sm font-bold text-amber-950 tabular-nums">
                                        <span>Total</span>
                                        <span>{rupiah(result.damage_charge.total)}</span>
                                    </p>
                                    <p className="mt-1 text-[13px] font-semibold text-amber-900">
                                        Status: {damageStatusLabel(result.damage_charge.status)}
                                    </p>
                                    {!['paid', 'waived', 'cancelled'].includes(result.damage_charge.status) && (
                                        <Link
                                            href={`/booking/damage/${result.damage_charge.charge_code}?phone=${encodeURIComponent(result.customer_phone)}`}
                                            className="pressable mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF9137] text-sm font-bold text-[#241203]"
                                        >
                                            Bayar Sekarang
                                        </Link>
                                    )}
                                </div>
                            )}

                            {result.cancellation?.cancelled ? (
                                <div className="mt-4 space-y-3">
                                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                                        <p className="text-[11px] font-bold tracking-[0.14em] text-red-800 uppercase">
                                            Booking Dibatalkan
                                        </p>
                                        {result.cancellation.cancelled_at && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {result.cancellation.cancelled_at}
                                                {result.cancellation.cancelled_by_type ? ` · oleh ${result.cancellation.cancelled_by_type === 'customer' ? 'Anda' : 'admin'}` : ''}
                                            </p>
                                        )}
                                        {result.cancellation.cancel_reason && (
                                            <p className="mt-1 text-[13px] text-red-900">
                                                Alasan: {result.cancellation.cancel_reason}
                                            </p>
                                        )}
                                        {result.cancellation.record && (
                                            <div className="mt-3 space-y-1 border-t border-red-200 pt-3 text-[13px] text-red-900 tabular-nums">
                                                <p className="flex justify-between gap-3">
                                                    <span>Dibayarkan</span>
                                                    <span className="font-semibold">{rupiah(result.cancellation.record.original_amount)}</span>
                                                </p>
                                                <p className="flex justify-between gap-3">
                                                    <span>Refund ({result.cancellation.record.policy_percent}%)</span>
                                                    <span className="font-bold">{rupiah(result.cancellation.record.refund_amount)}</span>
                                                </p>
                                                <p className="flex justify-between gap-3">
                                                    <span>Non-refundable</span>
                                                    <span className="font-semibold">{rupiah(result.cancellation.record.non_refundable_amount)}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {result.cancellation.refunds.length > 0 && (
                                        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                                            <p className="text-[11px] font-bold tracking-[0.14em] text-sky-800 uppercase">
                                                Pengembalian Dana
                                            </p>
                                            {result.cancellation.refunds.map((refund) => (
                                                <div key={refund.refund_code} className="mt-2 border-t border-sky-200 pt-2 text-[13px] text-sky-950 first:border-0 first:pt-0">
                                                    <p className="flex justify-between gap-3">
                                                        <span className="font-mono text-xs font-bold">{refund.refund_code}</span>
                                                        <span className="font-bold tabular-nums">{rupiah(refund.amount)}</span>
                                                    </p>
                                                    <p className="mt-0.5 flex items-center justify-between gap-3">
                                                        <span className="text-xs font-semibold">Status: {refundStatusLabel(refund.status)}</span>
                                                        <Link
                                                            href={`/booking/refunds/${refund.refund_code}?phone=${encodeURIComponent(result.customer_phone)}`}
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 underline"
                                                        >
                                                            <Receipt size={12} /> Lihat Bukti Refund
                                                        </Link>
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : result.cancellation?.preview ? (
                                result.cancellation.preview.eligible ? (
                                    <div className="mt-4">
                                        <CancelBookingButton
                                            bookingCode={result.booking_code}
                                            phone={result.customer_phone}
                                            preview={result.cancellation.preview}
                                            reasons={result.cancellation.reasons}
                                        />
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-100 p-4">
                                        <p className="text-[13px] font-bold text-stone-700">Pembatalan tidak tersedia</p>
                                        <p className="mt-1 text-xs leading-5 text-stone-500">
                                            {result.cancellation.preview.blocked_reason}
                                        </p>
                                    </div>
                                )
                            ) : null}

                            {result.status === 'cancelled' ? (
                                <p className="mt-5 rounded-xl bg-red-100 px-4 py-3 text-center text-[13px] font-bold text-red-700">
                                    Booking ini dibatalkan. Hubungi outlet untuk
                                    info lebih lanjut.
                                </p>
                            ) : (
                                <ol className="mt-5 space-y-0">
                                    {timelineSteps.map((label, i) => {
                                        const done = i < stage;
                                        const now = i === stage;
                                        return (
                                            <li
                                                key={label}
                                                className="relative flex gap-3.5 pb-5 last:pb-0"
                                            >
                                                <div className="flex flex-col items-center">
                                                    <span
                                                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                                            done
                                                                ? 'bg-[#0B6B4F] text-white'
                                                                : now
                                                                  ? 'bg-[#FF9137] text-[#241203]'
                                                                  : 'bg-stone-200 text-stone-400'
                                                        }`}
                                                    >
                                                        {done ? (
                                                            <Check size={13} />
                                                        ) : (
                                                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                        )}
                                                    </span>
                                                    {i <
                                                        timelineSteps.length -
                                                            1 && (
                                                        <span
                                                            className={`mt-1 w-0.5 flex-1 rounded-full ${
                                                                i < stage
                                                                    ? 'bg-[#0B6B4F]'
                                                                    : 'bg-stone-200'
                                                            }`}
                                                            aria-hidden
                                                        />
                                                    )}
                                                </div>
                                                <p
                                                    className={`pt-0.5 text-[13.5px] ${
                                                        done || now
                                                            ? 'font-semibold text-[#241203]'
                                                            : 'text-stone-400'
                                                    }`}
                                                >
                                                    {label}
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function damageStatusLabel(status: string): string {
    switch (status) {
        case 'paid':
            return 'Lunas';
        case 'partial':
            return 'Sebagian Dibayar';
        case 'waived':
            return 'Dibebaskan';
        case 'cancelled':
            return 'Dibatalkan';
        default:
            return 'Belum Dibayar';
    }
}

function refundStatusLabel(status: string): string {
    switch (status) {
        case 'pending':
            return 'Menunggu Diproses';
        case 'processing':
            return 'Sedang Diproses';
        case 'completed':
            return 'Berhasil Dikembalikan';
        case 'failed':
            return 'Gagal Diproses';
        case 'cancelled':
            return 'Dibatalkan';
        default:
            return status;
    }
}

function CancelBookingButton({
    bookingCode,
    phone,
    preview,
    reasons,
}: {
    bookingCode: string;
    phone: string;
    preview: {
        eligible: boolean;
        policy_percent: number;
        policy_rule: string;
        original_amount: number;
        refund_amount: number;
        non_refundable_amount: number;
        description: string;
    };
    reasons: Record<string, string>;
}) {
    const [open, setOpen] = useState(false);
    const [reasonCode, setReasonCode] = useState('');
    const form = useForm({ customer_phone: phone, cancel_reason: '', reason_code: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, reason_code: reasonCode || undefined }));
        form.post(`/booking/${bookingCode}/cancel`, { preserveScroll: true });
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="pressable flex h-11 w-full items-center justify-center rounded-2xl border border-red-200 bg-white text-sm font-bold text-red-700"
            >
                Batalkan Booking
            </button>
        );
    }

    const reasonEntries = Object.entries(reasons);

    return (
        <form onSubmit={submit} className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
            <p className="text-sm font-bold text-red-900">Batalkan booking {bookingCode}?</p>
            <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3 text-[13px] tabular-nums">
                <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">
                    Kebijakan Pembatalan · {preview.policy_rule}
                </p>
                <p className="mt-2 flex justify-between gap-3 text-stone-600">
                    <span>Total dibayarkan</span>
                    <span className="font-semibold text-stone-900">{rupiah(preview.original_amount)}</span>
                </p>
                <p className="mt-1 flex justify-between gap-3 text-stone-600">
                    <span>Refund ({preview.policy_percent}%)</span>
                    <span className="font-bold text-[#0B6B4F]">{rupiah(preview.refund_amount)}</span>
                </p>
                <p className="mt-1 flex justify-between gap-3 text-stone-600">
                    <span>Non-refundable</span>
                    <span className="font-semibold text-stone-900">{rupiah(preview.non_refundable_amount)}</span>
                </p>
            </div>
            {reasonEntries.length > 0 && (
                <>
                    <label htmlFor="cancel_reason_code" className="mt-3 block text-xs font-bold tracking-wide text-stone-500 uppercase">
                        Alasan pembatalan
                    </label>
                    <select
                        id="cancel_reason_code"
                        value={reasonCode}
                        onChange={(e) => setReasonCode(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm outline-none focus:border-red-400"
                    >
                        <option value="">— Pilih alasan —</option>
                        {reasonEntries.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </>
            )}
            <label htmlFor="cancel_reason" className="mt-3 block text-xs font-bold tracking-wide text-stone-500 uppercase">
                {reasonEntries.length > 0 ? 'Keterangan tambahan' : 'Alasan pembatalan'}
            </label>
            <textarea
                id="cancel_reason"
                value={form.data.cancel_reason}
                onChange={(e) => form.setData('cancel_reason', e.target.value)}
                placeholder="Contoh: jadwal berubah"
                rows={2}
                className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:border-red-400"
            />
            {form.errors.cancel_reason && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{form.errors.cancel_reason}</p>
            )}
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="pressable h-11 flex-1 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-600"
                >
                    Kembali
                </button>
                <button
                    type="submit"
                    disabled={form.processing}
                    className="pressable h-11 flex-1 rounded-2xl bg-red-600 text-sm font-bold text-white disabled:opacity-50"
                >
                    {form.processing ? 'Memproses…' : 'Ya, batalkan'}
                </button>
            </div>
        </form>
    );
}
