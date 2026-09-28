import { Link } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { formatDateShort, rupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardRecentBooking } from '@/types/insights';

const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    confirmed: 'bg-sky-50 text-sky-800 border-sky-200',
    preparing: 'bg-violet-50 text-violet-800 border-violet-200',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function RecentBookings({ rows }: { rows: DashboardRecentBooking[] }) {
    return (
        <section
            aria-label="Booking terbaru"
            className="animate-fade-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
        >
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-0">
                <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                        Booking Terbaru
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                        5 transaksi terakhir dari seluruh outlet
                    </p>
                </div>
                <Link
                    href="/admin/bookings"
                    className="text-xs font-semibold text-sky-700 hover:underline"
                >
                    Semua booking
                </Link>
            </div>
            {rows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                    Belum ada booking.
                </p>
            ) : (
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                        <thead>
                            <tr className="border-y border-slate-200 text-xs text-slate-500">
                                <th className="px-4 py-2.5 font-medium">
                                    Booking
                                </th>
                                <th className="px-2 py-2.5 font-medium">
                                    Customer
                                </th>
                                <th className="px-2 py-2.5 font-medium">
                                    Kendaraan
                                </th>
                                <th className="px-2 py-2.5 font-medium">
                                    Periode
                                </th>
                                <th className="px-2 py-2.5 font-medium">
                                    Status
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, 5).map((b) => (
                                <tr
                                    key={b.id}
                                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                                >
                                    <td className="px-4 py-2.5">
                                        <Link
                                            href={`/admin/bookings/${b.booking_code}`}
                                            className="font-mono text-xs font-semibold text-slate-900 hover:underline"
                                        >
                                            {b.booking_code}
                                        </Link>
                                    </td>
                                    <td className="max-w-[120px] truncate px-2 py-2.5 text-slate-700">
                                        {b.customer_name}
                                    </td>
                                    <td className="max-w-[120px] truncate px-2 py-2.5 text-slate-700">
                                        {b.vehicle_name ?? '—'}
                                    </td>
                                    <td className="px-2 py-2.5 text-xs whitespace-nowrap text-slate-500 tabular-nums">
                                        {formatDateShort(b.start_date)} –{' '}
                                        {formatDateShort(b.end_date)}
                                    </td>
                                    <td className="px-2 py-2.5">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                statusStyle[b.status] ??
                                                    statusStyle.pending,
                                            )}
                                        >
                                            {b.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                                        {rupiah(b.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
