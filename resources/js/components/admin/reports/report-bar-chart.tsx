import { cn } from '@/lib/utils';

export type BarItem = {
    label: string;
    value: number;
    hint?: string;
};

/**
 * Bar chart horizontal: label di kiri, bar di tengah, nilai di kanan.
 * Tidak ada teks yang bertumpuk — layout flex menjamin setiap baris
 * punya ruang sendiri berapapun kategorinya.
 */
export function ReportBarChart({
    items,
    formatValue,
    color = '#1D4ED8',
    ariaLabel,
    emptyText = 'Belum ada data pada periode ini.',
    limit,
}: {
    items: BarItem[];
    formatValue: (n: number) => string;
    color?: string;
    ariaLabel: string;
    emptyText?: string;
    limit?: number;
}) {
    const shown = limit ? items.slice(0, limit) : items;

    if (shown.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-slate-500">
                {emptyText}
            </p>
        );
    }

    const max = Math.max(1, ...shown.map((i) => i.value));

    return (
        <ul className="space-y-3" aria-label={ariaLabel}>
            {shown.map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                    <p
                        className="w-32 shrink-0 truncate text-xs font-medium text-slate-600 sm:w-44"
                        title={item.hint ?? item.label}
                    >
                        {item.label}
                    </p>
                    <div
                        className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
                        role="img"
                        aria-label={`${item.label}: ${formatValue(item.value)}`}
                    >
                        <div
                            className={cn(
                                'h-full rounded-full transition-[width] duration-300 ease-out',
                            )}
                            style={{
                                width: `${Math.max(item.value > 0 ? 3 : 0, (item.value / max) * 100)}%`,
                                backgroundColor: color,
                            }}
                        />
                    </div>
                    <p className="w-24 shrink-0 text-right text-xs font-semibold text-slate-900 tabular-nums">
                        {formatValue(item.value)}
                    </p>
                </li>
            ))}
        </ul>
    );
}
