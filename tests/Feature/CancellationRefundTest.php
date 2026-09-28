<?php

use App\Models\Booking;
use App\Models\Cancellation;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\PaymentService;
use Carbon\Carbon;

/** Bayar sebagian via jalur server (tanpa upload) untuk skenario refund. */
function payPartialTest(Booking $booking, int $amount): Payment
{
    $payment = Payment::create([
        'booking_id' => $booking->id,
        'payment_code' => app(PaymentService::class)->generatePaymentCode(),
        'type' => 'full_payment',
        'method' => 'bank_transfer',
        'amount' => $amount,
        'status' => Payment::STATUS_PAID,
        'paid_at' => now(),
        'submitted_at' => now(),
    ]);
    app(PaymentService::class)->syncBookingPayment($booking->fresh());

    return $payment->fresh();
}

// ---------- Customer cancellation ----------

test('customer can cancel pending booking without payment and no refund is created', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Jadwal berubah',
    ])->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('cancelled')
        ->and($booking->cancelled_by_type)->toBe('customer')
        ->and($booking->cancelled_at)->not->toBeNull();

    $cancellation = Cancellation::where('booking_id', $booking->id)->first();
    expect($cancellation)->not->toBeNull()
        ->and($cancellation->original_amount)->toBe(0)
        ->and($cancellation->refund_amount)->toBe(0)
        ->and($cancellation->non_refundable_amount)->toBe(0)
        ->and($cancellation->policy_percent)->toBe(80);
    expect(Refund::where('booking_id', $booking->id)->count())->toBe(0);

    $this->assertDatabaseHas('notification_logs', [
        'booking_id' => $booking->id,
        'type' => 'booking_cancelled',
    ]);

    // Availability released: same period bookable again.
    $this->post('/booking', bookingPayload($vehicle))->assertRedirect();
    expect(Booking::where('status', 'pending')->count())->toBe(1);
});

test('customer cancel with partial DP creates 80 percent refund', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payPartialTest($booking, 127500);

    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Perubahan rencana',
    ])->assertRedirect();

    $cancellation = Cancellation::where('booking_id', $booking->id)->firstOrFail();
    expect($cancellation->original_amount)->toBe(127500)
        ->and($cancellation->refund_amount)->toBe(102000)
        ->and($cancellation->non_refundable_amount)->toBe(25500)
        // Invariant: refund + non-refundable == original.
        ->and($cancellation->refund_amount + $cancellation->non_refundable_amount)->toBe($cancellation->original_amount);

    $refund = Refund::where('booking_id', $booking->id)->firstOrFail();
    expect($refund->refund_code)->toMatch('/^RF-\d{8}-\d{4}$/')
        ->and($refund->amount)->toBe(102000)
        ->and($refund->status)->toBe('pending')
        ->and($refund->channel)->toBe('manual');

    $this->assertDatabaseHas('notification_logs', [
        'booking_id' => $booking->id,
        'type' => 'refund_created',
    ]);
});

test('customer cannot cancel fully paid booking', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payOperationalDp($booking);
    expect($booking->fresh()->isFullyPaid())->toBeTrue();

    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Berubah pikiran',
    ])->assertSessionHasErrors('cancel_reason');

    expect($booking->fresh()->status)->not->toBe('cancelled');
    expect(Cancellation::where('booking_id', $booking->id)->count())->toBe(0);
});

test('customer cannot cancel active completed or already cancelled booking', function () {
    $vehicle = makeVehicle();

    foreach (['active', 'completed'] as $status) {
        $booking = operationalBooking($vehicle);
        $booking->update(['status' => $status]);
        $this->post("/booking/{$booking->booking_code}/cancel", [
            'customer_phone' => '081234567890',
            'cancel_reason' => 'Iseng',
        ])->assertSessionHasErrors('cancel_reason');
        expect($booking->fresh()->status)->toBe($status);
    }

    $booking = operationalBooking($vehicle);
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Pertama',
    ])->assertRedirect();
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Kedua',
    ])->assertSessionHasErrors('cancel_reason');
    expect(Cancellation::where('booking_id', $booking->id)->count())->toBe(1);
});

// ---------- Security ----------

