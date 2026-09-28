export function rupiah(n: number): string {
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

export function formatDateID(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(d);
}

export function formatRangeID(start: string, end: string): string {
    const a = new Date(start + 'T00:00:00');
    const b = new Date(end + 'T00:00:00');
    const sameMonth =
        a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const dayMonth = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
    });
    const full = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    if (sameMonth) {
        return `${a.getDate()} – ${full.format(b)}`;
    }
    return `${dayMonth.format(a)} – ${full.format(b)}`;
}

export function durationDays(start: string, end: string): number {
    const ms =
        new Date(end + 'T00:00:00').getTime() -
        new Date(start + 'T00:00:00').getTime();
    return Math.max(1, Math.round(ms / 86400000));
}

export function todayISO(offsetDays = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
}

export function formatPercent(n: number): string {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(n)}%`;
}

export function formatDateShort(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function rupiahCompact(n: number): string {
    const v = new Intl.NumberFormat('id-ID', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(n);
    return `Rp${v}`;
}
