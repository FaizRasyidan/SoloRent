import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Check,
    CircleAlert,
    Clock3,
    Loader2,
    MapPin,
    Phone,
    Receipt,
    UserRound,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    BOOKING_STATUS_LABELS,
    TASK_STATUS_LABELS,
    type AdminBookingDetail,
    type AssignableDriver,
    type AssignableUnit,
    type CancellationPayload,
    type DamageChargeRow,
    type DamageRecordRow,
    type MaintenanceRow,
} from '@/types';
import { cn } from '@/lib/utils';
import { compressImage, compressImages } from '@/lib/image';

type PaymentHistoryItem = {
    payment_code: string;
    amount: number;
    method: string;
    type: string;
    status: string;
    submitted_at: string | null;
    paid_at: string | null;
    rejection_reason: string | null;
    has_proof: boolean;
    created_at: string;
};

type PaymentSummary = {
    totals: {
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
    invoice_number: string | null;
    history: PaymentHistoryItem[];
};

type Props = {
    booking: AdminBookingDetail;
    units: AssignableUnit[];
    drivers: AssignableDriver[];
    staffOptions: { id: number; name: string }[];
    statusLabels: Record<string, string>;
    handoverItems: Record<string, string>;
    taskStatuses: Record<string, string>;
    payment?: PaymentSummary;
    cancellation?: CancellationPayload;
    cancelReasons: Record<string, string>;
    refundStatuses: Record<string, string>;
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    confirmed: 'bg-sky-50 text-sky-800 border-sky-200',
    preparing: 'bg-violet-50 text-violet-800 border-violet-200',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

const cardCls = 'rounded-2xl border border-slate-200/80 bg-white p-5';
const cardTitleCls = 'text-[15px] font-semibold tracking-tight text-slate-900';

export default function BookingShow() {
    const { booking, units, drivers, staffOptions, handoverItems, payment, cancellation, cancelReasons } = usePage().props as unknown as Props;
    const { damages, damage_charges, maintenances } = booking;
    const [busy, setBusy] = useState<string | null>(null);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelReasonCode, setCancelReasonCode] = useState('');
    const [overrideAmount, setOverrideAmount] = useState('');
    const [overrideReason, setOverrideReason] = useState('');

    // Selama serah terima berlangsung, unit/driver/petugas dikunci agar tidak
    // berubah di tengah proses. Setelah serah terima selesai, dibuka kembali.
    const handoverLocked = booking.status === 'preparing' && !booking.handover.completed_at;

    const post = (url: string, data: Record<string, unknown>, key: string) => {
        setBusy(key);
        router.post(url, data as never, { preserveScroll: true, onFinish: () => setBusy(null) });
    };

    const cancel = () => {
        setBusy('cancel');
        router.post(
            `/admin/bookings/${booking.booking_code}/cancel`,
            {
                cancel_reason: cancelReason,
                reason_code: cancelReasonCode || undefined,
                override_amount: overrideAmount === '' ? undefined : Number(overrideAmount),
                override_reason: overrideReason || undefined,
            } as never,
            { preserveScroll: true, onFinish: () => { setBusy(null); setCancelOpen(false); } },
        );
    };

    return (
        <AdminLayout title={`Booking ${booking.booking_code}`}>
            <Head title={`Booking ${booking.booking_code}`} />

            <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                <ArrowLeft className="size-4" /> Kembali ke daftar
            </Link>

            {/* Header */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-mono text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                        {booking.booking_code}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusStyle[booking.status] ?? ''}>
                            {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                        </Badge>
                        {booking.status === 'cancelled' && booking.cancel_reason && (
                            <span className="text-xs text-slate-500">Alasan: {booking.cancel_reason}</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {booking.status === 'pending' && (
                        <>
                            <ActionButton busy={busy === 'confirm'} onClick={() => post(`/admin/bookings/${booking.booking_code}/confirm`, {}, 'confirm')} primary>
                                Konfirmasi Booking
                            </ActionButton>
                            <Button variant="outline" disabled={busy !== null} onClick={() => setCancelOpen(true)} className="rounded-xl">
                                Batalkan
                            </Button>
                        </>
                    )}
                    {booking.status === 'confirmed' && (
                        <>
                            <ActionButton busy={busy === 'ready'} onClick={() => post(`/admin/bookings/${booking.booking_code}/ready`, {}, 'ready')} primary>
                                Tandai Siap
                            </ActionButton>
                            <Button variant="outline" disabled={busy !== null} onClick={() => setCancelOpen(true)} className="rounded-xl">
                                Batalkan
                            </Button>
                        </>
                    )}
                    {booking.status === 'preparing' && (
                        <>
                            <ActionButton busy={busy === 'activate'} onClick={() => post(`/admin/bookings/${booking.booking_code}/activate`, {}, 'activate')} primary disabled={!booking.handover.completed_at}>
                                Aktifkan Rental
                            </ActionButton>
                            <Button variant="outline" disabled={busy !== null} onClick={() => setCancelOpen(true)} className="rounded-xl">
                                Batalkan
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {booking.readiness.length > 0 && (booking.status === 'confirmed' || booking.status === 'preparing') && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" />
                    Belum siap: {booking.readiness.join(', ')}.
                </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                    {/* Customer + rental */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <section className={cardCls}>
                            <h3 className={cardTitleCls}>Customer</h3>
                            <div className="mt-3 space-y-2 text-sm">
                                <p className="flex items-center gap-2 font-semibold text-slate-900"><UserRound className="size-4 text-slate-400" />{booking.customer_name}</p>
                                <p className="flex items-center gap-2 text-slate-600 tabular-nums"><Phone className="size-4 text-slate-400" />{booking.customer_phone}</p>
                                {booking.customer_email && <p className="text-slate-600">{booking.customer_email}</p>}
                            </div>
                            {booking.notes && (
                                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">“{booking.notes}”</p>
                            )}
                        </section>
                        <section className={cardCls}>
                            <h3 className={cardTitleCls}>Rental</h3>
                            <div className="mt-3 space-y-1.5 text-sm">
                                <p className="font-semibold text-slate-900">
                                    {booking.vehicle_slug ? (
                                        <Link href={`/admin/vehicles/${booking.vehicle_slug}`} className="hover:underline">{booking.vehicle_name}</Link>
                                    ) : (booking.vehicle_name)}
                                </p>
                                <p className="flex items-center gap-2 text-slate-600 tabular-nums"><CalendarDays className="size-4 text-slate-400" />{fmtDate(booking.start_date)} – {fmtDate(booking.end_date)}</p>
                                <p className="text-slate-600 tabular-nums">{booking.duration_days} hari · {rupiah(booking.price_per_day)} / hari</p>
                                <div className="border-t border-slate-100 pt-2 tabular-nums">
                                    <p className="flex justify-between text-slate-600"><span>Subtotal</span><span>{rupiah(booking.subtotal)}</span></p>
                                    {booking.delivery_fee > 0 && <p className="flex justify-between text-slate-600"><span>Antar</span><span>{rupiah(booking.delivery_fee)}</span></p>}
                                    <p className="flex justify-between font-bold text-slate-900"><span>Total</span><span>{rupiah(booking.total)}</span></p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Layanan */}
                    <section className={cardCls}>
                        <h3 className={cardTitleCls}>Layanan</h3>
                        <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Driver</p>
                                <p className="mt-1 font-semibold text-slate-900">{booking.with_driver ? (booking.driver_name ?? 'Belum ditugaskan') : 'Tidak diperlukan'}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Pengambilan</p>
                                <p className="mt-1 font-semibold text-slate-900">{booking.pickup_method === 'delivery' ? 'Diantar ke lokasi' : 'Ambil di toko'}</p>
                                {booking.pickup_method === 'delivery' && (
                                    <p className="mt-1 text-xs text-slate-600">{[booking.delivery_name, booking.delivery_address, booking.delivery_district].filter(Boolean).join(', ')}</p>
                                )}
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Pengembalian</p>
                                <p className="mt-1 font-semibold text-slate-900">{booking.return_method === 'pickup' ? 'Jemput di lokasi' : 'Kembali ke toko'}</p>
                                {booking.return_method === 'pickup' && booking.return_address && (
                                    <p className="mt-1 text-xs text-slate-600">{booking.return_address}</p>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Pembayaran — Phase 6 */}
                    {payment && (
                        <section className={cardCls} aria-label="Pembayaran">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className={cardTitleCls}>Pembayaran</h3>
                                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-800' : booking.payment_status === 'partial' ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800'}`}>
                                    {booking.payment_status === 'paid' ? 'Lunas' : booking.payment_status === 'partial' ? 'Sebagian' : 'Belum Dibayar'}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center tabular-nums">
                                <div className="rounded-xl bg-slate-50 px-2 py-3">
                                    <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Total Tagihan</p>
                                    <p className="mt-1 text-sm font-bold">{rupiah(payment.totals.grand_total)}</p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 px-2 py-3">
                                    <p className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase">Dibayar</p>
                                    <p className="mt-1 text-sm font-bold text-emerald-800">{rupiah(payment.totals.paid)}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 px-2 py-3">
                                    <p className="text-[11px] font-semibold tracking-wide text-amber-700 uppercase">Sisa</p>
                                    <p className="mt-1 text-sm font-bold text-amber-800">{rupiah(payment.totals.outstanding)}</p>
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 tabular-nums">
                                DP {payment.totals.dp_percent}% ({rupiah(payment.totals.dp_minimum)}) {payment.totals.dp_satisfied ? '✓ terpenuhi — booking bisa dikonfirmasi.' : '— belum terpenuhi.'} Unit baru boleh dipakai setelah LUNAS{!payment.totals.fully_paid ? ` (sisa ${rupiah(payment.totals.outstanding)})` : ''}.
                                {payment.invoice_number ? ` Invoice ${payment.invoice_number}.` : ''}
                            </p>
                            {payment.history.length > 0 ? (
                                <ol className="mt-3 space-y-1.5">
                                    {payment.history.map((h) => (
                                        <li key={h.payment_code} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5 text-[13px]">
                                            <span>
                                                <Link href={`/admin/payments/${h.payment_code}`} className="font-mono font-bold hover:underline">{h.payment_code}</Link>
                                                <span className="ml-2 text-slate-500 tabular-nums">{rupiah(h.amount)} · {h.created_at}</span>
                                            </span>
                                            <Badge variant="outline">{h.status}</Badge>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">Belum ada pembayaran untuk booking ini.</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Link href="/admin/payments" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700">
                                    <Wallet className="size-3.5" /> Kelola Pembayaran
                                </Link>
                                {payment.invoice_number && (
                                    <Link href={`/admin/bookings/${booking.booking_code}/invoice`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50">
                                        <Receipt className="size-3.5" /> Cetak Invoice
                                    </Link>
                                )}
                            </div>
                            {payment.totals.outstanding > 0 && !['cancelled', 'completed'].includes(booking.status) && (
                                <SettlementForm
                                    bookingCode={booking.booking_code}
                                    outstanding={payment.totals.outstanding}
                                />
                            )}
                        </section>
                    )}

                    {/* Pembatalan & Refund — Phase 7A */}
                    {cancellation && (cancellation.cancelled || cancellation.preview) && (
                        <section className={cardCls} aria-label="Pembatalan dan refund">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className={cardTitleCls}>Pembatalan & Refund</h3>
                                {cancellation.cancelled ? (
                                    <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-200">Dibatalkan</Badge>
                                ) : cancellation.preview?.eligible ? (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">Dapat Dibatalkan</Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Tidak Dapat Dibatalkan</Badge>
                                )}
                            </div>

                            {cancellation.record && (
                                <dl className="mt-3 space-y-1.5 rounded-xl bg-slate-50 px-4 py-3 text-[13px] tabular-nums">
                                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Dibatalkan oleh</dt><dd className="font-semibold">{cancellation.record.cancelled_by_type === 'admin' ? 'Admin' : cancellation.record.cancelled_by_type === 'customer' ? 'Customer' : 'Sistem'}</dd></div>
                                    {cancellation.record.cancelled_at && <div className="flex justify-between gap-3"><dt className="text-slate-500">Waktu</dt><dd className="font-semibold">{cancellation.record.cancelled_at}</dd></div>}
                                    {cancellation.record.reason && <div className="flex justify-between gap-3"><dt className="text-slate-500">Alasan</dt><dd className="max-w-56 text-right font-semibold">{cancellation.record.reason}</dd></div>}
                                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Kebijakan</dt><dd className="font-semibold">{cancellation.record.policy_rule ?? `Refund ${cancellation.record.policy_percent}%`}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Dibayarkan</dt><dd className="font-semibold">{rupiah(cancellation.record.original_amount)}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Refund</dt><dd className="font-bold text-emerald-700">{rupiah(cancellation.record.refund_amount)}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Non-refundable</dt><dd className="font-semibold">{rupiah(cancellation.record.non_refundable_amount)}</dd></div>
                                    {cancellation.record.was_overridden && (
                                        <>
                                            <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5"><dt className="text-slate-500">Hasil policy</dt><dd className="font-semibold">{rupiah(cancellation.record.override_policy_amount ?? 0)}</dd></div>
                                            <div className="flex justify-between gap-3"><dt className="text-slate-500">Override</dt><dd className="font-bold text-amber-700">{rupiah(cancellation.record.override_amount ?? 0)}</dd></div>
                                            {cancellation.record.override_reason && <div className="flex justify-between gap-3"><dt className="text-slate-500">Alasan override</dt><dd className="max-w-56 text-right font-semibold">{cancellation.record.override_reason}</dd></div>}
                                        </>
                                    )}
                                </dl>
                            )}

                            {!cancellation.cancelled && cancellation.preview && (
                                <div className="mt-3 rounded-xl border border-slate-200 px-4 py-3 text-[13px] tabular-nums">
                                    {cancellation.preview.eligible ? (
                                        <>
                                            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{cancellation.preview.policy_rule}</p>
                                            <p className="mt-1.5 flex justify-between gap-3"><span className="text-slate-500">Dibayarkan</span><span className="font-semibold">{rupiah(cancellation.preview.original_amount)}</span></p>
                                            <p className="mt-1 flex justify-between gap-3"><span className="text-slate-500">Refund ({cancellation.preview.policy_percent}%)</span><span className="font-bold text-emerald-700">{rupiah(cancellation.preview.refund_amount)}</span></p>
                                            <p className="mt-1 flex justify-between gap-3"><span className="text-slate-500">Non-refundable</span><span className="font-semibold">{rupiah(cancellation.preview.non_refundable_amount)}</span></p>
                                        </>
                                    ) : (
                                        <p className="text-xs leading-5 text-slate-500">{cancellation.preview.blocked_reason}</p>
                                    )}
                                </div>
                            )}

                            {cancellation.refunds.length > 0 && (
                                <ol className="mt-3 space-y-1.5">
                                    {cancellation.refunds.map((refund) => (
                                        <li key={refund.refund_code} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5 text-[13px]">
                                            <span>
                                                <Link href="/admin/refunds" className="font-mono font-bold hover:underline">{refund.refund_code}</Link>
                                                <span className="ml-2 text-slate-500 tabular-nums">{rupiah(refund.amount)} · {refund.created_at}</span>
                                                {refund.reference && <span className="ml-2 font-mono text-[11px] text-slate-400">{refund.reference}</span>}
                                            </span>
                                            <Badge variant="outline">{refund.status}</Badge>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>
                    )}

                    {/* Assignment */}
                    {(booking.status === 'confirmed' || booking.status === 'preparing') && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <AssignCard
                                title="Unit Kendaraan"
                                current={booking.unit_code ? `Unit ${booking.unit_code}` : 'Belum ditugaskan'}
                                options={units}
                                busy={busy !== null}
                                locked={handoverLocked}
                                onAssign={(id) => post(`/admin/bookings/${booking.booking_code}/assign-unit`, { vehicle_unit_id: id }, 'unit')}
                                renderOption={(u) => (
                                    <>
                                        <span className="font-semibold">{u.unit_code}</span>
                                        {u.plate_number && <span className="text-xs text-slate-400"> · {u.plate_number}</span>}
                                        <AvailabilityNote available={u.available} active={u.status === 'active'} blocker={u.blocking_booking} maintenance={u.in_maintenance ? (u.maintenance_title ?? 'berjalan') : null} />
                                    </>
                                )}
                                disableReason={(u) => !u.available || u.status !== 'active' || u.in_maintenance}
                                emptyText={units.length === 0 ? 'Belum ada unit untuk kendaraan ini. Tambahkan di detail kendaraan.' : undefined}
                            />
                            {booking.with_driver ? (
                                <AssignCard
                                    title="Driver Rental"
                                    current={booking.driver_name ?? 'Belum ditugaskan'}
                                    options={drivers}
                                    busy={busy !== null}
                                    locked={handoverLocked}
                                    onAssign={(id) => post(`/admin/bookings/${booking.booking_code}/assign-driver`, { driver_id: id }, 'driver')}
                                    renderOption={(d) => (
                                        <>
                                            <span className="font-semibold">{d.name}</span>
                                            <AvailabilityNote available={d.available} active={d.status === 'active'} blocker={d.blocking_booking} working={d.status === 'working'} />
                                        </>
                                    )}
                                    disableReason={(d) => !d.available || d.status !== 'active'}
                                />
                            ) : (
                                <section className={cardCls}>
                                    <h3 className={cardTitleCls}>Driver Rental</h3>
                                    <p className="mt-2 text-sm text-slate-500">Tidak diperlukan untuk booking ini.</p>
                                </section>
                            )}
                        </div>
                    )}

                    {/* Tasks */}
                    {booking.tasks.length > 0 && (
                        <section className={cardCls}>
                            <h3 className={cardTitleCls}>Tugas Pengantaran & Pengambilan</h3>
                            <div className="mt-3 space-y-3">
                                {booking.tasks.map((task) => (
                                    <TaskCard key={task.id} task={task} staffOptions={staffOptions} bookingCode={booking.booking_code} busyKey={busy} setBusyKey={setBusy} locked={handoverLocked} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Handover */}
                    {booking.status === 'preparing' && !booking.handover.completed_at && (
                        <HandoverForm bookingCode={booking.booking_code} items={handoverItems} />
                    )}
                    {booking.handover.completed_at && (
                        <section className={cardCls}>
                            <h3 className={cardTitleCls}>Serah Terima</h3>
                            <p className="mt-1 text-xs text-slate-500">Selesai {booking.handover.completed_at}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {booking.handover.checklist.map((c) => (
                                    <Badge key={c} variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">
                                        <Check className="mr-1 size-3" />{handoverItems[c] ?? c}
                                    </Badge>
                                ))}
                            </div>
                            {booking.handover.notes && <p className="mt-3 text-sm text-slate-600">{booking.handover.notes}</p>}
                            {booking.handover.photos.length > 0 && (
                                <div className="mt-3 flex gap-2 overflow-x-auto">
                                    {booking.handover.photos.map((url) => (
                                        <img key={url} src={url} alt="Foto serah terima" loading="lazy" className="size-20 shrink-0 rounded-lg border border-slate-200 object-cover" />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Return */}
                    {booking.status === 'active' && !booking.return.returned_at && (
                        <ReturnForm bookingCode={booking.booking_code} />
                    )}
                    {booking.return.returned_at && (
                        <section className={cardCls}>
                            <h3 className={cardTitleCls}>Pemeriksaan Pengembalian</h3>
                            <p className="mt-1 text-xs text-slate-500">Selesai {booking.return.returned_at}</p>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Kondisi</p><p className="mt-1 font-semibold">{booking.return.condition === 'normal' ? 'Normal' : booking.return.condition === 'damage' ? 'Ada Kerusakan' : (booking.return.condition ?? '—')}</p></div>
                                <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">BBM</p><p className="mt-1 font-semibold">{booking.return.fuel}</p></div>
                            </div>
                            {booking.return.notes && <p className="mt-3 text-sm text-slate-600">{booking.return.notes}</p>}
                            {booking.return.photos.length > 0 && (
                                <div className="mt-3 flex gap-2 overflow-x-auto">
                                    {booking.return.photos.map((url) => (
                                        <img key={url} src={url} alt="Foto pengembalian" loading="lazy" className="size-20 shrink-0 rounded-lg border border-slate-200 object-cover" />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Damage & maintenance — only relevant after return */}
                    {(booking.return.returned_at || damages.length > 0 || damage_charges.length > 0) && (
                        <DamageSection
                            bookingCode={booking.booking_code}
                            unitCode={booking.unit_code}
                            damages={damages}
                            charges={damage_charges}
                            busy={busy !== null}
                        />
                    )}
                    {(booking.return.returned_at || maintenances.length > 0) && (
                        <MaintenanceSection
                            bookingCode={booking.booking_code}
                            unitCode={booking.unit_code}
                            records={maintenances}
                            busyKey={busy}
                            setBusyKey={setBusy}
                        />
                    )}
                </div>

                {/* Timeline */}
                <div>
                    <section className={cn(cardCls, 'lg:sticky lg:top-20')}>
                        <h3 className={cardTitleCls}>Timeline Booking</h3>
                        <ol className="mt-4">
                            {booking.timeline.map((step) => (
                                <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
                                    <div className="flex flex-col items-center">
                                        <span className={cn(
                                            'flex size-6 items-center justify-center rounded-full',
                                            step.done ? 'bg-emerald-600 text-white' : step.current ? 'bg-[#FF9137] text-[#241203]' : 'bg-slate-200 text-slate-400',
                                        )}>
                                            {step.done ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                                        </span>
                                        <span className={cn('mt-1 w-0.5 flex-1 rounded-full', step.done ? 'bg-emerald-600' : 'bg-slate-200')} aria-hidden />
                                    </div>
                                    <div className="pt-0.5">
                                        <p className={cn('text-[13.5px]', step.done || step.current ? 'font-semibold text-slate-900' : 'text-slate-400')}>{step.label}</p>
                                        {step.at && <p className="flex items-center gap-1 text-[11px] text-slate-400 tabular-nums"><Clock3 className="size-3" />{step.at}</p>}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>
            </div>

            {/* Cancel dialog */}
            <Dialog open={cancelOpen} onOpenChange={(open) => !open && busy === null && setCancelOpen(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Batalkan Booking?</DialogTitle>
                        <DialogDescription>
                            Booking {booking.booking_code} tidak akan lagi memblokir ketersediaan. Tugas terkait ikut dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    {cancellation?.assignment_warnings && cancellation.assignment_warnings.length > 0 && (
                        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                            <CircleAlert className="mt-0.5 size-4 shrink-0" />
                            Booking memiliki assignment operasional aktif: {cancellation.assignment_warnings.join(' ')} Lanjutkan?
                        </p>
                    )}
                    {cancellation?.preview?.eligible && (
                        <dl className="grid grid-cols-2 gap-2 text-center tabular-nums">
                            <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Dibayarkan</p>
                                <p className="mt-0.5 text-sm font-bold">{rupiah(cancellation.preview.original_amount)}</p>
                            </div>
                            <div className="rounded-xl bg-emerald-50 px-2 py-2.5">
                                <p className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase">Refund ({cancellation.preview.policy_percent}%)</p>
                                <p className="mt-0.5 text-sm font-bold text-emerald-800">{rupiah(cancellation.preview.refund_amount)}</p>
                            </div>
                        </dl>
                    )}
                    {cancellation?.fully_paid && !cancellation.cancelled && (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                            Booking LUNAS — pembatalan memerlukan override admin. Isi nominal refund dan alasan override di bawah.
                        </p>
                    )}
                    <div className="grid gap-2">
                        {Object.keys(cancelReasons).length > 0 && (
                            <>
                                <Label htmlFor="cancel_reason_code">Alasan</Label>
                                <select
                                    id="cancel_reason_code"
                                    value={cancelReasonCode}
                                    onChange={(e) => setCancelReasonCode(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                                >
                                    <option value="">— Pilih alasan —</option>
                                    {Object.entries(cancelReasons).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        <Label htmlFor="cancel_reason">Keterangan (wajib)</Label>
                        <Input id="cancel_reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Contoh: customer meminta reschedule" className="h-11 rounded-xl" />
                        {cancellation?.fully_paid && !cancellation.cancelled && (
                            <>
                                <Label htmlFor="override_amount">Nominal refund override (Rp)</Label>
                                <Input
                                    id="override_amount"
                                    type="number"
                                    min={0}
                                    value={overrideAmount}
                                    onChange={(e) => setOverrideAmount(e.target.value)}
                                    placeholder={cancellation.preview ? String(cancellation.preview.policy_amount) : '0'}
                                    className="h-11 rounded-xl tabular-nums"
                                />
                                <Label htmlFor="override_reason">Alasan override (wajib)</Label>
                                <Input id="override_reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Contoh: unit mogok sebelum serah terima" className="h-11 rounded-xl" />
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" disabled={busy !== null} onClick={() => setCancelOpen(false)}>Batal</Button>
                        <Button disabled={busy !== null || cancelReason.trim() === ''} onClick={cancel} className="bg-rose-600 text-white hover:bg-rose-500">
                            {busy === 'cancel' ? 'Memproses…' : 'Ya, batalkan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function SettlementForm({ bookingCode, outstanding }: { bookingCode: string; outstanding: number }) {
    const form = useForm({ amount: outstanding, method: 'cash', notes: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, booking_code: bookingCode }));
        form.post('/admin/payments', { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-[13px] font-bold text-emerald-900">Input Pelunasan (admin saja)</p>
            <p className="mt-0.5 text-xs text-emerald-700 tabular-nums">Sisa {rupiah(outstanding)} · dicatat langsung lunas, mis. tunai di outlet.</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_150px]">
                <div>
                    <Label htmlFor="settle_amount">Nominal</Label>
                    <Input
                        id="settle_amount"
                        type="number"
                        min={1}
                        max={outstanding}
                        value={form.data.amount}
                        onChange={(e) => form.setData('amount', Number(e.target.value))}
                        className="mt-1 h-10 rounded-xl tabular-nums"
                    />
                </div>
                <div>
                    <Label htmlFor="settle_method">Metode</Label>
                    <select
                        id="settle_method"
                        value={form.data.method}
                        onChange={(e) => form.setData('method', e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                        <option value="cash">Tunai</option>
                        <option value="bank_transfer">Transfer Bank</option>
                    </select>
                </div>
            </div>
            <div className="mt-2.5">
                <Label htmlFor="settle_notes">Catatan (opsional)</Label>
                <Input
                    id="settle_notes"
                    value={form.data.notes}
                    onChange={(e) => form.setData('notes', e.target.value)}
                    placeholder="Contoh: dibayar tunai saat pengambilan unit"
                    maxLength={500}
                    className="mt-1 h-10 rounded-xl"
                />
            </div>
            {form.errors.amount && <p className="mt-1.5 text-xs text-rose-600">{form.errors.amount}</p>}
            <Button type="submit" disabled={form.processing} className="mt-3 h-10 w-full rounded-xl bg-emerald-700 text-sm text-white hover:bg-emerald-600 sm:w-auto sm:px-6">
                {form.processing ? 'Menyimpan…' : 'Catat Pelunasan'}
            </Button>
        </form>
    );
}

function ActionButton({ children, busy, onClick, primary, disabled }: { children: React.ReactNode; busy: boolean; onClick: () => void; primary?: boolean; disabled?: boolean }) {
    return (
        <Button
            onClick={onClick}
            disabled={busy || disabled}
            className={cn(
                'rounded-xl',
                primary && 'bg-slate-900 text-white hover:bg-slate-700',
            )}
        >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {children}
        </Button>
    );
}

function AvailabilityNote({ available, active, blocker, working, maintenance }: { available: boolean; active: boolean; blocker: { booking_code: string; start_date: string; end_date: string } | null; working?: boolean; maintenance?: string | null }) {
    if (working) return <span className="ml-auto text-[11px] font-semibold text-amber-600">● Bekerja</span>;
    if (!active) return <span className="ml-auto text-[11px] font-medium text-slate-400">Nonaktif</span>;
    if (maintenance) return <span className="ml-auto text-right text-[11px] font-medium text-amber-700">● Maintenance · {maintenance}</span>;
    if (available) return <span className="ml-auto text-[11px] font-semibold text-emerald-600">● Tersedia</span>;
    return (
        <span className="ml-auto text-right text-[11px] font-medium text-rose-600">
            ● Tidak tersedia{blocker ? ` · ${blocker.booking_code}` : ''}
        </span>
    );
}

function AssignCard<T extends { id: number }>({
    title,
    current,
    options,
    busy,
    onAssign,
    renderOption,
    disableReason,
    emptyText,
    locked,
}: {
    title: string;
    current: string;
    options: T[];
    busy: boolean;
    onAssign: (id: number) => void;
    renderOption: (opt: T) => React.ReactNode;
    disableReason: (opt: T) => boolean;
    emptyText?: string;
    locked?: boolean;
}) {
    const [selected, setSelected] = useState('');
    return (
        <section className={cardCls}>
            <h3 className={cardTitleCls}>{title}</h3>
            <p className="mt-1 text-sm text-slate-500">Saat ini: <span className="font-semibold text-slate-800">{current}</span></p>
            {locked ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">Dikunci selama serah terima berlangsung.</p>
            ) : emptyText ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">{emptyText}</p>
            ) : (
                <div className="mt-3 space-y-2">
                    <select
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        aria-label={`Pilih ${title}`}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                        <option value="">Pilih…</option>
                        {options.map((opt) => {
                            const disabled = disableReason(opt);
                            return (
                                <option key={opt.id} value={opt.id} disabled={disabled}>
                                    {optionLabel(opt, disabled)}
                                </option>
                            );
                        })}
                    </select>
                    {/* Rich option preview (native select can't render HTML) */}
                    {selected && (
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            {renderOption(options.find((o) => String(o.id) === selected)!)}
                        </div>
                    )}
                    <Button
                        disabled={busy || !selected}
                        onClick={() => selected && onAssign(Number(selected))}
                        className="h-10 w-full rounded-xl bg-slate-900 text-sm text-white hover:bg-slate-700"
                    >
                        {busy ? 'Menugaskan…' : 'Tugaskan'}
                    </Button>
                    <div className="space-y-1.5 pt-1">
                        {options.map((opt) => (
                            <div key={opt.id} className="flex items-center gap-2 text-[13px]">
                                {renderOption(opt)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

function optionLabel<T>(opt: T, disabled: boolean): string {
    const o = opt as unknown as Record<string, unknown>;
    const name = String(o.unit_code ?? o.name ?? o.id);
    return disabled ? `${name} (tidak tersedia)` : name;
}

function TaskCard({ task, staffOptions, bookingCode, busyKey, setBusyKey, locked }: {
    task: Props['booking']['tasks'][number];
    staffOptions: Props['staffOptions'];
    bookingCode: string;
    busyKey: string | null;
    setBusyKey: (k: string | null) => void;
    locked?: boolean;
}) {
    const [staff, setStaff] = useState(task.staff_id ? String(task.staff_id) : '');
    const [scheduledAt, setScheduledAt] = useState((task.scheduled_at ?? '').replace(' ', 'T').slice(0, 16));

    // Semua operasi tugas dikelola di sini (detail booking) — halaman
    // operations hanya memantau. Dikunci selama serah terima berlangsung.

    const assign = () => {
        if (!staff) return;
        setBusyKey(`task-${task.id}`);
        router.post(
            `/admin/tasks/${task.id}/assign`,
            { driver_id: Number(staff), scheduled_at: scheduledAt ? scheduledAt.replace('T', ' ') + ':00' : null } as never,
            { preserveScroll: true, onFinish: () => setBusyKey(null) },
        );
    };

    const advance = (status: string) => {
        setBusyKey(`task-${task.id}-${status}`);
        router.patch(`/admin/tasks/${task.id}/status`, { status }, { preserveScroll: true, onFinish: () => setBusyKey(null) });
    };

    const nextSteps: Record<string, { status: string; label: string }[]> = {
        assigned: [{ status: 'on_the_way', label: 'Berangkat' }],
        on_the_way: [{ status: 'arrived', label: 'Tiba di lokasi' }],
        arrived: [{ status: 'completed', label: 'Selesaikan' }],
    };

    const canAssign = !locked && task.status === 'scheduled' && !task.staff_id;
    const canAdvance = !locked && (nextSteps[task.status] ?? []).length > 0 && !!task.staff_id;

    return (
        <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPin className="size-4 text-slate-400" />
                    {task.type === 'delivery' ? 'Pengantaran' : 'Pengambilan'}
                    {task.scheduled_at && <span className="font-normal text-slate-500 tabular-nums">· {task.scheduled_at}</span>}
                </p>
                <Badge variant="outline" className="text-[11px]">{TASK_STATUS_LABELS[task.status] ?? task.status}</Badge>
            </div>
            {task.address && <p className="mt-1 text-xs text-slate-500">{task.address}</p>}
            <p className="mt-1 text-xs text-slate-500">Petugas: <span className="font-semibold text-slate-800">{task.staff_name ?? 'Belum ditugaskan'}</span></p>
            {!!locked && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">Dikunci selama serah terima berlangsung.</p>
            )}

            {canAssign && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select value={staff} onChange={(e) => setStaff(e.target.value)} aria-label="Pilih petugas" className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400">
                        <option value="">Pilih petugas…</option>
                        {staffOptions.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} aria-label="Jadwal" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
                    <Button disabled={busyKey !== null || !staff} onClick={assign} className="h-10 rounded-xl bg-slate-900 text-sm text-white hover:bg-slate-700">
                        {busyKey === `task-${task.id}` ? '…' : 'Tugaskan'}
                    </Button>
                </div>
            )}
            {canAdvance && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {nextSteps[task.status].map((n) => (
                        <Button key={n.status} variant="outline" disabled={busyKey !== null} onClick={() => advance(n.status)} className="h-9 rounded-xl text-xs">
                            {busyKey === `task-${task.id}-${n.status}` ? 'Memproses…' : n.label}
                        </Button>
                    ))}
                    <Button variant="outline" disabled={busyKey !== null} onClick={() => advance('cancelled')} className="h-9 rounded-xl text-xs text-rose-600 hover:text-rose-600">
                        Batalkan tugas
                    </Button>
                </div>
            )}
        </div>
    );
}

function HandoverForm({ bookingCode, items }: { bookingCode: string; items: Record<string, string> }) {
    const form = useForm({ checklist: [] as string[], handover_notes: '', handover_photos: [] as File[] });
    const toggle = (key: string) => {
        form.setData('checklist', form.data.checklist.includes(key)
            ? form.data.checklist.filter((c) => c !== key)
            : [...form.data.checklist, key]);
    };
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/admin/bookings/${bookingCode}/handover`, { preserveScroll: true });
    };
    const allChecked = Object.keys(items).every((k) => form.data.checklist.includes(k));

    return (
        <section className={cardCls}>
            <h3 className={cardTitleCls}>Serah Terima Kendaraan</h3>
            <p className="mt-0.5 text-xs text-slate-500">Centang semua item untuk menyelesaikan serah terima.</p>
            <form onSubmit={submit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.entries(items).map(([key, label]) => (
                        <label key={key} className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors', form.data.checklist.includes(key) ? 'border-emerald-300 bg-emerald-50 font-medium text-emerald-900' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                            <input type="checkbox" checked={form.data.checklist.includes(key)} onChange={() => toggle(key)} className="size-4 accent-emerald-600" />
                            {label}
                        </label>
                    ))}
                </div>
                {form.errors.checklist && <p className="text-xs text-rose-600">{form.errors.checklist}</p>}
                <div className="grid gap-2">
                    <Label htmlFor="handover_notes">Catatan (opsional)</Label>
                    <textarea id="handover_notes" rows={2} value={form.data.handover_notes} onChange={(e) => form.setData('handover_notes', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="handover_photos">Foto sebelum rental (opsional, maks 5)</Label>
                    <Input id="handover_photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => form.setData('handover_photos', [...(e.target.files ?? [])])} className="h-11 rounded-xl" />
                    {form.errors.handover_photos && <p className="text-xs text-rose-600">{form.errors.handover_photos}</p>}
                </div>
                <Button type="submit" disabled={form.processing || !allChecked} className="h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-700 sm:w-auto sm:px-8">
                    {form.processing ? 'Menyimpan…' : 'Selesaikan Serah Terima'}
                </Button>
            </form>
        </section>
    );
}

const chargeStatusStyle: Record<string, string> = {
    unpaid: 'bg-amber-50 text-amber-800 border-amber-200',
    partial: 'bg-sky-50 text-sky-800 border-sky-200',
    paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    waived: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

const chargeStatusLabel: Record<string, string> = {
    unpaid: 'Belum Dibayar',
    partial: 'Sebagian Dibayar',
    paid: 'Lunas',
    waived: 'Dibebaskan',
    cancelled: 'Dibatalkan',
};

function DamageSection({ bookingCode, unitCode, damages, charges, busy }: {
    bookingCode: string;
    unitCode: string | null;
    damages: DamageRecordRow[];
    charges: DamageChargeRow[];
    busy: boolean;
}) {
    const form = useForm({ title: '', description: '', repair_cost: '', photo: null as File | null });
    const [confirmAction, setConfirmAction] = useState<{ url: string; label: string; body?: Record<string, string> } | null>(null);
    const [compressing, setCompressing] = useState(false);

    const submitDamage = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/admin/bookings/${bookingCode}/damages`, { preserveScroll: true, forceFormData: true, onSuccess: () => form.reset() });
    };

    // Foto HP (2–6MB) melebihi limit server bila diupload mentah — kompres dulu.
    const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0] ?? null;
        e.target.value = '';
        if (!picked) {
            form.setData('photo', null);
            return;
        }
        setCompressing(true);
        try {
            form.setData('photo', await compressImage(picked));
        } finally {
            setCompressing(false);
        }
    };

    const runConfirm = () => {
        if (!confirmAction) return;
        if (confirmAction.body) {
            router.post(confirmAction.url, confirmAction.body as never, { preserveScroll: true, onFinish: () => setConfirmAction(null) });
        } else {
            router.delete(confirmAction.url, { preserveScroll: true, onFinish: () => setConfirmAction(null) });
        }
    };

    return (
        <section className={cardCls}>
            <h3 className={cardTitleCls}>Biaya Kerusakan</h3>
            <p className="mt-0.5 text-xs text-slate-500">Tagihan terpisah dari total booking awal. Total dihitung server dari item.</p>

            {damages.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {damages.map((d) => (
                        <li key={d.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                            {d.photo_url && <img src={d.photo_url} alt={d.title} loading="lazy" className="size-11 shrink-0 rounded-lg border border-slate-200 object-cover" />}
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-900">{d.title}</p>
                                <p className="text-xs text-slate-500 tabular-nums">
                                    Rp{Number(d.repair_cost).toLocaleString('id-ID')}{d.unit_code ? ` · ${d.unit_code}` : ''}
                                </p>
                                {d.description && <p className="mt-0.5 truncate text-xs text-slate-500">{d.description}</p>}
                            </div>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmAction({ url: `/admin/damages/${d.id}`, label: `Hapus catatan "${d.title}"? Item tagihan terkait ikut dihapus dan total dihitung ulang.` })}
                                className="shrink-0 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                            >
                                Hapus
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {charges.length === 0 && damages.length === 0 && (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-xs text-slate-500">
                    Belum ada kerusakan yang dicatat.
                </p>
            )}

            {charges.map((charge) => (
                <ChargeCard key={charge.id} charge={charge} busy={busy} />
            ))}

            <form onSubmit={submitDamage} className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase sm:col-span-2">+ Tambah Kerusakan {unitCode ? `(unit ${unitCode})` : ''}</p>
                <Input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="Judul — mis. Spion kanan pecah" aria-label="Judul kerusakan" className="h-10 rounded-xl bg-white" />
                <Input value={form.data.repair_cost} onChange={(e) => form.setData('repair_cost', e.target.value)} placeholder="Biaya — mis. 150000" inputMode="numeric" aria-label="Biaya perbaikan" className="h-10 rounded-xl bg-white tabular-nums" />
                <Input value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} placeholder="Deskripsi (opsional)" aria-label="Deskripsi kerusakan" className="h-10 rounded-xl bg-white sm:col-span-2" />
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} aria-label="Foto kerusakan (otomatis dikompresi)" className="h-10 rounded-xl bg-white sm:col-span-2" />
                {(form.errors.title || form.errors.repair_cost || form.errors.description || form.errors.photo) && (
                    <p className="text-xs text-rose-600 sm:col-span-2">{form.errors.title ?? form.errors.repair_cost ?? form.errors.description ?? form.errors.photo}</p>
                )}
                <div className="sm:col-span-2">
                    <Button type="submit" disabled={form.processing || busy || compressing} className="h-10 rounded-xl bg-slate-900 text-sm text-white hover:bg-slate-700">
                        {compressing ? 'Menyiapkan foto…' : form.processing ? 'Menyimpan…' : 'Simpan Kerusakan'}
                    </Button>
                </div>
            </form>

            <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi</DialogTitle>
                        <DialogDescription>{confirmAction?.label}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmAction(null)}>Batal</Button>
                        <Button onClick={runConfirm} className="bg-rose-600 text-white hover:bg-rose-500">Ya, lanjutkan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function ChargeCard({ charge, busy }: { charge: DamageChargeRow; busy: boolean }) {
    const itemForm = useForm({ description: '', amount: '' });
    const [waiveOpen, setWaiveOpen] = useState(false);
    const [waiveReason, setWaiveReason] = useState('');
    const [cashOpen, setCashOpen] = useState(false);
    const cashForm = useForm({ method: 'cash', notes: '' });

    const submitItem = (e: React.FormEvent) => {
        e.preventDefault();
        itemForm.post(`/admin/damage-charges/${charge.charge_code}/items`, { preserveScroll: true, onSuccess: () => itemForm.reset() });
    };

    const removeItem = (id: number) => {
        router.delete(`/admin/damage-charge-items/${id}`, { preserveScroll: true });
    };

    const waive = () => {
        router.post(`/admin/damage-charges/${charge.charge_code}/waive`, { waived_reason: waiveReason } as never, {
            preserveScroll: true,
            onFinish: () => { setWaiveOpen(false); setWaiveReason(''); },
        });
    };

    const recordCash = (e: React.FormEvent) => {
        e.preventDefault();
        cashForm.post(`/admin/damage-charges/${charge.charge_code}/cash`, { preserveScroll: true, onSuccess: () => setCashOpen(false) });
    };

    return (
        <div className="mt-3 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-bold text-slate-900">{charge.charge_code}</p>
                <Badge variant="outline" className={chargeStatusStyle[charge.status] ?? ''}>
                    {chargeStatusLabel[charge.status] ?? charge.status}
                    {charge.locked ? ' · Terkunci' : ''}
                </Badge>
            </div>

            <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {charge.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2">
                        {item.record_photo_url && <img src={item.record_photo_url} alt={item.description} loading="lazy" className="size-9 shrink-0 rounded-lg border border-slate-200 object-cover" />}
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-800">{item.description}</p>
                            {item.record_title && item.record_title !== item.description && (
                                <p className="truncate text-[11px] text-slate-400">dari: {item.record_title}</p>
                            )}
                        </div>
                        <span className="font-semibold tabular-nums">Rp{Number(item.amount).toLocaleString('id-ID')}</span>
                        {!charge.locked && (
                            <button type="button" aria-label={`Hapus item ${item.description}`} disabled={busy} onClick={() => removeItem(item.id)} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50">
                                Hapus
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            <div className="mt-1 space-y-1 border-t border-slate-200 pt-2 text-sm tabular-nums">
                <p className="flex justify-between font-bold text-slate-900"><span>Total Tagihan</span><span>Rp{Number(charge.total).toLocaleString('id-ID')}</span></p>
                {charge.paid > 0 && <p className="flex justify-between text-emerald-700"><span>Dibayar</span><span>Rp{Number(charge.paid).toLocaleString('id-ID')}</span></p>}
                {charge.status !== 'paid' && <p className="flex justify-between font-semibold text-amber-800"><span>Sisa</span><span>Rp{Number(charge.outstanding).toLocaleString('id-ID')}</span></p>}
            </div>

            {charge.waived_reason && (
                <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">Dibebaskan: {charge.waived_reason}</p>
            )}

            {charge.payments.length > 0 && (
                <div className="mt-3">
                    <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">Pembayaran</p>
                    <ul className="mt-1.5 space-y-1.5">
                        {charge.payments.map((p) => (
                            <li key={p.payment_code} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                <span className="font-mono font-bold text-slate-800">{p.payment_code}</span>
                                <span className="font-semibold tabular-nums">Rp{Number(p.amount).toLocaleString('id-ID')}</span>
                                <span className="text-slate-500">{p.status}{p.paid_at ? ` · ${p.paid_at}` : ''}</span>
                                {p.status === 'submitted' && (
                                    <Link href={`/admin/payments/${p.payment_code}`} className="ml-auto font-bold text-sky-700 hover:underline">
                                        Verifikasi
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!charge.locked && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <form onSubmit={submitItem} className="flex flex-col gap-2 sm:flex-row">
                        <Input value={itemForm.data.description} onChange={(e) => itemForm.setData('description', e.target.value)} placeholder="Biaya manual — mis. Ongkos kirim part" aria-label="Deskripsi biaya manual" className="h-10 flex-1 rounded-xl" />
                        <Input value={itemForm.data.amount} onChange={(e) => itemForm.setData('amount', e.target.value)} placeholder="Nominal" inputMode="numeric" aria-label="Nominal biaya manual" className="h-10 rounded-xl tabular-nums sm:w-36" />
                        <Button type="submit" variant="outline" disabled={itemForm.processing || busy} className="h-10 rounded-xl text-xs">+ Item</Button>
                    </form>
                    {(itemForm.errors.description || itemForm.errors.amount) && (
                        <p className="text-xs text-rose-600">{itemForm.errors.description ?? itemForm.errors.amount}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setCashOpen((v) => !v)} disabled={busy} className="h-9 rounded-xl text-xs">Catat Tunai</Button>
                        <Button variant="outline" onClick={() => setWaiveOpen((v) => !v)} disabled={busy} className="h-9 rounded-xl text-xs">Bebaskan Biaya</Button>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => router.post(`/admin/damage-charges/${charge.charge_code}/cancel`, {}, { preserveScroll: true })}
                            className="h-9 rounded-xl text-xs text-rose-600 hover:text-rose-600"
                        >
                            Batalkan Tagihan
                        </Button>
                    </div>
                    {cashOpen && (
                        <form onSubmit={recordCash} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center">
                            <select value={cashForm.data.method} onChange={(e) => cashForm.setData('method', e.target.value)} aria-label="Metode" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
                                <option value="cash">Tunai</option>
                                <option value="bank_transfer">Transfer</option>
                            </select>
                            <Input value={cashForm.data.notes} onChange={(e) => cashForm.setData('notes', e.target.value)} placeholder="Catatan (opsional)" aria-label="Catatan pembayaran tunai" className="h-10 flex-1 rounded-xl bg-white" />
                            <Button type="submit" disabled={cashForm.processing || busy} className="h-10 rounded-xl bg-emerald-700 text-xs text-white hover:bg-emerald-600">
                                {cashForm.processing ? '…' : `Lunasi Rp${Number(charge.outstanding).toLocaleString('id-ID')}`}
                            </Button>
                        </form>
                    )}
                    {waiveOpen && (
                        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center">
                            <Input value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} placeholder="Alasan pembebasan (wajib)" aria-label="Alasan pembebasan" className="h-10 flex-1 rounded-xl bg-white" />
                            <Button
                                disabled={!waiveReason.trim() || busy}
                                onClick={() => router.post(`/admin/damage-charges/${charge.charge_code}/waive`, { waived_reason: waiveReason } as never, { preserveScroll: true, onFinish: () => { setWaiveOpen(false); setWaiveReason(''); } })}
                                className="h-10 rounded-xl text-xs"
                            >
                                Bebaskan
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MaintenanceSection({ bookingCode, unitCode, records }: {
    bookingCode: string;
    unitCode: string | null;
    records: MaintenanceRow[];
    busyKey: string | null;
    setBusyKey: (k: string | null) => void;
}) {
    const mntStyle: Record<string, string> = {
        scheduled: 'bg-amber-50 text-amber-800 border-amber-200',
        in_progress: 'bg-sky-50 text-sky-800 border-sky-200',
        completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
    };
    const mntLabel: Record<string, string> = {
        scheduled: 'Dijadwalkan',
        in_progress: 'Berjalan',
        completed: 'Selesai',
        cancelled: 'Dibatalkan',
    };
    const priLabel: Record<string, string> = {
        rendah: 'Rendah',
        sedang: 'Sedang',
        tinggi: 'Tinggi',
        darurat: 'Darurat',
    };

    return (
        <section className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className={cardTitleCls}>Perbaikan Unit</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Kerusakan otomatis tercatat di menu Perbaikan. Status diubah dari sana.</p>
                </div>
                <Link href="/admin/repairs" className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-700">
                    Kelola di Perbaikan
                </Link>
            </div>

            {records.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-xs text-slate-500">
                    Belum ada perbaikan untuk booking ini{unitCode ? ` (unit ${unitCode})` : ''}.
                </p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {records.map((m) => (
                        <li key={m.id} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Link href={`/admin/repairs/${m.id}`} className="font-semibold text-slate-900 hover:underline">
                                    {m.title}{m.unit_code ? ` · ${m.unit_code}` : ''}
                                </Link>
                                <div className="flex items-center gap-1.5">
                                    {(m.damage_count ?? 0) > 1 && (
                                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">{m.damage_count} kerusakan</Badge>
                                    )}
                                    <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200">{priLabel[m.priority] ?? m.priority ?? 'Sedang'}</Badge>
                                    <Badge variant="outline" className={mntStyle[m.status] ?? ''}>{mntLabel[m.status] ?? m.status}</Badge>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 tabular-nums">
                                Biaya Rp{Number(m.cost).toLocaleString('id-ID')}
                                {m.estimated_completed_at ? ` · estimasi ${m.estimated_completed_at}` : ''}
                                {m.started_at ? ` · mulai ${m.started_at}` : ''}
                                {m.completed_at ? ` · selesai ${m.completed_at}` : ''}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function ReturnForm({ bookingCode }: { bookingCode: string }) {    const form = useForm({
        return_condition: 'normal',
        return_fuel: '',
        return_notes: '',
        return_photos: [] as File[],
        damages: [] as { title: string; description: string; repair_cost: number; photo: File | null }[],
    });
    const [draft, setDraft] = useState({ title: '', description: '', repair_cost: '', photo: null as File | null });
    const [compressing, setCompressing] = useState(false);

    const addDamage = () => {
        if (!draft.title.trim() || draft.repair_cost === '') return;
        form.setData('damages', [
            ...form.data.damages,
            { title: draft.title.trim(), description: draft.description.trim(), repair_cost: Number(draft.repair_cost) || 0, photo: draft.photo },
        ]);
        setDraft({ title: '', description: '', repair_cost: '', photo: null });
    };

    // Foto HP (2–6MB) melebihi limit server bila diupload mentah — kompres dulu.
    const pickReturnPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = '';
        if (files.length === 0) {
            form.setData('return_photos', []);
            return;
        }
        setCompressing(true);
        try {
            form.setData('return_photos', await compressImages(files));
        } finally {
            setCompressing(false);
        }
    };

    const pickDraftPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0] ?? null;
        e.target.value = '';
        if (!picked) {
            setDraft({ ...draft, photo: null });
            return;
        }
        setCompressing(true);
        try {
            setDraft({ ...draft, photo: await compressImage(picked) });
        } finally {
            setCompressing(false);
        }
    };

    const removeDamage = (index: number) => {
        form.setData('damages', form.data.damages.filter((_, i) => i !== index));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            return_photos: data.return_photos,
            damages: data.damages.map((d) => ({ ...d })),
        }));
        form.post(`/admin/bookings/${bookingCode}/return`, { preserveScroll: true, forceFormData: true });
    };

    const isDamage = form.data.return_condition === 'damage';

    return (
        <section className={cardCls}>
            <h3 className={cardTitleCls}>Pemeriksaan Pengembalian</h3>
            <p className="mt-0.5 text-xs text-slate-500">Menyelesaikan pemeriksaan akan menutup rental. Kerusakan yang dicatat otomatis menjadi tagihan terpisah.</p>
            <form onSubmit={submit} className="mt-4 space-y-4">
                <div className="grid gap-2">
                    <Label>Kondisi Kendaraan</Label>
                    <div className="flex gap-2">
                        {[{ v: 'normal', l: 'Normal' }, { v: 'damage', l: 'Ada Kerusakan' }].map((o) => (
                            <button key={o.v} type="button" onClick={() => form.setData('return_condition', o.v)} aria-pressed={form.data.return_condition === o.v} className={cn('flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors', form.data.return_condition === o.v ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500')}>
                                {o.l}
                            </button>
                        ))}
                    </div>
                    {form.errors.return_condition && <p className="text-xs text-rose-600">{form.errors.return_condition}</p>}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="return_fuel">BBM</Label>
                    <Input id="return_fuel" value={form.data.return_fuel} onChange={(e) => form.setData('return_fuel', e.target.value)} placeholder="Contoh: 3/4" className="h-11 rounded-xl" />
                    {form.errors.return_fuel && <p className="text-xs text-rose-600">{form.errors.return_fuel}</p>}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="return_notes">Catatan (opsional)</Label>
                    <textarea id="return_notes" rows={2} value={form.data.return_notes} onChange={(e) => form.setData('return_notes', e.target.value)} placeholder="Contoh: tidak ada masalah" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="return_photos">Foto (opsional, maks 5 — otomatis dikompresi)</Label>
                    <Input id="return_photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pickReturnPhotos} className="h-11 rounded-xl" />
                </div>

                {isDamage && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                        <p className="text-sm font-bold text-slate-900">Daftar Kerusakan</p>
                        {form.data.damages.length > 0 && (
                            <ul className="mt-3 space-y-2">
                                {form.data.damages.map((d, i) => (
                                    <li key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-slate-900">{d.title}</p>
                                            <p className="text-xs text-slate-500 tabular-nums">Rp{Number(d.repair_cost).toLocaleString('id-ID')}{d.photo ? ' · ada foto' : ''}</p>
                                        </div>
                                        <button type="button" aria-label={`Hapus ${d.title}`} onClick={() => removeDamage(i)} className="text-xs font-semibold text-rose-600 hover:underline">
                                            Hapus
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Judul — mis. Spion kanan pecah" aria-label="Judul kerusakan" className="h-10 rounded-xl bg-white" />
                            <Input value={draft.repair_cost} onChange={(e) => setDraft({ ...draft, repair_cost: e.target.value })} placeholder="Biaya — mis. 150000" inputMode="numeric" aria-label="Biaya perbaikan" className="h-10 rounded-xl bg-white tabular-nums" />
                            <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Deskripsi (opsional)" aria-label="Deskripsi kerusakan" className="h-10 rounded-xl bg-white sm:col-span-2" />
                            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickDraftPhoto} aria-label="Foto kerusakan (otomatis dikompresi)" className="h-10 rounded-xl bg-white sm:col-span-2" />
                        </div>
                        <Button type="button" variant="outline" onClick={addDamage} disabled={!draft.title.trim() || draft.repair_cost === '' || compressing} className="mt-2 h-10 rounded-xl text-xs">
                            {compressing ? 'Menyiapkan foto…' : '+ Tambah Kerusakan'}
                        </Button>
                        {form.errors.damages && <p className="mt-1 text-xs text-rose-600">{form.errors.damages}</p>}
                        {Object.entries(form.errors)
                            .filter(([key]) => key.startsWith('damages.'))
                            .map(([key, message]) => {
                                const idx = Number(key.split('.')[1]);
                                return (
                                    <p key={key} className="mt-1 text-xs text-rose-600">
                                        Kerusakan #{Number.isNaN(idx) ? '?' : idx + 1} ({key.split('.').slice(2).join('.')}): {message}
                                    </p>
                                );
                            })}
                    </div>
                )}

                <Button type="submit" disabled={form.processing || compressing || (isDamage && form.data.damages.length === 0)} className="h-11 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-600 sm:w-auto sm:px-8">
                    {compressing ? 'Menyiapkan foto…' : form.processing ? 'Menyimpan…' : isDamage ? 'Selesaikan Inspection & Buat Tagihan' : 'Selesaikan Inspection'}
                </Button>
            </form>
        </section>
    );
}
