import { Link, router, usePage } from '@inertiajs/react';
import {
    Bell,
    Check,
    CheckCircle2,
    CircleAlert,
    Info,
    TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    emitAdminNotificationsUnread,
    timeAgoID,
    type AdminNotificationItem,
    type AdminNotificationLevel,
    type AdminNotificationsShared,
} from '@/lib/notifications';

const POLL_MS = 30000;

const levelIcon: Record<AdminNotificationLevel, typeof Bell> = {
    info: Info,
    action: Bell,
    success: CheckCircle2,
    warning: TriangleAlert,
    danger: CircleAlert,
};

const levelStyle: Record<AdminNotificationLevel, string> = {
    info: 'bg-slate-100 text-slate-500',
    action: 'bg-sky-100 text-sky-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
};

type FeedResponse = {
    unread: number;
    latest: AdminNotificationItem[];
};

export function AdminNotificationBell() {
    const { adminNotifications } = usePage().props as unknown as {
        adminNotifications?: AdminNotificationsShared;
    };
    const [unread, setUnread] = useState(adminNotifications?.unread ?? 0);
    const [items, setItems] = useState<AdminNotificationItem[]>([]);
    const [open, setOpen] = useState(false);
    const stopped = useRef(false);
    const openRef = useRef(false);
    const lastSeenId = useRef(0);
    openRef.current = open;

    const applyFeed = useCallback((feed: FeedResponse, announce: boolean) => {
        setUnread(feed.unread);
        emitAdminNotificationsUnread(feed.unread);
        setItems(feed.latest);

        const maxId = feed.latest.reduce(
            (m, n) => Math.max(m, n.id),
            lastSeenId.current,
        );
        if (announce && maxId > lastSeenId.current && !openRef.current) {
            const fresh = feed.latest.filter(
                (n) => n.id > lastSeenId.current && !n.read_at,
            );
            if (fresh.length === 1) {
                toast.info(fresh[0].title, {
                    description: fresh[0].body ?? undefined,
                });
            } else if (fresh.length > 1) {
                toast.info(`${fresh.length} notifikasi baru`, {
                    description: fresh[0].title,
                });
            }
        }
        lastSeenId.current = maxId;
    }, []);

    const fetchFeed = useCallback(
        async (announce: boolean) => {
            if (stopped.current) return;
            try {
                const res = await fetch('/admin/notifications/feed', {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                // Sesi habis: middleware meng-redirect ke halaman login (HTML).
                // Hentikan polling diam-diam alih-alih membanjiri console.
                const contentType = res.headers.get('content-type') ?? '';
                if (
                    !res.ok ||
                    res.redirected ||
                    !contentType.includes('application/json')
                ) {
                    stopped.current = true;
                    return;
                }
                const feed = (await res.json()) as FeedResponse;
                applyFeed(feed, announce);
            } catch {
                /* offline sesaat — coba lagi pada interval berikutnya */
            }
        },
        [applyFeed],
    );

    useEffect(() => {
        setUnread(adminNotifications?.unread ?? 0);
    }, [adminNotifications?.unread]);

    useEffect(() => {
        void fetchFeed(false);
        const timer = window.setInterval(() => {
            if (!document.hidden) void fetchFeed(true);
        }, POLL_MS);
        const onVisible = () => {
            if (!document.hidden) void fetchFeed(true);
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [fetchFeed]);

    const markRead = (id: number) => {
        setItems((prev) =>
            prev.map((n) =>
                n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
            ),
        );
        setUnread((u) => {
            const next = Math.max(0, u - 1);
            emitAdminNotificationsUnread(next);
            return next;
        });
        router.post(
            `/admin/notifications/${id}/read`,
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    const markAll = () => {
        setItems((prev) =>
            prev.map((n) => ({ ...n, read_at: new Date().toISOString() })),
        );
        setUnread(0);
        emitAdminNotificationsUnread(0);
        router.post(
            '/admin/notifications/read-all',
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={
                        unread > 0
                            ? `${unread} notifikasi belum dibaca`
                            : 'Notifikasi'
                    }
                    className="relative flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-[transform,background-color,color] duration-150 ease-out hover:bg-slate-50 hover:text-slate-900 active:scale-[0.96]"
                >
                    <Bell className="size-5" />
                    {unread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white tabular-nums">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-[min(92vw,380px)] p-0"
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                        Notifikasi
                        {unread > 0 && (
                            <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 tabular-nums">
                                {unread} baru
                            </span>
                        )}
                    </p>
                    <Link
                        href="/admin/notifications"
                        className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                        Lihat semua
                    </Link>
                </div>

                <div className="max-h-[380px] overflow-y-auto">
                    {items.length === 0 ? (
                        <p className="px-4 py-8 text-center text-xs text-slate-500">
                            Belum ada notifikasi. Booking & pembayaran customer
                            akan muncul di sini.
                        </p>
                    ) : (
                        items.map((n) => {
                            const Icon = levelIcon[n.level] ?? Info;
                            const target =
                                n.action_url ?? '/admin/notifications';
                            return (
                                <div
                                    key={n.id}
                                    className={cn(
                                        'flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0',
                                        !n.read_at && 'bg-sky-50/50',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex size-8 shrink-0 items-center justify-center rounded-lg',
                                            levelStyle[n.level] ??
                                                levelStyle.info,
                                        )}
                                    >
                                        <Icon className="size-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={target}
                                            className="block text-[13px] leading-snug font-semibold text-slate-900 hover:underline"
                                        >
                                            {n.title}
                                        </Link>
                                        {n.body && (
                                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                                {n.body}
                                            </p>
                                        )}
                                        <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                                            {timeAgoID(n.created_at)}
                                        </p>
                                    </div>
                                    {!n.read_at && (
                                        <button
                                            type="button"
                                            onClick={() => markRead(n.id)}
                                            title="Tandai sudah dibaca"
                                            aria-label={`Tandai dibaca: ${n.title}`}
                                            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                        >
                                            <Check className="size-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {unread > 0 && (
                    <button
                        type="button"
                        onClick={markAll}
                        className="w-full border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                    >
                        Tandai semua dibaca
                    </button>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
