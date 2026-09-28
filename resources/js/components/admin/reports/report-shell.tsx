import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BasisInfo } from '@/types/reports';

export function SectionCard({
    title,
    subtitle,
    basis,
    action,
    children,
    index = 0,
    id,
}: {
    title: string;
    subtitle?: string;
    basis?: BasisInfo | null;
    action?: ReactNode;
    children: ReactNode;
    index?: number;
    id?: string;
}) {
    return (
        <section
            id={id}
            aria-label={title}
            className="report-card animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5"
            style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="mt-0.5 text-xs text-slate-500">
                            {subtitle}
                        </p>
                    )}
                    {basis && (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                            Berdasarkan {basis.column || 'data aktual'} ·{' '}
                            {basis.period} · {basis.vehicle} ·{' '}
                            {basis.timezone.replace('Asia/', '')}
                        </p>
                    )}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

export function CardGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
                className,
            )}
        >
            {children}
        </div>
    );
}
