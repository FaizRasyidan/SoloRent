<?php

use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\DamageRecord;
use App\Models\MaintenanceRecord;
use App\Models\NotificationLog;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;

/** Booking aktif siap return: confirm → paid → unit → ready → handover → active. */
function activeBooking(Vehicle $vehicle, array $overrides = []): Booking
{
    $admin = User::where('email', 'admin@solorent.test')->first() ?? makeAdmin();
    test()->actingAs($admin);
    $unit = makeUnit($vehicle);
    $booking = operationalBooking($vehicle, $overrides);
    $code = $booking->booking_code;

    test()->post("/admin/bookings/{$code}/confirm")->assertRedirect();
    payOperationalDp($booking);
    test()->post("/admin/bookings/{$code}/assign-unit", ['vehicle_unit_id' => $unit->id])->assertRedirect();
    test()->post("/admin/bookings/{$code}/ready")->assertRedirect();
    test()->post("/admin/bookings/{$code}/handover", [
        'checklist' => ['body', 'lampu', 'ban', 'rem', 'spion', 'stnk', 'kunci', 'bbm'],
    ])->assertRedirect();
    test()->post("/admin/bookings/{$code}/activate")->assertRedirect();

    return $booking->fresh();
}

function damagePayload(array $overrides = []): array
{
    return array_merge([
        'title' => 'Spion kanan pecah',
        'description' => 'Spion kanan rusak akibat benturan.',
        'repair_cost' => 150000,
    ], $overrides);
}

// ---------- Cancellation ----------

test('customer can cancel eligible booking with reason', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Jadwal berubah',
    ])->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('cancelled')
        ->and($booking->cancel_reason)->toBe('Jadwal berubah')
        ->and($booking->cancelled_by_type)->toBe('customer')
        ->and($booking->cancelled_at)->not->toBeNull();

    // Availability released: same period bookable again.
    $this->post('/booking', bookingPayload($vehicle))->assertRedirect();
    expect(Booking::where('status', 'pending')->count())->toBe(1);
});

test('customer cancellation is guarded', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    // Missing reason rejected.
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
    ])->assertSessionHasErrors('cancel_reason');

    // Wrong phone rejected.
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '080000000000',
        'cancel_reason' => 'Iseng',
    ])->assertForbidden();

    // Phase 7A: confirmed is eligible — active is not.
    $booking->update(['status' => 'confirmed']);
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Berubah pikiran',
    ])->assertRedirect();
    expect($booking->fresh()->status)->toBe('cancelled');

    $vehicle2 = makeVehicle(['slug' => 'motor-aktif', 'name' => 'Motor Aktif', 'price_per_day' => 90000]);
    $active = operationalBooking($vehicle2);
    $active->update(['status' => 'active']);
    $this->post("/booking/{$active->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Berubah pikiran',
    ])->assertSessionHasErrors('cancel_reason');
    expect($active->fresh()->status)->toBe('active');
});

test('admin cancellation requires reason and cancelled booking rejects new damage', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/cancel", [])
        ->assertSessionHasErrors('cancel_reason');

    $this->post("/admin/bookings/{$booking->booking_code}/cancel", ['cancel_reason' => 'Unit mogok'])
        ->assertRedirect();
    expect($booking->fresh()->cancelled_by_type)->toBe('admin');

    // No damage charge allowed on cancelled booking.
    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload())
        ->assertStatus(422);
    $this->assertDatabaseCount('damage_records', 0);
});

// ---------- Damage records & charge ----------

test('admin can create damage with photo and charge totals server-side', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/return", [
        'return_condition' => 'damage',
        'return_fuel' => '3/4',
        'damages' => [
            array_merge(damagePayload(), ['repair_cost' => 75000]),
            ['title' => 'Cat body kiri', 'description' => 'Baret dalam.', 'repair_cost' => 250000],
        ],
    ])->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('completed')
        ->and($booking->total)->toBe(255000);

    $charge = $booking->damageCharges()->first();
    expect($charge->charge_code)->toMatch('/^DC-\d{8}-\d{4}$/')
        ->and($charge->total)->toBe(325000)
        ->and($charge->status)->toBe('unpaid')
        ->and($booking->total)->toBe(255000);

    // Second charge code stays unique.
    $vehicle2 = makeVehicle(['slug' => 'yamaha-nmax', 'name' => 'Yamaha NMAX', 'price_per_day' => 110000]);
    $booking2 = activeBooking($vehicle2);
    $this->post("/admin/bookings/{$booking2->booking_code}/damages", damagePayload());
    expect($booking2->damageCharges()->first()->charge_code)->not->toBe($charge->charge_code);
});

test('damage photo validation rejects non-images', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", array_merge(damagePayload(), [
        'photo' => UploadedFile::fake()->create('note.txt', 10, 'text/plain'),
    ]))->assertSessionHasErrors('photo');

    $this->assertDatabaseCount('damage_records', 0);
});

test('damage repair cost is validated server-side', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['repair_cost' => -5000]))
        ->assertSessionHasErrors('repair_cost');
    $this->assertDatabaseCount('damage_charges', 0);
});

