<?php

use App\Models\DamageRecord;
use App\Models\MaintenanceRecord;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

/**
 * Gabungkan entri Perbaikan otomatis yang terpecah (satu baris per
 * kerusakan) menjadi satu baris per unit per booking.
 *
 * Hanya menyentuh entri otomatis (damage_record_id NOT NULL) yang masih
 * terjadwal; histori berjalan/selesai dibiarkan apa adanya.
 * Tidak dapat dikembalikan (down kosong).
 */
return new class extends Migration
{
    public function up(): void
    {
        $groups = MaintenanceRecord::where('status', MaintenanceRecord::STATUS_SCHEDULED)
            ->whereNotNull('damage_record_id')
            ->whereNotNull('booking_id')
            ->whereNotNull('vehicle_unit_id')
            ->orderBy('id')
            ->get()
            ->groupBy(fn (MaintenanceRecord $r) => $r->booking_id.'_'.$r->vehicle_unit_id);

        $severity = ['rendah' => 0, 'sedang' => 1, 'tinggi' => 2, 'darurat' => 3];

        foreach ($groups as $rows) {
            if ($rows->count() < 2) {
                continue;
            }

            /** @var MaintenanceRecord $survivor */
            $survivor = $rows->sortBy('id')->first();
            $others = $rows->where('id', '!==', $survivor->id);

            $damages = DamageRecord::where('booking_id', $survivor->booking_id)
                ->where('vehicle_unit_id', $survivor->vehicle_unit_id)
                ->orderBy('id')
                ->get();

            if ($damages->isEmpty()) {
                continue;
            }

            $survivor->update([
                'title' => Str::limit($damages->pluck('title')->implode(', '), 150, ''),
                'description' => Str::limit(
                    $damages->map(fn (DamageRecord $d) => '- '.$d->title.($d->description ? ': '.$d->description : ''))->implode("\n"),
                    2000
                ),
                'cost' => (int) $damages->sum('repair_cost'),
                'priority' => $rows->sortByDesc(fn (MaintenanceRecord $r) => $severity[$r->priority] ?? 1)->first()->priority,
                'estimated_completed_at' => $rows->whereNotNull('estimated_completed_at')->min('estimated_completed_at'),
            ]);

            MaintenanceRecord::whereKey($others->pluck('id')->all())->delete();
        }
    }

    public function down(): void
    {
        // Penggabungan tidak dapat dikembalikan.
    }
};
