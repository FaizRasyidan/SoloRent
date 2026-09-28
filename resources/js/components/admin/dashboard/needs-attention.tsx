import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AttentionEntry } from '@/types/insights';

const priorityStyle: Record<string, string> = {
    high: 'bg-rose-50 text-rose-800 border-rose-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const priorityLabel: Record<string, string> = {
    high: 'HIGH',
    medium: 'MED',
    low: 'LOW',
};

export function NeedsAttention({ items }: { items: AttentionEntry[] }) {
    const shown = items.slice(0, 5);
    const rest = Math.max(0, items.length - shown.length);

    return (
        <section
            id="perlu-tindakan"
            aria-label="Perlu tindakan"
            className="animate-fade-up scroll-mt-4 rounded-2xl border border-slate-200/80 bg-white p-5"
        >
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                Perlu Tindakan
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
                Dihitung live — hilang otomatis saat masalah diperbaiki
            </p>

            <div className="mt-4 space-y-3">
                {shown.length === 0 && (
                    <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm font-medium text-emerald-800">
                        Semua beres — tidak ada item menunggu tindakan.
                    </p>
                )}
                {shown.map((item) => (
                    <Link
                        key={item.id}
                        href={item.action_url}
                        className="block rounded-xl border border-slate-200/70 p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        aria-label={`${item.title}: ${item.count}. Tindak lanjuti.`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <Badge
                                variant="outline"
                                className={cn(
                                    'text-[10px] font-bold tracking-wide',
                                    priorityStyle[item.priority] ??
                                        priorityStyle.low,
                                )}
                            >
                                {priorityLabel[item.priority] ?? item.priority}
                            </Badge>
                            <span className="text-xs font-bold text-slate-900 tabular-nums">
                                {item.count}
                            </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                            {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {item.detail}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-700">
                            Tindak lanjuti <ArrowRight className="size-3.5" />
                        </span>
                    </Link>
                ))}
            </div>

            {rest > 0 && (
                <Link
                    href="/admin/notifications?level=action"
                    className="mt-3 block text-center text-xs font-semibold text-slate-600 hover:underline"
                >
                    +{rest} lainnya — lihat di Notifikasi
                </Link>
            )}
        </section>
    );
}
