<?php

use App\Models\Booking;
use App\Models\Vehicle;
use Carbon\Carbon;

function bookingPayload(Vehicle $vehicle, array $overrides = []): array
{
    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();

    return array_merge([
        'vehicle_id' => $vehicle->id,
        'start_date' => $start,
        'end_date' => $end,
        'pickup_method' => 'outlet',
        'return_method' => 'outlet',
        'customer_name' => 'Budi Santoso',
        'customer_phone' => '081234567890',
        'terms' => true,
    ], $overrides);
}

test('booking page loads for guests without login', function () {
    $vehicle = makeVehicle();

    $this->get('/booking')->assertOk();
    $this->get('/booking/'.$vehicle->slug)->assertOk();
});

test('availability endpoint reports available vehicle', function () {
    $vehicle = makeVehicle();

    $response = $this->getJson('/booking/availability?'.http_build_query([
        'vehicle_id' => $vehicle->id,
        'start_date' => Carbon::today()->addDay()->toDateString(),
        'end_date' => Carbon::today()->addDays(4)->toDateString(),
    ]));

    $response->assertOk()->assertJson([
        'available' => true,
        'duration_days' => 3,
        'subtotal' => 255000,
    ]);
});

test('guest can create booking with server-side pricing', function () {
    $vehicle = makeVehicle(['price_per_day' => 100000, 'stock' => 2]);

    $response = $this->post('/booking', bookingPayload($vehicle));

    $response->assertRedirect();
    $this->assertDatabaseCount('bookings', 1);

    $booking = Booking::first();
    expect($booking->booking_code)->toMatch('/^SR-\d{8}-\d{4}$/')
        ->and($booking->duration_days)->toBe(3)
        ->and($booking->price_per_day)->toBe(100000)
        ->and($booking->subtotal)->toBe(300000)
        ->and($booking->delivery_fee)->toBe(0)
        ->and($booking->total)->toBe(300000)
        ->and($booking->status)->toBe('pending');

    // Price snapshot is stored on the item
    $this->assertDatabaseHas('booking_items', [
        'booking_id' => $booking->id,
        'vehicle_name_snapshot' => 'Honda Vario 160',
        'price_per_day' => 100000,
        'duration_days' => 3,
        'subtotal' => 300000,
    ]);
});

test('delivery booking adds area fee to total', function () {
    $vehicle = makeVehicle();

    $this->post('/booking', bookingPayload($vehicle, [
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel Kusuma',
        'delivery_address' => 'Jl. Sugiyopranoto No. 1',
    ]))->assertRedirect();

    $booking = Booking::first();
    expect($booking->delivery_fee)->toBe(20000)
        ->and($booking->total)->toBe(255000 + 20000);
});

test('double booking is rejected when stock runs out', function () {
    $vehicle = makeVehicle(['stock' => 1]);

    $this->post('/booking', bookingPayload($vehicle))->assertRedirect();

    $second = $this->post('/booking', bookingPayload($vehicle, [
        'start_date' => Carbon::today()->addDays(2)->toDateString(),
        'end_date' => Carbon::today()->addDays(5)->toDateString(),
    ]));

    $second->assertSessionHasErrors('availability');
    $this->assertDatabaseCount('bookings', 1);
});

test('booking requires name, phone and terms', function () {
    $vehicle = makeVehicle();

    $this->post('/booking', bookingPayload($vehicle, [
        'customer_name' => '',
        'customer_phone' => 'abc',
        'terms' => false,
    ]))->assertSessionHasErrors(['customer_name', 'customer_phone', 'terms']);

    $this->assertDatabaseCount('bookings', 0);
});

test('success page shows booking by code', function () {
    $vehicle = makeVehicle();
    $this->post('/booking', bookingPayload($vehicle));

    $code = Booking::first()->booking_code;

    $this->get('/booking/success/'.$code)->assertOk();
});

test('check booking finds booking with matching phone', function () {
    $vehicle = makeVehicle();
    $this->post('/booking', bookingPayload($vehicle));
    $code = Booking::first()->booking_code;

    $this->get('/booking/check?'.http_build_query([
        'code' => $code,
        'phone' => '081234567890',
    ]))->assertOk();
});
