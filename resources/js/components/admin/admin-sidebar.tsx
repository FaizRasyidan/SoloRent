import { Link, usePage } from '@inertiajs/react';
import {
    Bell,
    Bike,
    CalendarDays,
    CarFront,
    ChartNoAxesCombined,
    ClipboardList,
    LayoutDashboard,
    LogOut,
    RotateCcw,
    Settings,
    Users,
    Wallet,
    Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
    ADMIN_NOTIFICATIONS_EVENT,
    type AdminNotificationsShared,
} from '@/lib/notifications';
import type { User } from '@/types';

type Item = {
    title: string;
    icon: typeof LayoutDashboard;
    href?: string;
    badge?: string;
    /** Badge angka live dari lonceng (bukan label statis). */
    liveBadge?: boolean;
    disabled?: boolean;
};

const sections: { label: string; items: Item[] }[] = [
    {
        label: 'Dashboard',
        items: [
            {
                title: 'Dashboard',
                icon: LayoutDashboard,
                href: '/admin/dashboard',
            },
        ],
    },
    {
        label: 'Rental',
        items: [
            { title: 'Kendaraan', icon: CarFront, href: '/admin/vehicles' },
            { title: 'Booking', icon: ClipboardList, href: '/admin/bookings' },
            { title: 'Perbaikan', icon: Wrench, href: '/admin/repairs' },
            {
                title: 'Operasional',
                icon: CalendarDays,
                href: '/admin/operations',
            },
            { title: 'Driver', icon: Users, href: '/admin/drivers' },
        ],
    },
    {
        label: 'Finance',
        items: [
            { title: 'Pembayaran', icon: Wallet, href: '/admin/payments' },
            { title: 'Refund', icon: RotateCcw, href: '/admin/refunds' },
        ],
    },
    {
        label: 'Analytics',
        items: [
            {
                title: 'Laporan',
                icon: ChartNoAxesCombined,
                href: '/admin/reports',
            },
        ],
    },
    {
        label: 'Sistem',
        items: [
            {
                title: 'Notifikasi',
                icon: Bell,
                href: '/admin/notifications',
                liveBadge: true,
            },
            {
                title: 'Pengaturan',
                icon: Settings,
                badge: 'Segera',
                disabled: true,
            },
        ],
    },
];

export function AdminSidebar({
    onNavigate,
    collapsed = false,
}: {
    onNavigate?: () => void;
    collapsed?: boolean;
}) {
    const page = usePage();
    const { auth } = page.props as unknown as { auth: { user: User | null } };
    const user = auth.user;
    const { adminNotifications } = page.props as unknown as {
        adminNotifications?: AdminNotificationsShared;
    };
    const [unread, setUnread] = useState(adminNotifications?.unread ?? 0);

    useEffect(() => {
        setUnread(adminNotifications?.unread ?? 0);
    }, [adminNotifications?.unread]);

    useEffect(() => {
        const onUnread = (e: Event) => {
            const detail = (e as CustomEvent<number>).detail;
            if (typeof detail === 'number') setUnread(detail);
        };
        window.addEventListener(ADMIN_NOTIFICATIONS_EVENT, onUnread);
        return () =>
            window.removeEventListener(ADMIN_NOTIFICATIONS_EVENT, onUnread);
    }, []);
    const currentPath = page.url.split('?')[0];
    const isActive = (href: string, exact = false) =>
        exact
            ? currentPath === href
            : currentPath === href || currentPath.startsWith(`${href}/`);

    const linkCls = (active: boolean) =>
        cn(
            'relative flex items-center rounded-lg transition-[background-color,color] duration-150 ease-out',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
            active
                ? 'bg-slate-900 font-semibold text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        );

    const disabledCls = cn(
        'flex items-center rounded-lg text-slate-400',
        collapsed
            ? 'cursor-not-allowed justify-center px-0 py-2.5'
            : 'cursor-not-allowed gap-3 px-3 py-2',
    );

    return (
        <div className="flex h-full flex-col border-r border-slate-200/80 bg-white">
            <div
                className={cn(
                    'flex items-center gap-3 pt-6 pb-5',
                    collapsed ? 'justify-center px-2' : 'px-5',
                )}
            >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FF9137] text-[#241203]">
                    <Bike className="size-5" strokeWidth={2.25} />
                </div>
                {!collapsed && (
                    <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                            SoloRent
                        </p>
                        <p className="text-xs text-slate-500">Panel Admin</p>
                    </div>
                )}
            </div>

            <nav
                className={cn(
                    'flex-1 space-y-6 overflow-y-auto pb-4',
                    collapsed ? 'px-2' : 'px-3',
                )}
            >
                {sections.map((section) => (
                    <div key={section.label}>
                        {!collapsed && (
                            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                                {section.label}
                            </p>
                        )}
                        <ul className="space-y-1">
                            {section.items.map((item) => {
                                const liveCount = item.liveBadge ? unread : 0;
                                const content = (
                                    <>
                                        <item.icon
                                            className="size-[18px] shrink-0 opacity-75"
                                            strokeWidth={2}
                                        />
                                        {!collapsed && (
                                            <span className="flex-1 truncate text-sm font-medium">
                                                {item.title}
                                            </span>
                                        )}
                                        {!collapsed && liveCount > 0 && (
                                            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white tabular-nums">
                                                {liveCount > 99
                                                    ? '99+'
                                                    : liveCount}
                                            </span>
                                        )}
                                        {!collapsed &&
                                            liveCount === 0 &&
                                            item.badge && (
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400">
                                                    {item.badge}
                                                </span>
                                            )}
                                        {collapsed && liveCount > 0 && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500"
                                            />
                                        )}
                                    </>
                                );

                                if (item.disabled || !item.href) {
                                    return (
                                        <li key={item.title}>
                                            <span
                                                aria-disabled="true"
                                                title={
                                                    collapsed
                                                        ? item.title
                                                        : `${item.title} — tersedia di phase berikutnya`
                                                }
                                                className={disabledCls}
                                            >
                                                {content}
                                            </span>
                                        </li>
                                    );
                                }

                                return (
                                    <li key={item.title}>
                                        <Link
                                            href={item.href}
                                            onClick={onNavigate}
                                            title={
                                                collapsed
                                                    ? item.title
                                                    : undefined
                                            }
                                            aria-label={item.title}
                                            className={linkCls(
                                                isActive(
                                                    item.href,
                                                    item.href ===
                                                        '/admin/dashboard',
                                                ),
                                            )}
                                        >
                                            {content}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            <div
                className={cn(
                    'border-t border-slate-200/80',
                    collapsed ? 'p-2' : 'p-4',
                )}
            >
                {collapsed ? (
                    <div className="flex flex-col items-center gap-2 py-1">
                        <span
                            title={`${user?.name ?? 'Admin'} — ${user?.email ?? ''}`}
                            className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700"
                        >
                            {(user?.name ?? 'A').slice(0, 1).toUpperCase()}
                        </span>
                        <Link
                            href="/admin/logout"
                            method="post"
                            as="button"
                            title="Keluar"
                            aria-label="Keluar"
                            className="flex size-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        >
                            <LogOut className="size-[18px]" />
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                        <p className="truncate text-sm font-semibold text-slate-900">
                            {user?.name ?? 'Admin'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                            {user?.email ?? 'admin@solorent.test'}
                        </p>
                        <Link
                            href="/admin/logout"
                            method="post"
                            as="button"
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-slate-700 active:scale-[0.98]"
                        >
                            <LogOut className="size-4" />
                            Keluar
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
