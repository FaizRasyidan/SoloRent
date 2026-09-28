<?php

namespace App\Console\Commands;

use App\Models\AdminNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class PruneAdminNotifications extends Command
{
    protected $signature = 'admin:notifications:prune
        {--pretend : Tampilkan jumlah yang akan dihapus tanpa menghapus}';

    protected $description = 'Hapus notifikasi admin yang sudah dibaca dan berumur lebih dari 30 hari. Yang belum dibaca tidak pernah dihapus.';

    public function handle(): int
    {
        $query = AdminNotification::query()
            ->whereNotNull('read_at')
            ->where('read_at', '<', now()->subDays(30));

        if ($this->option('pretend')) {
            $this->comment('Akan dihapus: '.$query->count().' notifikasi (dry-run, tidak ada yang dihapus).');

            return self::SUCCESS;
        }

        $deleted = $query->delete();

        Log::info('admin.notifications.pruned', ['deleted' => $deleted]);
        $this->comment("Selesai: {$deleted} notifikasi lama dihapus.");

        return self::SUCCESS;
    }
}
