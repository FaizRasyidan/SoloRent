import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, CircleAlert, CircleCheck, Clock, Receipt, Search } from 'lucide-react';
import { rupiah } from '@/lib/format';

type RefundDTO = {
    refund_code: string;
    amount: number;
    status: string;
    status_label: string;
    reference: string | null;
    reason: string | null;
    processed_at: string | null;
    created_at: string;
};

type Props = {
    verified: boolean;
    refund_code: string;
    phone: string;
    refund?: RefundDTO;
    booking?: {
        booking_code: string;
        vehicle_name: string | null;
        customer_name: string;
        status: string;
    };
    cancellation?: {
        original_amount: number;
        non_refundable_amount: number;
        policy_rule: string | null;
    } | null;
    manual_note?: string | null;
    whatsapp_url?: string;
};

export default function BookingRefund({ verified, refund_code, phone, refund, booking, cancellation, manual_note, whatsapp_url }: Props) {
    const form = useForm({ phone });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.get(`/booking/refunds/${refund_code}`);
    };

    return (
        <>
            <Head title={`Refund ${refund_code} — SoloRent`} />
            <div className="mx-auto max-w-xl px-5 py-10 lg:py-14">
                <Link
                    href="/booking/check"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]"
                >
                    <ArrowLeft size={16} /> Cek Booking
                </Link>

                <div className="mt-6 rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8">
                    <h1 className="text-2xl font-bold tracking-tight">Bukti Pengembalian Dana</h1>
                    <p className="mt-1 font-mono text-xs font-bold text-stone-500">{refund_code}</p>

                    {!verified || !refund ? (
                        <form onSubmit={submit} className="mt-6 space-y-4">
                            <p className="text-sm text-stone-500">
                                Masukkan nomor WhatsApp yang dipakai saat memesan untuk melihat bukti refund ini.
                            </p>
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
                                disabled={form.processing}
                                className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF9137] text-sm font-bold text-[#241203] disabled:opacity-50"
                            >
                                <Search size={16} />
                                {form.processing ? 'Memeriksa…' : 'Lihat Bukti Refund'}
                            </button>
                        </form>
                    ) : (
                        <div className="mt-6">
                            <div
                                className={`rounded-2xl border p-5 ${
                                    refund.status === 'completed'
                                        ? 'border-emerald-200 bg-emerald-50'
                                        : refund.status === 'failed'
                                          ? 'border-red-200 bg-red-50'
                                          : 'border-sky-200 bg-sky-50'
                                }`}
                            >
                                <p className="flex items-center gap-2 text-sm font-bold">
                                    {refund.status === 'completed' ? (
                                        <>
                                            <CircleCheck size={16} className="text-emerald-700" />
                                            <span className="text-emerald-900">Refund Berhasil</span>
                                        </>
                                    ) : refund.status === 'failed' ? (
                                        <>
                                            <CircleAlert size={16} className="text-red-700" />
                                            <span className="text-red-900">Refund Belum Berhasil Diproses</span>
                                        </>
                                    ) : (
                                        <>
                                            <Clock size={16} className="text-sky-700" />
                                            <span className="text-sky-900">Refund {refund.status_label}</span>
                                        </>
                                    )}
                                </p>
                                <p className="mt-2 text-3xl font-bold tabular-nums">{rupiah(refund.amount)}</p>
                                <p className="mt-1 text-xs text-stone-500">
                                    {refund.refund_code} · {refund.created_at}
                                </p>
                            </div>

                            <dl className="mt-4 space-y-2 rounded-2xl bg-[#F7F2EB] p-5 text-[13px]">
                                <div className="flex justify-between gap-3">
                                    <dt className="text-stone-500">Booking</dt>
                                    <dd className="font-mono font-bold">{booking?.booking_code}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-stone-500">Kendaraan</dt>
                                    <dd className="font-semibold">{booking?.vehicle_name ?? '-'}</dd>
                                </div>
                                {cancellation && (
                                    <>
                                        <div className="flex justify-between gap-3 tabular-nums">
                                            <dt className="text-stone-500">Dibayarkan</dt>
                                            <dd className="font-semibold">{rupiah(cancellation.original_amount)}</dd>
                                        </div>
                                        <div className="flex justify-between gap-3 tabular-nums">
                                            <dt className="text-stone-500">Non-refundable</dt>
                                            <dd className="font-semibold">{rupiah(cancellation.non_refundable_amount)}</dd>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between gap-3">
                                    <dt className="text-stone-500">Status</dt>
                                    <dd className="font-semibold">{refund.status_label}</dd>
                                </div>
                                {refund.reference && (
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-stone-500">Referensi</dt>
                                        <dd className="font-mono font-semibold">{refund.reference}</dd>
                                    </div>
                                )}
                                {refund.processed_at && (
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-stone-500">Diproses</dt>
                                        <dd className="font-semibold">{refund.processed_at}</dd>
                                    </div>
                                )}
                            </dl>

                            {refund.status === 'failed' && (
                                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-5 text-amber-900">
                                    Refund belum berhasil diproses. Admin akan memproses pengembalian dana.
                                </p>
                            )}

                            {refund.status !== 'completed' && refund.status !== 'failed' && manual_note && (
                                <p className="mt-4 flex items-start gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-[13px] leading-5 text-stone-600">
                                    <Receipt size={15} className="mt-0.5 shrink-0" />
                                    {manual_note}
                                </p>
                            )}

                            {whatsapp_url && (
                                <a
                                    href={whatsapp_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="pressable mt-4 flex h-11 w-full items-center justify-center rounded-2xl border border-[#0B6B4F]/25 bg-white text-sm font-bold text-[#0B6B4F]"
                                >
                                    Hubungi Admin via WhatsApp
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