test('normal return creates no damage charge', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/return", [
        'return_condition' => 'normal',
        'return_fuel' => 'Penuh',
    ])->assertRedirect();

    expect($booking->fresh()->status)->toBe('completed');
    $this->assertDatabaseCount('damage_charges', 0);
});

// ---------- Damage payment ----------

test('customer can pay damage charge and receipt is shown', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['repair_cost' => 150000]))
        ->assertRedirect();
    $charge = $booking->damageCharges()->first();

    // Unverified gate (labels live in JS bundle — props carry the code).
    $this->get("/booking/damage/{$charge->charge_code}")
        ->assertOk()->assertSee($charge->charge_code);

    // Verified page shows separated charge (booking total untouched).
    $this->get("/booking/damage/{$charge->charge_code}?phone=081234567890")
        ->assertOk()
        ->assertSee($charge->charge_code)
        ->assertSee('"total":150000', false);

    // Pay: amount comes from server; customer cannot alter it.
    $this->post("/booking/damage/{$charge->charge_code}/pay", [
        'customer_phone' => '081234567890',
        'method' => 'bank_transfer',
        'proof' => fakeImage('bukti.png'),
    ])->assertRedirect();

    $payment = Payment::where('damage_charge_id', $charge->id)->first();
    expect($payment->amount)->toBe(150000)
        ->and($payment->type)->toBe('damage')
        ->and($payment->status)->toBe('submitted');

    // Duplicate payment while one is open is prevented.
    $this->post("/booking/damage/{$charge->charge_code}/pay", [
        'customer_phone' => '081234567890',
        'method' => 'bank_transfer',
        'proof' => fakeImage('bukti2.png'),
    ])->assertSessionHasErrors('amount');

    // Admin verifies → paid, outstanding 0, booking total unchanged.
    $this->post("/admin/payments/{$payment->payment_code}/confirm")->assertRedirect();

    $charge->refresh();
    $booking->refresh();
    expect($charge->status)->toBe('paid')
        ->and($charge->outstanding())->toBe(0)
        ->and($booking->total)->toBe(255000)
        ->and($booking->paidTotal())->toBe(255000);

    $this->get("/booking/damage/{$charge->charge_code}?phone=081234567890")
        ->assertOk()
        ->assertSee('"status":"paid"', false)
        ->assertSee($payment->payment_code);

    // Paid charge already settled: no new payment can be created.
    $this->post("/booking/damage/{$charge->charge_code}/pay", [
        'customer_phone' => '081234567890',
        'method' => 'bank_transfer',
        'proof' => fakeImage('bukti3.png'),
    ])->assertSessionHasErrors('amount');
});

test('customer cannot see another customer damage charge', function () {
    $vehicle = makeVehicle();
    $bookingA = activeBooking($vehicle);
    $vehicle2 = makeVehicle(['slug' => 'motor-lain', 'name' => 'Motor Lain', 'price_per_day' => 90000]);
    $bookingB = activeBooking($vehicle2, ['customer_phone' => '089999999999']);

    $this->post("/admin/bookings/{$bookingA->booking_code}/damages", damagePayload());
    $chargeA = $bookingA->damageCharges()->first();

    // B's phone against A's charge → gate stays closed (no items leaked in props).
    $this->get("/booking/damage/{$chargeA->charge_code}?phone=089999999999")
        ->assertOk()
        ->assertSee($chargeA->charge_code)
        ->assertDontSee('Spion kanan pecah');

    $this->post("/booking/damage/{$chargeA->charge_code}/pay", [
        'customer_phone' => '089999999999',
        'method' => 'bank_transfer',
        'proof' => fakeImage('x.png'),
    ])->assertForbidden();
});

test('paid charge is locked against edits', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload());
    $charge = $booking->damageCharges()->first();
    $record = $booking->damageRecords()->first();
    $item = $charge->items()->first();

    $this->post("/admin/damage-charges/{$charge->charge_code}/cash", ['method' => 'cash'])->assertRedirect();
    expect($charge->fresh()->status)->toBe('paid');

    $this->put("/admin/damages/{$record->id}", damagePayload(['repair_cost' => 99999]))
        ->assertStatus(422);
    $this->delete("/admin/damages/{$record->id}")->assertStatus(422);
    $this->post("/admin/damage-charges/{$charge->charge_code}/items", ['description' => 'Tambahan', 'amount' => 10000])
        ->assertStatus(422);
    $this->delete("/admin/damage-charge-items/{$item->id}")->assertStatus(422);

    expect($charge->fresh()->total)->toBe(150000);
});

