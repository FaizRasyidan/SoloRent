<?php

use App\Models\Payment;
use App\Services\PaymentService;
use Inertia\Testing\AssertableInertia;
use Symfony\Component\HttpKernel\Exception\HttpException;

test('payments cannot proceed once the damage charge is closed', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    test()->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload());
    $charge = $booking->damageCharges()->first();

    // Customer creates a payment (pending), then admin waives the charge.
    test()->post("/booking/damage/{$charge->charge_code}/pay", [
        'customer_phone' => '081234567890',
        'method' => 'bank_transfer',
        'proof' => fakeImage('bukti.png'),
    ])->assertRedirect();
    $payment = Payment::where('damage_charge_id', $charge->id)->first();

    test()->post("/admin/damage-charges/{$charge->charge_code}/waive", ['waived_reason' => 'Goodwill'])
        ->assertRedirect();

    // Proof re-submit blocked: charge no longer open.
    $service = app(PaymentService::class);
    try {
        $service->submitProof($payment->fresh(), null);
        $submitted = true;
    } catch (HttpException) {
        $submitted = false;
    }
    expect($submitted)->toBeFalse();

    // Admin verify blocked as well.
    $response = test()->post("/admin/payments/{$payment->payment_code}/confirm");
    $response->assertStatus(422);
    expect($payment->fresh()->status)->toBe('submitted');
});

test('bookings list exposes open damage charges', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    test()->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['repair_cost' => 80000]));

    test()->get('/admin/bookings')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('bookings.data.0.open_damage.status', 'unpaid')
            ->where('bookings.data.0.open_damage.outstanding', 80000)
        );
});
