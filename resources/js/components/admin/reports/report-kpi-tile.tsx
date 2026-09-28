import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const tones: Record<string, string> = {
    default: 'bg-slate-100 text-slate-500',
    money: 'bg-slate-900 text-white',
    success: 'bg-emerald-100 text-emerald-700',
    warn: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    info: 'bg-sky-100 text-sky-700',
};

export function KpiTile({
    icon: Icon,
    label,
    value,
    hint,
    href,
    tone = 'default',
    index = 0,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    hint?: string;
    href?: string;
    tone?: keyof typeof tones;
    index?: number;
}) {
    const inner = (
        <>
            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] font-medium text-slate-500">
                    {label}
                </p>
                <span
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        tones[tone] ?? tones.default,
                    )}
                >
                    <Icon className="size-[18px]" strokeWidth={2} />
                </span>
            </div>
            <p
                className="mt-2 truncate text-[26px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums"
                title={value}
            >
                {value}
            </p>
            {hint && (
                <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                    {hint}
                </p>
            )}
        </>
    );

    const cls =
        'animate-fade-up block rounded-2xl border border-slate-200/80 bg-white p-5 transition-[box-shadow,border-color,transform] duration-150 ease-out';

    if (href) {
        return (
            <Link
                href={href}
                className={cn(
                    cls,
                    'hover:border-slate-300 hover:shadow-sm active:scale-[0.99]',
                )}
                style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                aria-label={`${label}: ${value}`}
            >
                {inner}
            </Link>
        );
    }

    return (
        <div
            className={cls}
            style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
        >
            {inner}
        </div>
    );
}
