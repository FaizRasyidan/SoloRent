import type { ReportFilters, ReportTab } from '@/types/reports';

export function reportHref(
    filters: ReportFilters,
    tab: ReportTab,
    extra?: Record<string, string | number | null | undefined>,
): string {
    const p = new URLSearchParams();
    p.set('tab', tab);
    p.set('period', filters.period);
    if (filters.period === 'custom') {
        p.set('from', filters.from);
        p.set('to', filters.to);
    }
    if (filters.group && filters.group !== 'auto')
        p.set('group', filters.group);
    if (filters.category) p.set('category', filters.category);
    if (filters.vehicle) p.set('vehicle', String(filters.vehicle));
    if (extra) {
        for (const [k, v] of Object.entries(extra)) {
            if (v === null || v === undefined || v === '') continue;
            p.set(k, String(v));
        }
    }
    return `/admin/reports?${p.toString()}`;
}

export function exportHref(filters: ReportFilters, report: string): string {
    const p = new URLSearchParams();
    p.set('period', filters.period);
    if (filters.period === 'custom') {
        p.set('from', filters.from);
        p.set('to', filters.to);
    }
    if (filters.group && filters.group !== 'auto')
        p.set('group', filters.group);
    if (filters.category) p.set('category', filters.category);
    if (filters.vehicle) p.set('vehicle', String(filters.vehicle));
    if (filters.status) p.set('status', filters.status);
    if (filters.search) p.set('search', filters.search);
    p.set('report', report);
    return `/admin/reports/export?${p.toString()}`;
}