test('admin can waive or cancel an open charge', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload());
    $charge = $booking->damageCharges()->first();

    $this->post("/admin/damage-charges/{$charge->charge_code}/waive", [])->assertSessionHasErrors('waived_reason');
    $this->post("/admin/damage-charges/{$charge->charge_code}/waive", ['waived_reason' => 'Customer langganan'])
        ->assertRedirect();
    $charge->refresh();
    expect($charge->status)->toBe('waived')
        ->and($charge->waived_reason)->toBe('Customer langganan')
        ->and($charge->waived_by)->not->toBeNull()
        ->and($charge->waived_at)->not->toBeNull();

    $vehicle2 = makeVehicle(['slug' => 'motor-dua', 'name' => 'Motor Dua', 'price_per_day' => 90000]);
    $booking2 = activeBooking($vehicle2);
    $this->post("/admin/bookings/{$booking2->booking_code}/damages", damagePayload());
    $charge2 = $booking2->damageCharges()->first();
    $this->post("/admin/damage-charges/{$charge2->charge_code}/cancel")->assertRedirect();
    expect($charge2->fresh()->status)->toBe('cancelled');
    // History kept: charge + record still in database.
    expect(DamageCharge::count())->toBe(2)
        ->and(DamageRecord::count())->toBe(2);
});

// ---------- Maintenance ----------

test('maintenance makes unit unavailable and completion restores it', function () {
    $vehicle = makeVehicle(['stock' => 3]);
    $booking = activeBooking($vehicle);
    $unit = $booking->fresh()->unit;

    $this->post("/admin/bookings/{$booking->booking_code}/maintenances", [
        'title' => 'Ganti spion kanan',
        'description' => 'Spion pecah saat rental.',
        'cost' => 100000,
    ])->assertRedirect();

    $record = MaintenanceRecord::first();
    expect($record->cost)->toBe(100000);

    $this->patch("/admin/maintenances/{$record->id}/status", ['status' => 'in_progress'])
        ->assertRedirect();
    expect($unit->fresh()->status)->toBe('inactive');

    // Overlapping booking cannot use the unit now.
    $other = operationalBooking($vehicle, [
        'start_date' => Carbon::today()->addDays(2)->toDateString(),
        'end_date' => Carbon::today()->addDays(3)->toDateString(),
    ]);
    payOperationalDp($other);
    $this->post("/admin/bookings/{$other->booking_code}/confirm");
    $this->post("/admin/bookings/{$other->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id])
        ->assertSessionHasErrors('unit');

    $this->patch("/admin/maintenances/{$record->id}/status", ['status' => 'completed'])
        ->assertRedirect();
    expect($unit->fresh()->status)->toBe('active');
    expect($record->fresh()->completed_at)->not->toBeNull();

    // History preserved.
    expect(MaintenanceRecord::count())->toBe(1);
});

test('damage charge and maintenance cost stay independent', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['repair_cost' => 150000]));

    // Opsi A: kerusakan otomatis tercatat sebagai Perbaikan terjadwal.
    $auto = MaintenanceRecord::whereNotNull('damage_record_id')->first();
    expect($auto)->not->toBeNull()
        ->and($auto->cost)->toBe(150000)
        ->and($auto->status)->toBe('scheduled');

    $this->post("/admin/bookings/{$booking->booking_code}/maintenances", [
        'title' => 'Servis spion',
        'cost' => 100000,
    ]);

    $charge = $booking->damageCharges()->first();
    $manual = MaintenanceRecord::whereNull('damage_record_id')->first();

    expect($charge->total)->toBe(150000)
        ->and($manual->cost)->toBe(100000)
        ->and(MaintenanceRecord::count())->toBe(2)
        ->and($booking->fresh()->total)->toBe(255000);
});

test('maintenance cannot be created for unit on active rental', function () {
    $vehicle = makeVehicle(['stock' => 5]);
    $booking = activeBooking($vehicle);
    $unit = $booking->fresh()->unit;

    // Second booking still active on another unit; maintenance for the first unit is fine.
    $other = operationalBooking($vehicle, [
        'start_date' => Carbon::today()->addDays(10)->toDateString(),
        'end_date' => Carbon::today()->addDays(12)->toDateString(),
    ]);
    payOperationalDp($other);
    $this->post("/admin/bookings/{$other->booking_code}/confirm");

    // Unit of the ACTIVE first booking cannot enter maintenance from another booking.
    $this->post("/admin/bookings/{$other->booking_code}/maintenances", [
        'vehicle_unit_id' => $unit->id,
        'title' => 'Iseng',
        'cost' => 10000,
    ])->assertStatus(422);
});

// ---------- Security ----------

test('non-admin cannot manage damage or maintenance', function () {
    $this->actingAs(makeCustomer());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload())->assertForbidden();
    $this->post("/admin/bookings/{$booking->booking_code}/maintenances", ['title' => 'x', 'cost' => 1])
        ->assertForbidden();
});

test('guest cannot access damage or maintenance routes', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload())
        ->assertRedirect(route('admin.login'));
    $this->get('/booking/damage/DC-20260927-0001')->assertNotFound();
});

test('damage events are logged for audit', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload());

    $charge = $booking->damageCharges()->first();
    $this->post("/admin/damage-charges/{$charge->charge_code}/cash", ['method' => 'cash']);

    $types = NotificationLog::where('booking_id', $booking->id)->pluck('type')->all();
    expect($types)->toContain('damage_charge_created')
        ->and($types)->toContain('damage_payment_confirmed');
});
