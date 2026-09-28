import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    Check,
    Copy,
    MapPin,
    MessageCircle,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { VehicleImage } from '@/components/customer/vehicle-image';
import { useReveal } from '@/hooks/use-reveal';
import { formatRangeID, rupiah } from '@/lib/format';
import type { BookingDTO } from '@/types/catalog';

const statusLabel: Record<string, [string, string]> = {
    pending: ['Menunggu Konfirmasi', 'bg-[#FFFC8C] text-[#241203]'],
    confirmed: ['Dikonfirmasi', 'bg-[#70FFD2]/50 text-[#0B6B4F]'],
    preparing: ['Disiapkan', 'bg-[#70FFD2]/50 text-[#0B6B4F]'],
    active: ['Rental Aktif', 'bg-[#0B6B4F] text-white'],
    completed: ['Selesai', 'bg-stone-200 text-stone-600'],
    cancelled: ['Dibatalkan', 'bg-red-100 text-red-700'],
};

export default function BookingSuccess({
    booking,
    whatsapp_url,
    payment,
}: {
    booking: BookingDTO;
    whatsapp_url: string;
    payment?: {
        payment_status: string;
        grand_total: number;
        dp_minimum: number;
        dp_percent: number;
        outstanding: number;
        invoice_number: string | null;
    };
}) {
    useReveal();
    const [copied, setCopied] = useState(false);
    const [label, cls] = statusLabel[booking.status] ?? statusLabel.pending;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(booking.booking_code);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = booking.booking_code;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <Head
                title={`Booking ${booking.booking_code} Berhasil — SoloRent`}
            />
            <div className="mx-auto max-w-2xl px-5 py-10 lg:py-14">
                <div
                    className="rounded-[28px] border border-[#241203]/10 bg-white p-7 text-center sm:p-10"
                    data-reveal="scale"
                >
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#70FFD2]/40">
                        <BadgeCheck size={30} className="text-[#0B6B4F]" />
                    </span>
                    <h1 className="mt-5 text-3xl font-bold tracking-[-0.02em]">
                        Booking berhasil!
                    </h1>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">
                        Simpan kode booking di bawah. Tunjukkan saat pengambilan
                        unit di outlet.
                    </p>

                    <div className="mt-6 rounded-2xl bg-[#F7F2EB] p-5">
                        <p className="text-[11px] font-bold tracking-[0.16em] text-stone-500 uppercase">
                            Kode Booking
                        </p>
                        <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                            {booking.booking_code}
                        </p>
                        <button
                            onClick={copy}
                            className="pressable mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-[#241203]/15 bg-white px-4 py-2 text-[13px] font-semibold"
                        >
                            {copied ? (
                                <>
                                    <Check
                                        size={14}
                                        className="text-[#0B6B4F]"
                                    />
                                    Tersalin
                                </>
                            ) : (
                                <>
                                    <Copy size={14} />
                                    Salin
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#241203]/10 p-4 text-left">
                        <VehicleImage
                            src={booking.vehicle_image}
                            alt={booking.vehicle_name ?? 'Kendaraan'}
                            category="motor"
                            className="h-16 w-22 shrink-0 rounded-xl"
                        />
                        <div className="min-w-0">
                            <p className="truncate font-bold">
                                {booking.vehicle_name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-500">
                                <CalendarDays size={13} />
                                {formatRangeID(
                                    booking.start_date,
                                    booking.end_date,
                                )}{' '}
                                · {booking.duration_days} hari
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-500">
                                <MapPin size={13} />
                                {booking.pickup_method === 'outlet'
                                    ? 'Ambil di Outlet'
                                    : `Diantar — ${booking.delivery_district ?? ''}`}
                            </p>
                        </div>
                    </div>

                    <dl className="mt-4 space-y-1.5 rounded-2xl bg-[#F7F2EB] p-5 text-sm tabular-nums">
                        <div className="flex justify-between text-stone-600">
                            <dt>Harga rental</dt>
                            <dd>{rupiah(booking.subtotal)}</dd>
                        </div>
                        <div className="flex justify-between text-stone-600">
                            <dt>Delivery</dt>
                            <dd>{rupiah(booking.delivery_fee)}</dd>
                        </div>
                        <div className="flex justify-between border-t border-[#241203]/10 pt-2 text-base font-bold text-[#241203]">
                            <dt>Total</dt>
                            <dd>{rupiah(booking.total)}</dd>
                        </div>
                    </dl>

                    <p className="mt-4">
                        <span
                            className={`inline-block rounded-full px-4 py-1.5 text-xs font-bold ${cls}`}
                        >
                            {label}
                        </span>
                    </p>

                    {payment && (
                        <div className="mt-4 rounded-2xl border border-[#FF9137]/40 bg-[#FF9137]/8 p-4 text-left text-sm">
                            <p className="flex items-center gap-2 font-bold">
                                <Wallet size={15} className="text-[#C2570B]" />
                                Lanjutkan Pembayaran
                            </p>
                            <p className="mt-1 text-[13px] leading-6 text-stone-600">
                                Bayar DP {payment.dp_percent}% ({rupiah(payment.dp_minimum)}) agar booking dikonfirmasi.
                                Unit baru bisa dipakai setelah LUNAS. Total tagihan {rupiah(payment.grand_total)}.
                            </p>
                            <Link
                                href={`/booking/${booking.booking_code}/payment?phone=${encodeURIComponent(booking.customer_phone)}`}
                                className="pressable mt-3 flex items-center justify-center gap-2 rounded-full bg-[#FF9137] py-3.5 text-sm font-bold text-[#241203]"
                            >
                                Bayar Sekarang <ArrowRight size={15} />
                            </Link>
                        </div>
                    )}

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
                            href="/booking/check"
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
