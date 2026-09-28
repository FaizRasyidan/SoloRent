<?php

namespace App\Services\Insights;

use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\MaintenanceRecord;
use App\Models\Payment;
use App\Models\Refund;
use App\Support\Insights\AttentionItem;
use App\Support\Reports\ReportPeriod;
use Carbon\Carbon;

/**
 * Needs Attention: 7 rule LIVE (tanpa penyimpanan). Item hilang otomatis
 * saat masalah diperbaiki. Urutan: HIGH → MED → LOW.
 */
class NeedsAttentionService
{
    /** @return list<array<string, mixed>> */
    public function items(): array
    {
        $out = [];
        foreach ([
            $this->refundFailed(),
            $this->paymentVerification(),
            $this->refundPending(),
            $this->driverUnassigned(),
            $this->inspectionOverdue(),
            $this->damageUnpaid(),
            $this->maintenanceActive(),
        ] as $item) {
            if ($item instanceof AttentionItem && $item->count > 0) {
                $out[] = $item;
            }
        }

        $rank = ['high' => 0, 'medium' => 1, 'low' => 2];
        usort($out, fn (AttentionItem $a, AttentionItem $b) => ($rank[$a->priority] ?? 9) <=> ($rank[$b->priority] ?? 9));

        return array_map(fn (AttentionItem $i) => $i->toArray(), $out);
    }

    private function refundFailed(): ?AttentionItem
    {
        $count = Refund::query()->where('status', Refund::STATUS_FAILED)->count();
        if ($count < 1) {
            return null;
        }

        return new AttentionItem(
            id: 'refund_failed',
            priority: 'high',
            title: 'Refund gagal diproses',
            detail: "{$count} refund berstatus gagal — perlu tindak lanjut manual.",
            count: $count,
            actionUrl: '/admin/refunds?status=failed',
        );
    }

    private function paymentVerification(): ?AttentionItem
    {
        $count = Payment::query()->where('status', Payment::STATUS_SUBMITTED)->count();
        if ($count < 1) {
            return null;
        }

        return new AttentionItem(
            id: 'payment_verification',
            priority: 'high',
            title: 'Pembayaran menunggu verifikasi',
            detail: "{$count} pembayaran customer menunggu diverifikasi admin.",
            count: $count,
            actionUrl: '/admin/payments?status=submitted',
        );
    }

    private function refundPending(): ?AttentionItem
    {
        $count = Refund::query()->where('status', Refund::STATUS_PENDING)->count();
        if ($count < 1) {
            return null;
        }

        return new AttentionItem(
            id: 'refund_pending',
            priority: 'medium',
            title: 'Refund menunggu diproses',
            detail: "{$count} refund menunggu diproses ke manual transfer.",
            count: $count,
            actionUrl: '/admin/refunds?status=pending',
        );
    }

    private function driverUnassigned(): ?AttentionItem
    {
        $blocking = config('solorent.statuses_blocking_availability', ['pending', 'confirmed', 'preparing', 'active']);
        $count = Booking::query()
            ->where('with_driver', true)
            ->whereNull('driver_id')
            ->whereIn('status', $blocking)
            ->count();
        if ($count < 1) {
            return null;
        }

        return new AttentionItem(
            id: 'driver_unassigned',
            priority: 'medium',
            title: 'Booking belum dapat driver',
            detail: "{$count} booking ber-driver belum memiliki driver.",
            count: $count,
            actionUrl: '/admin/bookings?driver=unassigned',
        );
    }

    private function inspectionOverdue(): ?AttentionItem
    {
        $today = Carbon::now(ReportPeriod::TIMEZONE)->toDateString();
        $count = Booking::query()
            ->where('status', 'active')
            ->whereDate('end_date', '<', $today)
            ->whereNull('returned_at')
            ->count();
        if ($count < 1) {
            return null;
        }

        return new AttentionItem(
            id: 'inspection_overdue',
            priority: 'medium',
            title: 'Pengembalian lewat jatuh tempo',
            detail: "{$count} sewa aktif melewati tanggal selesai tanpa inspeksi pengembalian.",
            count: $count,
            actionUrl: '/admin/bookings?status=active',
        );
    }

    private function damageUnpaid(): ?AttentionItem
    {
        $count = DamageCharge::query()
            ->whereIn('status', [DamageCharge::STATUS_UNPAID, DamageCharge::STATUS_PARTIAL])
            ->count();
        if ($count < 1) {
            return null;
        }

        return new AttentionItem(
            id: 'damage_unpaid',
            priority: 'medium',
            title: 'Tagihan kerusakan belum dibayar',
            detail: "{$count} tagihan kerusakan berstatus belum lunas.",
            count: $count,
            actionUrl: '/admin/reports?tab=damage',
        );
    }

    private function maintenanceActive(): ?AttentionItem
    {
        $count = MaintenanceRecord::query()
            ->whereIn('status', [MaintenanceRecord::STATUS_SCHEDULED, MaintenanceRecord::STATUS_IN_PROGRESS])
            ->distinct()
            ->count('vehicle_unit_id');
        if ($count < 1) {
            return null;
        }

        return new AttentionItem(
            id: 'maintenance_active',
            priority: 'low',
            title: 'Unit dalam perbaikan',
            detail: "{$count} unit sedang dalam perawatan terjadwal/berjalan.",
            count: $count,
            actionUrl: '/admin/repairs?status=in_progress',
        );
    }
}
