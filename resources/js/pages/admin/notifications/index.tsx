import { Head, Link, router } from '@inertiajs/react';
import {
    Bell,
    Check,
    CheckCheck,
    CheckCircle2,
    CircleAlert,
    Info,
    TriangleAlert,
} from 'lucide-react';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { timeAgoID, type AdminNotificationItem } from '@/lib/notifications';

type Props = {
    notifications: {
        data: AdminNotificationItem[];
        links: { url: string | null; label: string; active: boolean }[];
    };
    filters: { level: string | null };
    unread: number;
    levels: string[];
};

const levelIcon: Record<string, typeof Bell> = {
    info: Info,
    action: Bell,
    success: CheckCircle2,
    warning: TriangleAlert,
    danger: CircleAlert,
};

const levelStyle: Record<string, string> = {
    info: 'bg-slate-100 text-slate-500',
    action: 'bg-sky-100 text-sky-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
};

const levelLabel: Record<string, string> = {
    info: 'Info',
    action: 'Perlu Tindakan',
    success: 'Berhasil',
    warning: 'Peringatan',
    danger: 'Mendesak',
};

export default function NotificationsIndex({
    notifications,
    filters,
    unread,
    levels,
}: Props) {
    const go = (level: string | null) => {
        router.get(
            '/admin/notifications',
            { level },
            { preserveState: true, replace: true },
        );
    };

    const markRead = (id: number) => {
        router.post(
            `/admin/notifications/${id}/read`,
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    const markAll = () => {
        router.post(
            '/admin/notifications/read-all',
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <AdminLayout title="Notifikasi">
            <Head title="Notifikasi" />
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
                        Notifikasi
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Booking & pembayaran terbaru dari customer · {unread}{' '}
                        belum dibaca.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={markAll}
                    disabled={unread === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <CheckCheck className="size-4" /> Tandai semua dibaca
                </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    key="all"
                    onClick={() => go(null)}
                    aria-pressed={!filters.level}
                    className={cn(
                        'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                        !filters.level
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                >
                    Semua
                </button>
                {levels.map((level) => {
                    const active = filters.level === level;
                    return (
                        <button
                            key={level}
                            onClick={() => go(level)}
                            aria-pressed={active}
                            className={cn(
                                'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                                active
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                            )}
                        >
                            {levelLabel[level] ?? level}
                        </button>
                    );
                })}
            </div>

            {notifications.data.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <Bell className="mx-auto size-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold">
                        Belum ada notifikasi pada filter ini.
                    </p>
                </div>
            ) : (
                <ul className="mt-4 space-y-2.5">
                    {notifications.data.map((n) => {
                        const Icon = (levelIcon[n.level] ??
                            Info) as typeof Bell;
                        const target = n.action_url ?? '/admin/notifications';
                        return (
                            <li
                                key={n.id}
                                className={cn(
                                    'flex gap-3.5 rounded-2xl border bg-white p-4',
                                    !n.read_at
                                        ? 'border-sky-200 bg-sky-50/40'
                                        : 'border-slate-200/80',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-10 shrink-0 items-center justify-center rounded-xl',
                                        levelStyle[n.level] ?? levelStyle.info,
                                    )}
                                >
                                    <Icon className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">
                                            {n.title}
                                        </p>
                                        {!n.read_at && (
                                            <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                                Baru
                                            </span>
                                        )}
                                    </div>
                                    {n.body && (
                                        <p className="mt-1 text-[13px] text-slate-600">
                                            {n.body}
                                        </p>
                                    )}
                                    <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
                                        {timeAgoID(n.created_at)} ·{' '}
                                        {n.created_display}
                                    </p>
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        <Link
                                            href={target}
                                            className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                                        >
                                            Lihat
                                        </Link>
                                        {!n.read_at && (
                                            <button
                                                type="button"
                                                onClick={() => markRead(n.id)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                            >
                                                <Check className="size-3.5" />{' '}
                                                Tandai dibaca
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                {notifications.links.map((l, i) => (
                    <Link
                        key={i}
                        href={l.url ?? '#'}
                        preserveState
                        className={cn(
                            'rounded-lg border px-3.5 py-2 text-xs font-semibold',
                            l.active
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600',
                            !l.url && 'pointer-events-none opacity-40',
                        )}
                    >
                        <span dangerouslySetInnerHTML={{ __html: l.label }} />
                    </Link>
                ))}
            </div>
        </AdminLayout>
    );
}
