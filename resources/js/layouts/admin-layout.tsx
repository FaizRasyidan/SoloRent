import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'admin-sidebar-collapsed';

export default function AdminLayout({
    title = 'Dashboard',
    children,
    wide = false,
}: {
    title?: string;
    children: React.ReactNode;
    wide?: boolean;
}) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { flash } = usePage().props as unknown as {
        flash?: { success?: string };
    };

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash?.success]);

    useEffect(() => {
        try {
            setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
        } catch {
            /* storage unavailable — keep sidebar visible */
        }
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
            } catch {
                /* storage unavailable — state-only toggle */
            }
            return next;
        });
    };

    return (
        <div className="min-h-svh bg-[#F4F5F7] text-slate-800">
            {/* Desktop sidebar — collapses to an icon rail, logo stays visible */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:block',
                    collapsed ? 'w-20' : 'w-72',
                )}
            >
                <AdminSidebar collapsed={collapsed} />
            </aside>

            {/* Mobile drawer */}
            <div
                aria-hidden={!mobileOpen}
                onClick={() => setMobileOpen(false)}
                className={cn(
                    'fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 ease-out lg:hidden',
                    mobileOpen
                        ? 'opacity-100'
                        : 'pointer-events-none opacity-0',
                )}
            />
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            </aside>

            {/* Content area follows the sidebar width — no leftover gap */}
            <div
                className={cn(
                    'transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    collapsed ? 'lg:pl-20' : 'lg:pl-72',
                )}
            >
                <AdminTopbar
                    title={title}
                    onMenu={() => setMobileOpen(true)}
                    collapsed={collapsed}
                    onToggleSidebar={toggleCollapsed}
                />
                <main
                    className={cn(
                        'mx-auto w-full px-4 py-6 sm:px-6',
                        wide ? 'max-w-7xl' : 'max-w-6xl',
                    )}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
