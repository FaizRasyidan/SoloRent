import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function ReportEmpty({
    title,
    hint,
    action,
}: {
    title: string;
    hint?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {hint && (
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                    {hint}
                </p>
            )}
            {action && <div className="mt-4 flex justify-center">{action}</div>}
        </div>
    );
}

export function ReportError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-rose-900">
                Laporan tidak dapat dimuat.
            </p>
            <p className="mt-1 text-xs text-rose-700">Silakan coba lagi.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
            >
                Coba Lagi
            </button>
        </div>
    );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-hidden="true"
        >
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="size-9 rounded-xl" />
                    </div>
                    <Skeleton className="mt-3 h-7 w-32" />
                    <Skeleton className="mt-2 h-3.5 w-40" />
                </div>
            ))}
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div
            className="rounded-2xl border border-slate-200/80 bg-white p-5"
            aria-hidden="true"
        >
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-1 h-4 w-64" />
            <Skeleton className="mt-4 h-56 w-full rounded-xl" />
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
            aria-hidden="true"
        >
            <div className={cn('space-y-px bg-slate-200/60')}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 bg-white px-4 py-3.5"
                    >
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="ml-auto h-4 w-20" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function useReportLoading() {
    const [failed, setFailed] = useState(false);
    return { failed, setFailed };
}
