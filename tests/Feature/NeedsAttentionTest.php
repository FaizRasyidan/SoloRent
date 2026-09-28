<?php

use App\Models\MaintenanceRecord;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\Insights\NeedsAttentionService;
use App\Services\PaymentService;
use Carbon\Carbon;
use Inertia\Testing\AssertableInertia;

function attentionItems(): array
{
    return app(NeedsAttentionService::class)->items();
}

test('no problems yields no attention items', function () {
    expect(attentionItems())->toBeEmpty();
});

test('failed refund raises high priority item and disappears when completed', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $refund = Refund::create([
        'booking_id' => $booking->id,
        'refund_code' => Refund::generateCode(),
        'amount' => 100000,
        'status' => Refund::STATUS_FAILED,
        'reason' => 'Uji attention',
        'channel' => Refund::CHANNEL_MANUAL,
    ]);

    $items = attentionItems();
    $ids = array_column($items, 'id');
    expect($ids)->toContain('refund_failed');
    $item = collect($items)->firstWhere('id', 'refund_failed');
    expect($item['priority'])->toBe('high')
        ->and($item['action_url'])->toBe('/admin/refunds?status=failed');

    // Auto-expire: masalah diperbaiki → item hilang tanpa hapus manual.
    $refund->status = Refund::STATUS_COMPLETED;
    $refund->save();

    expect(array_column(attentionItems(), 'id'))->not->toContain('refund_failed');
});

test('submitted payment raises high priority item with correct link', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    Payment::create([
        'booking_id' => $booking->id,
        'payment_code' => app(PaymentService::class)->generatePaymentCode(),
        'type' => 'full_payment',
        'method' => 'bank_transfer',
        'amount' => 100000,
        'status' => Payment::STATUS_SUBMITTED,
        'submitted_at' => now(),
    ]);

    $items = attentionItems();
    $item = collect($items)->firstWhere('id', 'payment_verification');
    expect($item)->not->toBeNull()
        ->and($item['priority'])->toBe('high')
        ->and($item['action_url'])->toBe('/admin/payments?status=submitted');
});

test('overdue inspection appears and clears after return', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $booking->status = 'active';
    $booking->start_date = Carbon::today()->subDays(5)->toDateString();
    $booking->end_date = Carbon::today()->subDay()->toDateString();
    $booking->returned_at = null;
    $booking->save();

    expect(array_column(attentionItems(), 'id'))->toContain('inspection_overdue');

    $booking->returned_at = now();
    $booking->save();

    expect(array_column(attentionItems(), 'id'))->not->toContain('inspection_overdue');
});

test('unpaid damage charge links to damage report tab', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    datedDamageCharge($booking, 150000);

    $items = attentionItems();
    $item = collect($items)->firstWhere('id', 'damage_unpaid');
    expect($item)->not->toBeNull()
        ->and($item['action_url'])->toBe('/admin/reports?tab=damage');
});

test('active maintenance counts distinct units as low priority', function () {
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle);
    MaintenanceRecord::create([
        'vehicle_unit_id' => $unit->id,
        'title' => 'Ganti oli',
        'status' => MaintenanceRecord::STATUS_IN_PROGRESS,
    ]);

    $items = attentionItems();
    $item = collect($items)->firstWhere('id', 'maintenance_active');
    expect($item)->not->toBeNull()
        ->and($item['priority'])->toBe('low')
        ->and($item['action_url'])->toBe('/admin/repairs?status=in_progress');
});

test('high priority items sort before medium and low', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $unit = makeUnit($vehicle);
    MaintenanceRecord::create([
        'vehicle_unit_id' => $unit->id,
        'title' => 'Ganti oli',
        'status' => MaintenanceRecord::STATUS_SCHEDULED,
    ]);
    Refund::create([
        'booking_id' => $booking->id,
        'refund_code' => Refund::generateCode(),
        'amount' => 50000,
        'status' => Refund::STATUS_PENDING,
        'reason' => 'Uji urutan',
        'channel' => Refund::CHANNEL_MANUAL,
    ]);
    Payment::create([
        'booking_id' => $booking->id,
        'payment_code' => app(PaymentService::class)->generatePaymentCode(),
        'type' => 'full_payment',
        'method' => 'bank_transfer',
        'amount' => 100000,
        'status' => Payment::STATUS_SUBMITTED,
        'submitted_at' => now(),
    ]);

    $priorities = array_column(attentionItems(), 'priority');

    expect($priorities[0])->toBe('high')
        ->and($priorities)->toContain('medium')
        ->and($priorities)->toContain('low');
    expect(end($priorities))->toBe('low');
});

test('dashboard attention card shows at most all live items', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    Refund::create([
        'booking_id' => $booking->id,
        'refund_code' => Refund::generateCode(),
        'amount' => 50000,
        'status' => Refund::STATUS_PENDING,
        'reason' => 'Uji kartu',
        'channel' => Refund::CHANNEL_MANUAL,
    ]);

    $this->get('/admin/dashboard')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->where('kpis.attention_count', 1)
            ->has('attention.items', 1)
    );
});
