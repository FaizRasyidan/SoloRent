import { Head, Link, router } from '@inertiajs/react';
import { Banknote, Clock3, Search } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Row = {
    payment_code: string;
    booking_code: string | null;
    customer_name: string | null;
    amount: number;
    method: string;
    type: string;
    status: string;
    submitted_at: string | null;
    paid_at: string | null;
    created_at: string;
};

type Props = {
    payments: { data: Row[]; links: { url: string | null; label: string; active: boolean }[] };
    filters: { search: string | null; status: string | null; sort: string | null };
    counts: Record<string, number>;
    todayPaid: number;
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

const tabs = [
    ['all', 'Semua'],
    ['pending', 'Pending'],
    ['submitted', 'Menunggu Verifikasi'],
    ['paid', 'Lunas'],
    ['rejected', 'Ditolak'],
] as const;

export default function PaymentsIndex({ payments, filters, counts, todayPaid }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    const go = (patch: Record<string, string | null>) => {
        router.get('/admin/payments', { search: search || null, status: filters.status, sort: filters.sort, ...patch }, { preserveState: true, replace: true });
    };

    return (
        <AdminLayout title="Pembayaran">
            <Head title="Pembayaran" />
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Pembayaran</h2>
                    <p className="mt-1 text-sm text-slate-500">Verifikasi transfer manual · DP 50% syarat konfirmasi booking.</p>
                </div>
                <p className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white tabular-nums">
                    <Banknote className="size-4" /> Hari ini: {rupiah(todayPaid)}
                </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {tabs.map(([v, label]) => {
                    const active = (filters.status ?? 'all') === v || (v === 'all' && !filters.status);
                    return (
                        <button
                            key={v}
                            onClick={() => go({ status: v === 'all' ? null : v })}
                            aria-pressed={active}
                            className={cn(
                                'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                                active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                            )}
                        >
                            {label} · {counts[v] ?? 0}
                        </button>
                    );
                })}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    go({});
                }}
                className="mt-4 flex gap-2"
            >
                <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari kode payment / booking / customer…"
                        aria-label="Cari pembayaran"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm outline-none focus:border-slate-400"
                    />
                </div>
                <select
                    value={filters.sort ?? 'newest'}
                    onChange={(e) => go({ sort: e.target.value })}
                    aria-label="Urutkan"
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                    <option value="newest">Terbaru</option>
                    <option value="oldest">Terlama</option>
                    <option value="highest">Nominal terbesar</option>
                    <option value="lowest">Nominal terkecil</option>
                </select>
                <button type="submit" className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white">
                    Cari
                </button>
            </form>

            {payments.data.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <Clock3 className="mx-auto size-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold">Belum ada pembayaran pada filter ini.</p>
                </div>
            ) : (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs text-slate-500">
                                <th className="px-4 py-3 font-medium">Payment</th>
                                <th className="px-4 py-3 font-medium">Booking / Customer</th>
                                <th className="px-4 py-3 font-medium">Nominal</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 text-right font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.data.map((p) => (
                                <tr key={p.payment_code} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-3">
                                        <p className="font-mono text-xs font-bold">{p.payment_code}</p>
                                        <p className="text-[11px] text-slate-400 tabular-nums">{p.created_at}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-mono text-xs font-semibold">{p.booking_code ?? '—'}</p>
                                        <p className="text-xs text-slate-500">{p.customer_name ?? '—'}</p>
                                    </td>
                                    <td className="px-4 py-3 font-semibold tabular-nums">{rupiah(p.amount)}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className={statusStyle[p.status] ?? ''}>
                                            {p.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link href={`/admin/payments/${p.payment_code}`} className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                                            Detail
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                {payments.links.map((l, i) => (
                    <Link
                        key={i}
                        href={l.url ?? '#'}
                        preserveState
                        className={cn(
                            'rounded-lg border px-3.5 py-2 text-xs font-semibold',
                            l.active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600',
                            !l.url && 'pointer-events-none opacity-40',
                        )}
                    >
                        <span dangerouslySetInnerHTML={{ __html: l.label }} />
                    </Link>
                ))}
            </div>
        </AdminLayout>
    );
}
