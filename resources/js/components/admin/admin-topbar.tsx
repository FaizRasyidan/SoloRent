import { Link, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    Settings,
    UserRound,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { User } from '@/types';
import { AdminNotificationBell } from '@/components/admin/admin-notification-bell';

type Props = {
    title: string;
    onMenu: () => void;
    collapsed: boolean;
    onToggleSidebar: () => void;
};

export function AdminTopbar({
    title,
    onMenu,
    collapsed,
    onToggleSidebar,
}: Props) {
    const { auth } = usePage().props as unknown as {
        auth: { user: User | null };
    };
    const user = auth.user;

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2.5 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6">
            {/* Mobile: open drawer */}
            <button
                type="button"
                onClick={onMenu}
                aria-label="Buka menu navigasi"
                className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-[transform,background-color] duration-150 ease-out hover:bg-slate-50 active:scale-[0.96] lg:hidden"
            >
                <Menu className="size-5" />
            </button>

            {/* Desktop: hide / show sidebar */}
            <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={
                    collapsed ? 'Bentangkan sidebar' : 'Ciutkan sidebar'
                }
                title={collapsed ? 'Bentangkan sidebar' : 'Ciutkan sidebar'}
                className="hidden size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-[transform,background-color,color] duration-150 ease-out hover:bg-slate-50 hover:text-slate-900 active:scale-[0.96] lg:flex"
            >
                {collapsed ? (
                    <PanelLeftOpen className="size-5" />
                ) : (
                    <PanelLeftClose className="size-5" />
                )}
            </button>

            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-slate-900">
                {title}
            </h1>

            <AdminNotificationBell />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pr-2.5 pl-1.5 transition-[background-color,transform] duration-150 ease-out hover:bg-slate-50 active:scale-[0.98]"
                    >
                        <span className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                            {(user?.name ?? 'A').slice(0, 1).toUpperCase()}
                        </span>
                        <span className="hidden max-w-32 truncate text-left text-sm font-medium text-slate-800 sm:block">
                            {user?.name ?? 'Admin'}
                        </span>
                        <ChevronDown className="size-4 text-slate-400" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="font-normal">
                        <p className="truncate text-sm font-semibold">
                            {user?.name ?? 'Admin'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {user?.email ?? ''}
                        </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <UserRound className="size-4" /> Profil
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                        <Settings className="size-4" /> Pengaturan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link
                            href="/admin/logout"
                            method="post"
                            as="button"
                            className="w-full cursor-pointer"
                        >
                            <LogOut className="size-4" /> Keluar
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
