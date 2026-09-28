import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReportFilters, ReportInsightsSection } from '@/types/reports';

const CATEGORIES = [
    { value: 'all', label: 'Semua' },
    { value: 'demand', label: 'Permintaan' },
    { value: 'revenue', label: 'Pendapatan' },
    { value: 'fleet', label: 'Armada' },
    { value: 'customer', label: 'Customer' },
    { value: 'cancellation', label: 'Pembatalan' },
    { value: 'maintenance', label: 'Perawatan' },
    { value: 'general', label: 'Umum' },
];

export function InsightSectionView({
    section,
    filters: _filters,
}: {
    section: ReportInsightsSection;
    filters: ReportFilters;
}) {
    void _filters;
    const [cat, setCat] = useState('all');
    const items = section.insights.insights.filter(
        (i) => cat === 'all' || i.category === cat,
    );

    return (
        <div className="space-y-4">
            <div
                className="flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="Filter kategori insight"
            >
                {CATEGORIES.map((c) => (
                    <button
                        key={c.value}
                        type="button"
                        aria-pressed={cat === c.value}
                        onClick={() => setCat(c.value)}
                        className={cn(
                            'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                            cat === c.value
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                        )}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {items.length === 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-10 text-center">
                    <p className="text-[15px] font-semibold text-slate-900">
                        Data belum cukup untuk insight.
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                        Setiap rule membutuhkan sampel minimum — tambah
                        transaksi atau pilih periode lebih panjang.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {items.map((item, i) => (
                    <article
                        key={item.id}
                        className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5"
                        style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                    >
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[11px]">
                                {CATEGORIES.find(
                                    (c) => c.value === item.category,
                                )?.label ?? item.category}
                            </Badge>
                            <span className="text-[11px] text-slate-400">
                                Keyakinan {item.confidence}
                            </span>
                        </div>
                        <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-slate-900">
                            {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                            {item.summary}
                        </p>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
                            {item.evidence.map((line, j) => (
                                <li key={j}>{line}</li>
                            ))}
                        </ul>
                        <div className="mt-3 rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-600">
                                <span className="font-semibold">
                                    Rekomendasi:{' '}
                                </span>
                                {item.recommendation}
                            </p>
                        </div>
                        <Link
                            href={item.action_url}
                            className="mt-3 inline-block text-xs font-semibold text-sky-700 hover:underline"
                        >
                            Buka laporan terkait
                        </Link>
                    </article>
                ))}
            </div>

            <p className="text-[11px] text-slate-400">
                Terakhir diperbarui: {section.insights.generated_at} WIB ·
                dihitung dari data 30 hari terakhir (atau jendela tiap rule).
            </p>
        </div>
    );
}
