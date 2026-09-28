import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';

export function ReportPagination({
    links,
}: {
    links: { url: string | null; label: string; active: boolean }[];
}) {
    if (!links || links.length <= 3) return null;

    return (
        <nav
            aria-label="Navigasi halaman"
            className="mt-4 flex flex-wrap gap-2"
        >
            {links.map((l, i) => (
                <Link
                    key={i}
                    href={l.url ?? '#'}
                    preserveState
                    preserveScroll
                    className={cn(
                        'rounded-lg border px-3.5 py-2 text-xs font-semibold',
                        l.active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                        !l.url && 'pointer-events-none opacity-40',
                    )}
                >
                    <span dangerouslySetInnerHTML={{ __html: l.label }} />
                </Link>
            ))}
        </nav>
    );
}

export function ReportTableShell({
    minWidth = 720,
    children,
    label,
}: {
    minWidth?: number;
    children: React.ReactNode;
    label: string;
}) {
    return (
        <div
            className="report-table -mx-5 overflow-x-auto px-5"
            role="region"
            aria-label={label}
            tabIndex={0}
        >
            <table className="w-full text-left text-sm" style={{ minWidth }}>
                {children}
            </table>
        </div>
    );
}

export function ReportTableHead({
    columns,
}: {
    columns: { label: string; align?: 'left' | 'right' }[];
}) {
    return (
        <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
                {columns.map((c) => (
                    <th
                        key={c.label}
                        scope="col"
                        className={cn(
                            'py-2.5 pr-4 font-medium whitespace-nowrap last:pr-0',
                            c.align === 'right' && 'text-right',
                        )}
                    >
                        {c.label}
                    </th>
                ))}
            </tr>
        </thead>
    );
}
