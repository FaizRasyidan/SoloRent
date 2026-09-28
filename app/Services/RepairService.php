<?php

namespace App\Services;

use App\Models\DamageRecord;
use App\Models\MaintenanceRecord;
use App\Models\VehicleUnit;
use Illuminate\Support\Str;

/**
 * Satu pintu untuk Perbaikan otomatis dari Kerusakan (Opsi A).
 *
 * Prinsip ringkas: seluruh kerusakan milik satu unit dalam satu booking
 * digabung menjadi SATU entri Perbaikan (judul digabung ", ", biaya
 * dijumlah). Dipakai DamageController dan BookingController agar tidak
 * duplikasi logic.
 *
 * Penanda entri otomatis: damage_record_id NOT NULL. Entri manual
 * (damage_record_id NULL) tidak pernah digabung/diubah otomatis.
 * Sinkronisasi hanya menyentuh entri berstatus scheduled; yang sudah
 * berjalan/selesai adalah histori dan dibiarkan apa adanya.
 */
class RepairService
{
    /**
     * Selaraskan grup otomatis untuk pasangan booking+unit:
     * - masih ada kerusakan → pastikan 1 grup scheduled berisi
     *   gabungan judul & jumlah biaya (buat baru atau perbarui),
     * - tidak ada kerusakan tersisa → hapus grup scheduled.
     */
    public function syncAutoGroup(int $bookingId, ?int $unitId, ?int $createdBy = null): ?MaintenanceRecord
    {
        if (! $unitId) {
            return null;
        }

        $damages = DamageRecord::where('booking_id', $bookingId)
            ->where('vehicle_unit_id', $unitId)
            ->orderBy('id')
            ->get();

        $group = MaintenanceRecord::where('booking_id', $bookingId)
            ->where('vehicle_unit_id', $unitId)
            ->where('status', MaintenanceRecord::STATUS_SCHEDULED)
            ->where('source', MaintenanceRecord::SOURCE_AUTO)
            ->orderBy('id')
            ->first();

        if ($damages->isEmpty()) {
            $group?->delete();

            return null;
        }

        $title = Str::limit($damages->pluck('title')->implode(', '), 150, '');
        $cost = (int) $damages->sum('repair_cost');
        $description = Str::limit(
            $damages->map(fn (DamageRecord $d) => '- '.$d->title.($d->description ? ': '.$d->description : ''))->implode("\n"),
            2000
        );

        if ($group) {
            $group->update([
                'damage_record_id' => $damages->first()->id,
                'title' => $title,
                'description' => $description,
                'cost' => $cost,
            ]);

            return $group->fresh();
        }

        $unit = VehicleUnit::find($unitId);

        return MaintenanceRecord::create([
            'vehicle_unit_id' => $unitId,
            'booking_id' => $bookingId,
            'damage_record_id' => $damages->first()->id,
            'title' => $title,
            'description' => $description,
            'cost' => $cost,
            'priority' => MaintenanceRecord::PRIORITY_SEDANG,
            'status' => MaintenanceRecord::STATUS_SCHEDULED,
            'source' => MaintenanceRecord::SOURCE_AUTO,
            'unit_status_before' => $unit?->status,
            'created_by' => $createdBy,
        ]);
    }
}
