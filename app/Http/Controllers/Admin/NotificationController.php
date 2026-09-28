<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'level' => ['nullable', 'in:info,action,success,warning,danger'],
        ]);

        $level = $filters['level'] ?? null;

        $query = AdminNotification::query()
            ->when($level, fn ($q) => $q->where('level', $level))
            ->latest();

        $notifications = $query->paginate(15)->withQueryString()
            ->through(fn (AdminNotification $n) => $this->payload($n));

        return Inertia::render('admin/notifications/index', [
            'notifications' => $notifications,
            'filters' => ['level' => $level],
            'unread' => AdminNotification::unread()->count(),
            'levels' => AdminNotification::LEVELS,
        ]);
    }

    /**
     * Umpan ringan untuk polling lonceng (30 detik, berhenti saat tab hidden).
     */
    public function feed(): JsonResponse
    {
        $latest = AdminNotification::query()
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (AdminNotification $n) => $this->payload($n))
            ->all();

        return response()->json([
            'unread' => AdminNotification::unread()->count(),
            'latest' => $latest,
        ]);
    }

    public function read(AdminNotification $notification): RedirectResponse
    {
        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return redirect()->back();
    }

    public function readAll(): RedirectResponse
    {
        AdminNotification::unread()->update(['read_at' => now()]);

        return redirect()->back()->with('success', 'Semua notifikasi ditandai sudah dibaca.');
    }

    /** @return array<string, mixed> */
    private function payload(AdminNotification $notification): array
    {
        /** @var Carbon $createdAt */
        $createdAt = $notification->created_at;
        /** @var Carbon|null $readAt */
        $readAt = $notification->read_at;

        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'level' => $notification->level,
            'title' => $notification->title,
            'body' => $notification->body,
            'action_url' => $notification->action_url,
            'read_at' => $readAt?->toIso8601String(),
            'created_at' => $createdAt->toIso8601String(),
            'created_display' => $createdAt->format('d M Y H:i'),
        ];
    }
}
