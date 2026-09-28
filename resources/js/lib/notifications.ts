export type AdminNotificationLevel =
    | 'info'
    | 'action'
    | 'success'
    | 'warning'
    | 'danger';

export type AdminNotificationItem = {
    id: number;
    type: string;
    level: AdminNotificationLevel;
    title: string;
    body: string | null;
    action_url: string | null;
    read_at: string | null;
    created_at: string;
    created_display: string;
};

export type AdminNotificationsShared = {
    unread: number;
};

/** Event global agar badge sidebar ikut ter-update saat lonceng polling. */
export const ADMIN_NOTIFICATIONS_EVENT = 'admin-notifications:unread';

export function emitAdminNotificationsUnread(unread: number) {
    try {
        window.dispatchEvent(
            new CustomEvent<number>(ADMIN_NOTIFICATIONS_EVENT, {
                detail: unread,
            }),
        );
    } catch {
        /* non-browser / storage unavailable — abaikan */
    }
}

/** Waktu relatif Bahasa Indonesia: "baru saja", "5 menit lalu", … */
export function timeAgoID(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Math.max(0, Date.now() - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    return new Date(then).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