test('customer A cannot cancel or see customer B refund', function () {
    $vehicle = makeVehicle();
    $bookingA = operationalBooking($vehicle);
    payPartialTest($bookingA, 127500);
    $vehicle2 = makeVehicle(['slug' => 'motor-b', 'name' => 'Motor B', 'price_per_day' => 90000]);
    $bookingB = operationalBooking($vehicle2, ['customer_phone' => '089999999999']);

    // B's phone against A's booking → 403.
    $this->post("/booking/{$bookingA->booking_code}/cancel", [
        'customer_phone' => '089999999999',
        'cancel_reason' => 'Iseng',
    ])->assertForbidden();
    expect($bookingA->fresh()->status)->not->toBe('cancelled');

    // A cancels normally → refund exists.
    $this->post("/booking/{$bookingA->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Jadwal berubah',
    ])->assertRedirect();
    $refund = Refund::where('booking_id', $bookingA->id)->firstOrFail();

    // B cannot open A's refund receipt (verified gate, no amounts leaked).
    $this->get("/booking/refunds/{$refund->refund_code}?phone=089999999999")
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('verified', false));

    // A can open it.
    $this->get("/booking/refunds/{$refund->refund_code}?phone=081234567890")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('verified', true)
            ->where('refund.amount', 102000));

    // B's own booking untouched.
    expect($bookingB->fresh()->status)->not->toBe('cancelled');
});

// ---------- Availability & operational release ----------

test('cancelled booking releases unit driver and delivery task', function () {
    $vehicle = makeVehicle();
    $admin = makeAdmin();
    $this->actingAs($admin);

    $booking = operationalBooking($vehicle, [
        'with_driver' => true,
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel Kusuma',
        'delivery_address' => 'Jl. Sugiyopranoto No. 1',
    ]);
    $code = $booking->booking_code;
    payPartialTest($booking, 127500);

    $this->post("/admin/bookings/{$code}/confirm")->assertRedirect();
    $unit = makeUnit($vehicle);
    $this->post("/admin/bookings/{$code}/assign-unit", ['vehicle_unit_id' => $unit->id])->assertRedirect();
    $driver = makeDriver();
    $this->post("/admin/bookings/{$code}/assign-driver", ['driver_id' => $driver->id])->assertRedirect();
    expect($driver->fresh()->status)->toBe('working');

    $deliveryTask = $booking->fresh()->tasks->firstWhere('type', 'delivery');
    expect($deliveryTask)->not->toBeNull();

    // Customer cancels (confirmed is eligible).
    $this->post("/booking/{$code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Rencana berubah',
    ])->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('cancelled');
    // Driver kembali aktif, histori assignment tetap (driver_id tidak dihapus).
    expect($driver->fresh()->status)->toBe('active')
        ->and($booking->driver_id)->toBe($driver->id);
    // Delivery task cancelled, histori tetap ada.
    expect($deliveryTask->fresh()->status)->toBe('cancelled');
    // Unit dapat dipakai lagi pada periode yang sama.
    expect($unit->fresh()->isAvailableFor(
        $booking->start_date->toDateString(),
        $booking->end_date->toDateString()
    ))->toBeTrue();
    // Unit tetap terblokir bila maintenance/inactive (aturan tidak berubah).
    $unit->update(['status' => 'inactive']);
    expect($unit->fresh()->isAvailableFor(
        $booking->start_date->toDateString(),
        $booking->end_date->toDateString()
    ))->toBeFalse();
});

// ---------- Admin ----------

test('admin cancel creates refund and admin processes it to completed', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payPartialTest($booking, 127500);
    // DP 127500 = ambang 50% → booking auto-confirmed via syncBookingPayment.

    $this->post("/admin/bookings/{$booking->booking_code}/cancel", ['cancel_reason' => 'Permintaan customer'])
        ->assertRedirect();
    expect($booking->fresh()->cancelled_by_type)->toBe('admin');

    $refund = Refund::where('booking_id', $booking->id)->firstOrFail();

    // Duplicate process → one refund only (idempotent).
    $this->post("/admin/refunds/{$refund->refund_code}/process")->assertRedirect();
    $this->post("/admin/refunds/{$refund->refund_code}/process")->assertRedirect();
    expect(Refund::where('booking_id', $booking->id)->count())->toBe(1)
        ->and($refund->fresh()->status)->toBe('processing');

    // Complete without reference rejected.
    $this->post("/admin/refunds/{$refund->refund_code}/complete", [])->assertSessionHasErrors('reference');

    $this->post("/admin/refunds/{$refund->refund_code}/complete", ['reference' => 'TRX-REF-001'])
        ->assertRedirect();
    $refund->refresh();
    expect($refund->status)->toBe('completed')
        ->and($refund->reference)->toBe('TRX-REF-001')
        ->and($refund->processed_at)->not->toBeNull();

    $this->assertDatabaseHas('notification_logs', [
        'booking_id' => $booking->id,
        'type' => 'refund_completed',
    ]);

    // Original payment preserved, never zeroed.
    expect(Payment::where('booking_id', $booking->id)->where('status', 'paid')->sum('amount'))->toBe(127500);
});

