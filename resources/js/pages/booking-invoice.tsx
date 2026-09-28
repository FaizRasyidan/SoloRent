import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Download, Receipt } from 'lucide-react';
import { useReveal } from '@/hooks/use-reveal';
import { formatRangeID, rupiah } from '@/lib/format';

type Props = {
    booking: {
        booking_code: string;
        customer_name: string;
        vehicle_name: string | null;
        start_date: string;
        end_date: string;
        duration_days: number;
        price_per_day: number;
        status: string;
        payment_status: string;
    };
    totals: {
        subtotal: number;
        delivery_fee: number;
        driver_fee: number;
        additional_fee: number;
        deposit_amount: number;
        grand_total: number;
        paid: number;
        outstanding: number;
        dp_minimum: number;
    };
    invoice: { invoice_number: string; issued_at: string | null; customer_name: string; vehicle_name: string | null };
    outlet: { name: string; address: string; city: string; hours: string; phone: string; email: string };
    phone?: string;
    admin?: boolean;
    cancellation?: { refund_amount: number; refund_status: string | null; refund_code: string | null } | null;
};

export default function BookingInvoice({ booking, totals, invoice, outlet, phone, admin, cancellation }: Props) {
    useReveal();

    const backHref = admin
        ? `/admin/bookings/${booking.booking_code}`
        : `/booking/${booking.booking_code}/payment?phone=${encodeURIComponent(phone ?? '')}`;

    return (
        <>
            <Head title={`Invoice ${invoice.invoice_number} — SoloRent`} />
            <div className="mx-auto max-w-2xl px-5 py-8">
                <div className="flex items-center justify-between print:hidden">
                    <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]">
                        <ArrowLeft size={16} /> Kembali
                    </Link>
                    <button
                        onClick={() => window.print()}
                        className="pressable flex items-center gap-1.5 rounded-full bg-[#241203] px-4 py-2.5 text-[13px] font-bold text-white"
                    >
                        <Download size={14} /> Cetak / Unduh
                    </button>
                </div>

                <article className="mt-5 rounded-3xl border border-[#241203]/10 bg-white p-7 sm:p-10" data-reveal="scale">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xl font-bold tracking-tight">SOLORENT</p>
                            <p className="mt-0.5 text-xs text-stone-500">{outlet.name}</p>
                            <p className="text-xs text-stone-500">{outlet.address}, {outlet.city}</p>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full bg-[#F7F2EB] px-3.5 py-1.5 text-xs font-bold">
                            <Receipt size={13} /> Invoice
                        </span>
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <dt className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">No. Invoice</dt>
                            <dd className="mt-0.5 font-mono font-bold">{invoice.invoice_number}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">Booking</dt>
                            <dd className="mt-0.5 font-mono font-bold">{booking.booking_code}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">Customer</dt>
                            <dd className="mt-0.5 font-semibold">{booking.customer_name}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">Diterbitkan</dt>
                            <dd className="mt-0.5">{invoice.issued_at ?? '-'}</dd>
                        </div>
                    </dl>

                    <div className="mt-5 rounded-2xl bg-[#F7F2EB] p-5 text-sm">
                        <p className="font-bold">{booking.vehicle_name ?? '-'}</p>
                        <p className="mt-0.5 text-stone-600">
                            {formatRangeID(booking.start_date, booking.end_date)} · {booking.duration_days} hari @ {rupiah(booking.price_per_day)}/hari
                        </p>
                    </div>

                    <dl className="mt-4 space-y-2 text-sm tabular-nums">
                        <div className="flex justify-between text-stone-600">
                            <dt>Rental</dt>
                            <dd>{rupiah(totals.subtotal)}</dd>
                        </div>
                        <div className="flex justify-between text-stone-600">
                            <dt>Delivery</dt>
                            <dd>{rupiah(totals.delivery_fee)}</dd>
                        </div>
                        <div className="flex justify-between text-stone-600">
                            <dt>Deposit</dt>
                            <dd>{rupiah(totals.deposit_amount)}</dd>
                        </div>
                        <div className="flex justify-between border-t border-[#241203]/10 pt-2.5 text-base font-bold">
                            <dt>TOTAL</dt>
                            <dd>{rupiah(totals.grand_total)}</dd>
                        </div>
                        <div className="flex justify-between text-sm">
                            <dt className="text-stone-600">Dibayar</dt>
                            <dd className="font-semibold text-[#0B6B4F]">{rupiah(totals.paid)}</dd>
                        </div>
                        <div className="flex justify-between text-sm">
                            <dt className="text-stone-600">Sisa</dt>
                            <dd className="font-bold">{rupiah(totals.outstanding)}</dd>
                        </div>
                    </dl>

                    <p className="mt-5 rounded-2xl border border-dashed border-[#241203]/20 p-4 text-center text-sm font-bold">
                        Payment: {booking.payment_status === 'paid' ? 'PAID' : booking.payment_status === 'partial' ? 'PARTIAL' : 'UNPAID'}
                    </p>
                    {booking.status === 'cancelled' && (
                        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-800">
                            Booking Status: Dibatalkan
                            {cancellation && cancellation.refund_amount > 0 && (
                                <> · Refund {rupiah(cancellation.refund_amount)}{cancellation.refund_status ? ` (${cancellation.refund_status})` : ''}</>
                            )}
                        </p>
                    )}
                    <p className="mt-3 text-center text-xs text-stone-400">Invoice ini memakai snapshot booking dan sah tanpa tanda tangan.</p>
                </article>
            </div>
        </>
    );
}
