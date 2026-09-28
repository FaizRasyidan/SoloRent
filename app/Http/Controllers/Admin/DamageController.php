<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreDamageRequest;
use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\DamageChargeItem;
use App\Models\DamageRecord;
use App\Models\VehicleUnit;
use App\Services\NotificationService;
use App\Services\PaymentService;
use App\Services\RepairService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DamageController extends Controller
{
    public function __construct(private NotificationService $notifications) {}

    /** Tambah kerusakan → record + item + (buat/recalc) charge + gabung ke Perbaikan, semua dalam transaction. */
    public function storeRecord(StoreDamageRequest $request, Booking $booking): RedirectResponse
    {
        abort_unless(in_array($booking->status, ['active', 'completed'], true), 422, 'Kerusakan hanya dapat dicatat setelah return inspection.');

        $result = DB::transaction(function () use ($request, $booking) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            $record = DamageRecord::create([
                'booking_id' => $locked->id,
                'vehicle_unit_id' => $request->validated('vehicle_unit_id') ?? $locked->vehicle_unit_id,
                'title' => $request->validated('title'),
                'description' => $request->validated('description'),
                'repair_cost' => $request->validated('repair_cost'),
                'photo_path' => $request->hasFile('photo') ? $request->file('photo')->store('damages', 'public') : null,
                'created_by' => $request->user()->id,
            ]);

            // IDOR: unit kerusakan harus milik kendaraan booking ini.
            if ($record->vehicle_unit_id) {
                $unitVehicleId = (int) VehicleUnit::whereKey($record->vehicle_unit_id)->value('vehicle_id');
                abort_if($unitVehicleId !== (int) $locked->vehicle_id, 403, 'Unit tidak sesuai dengan kendaraan booking ini.');
            }

            $charge = $locked->openDamageCharge() ?? DamageCharge::create([
                'booking_id' => $locked->id,
                'charge_code' => DamageCharge::generateCode(),
                'status' => DamageCharge::STATUS_UNPAID,
                'created_by' => $request->user()->id,
            ]);

            $charge->items()->create([
                'damage_record_id' => $record->id,
                'description' => $record->title,
                'amount' => $record->repair_cost,
            ]);
            $charge->recalculate();

            // Opsi A (ringkas): gabung ke 1 entri Perbaikan per unit per booking.
            $repair = app(RepairService::class)->syncAutoGroup($locked->id, $record->vehicle_unit_id, $request->user()->id);

            return ['charge' => $charge->fresh(), 'repair' => $repair];
        });

        $charge = $result['charge'];

        $this->notifications->damageChargeCreated($booking->fresh(), $charge);

        return redirect()->back()->with('success', "Kerusakan dicatat. Tagihan {$charge->charge_code} total Rp".number_format($charge->total, 0, ',', '.').'. Tercatat di Perbaikan.');
    }

    public function updateRecord(StoreDamageRequest $request, DamageRecord $record): RedirectResponse
    {
        $charge = $record->booking->damageCharges()->whereHas('items', fn ($q) => $q->where('damage_record_id', $record->id))->first();
        abort_if($charge && $charge->isLocked(), 422, 'Tagihan sudah terkunci dan tidak dapat diubah.');

        DB::transaction(function () use ($request, $record) {
            $oldBookingId = $record->booking_id;
            $oldUnitId = $record->vehicle_unit_id;

            $data = [
                'vehicle_unit_id' => $request->validated('vehicle_unit_id'),
                'title' => $request->validated('title'),
                'description' => $request->validated('description'),
                'repair_cost' => $request->validated('repair_cost'),
            ];
            if ($request->hasFile('photo')) {
                if ($record->photo_path && Storage::disk('public')->exists($record->photo_path)) {
                    Storage::disk('public')->delete($record->photo_path);
                }
                $data['photo_path'] = $request->file('photo')->store('damages', 'public');
            }
            $record->update($data);

            DamageChargeItem::where('damage_record_id', $record->id)->update([
                'description' => $record->title,
                'amount' => $record->repair_cost,
            ]);

            // Selaraskan grup Perbaikan (grup lama bila unit dipindah + grup baru).
            $service = app(RepairService::class);
            $fresh = $record->fresh();
            $service->syncAutoGroup($oldBookingId, $oldUnitId);
            $service->syncAutoGroup($fresh->booking_id, $fresh->vehicle_unit_id);

            foreach ($record->booking->damageCharges as $related) {
                if ($related->isOpen()) {
                    $related->recalculate();
                }
            }
        });

        return redirect()->back()->with('success', 'Data kerusakan berhasil diperbarui.');
    }

    public function destroyRecord(DamageRecord $record): RedirectResponse
    {
        $charge = $record->booking->damageCharges()->whereHas('items', fn ($q) => $q->where('damage_record_id', $record->id))->first();
        abort_if($charge && $charge->isLocked(), 422, 'Tagihan sudah terkunci dan tidak dapat diubah.');

        DB::transaction(function () use ($record) {
            $bookingId = $record->booking_id;
            $unitId = $record->vehicle_unit_id;

            DamageChargeItem::where('damage_record_id', $record->id)->delete();
            if ($record->photo_path && Storage::disk('public')->exists($record->photo_path)) {
                Storage::disk('public')->delete($record->photo_path);
            }
            $booking = $record->booking;
            $record->delete();

            // Selaraskan grup Perbaikan: susutkan gabungan, hapus grup bila kosong.
            app(RepairService::class)->syncAutoGroup($bookingId, $unitId);

            foreach ($booking->damageCharges as $related) {
                if ($related->isOpen()) {
                    $related->recalculate();
                }
            }
        });

        return redirect()->back()->with('success', 'Catatan kerusakan dihapus dan tagihan dihitung ulang.');
    }

    /** Item manual tanpa damage record (biaya tambahan yang ditetapkan admin). */
    public function storeItem(Request $request, DamageCharge $charge): RedirectResponse
    {
        abort_if($charge->isLocked(), 422, 'Tagihan sudah terkunci dan tidak dapat diubah.');

        $data = $request->validate([
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'integer', 'min:0', 'max:100000000'],
        ], [
            'description.required' => 'Deskripsi biaya wajib diisi.',
            'amount.required' => 'Nominal wajib diisi.',
            'amount.integer' => 'Nominal harus berupa angka.',
            'amount.min' => 'Nominal tidak boleh negatif.',
        ]);

        DB::transaction(function () use ($charge, $data) {
            $locked = DamageCharge::whereKey($charge->id)->lockForUpdate()->firstOrFail();
            abort_if($locked->isLocked(), 422, 'Tagihan sudah terkunci dan tidak dapat diubah.');
            $locked->items()->create(['description' => $data['description'], 'amount' => $data['amount']]);
            $locked->recalculate();
        });

        return redirect()->back()->with('success', 'Biaya tambahan ditambahkan ke tagihan.');
    }

    public function destroyItem(DamageChargeItem $item): RedirectResponse
    {
        $charge = $item->charge;
        abort_if($charge->isLocked(), 422, 'Tagihan sudah terkunci dan tidak dapat diubah.');

        DB::transaction(function () use ($item, $charge) {
            $locked = DamageCharge::whereKey($charge->id)->lockForUpdate()->firstOrFail();
            abort_if($locked->isLocked(), 422, 'Tagihan sudah terkunci dan tidak dapat diubah.');
            $item->delete();
            $locked->recalculate();
        });

        return redirect()->back()->with('success', 'Item tagihan dihapus dan total dihitung ulang.');
    }

    public function updateNotes(Request $request, DamageCharge $charge): RedirectResponse
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:1000']]);
        $charge->update(['notes' => $data['notes'] ?? null]);

        return redirect()->back()->with('success', 'Catatan tagihan diperbarui.');
    }

    public function waive(Request $request, DamageCharge $charge): RedirectResponse
    {
        abort_unless($charge->isOpen(), 422, 'Hanya tagihan terbuka yang dapat dibebaskan.');

        $data = $request->validate([
            'waived_reason' => ['required', 'string', 'max:500'],
        ], ['waived_reason.required' => 'Alasan pembebasan wajib diisi.']);

        $charge->update([
            'status' => DamageCharge::STATUS_WAIVED,
            'waived_reason' => $data['waived_reason'],
            'waived_by' => $request->user()->id,
            'waived_at' => now(),
        ]);

        return redirect()->back()->with('success', "Tagihan {$charge->charge_code} dibebaskan.");
    }

    public function cancelCharge(DamageCharge $charge): RedirectResponse
    {
        abort_unless($charge->isOpen(), 422, 'Hanya tagihan terbuka yang dapat dibatalkan.');
        abort_if($charge->paidTotal() > 0, 422, 'Tagihan yang sudah ada pembayaran tidak dapat dibatalkan.');

        $charge->update(['status' => DamageCharge::STATUS_CANCELLED]);

        return redirect()->back()->with('success', "Tagihan {$charge->charge_code} dibatalkan. Histori tetap tersimpan.");
    }

    /** Admin mencatat pembayaran damage offline (tunai/transfer) langsung lunas. */
    public function recordCash(Request $request, DamageCharge $charge): RedirectResponse
    {
        $data = $request->validate([
            'method' => ['required', 'in:bank_transfer,cash'],
            'notes' => ['nullable', 'string', 'max:500'],
            'proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ]);

        try {
            $payment = app(PaymentService::class)->recordDamageSettlement(
                $charge,
                $data['method'],
                $request->user()?->id,
                ['notes' => $data['notes'] ?? null],
                $request->file('proof')
            );
        } catch (HttpException $e) {
            return redirect()->back()->withErrors(['amount' => $e->getMessage()]);
        }

        app(NotificationService::class)->damagePaymentConfirmed($charge->booking, $charge->fresh(), $payment);

        return redirect()->back()->with('success', "Pembayaran tunai {$payment->payment_code} dicatat. Tagihan lunas.");
    }
}