test('admin cannot cancel fully paid booking without override', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payOperationalDp($booking);

    $this->post("/admin/bookings/{$booking->booking_code}/cancel", ['cancel_reason' => 'Iseng'])
        ->assertSessionHasErrors('cancel_reason');
    expect($booking->fresh()->status)->not->toBe('cancelled');
});

test('admin override cancels fully paid booking with full audit trail', function () {
    $admin = makeAdmin();
    $this->actingAs($admin);
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payOperationalDp($booking);
    $paid = $booking->fresh()->paidTotal();
    expect($paid)->toBe(255000);

    // Override melebihi paid ditolak.
    $this->post("/admin/bookings/{$booking->booking_code}/cancel", [
        'cancel_reason' => 'Unit mogok',
        'override_amount' => $paid + 1000,
        'override_reason' => 'Iseng',
    ])->assertSessionHasErrors('cancel_reason');

    // Override tanpa alasan ditolak.
    $this->post("/admin/bookings/{$booking->booking_code}/cancel", [
        'cancel_reason' => 'Unit mogok',
        'override_amount' => $paid,
    ])->assertSessionHasErrors('cancel_reason');

    // Override valid: refund penuh karena unit mogok.
    $this->post("/admin/bookings/{$booking->booking_code}/cancel", [
        'cancel_reason' => 'Unit mogok sebelum serah terima',
        'override_amount' => $paid,
        'override_reason' => 'Kendaraan mengalami masalah sebelum rental.',
    ])->assertRedirect();

    $cancellation = Cancellation::where('booking_id', $booking->id)->firstOrFail();
    expect($cancellation->refund_amount)->toBe($paid)
        ->and($cancellation->non_refundable_amount)->toBe(0)
        ->and($cancellation->override_policy_amount)->toBe((int) floor($paid * 80 / 100))
        ->and($cancellation->override_amount)->toBe($paid)
        ->and($cancellation->override_reason)->toBe('Kendaraan mengalami masalah sebelum rental.')
        ->and($cancellation->overridden_by)->toBe($admin->id);
});

test('admin override zero creates no refund row', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payOperationalDp($booking);

    $this->post("/admin/bookings/{$booking->booking_code}/cancel", [
        'cancel_reason' => 'No-show customer',
        'override_amount' => 0,
        'override_reason' => 'Customer tidak pernah datang, dana hangus.',
    ])->assertRedirect();

    expect($booking->fresh()->status)->toBe('cancelled');
    expect(Refund::where('booking_id', $booking->id)->count())->toBe(0);
});

test('refund cannot exceed paid amount cumulatively', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payPartialTest($booking, 127500);
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Batal',
    ])->assertRedirect();

    // Refund kedua yang membuat total melebihi paid tidak bisa diproses.
    $extra = Refund::create([
        'booking_id' => $booking->id,
        'refund_code' => Refund::generateCode(),
        'amount' => 30000,
        'status' => Refund::STATUS_PENDING,
        'reason' => 'Uji kumulatif',
        'channel' => Refund::CHANNEL_MANUAL,
    ]);
    $this->post("/admin/refunds/{$extra->refund_code}/process")
        ->assertSessionHasErrors('refund');
});

test('non-admin cannot process refund', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payPartialTest($booking, 127500);
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Batal',
    ])->assertRedirect();
    $refund = Refund::where('booking_id', $booking->id)->firstOrFail();

    $this->actingAs(makeCustomer());
    $this->post("/admin/refunds/{$refund->refund_code}/process")->assertForbidden();
    $this->post("/admin/refunds/{$refund->refund_code}/complete", ['reference' => 'X'])->assertForbidden();
});

