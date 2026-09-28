import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { InsightDetail } from '@/components/admin/insights/insight-detail';
import { INSIGHT_CATEGORY_LABELS, type InsightItem } from '@/types/insights';

export function SmartInsights({
    items,
    generatedAt,
}: {
    items: InsightItem[];
    generatedAt: string;
}) {
    const [open, setOpen] = useState<InsightItem | null>(null);

    return (
        <section
            aria-label="Smart Insights"
            className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                        Smart Insights
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                        Temuan faktual dari data 30 hari terakhir
                    </p>
                </div>
                <form method="post" action="/admin/insights/refresh">
                    <button
                        type="submit"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        aria-label="Perbarui insight"
                    >
                        Refresh
                    </button>
                </form>
            </div>

            <div className="mt-4 space-y-3">
                {items.length === 0 && (
                    <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Data belum cukup untuk insight.
                    </p>
                )}
                {items.slice(0, 3).map((item) => (
                    <article
                        key={item.id}
                        className="rounded-xl border border-slate-200/70 p-3.5"
                    >
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[11px]">
                                {INSIGHT_CATEGORY_LABELS[item.category] ??
                                    item.category}
                            </Badge>
                            <span className="text-[11px] text-slate-400">
                                {item.confidence === 'high'
                                    ? 'Keyakinan tinggi'
                                    : item.confidence === 'medium'
                                      ? 'Keyakinan sedang'
                                      : 'Keyakinan rendah'}
                            </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                            {item.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {item.summary}
                        </p>
                        <button
                            type="button"
                            onClick={() => setOpen(item)}
                            className="mt-2 text-xs font-semibold text-sky-700 hover:underline"
                            aria-label={`Lihat detail: ${item.title}`}
                        >
                            Lihat Detail
                        </button>
                    </article>
                ))}
            </div>

            <p className="mt-4 text-[11px] text-slate-400">
                Terakhir diperbarui: {generatedAt} WIB
            </p>

            <InsightDetail item={open} onClose={() => setOpen(null)} />
        </section>
    );
}
