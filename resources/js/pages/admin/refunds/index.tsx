import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REFUND_STATUS_LABELS, type AdminRefundRow, type Paginated } from '@/types';
import { cn } from '@/lib/utils';

type Props = {
    refunds: Paginated<AdminRefundRow>;
    filters: { search: string | null; status: string | null; from: string | null; to: string | null };
    statusLabels: Record<string, string>;
    counts: Record<string, number>;
};

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    processing: 'bg-sky-50 text-sky-800 border-sky-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    failed: 'bg-rose-50 text-rose-800 border-rose-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function RefundIndex() {
    const { refunds, filters, counts } = usePage().props as unknown as Props;
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [reference, setReference] = useState<Record<string, string>>({});
    const [failReason, setFailReason] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<string | null>(null);

    const reload = (overrides: Record<string, string>) => {
        router.get(
            '/admin/refunds',
            { search, status, from: filters.from ?? '', to: filters.to ?? '', ...overrides },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const act = (code: string, action: 'process' | 'complete' | 'fail', data: Record<string, string> = {}) => {
        setBusy(`${action}-${code}`);
        router.post(`/admin/refunds/${code}/${action}`, data as never, {
            preserveScroll: true,
            onFinish: () => setBusy(null),
        });
    };

    return (
        <AdminLayout title="Refund">
            <Head title="Kelola Refund" />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-slate-900">
                        <RotateCcw className="size-5" /> Refund
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Pengembalian dana selalu manual: pending → processing → completed. Jangan tandai
                        selesai sebelum dana benar-benar dikembalikan.
                    </p>
                </div>
                <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft className="size-4" /> Booking
                </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter status refund">
                {[
                    { value: '', label: 'Semua', count: counts.all ?? 0 },
                    { value: 'pending', label: 'Pending', count: counts.pending ?? 0 },
                    { value: 'processing', label: 'Processing', count: counts.processing ?? 0 },
                    { value: 'completed', label: 'Completed', count: counts.completed ?? 0 },
                ].map((pill) => (
                    <button
                        key={pill.value || 'all'}
                        type="button"
                        onClick={() => { setStatus(pill.value); reload({ status: pill.value }); }}
                        className={cn(
                            'rounded-full border px-3.5 py-1.5 text-xs font-semibold tabular-nums',
                            status === pill.value
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                        )}
                    >
                        {pill.label} · {pill.count}
                    </button>
                ))}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-52 flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') reload({ search }); }}
                            placeholder="Cari kode refund / booking / customer…"
                            aria-label="Cari refund"
                            className="h-10 rounded-xl pl-9"
                        />
                    </div>
                    <Button variant="outline" onClick={() => reload({ search })} className="h-10 rounded-xl">Cari</Button>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-3xl text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-[11px] tracking-wide text-slate-400 uppercase">
                                <th className="py-2 pr-3 font-semibold">Refund</th>
                                <th className="py-2 pr-3 font-semibold">Booking</th>
                                <th className="py-2 pr-3 text-right font-semibold">Nominal</th>
                                <th className="py-2 pr-3 font-semibold">Status</th>
                                <th className="py-2 pr-3 font-semibold">Referensi</th>
                                <th className="py-2 font-semibold">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {refunds.data.map((refund) => (
                                <tr key={refund.refund_code} className="border-b border-slate-50 last:border-0">
                                    <td className="py-3 pr-3">
                                        <p className="font-mono text-xs font-bold text-slate-900">{refund.refund_code}</p>
                                        <p className="text-[11px] text-slate-400 tabular-nums">{refund.created_at}</p>
                                        {refund.reason && <p className="mt-0.5 max-w-48 truncate text-[11px] text-slate-500">{refund.reason}</p>}
                                    </td>
                                    <td className="py-3 pr-3">
                                        {refund.booking_code ? (
                                            <Link href={`/admin/bookings/${refund.booking_code}`} className="font-mono text-xs font-bold text-sky-700 hover:underline">
                                                {refund.booking_code}
                                            </Link>
                                        ) : (
                                            <span className="text-xs text-slate-400">-</span>
                                        )}
                                        {refund.customer_name && <p className="text-[11px] text-slate-500">{refund.customer_name}</p>}
                                    </td>
                                    <td className="py-3 pr-3 text-right font-bold tabular-nums">{rupiah(refund.amount)}</td>
                                    <td className="py-3 pr-3">
                                        <Badge variant="outline" className={statusStyle[refund.status] ?? ''}>
                                            {REFUND_STATUS_LABELS[refund.status] ?? refund.status}
                                        </Badge>
                                        {refund.failure_reason && (
                                            <p className="mt-1 max-w-44 text-[11px] text-rose-600">{refund.failure_reason}</p>
                                        )}
                                    </td>
                                    <td className="py-3 pr-3">
                                        {refund.reference
                                            ? <span className="font-mono text-xs text-slate-600">{refund.reference}</span>
                                            : <span className="text-xs text-slate-400">-</span>}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex max-w-64 flex-col gap-1.5">
                                            {refund.status === 'pending' && (
                                                <Button
                                                    size="sm"
                                                    disabled={busy !== null}
                                                    onClick={() => act(refund.refund_code, 'process')}
                                                    className="h-8 rounded-lg text-xs"
                                                >
                                                    {busy === `process-${refund.refund_code}` ? 'Memproses…' : 'Process Refund'}
                                                </Button>
                                            )}
                                            {(refund.status === 'pending' || refund.status === 'processing') && (
                                                <div className="flex gap-1.5">
                                                    <Input
                                                        value={reference[refund.refund_code] ?? ''}
                                                        onChange={(e) => setReference((prev) => ({ ...prev, [refund.refund_code]: e.target.value }))}
                                                        placeholder="No. referensi transfer"
                                                        aria-label={`Referensi refund ${refund.refund_code}`}
                                                        className="h-8 rounded-lg text-xs"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        disabled={busy !== null || !(reference[refund.refund_code] ?? '').trim()}
                                                        onClick={() => act(refund.refund_code, 'complete', { reference: (reference[refund.refund_code] ?? '').trim() })}
                                                        className="h-8 shrink-0 rounded-lg bg-emerald-600 text-xs text-white hover:bg-emerald-500"
                                                    >
                                                        {busy === `complete-${refund.refund_code}` ? '…' : 'Selesai'}
                                                    </Button>
                                                </div>
                                            )}
                                            {(refund.status === 'pending' || refund.status === 'processing') && (
                                                <div className="flex gap-1.5">
                                                    <Input
                                                        value={failReason[refund.refund_code] ?? ''}
                                                        onChange={(e) => setFailReason((prev) => ({ ...prev, [refund.refund_code]: e.target.value }))}
                                                        placeholder="Alasan gagal"
                                                        aria-label={`Alasan gagal refund ${refund.refund_code}`}
                                                        className="h-8 rounded-lg text-xs"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy !== null || !(failReason[refund.refund_code] ?? '').trim()}
                                                        onClick={() => act(refund.refund_code, 'fail', { failure_reason: (failReason[refund.refund_code] ?? '').trim() })}
                                                        className="h-8 shrink-0 rounded-lg text-xs text-rose-600"
                                                    >
                                                        Gagal
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {refunds.data.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                                        Belum ada refund.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {refunds.last_page > 1 && (
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                        <span className="tabular-nums">Halaman {refunds.current_page} dari {refunds.last_page}</span>
                        <div className="flex gap-1.5">
                            {refunds.links[0]?.url && (
                                <Link href={refunds.links[0].url} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 font-semibold">
                                    <ChevronLeft className="size-3.5" /> Sebelumnya
                                </Link>
                            )}
                            {refunds.links[refunds.links.length - 1]?.url && (
                                <Link href={refunds.links[refunds.links.length - 1].url ?? ''} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 font-semibold">
                                    Berikutnya <ChevronRight className="size-3.5" />
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