test('admin refund fail stores safe message and notifies', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payPartialTest($booking, 100000);
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Batal',
    ])->assertRedirect();
    $refund = Refund::where('booking_id', $booking->id)->firstOrFail();

    $this->post("/admin/refunds/{$refund->refund_code}/fail", ['failure_reason' => 'Rekening tujuan tidak valid.'])
        ->assertRedirect();
    expect($refund->fresh()->status)->toBe('failed');
    $this->assertDatabaseHas('notification_logs', [
        'booking_id' => $booking->id,
        'type' => 'refund_failed',
    ]);
});

// ---------- Policy configurability ----------

test('refund percent and time gate come from config', function () {
    config(['solorent.refund.percent' => 50]);
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payPartialTest($booking, 127500);

    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Batal',
    ])->assertRedirect();
    expect(Cancellation::where('booking_id', $booking->id)->firstOrFail()->refund_amount)->toBe(63750);

    // Time gate: min_hours besar menutup pembatalan.
    config(['solorent.refund.percent' => 80, 'solorent.cancellation.min_hours_before_start' => 100000]);
    $booking2 = operationalBooking($vehicle);
    $this->post("/booking/{$booking2->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Batal',
    ])->assertSessionHasErrors('cancel_reason');
    expect($booking2->fresh()->status)->not->toBe('cancelled');
});

// ---------- Damage separation ----------

test('damage charge is untouched by cancellation flow', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload())
        ->assertRedirect();
    $chargeCode = $booking->damageCharges()->first()->charge_code;

    // Active booking cannot be cancelled at all — charge stays open.
    $this->post("/admin/bookings/{$booking->booking_code}/cancel", ['cancel_reason' => 'Iseng'])
        ->assertSessionHasErrors('cancel_reason');
    expect($booking->fresh()->status)->toBe('active');
    expect($booking->damageCharges()->first()->status)->toBe('unpaid');
    expect($booking->damageCharges()->first()->charge_code)->toBe($chargeCode);
});

// ---------- End to end ----------

test('full end to end cancellation and refund', function () {
    $admin = makeAdmin();
    $this->actingAs($admin);
    $vehicle = makeVehicle();

    // Customer creates booking → DP paid → auto-confirmed → unit + driver assigned.
    $booking = operationalBooking($vehicle, ['with_driver' => true]);
    $code = $booking->booking_code;
    payPartialTest($booking, 127500);
    $unit = makeUnit($vehicle);
    $this->post("/admin/bookings/{$code}/assign-unit", ['vehicle_unit_id' => $unit->id])->assertRedirect();
    $driver = makeDriver();
    $this->post("/admin/bookings/{$code}/assign-driver", ['driver_id' => $driver->id])->assertRedirect();

    // Customer cancels → cancelled, vehicle/driver/delivery released, refund created.
    $this->post("/booking/{$code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Rencana perjalanan berubah',
    ])->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('cancelled')
        ->and($driver->fresh()->status)->toBe('active');

    $refund = Refund::where('booking_id', $booking->id)->firstOrFail();
    expect($refund->amount)->toBe(102000)->and($refund->status)->toBe('pending');

    // Admin processes → completed.
    $this->post("/admin/refunds/{$refund->refund_code}/process")->assertRedirect();
    $this->post("/admin/refunds/{$refund->refund_code}/complete", ['reference' => 'E2E-REF-001'])->assertRedirect();

    $booking->refresh();
    $refund->refresh();
    expect($booking->status)->toBe('cancelled')
        ->and($refund->status)->toBe('completed')
        ->and($unit->fresh()->isAvailableFor(
            Carbon::parse($booking->start_date)->toDateString(),
            Carbon::parse($booking->end_date)->toDateString()
        ))->toBeTrue()
        // Original payment preserved.
        ->and(Payment::where('booking_id', $booking->id)->where('status', 'paid')->sum('amount'))->toBe(127500)
        // No damage, no deposit anywhere.
        ->and($booking->damageCharges()->count())->toBe(0)
        ->and((int) $booking->deposit_amount)->toBe(0);
});
