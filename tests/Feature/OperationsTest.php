<?php

use App\Models\Booking;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Models\VehicleUnit;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia;

function makeUnit(Vehicle $vehicle, array $overrides = []): VehicleUnit
{
    static $counter = 0;
    $counter++;

    return VehicleUnit::create(array_merge([
        'vehicle_id' => $vehicle->id,
        'unit_code' => 'UT-'.$vehicle->id.'-'.$counter,
        'plate_number' => 'AD 1000 XY',
        'status' => 'active',
    ], $overrides));
}

function makeDriver(array $overrides = []): Driver
{
    return Driver::create(array_merge([
        'name' => 'Andi Pratama',
        'whatsapp' => '081234567890',
        'sim_type' => 'A',
        'status' => 'active',
    ], $overrides));
}

function operationalBooking(Vehicle $vehicle, array $overrides = []): Booking
{
    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();

    $response = test()->post('/booking', bookingPayload($vehicle, array_merge([
        'start_date' => $start,
        'end_date' => $end,
    ], $overrides)));
    $response->assertRedirect();

    return Booking::orderBy('id', 'desc')->first();
}

/** Phase 6: lunasi PENUH via jalur server (tanpa upload) agar flow operasional dapat lanjut (unit + laporan). */
function payOperationalDp(Booking $booking): void
{
    $booking = $booking->fresh();
    $amount = $booking->outstanding();
    if ($amount < 1) {
        $amount = (int) $booking->total;
    }
    $payment = App\Models\Payment::create([
        'booking_id' => $booking->id,
        'payment_code' => app(App\Services\PaymentService::class)->generatePaymentCode(),
        'type' => 'full_payment',
        'method' => 'bank_transfer',
        'amount' => $amount,
        'status' => App\Models\Payment::STATUS_PAID,
        'paid_at' => now(),
        'submitted_at' => now(),
    ]);
    app(App\Services\PaymentService::class)->syncBookingPayment($booking->fresh());
}

// ---------- Authorization ----------

test('guest cannot access operational routes', function () {
    $vehicle = makeVehicle();
    makeUnit($vehicle);
    $booking = operationalBooking($vehicle);

    $this->get('/admin/bookings')->assertRedirect(route('admin.login'));
    $this->get("/admin/bookings/{$booking->booking_code}")->assertRedirect(route('admin.login'));
    $this->post("/admin/bookings/{$booking->booking_code}/confirm")->assertRedirect(route('admin.login'));
    $this->get('/admin/drivers')->assertRedirect(route('admin.login'));
    $this->post('/admin/drivers', [])->assertRedirect(route('admin.login'));
    $this->get('/admin/operations')->assertRedirect(route('admin.login'));
    $this->get('/admin/operations/calendar')->assertRedirect(route('admin.login'));
    $this->post("/admin/vehicles/{$vehicle->slug}/units", [])->assertRedirect(route('admin.login'));
});

test('non-admin cannot access operational routes', function () {
    $this->actingAs(makeCustomer());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->get('/admin/bookings')->assertForbidden();
    $this->get("/admin/bookings/{$booking->booking_code}")->assertForbidden();
    $this->post("/admin/bookings/{$booking->booking_code}/confirm")->assertForbidden();
    $this->get('/admin/drivers')->assertForbidden();
    $this->get('/admin/operations')->assertForbidden();
});

// ---------- Booking management ----------

test('admin can view bookings with search and status filter', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    operationalBooking($vehicle);

    $this->get('/admin/bookings')->assertOk();

    $code = Booking::first()->booking_code;
    $this->get('/admin/bookings?'.http_build_query(['search' => substr($code, 0, 8), 'status' => 'pending']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('bookings.data', 1)
            ->where('statusCounts.all', 1)
            ->where('statusCounts.pending', 1)
            ->where('statusCounts.completed', 0)
        );

    $this->get('/admin/bookings?'.http_build_query(['status' => 'completed']))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('bookings.data', 0));

    $this->get("/admin/bookings/{$code}")->assertOk();
});

test('admin can confirm booking and tasks are created', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle, [
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel Novotel',
        'delivery_address' => 'Jl. Slamet Riyadi',
        'return_method' => 'pickup',
        'return_address' => 'Stasiun Balapan',
    ]);

    $this->post("/admin/bookings/{$booking->booking_code}/confirm")->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('confirmed')
        ->and($booking->confirmed_at)->not->toBeNull();

    $types = $booking->tasks()->pluck('type')->all();
    expect($types)->toContain('delivery')->and($types)->toContain('pickup');
});

test('admin cannot confirm non-pending booking', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $booking->update(['status' => 'confirmed']);

    $this->post("/admin/bookings/{$booking->booking_code}/confirm")->assertStatus(422);
});

test('admin can cancel booking and availability is released', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['stock' => 1]);
    $booking = operationalBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/confirm")->assertRedirect();
    $this->post("/admin/bookings/{$booking->booking_code}/cancel", ['cancel_reason' => 'Customer reschedule'])
        ->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('cancelled')
        ->and($booking->cancel_reason)->toBe('Customer reschedule');

    // Same period can be booked again — cancelled no longer blocks.
    $this->post('/booking', bookingPayload($vehicle))->assertRedirect();
    expect(Booking::where('status', 'pending')->count())->toBe(1);
});

// ---------- Vehicle assignment ----------

test('admin can assign available unit', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-001']);
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id])
        ->assertRedirect();

    expect($booking->fresh()->vehicle_unit_id)->toBe($unit->id)
        ->and($booking->fresh()->unit_assigned_at)->not->toBeNull();
});

test('admin cannot assign inactive unit', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-002', 'status' => 'inactive']);
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id])
        ->assertSessionHasErrors('unit');
    expect($booking->fresh()->vehicle_unit_id)->toBeNull();
});

test('admin cannot assign unit from another vehicle', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $other = makeVehicle(['slug' => 'toyota-avanza', 'name' => 'Toyota Avanza', 'category' => 'mobil', 'price_per_day' => 350000]);
    $foreignUnit = makeUnit($other, ['unit_code' => 'AV-001']);
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    // IDOR protection: 403, not silent reassignment.
    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $foreignUnit->id])
        ->assertForbidden();
    expect($booking->fresh()->vehicle_unit_id)->toBeNull();
});

test('admin cannot double assign the same unit on overlapping periods', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['stock' => 5]);
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-003']);

    $first = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$first->booking_code}/confirm");
    $this->post("/admin/bookings/{$first->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id])
        ->assertRedirect();

    // Overlapping period (22–25 vs 20–23 style overlap).
    $second = operationalBooking($vehicle, [
        'start_date' => Carbon::today()->addDays(2)->toDateString(),
        'end_date' => Carbon::today()->addDays(5)->toDateString(),
    ]);
    $this->post("/admin/bookings/{$second->booking_code}/confirm");
    $this->post("/admin/bookings/{$second->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id])
        ->assertSessionHasErrors('unit');

    // Adjacent period (end == start) is fine: no conflict.
    $third = operationalBooking($vehicle, [
        'start_date' => Carbon::today()->addDays(4)->toDateString(),
        'end_date' => Carbon::today()->addDays(6)->toDateString(),
    ]);
    $this->post("/admin/bookings/{$third->booking_code}/confirm");
    $this->post("/admin/bookings/{$third->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id])
        ->assertRedirect();
    expect($third->fresh()->vehicle_unit_id)->toBe($unit->id);
});

// ---------- Driver ----------

test('admin can create update and deactivate driver', function () {
    $this->actingAs(makeAdmin());

    $this->post('/admin/drivers', [
        'name' => 'Budi Setiawan',
        'whatsapp' => '081111111111',
        'sim_type' => 'B',
        'status' => 'active',
    ])->assertRedirect();
    $this->assertDatabaseHas('drivers', ['name' => 'Budi Setiawan']);

    $driver = Driver::first();
    $this->put("/admin/drivers/{$driver->id}", [
        'name' => 'Budi Setiawan',
        'whatsapp' => '081111111111',
        'sim_type' => 'B',
        'sim_number' => 'SIM-123',
        'status' => 'inactive',
    ])->assertRedirect();
    expect($driver->fresh()->status)->toBe('inactive');

    $this->post('/admin/drivers', ['name' => ''])->assertSessionHasErrors('name');
});

test('admin can assign driver when booking needs one', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $driver = makeDriver();
    $booking = operationalBooking($vehicle, ['with_driver' => true]);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $driver->id])
        ->assertRedirect();
    expect($booking->fresh()->driver_id)->toBe($driver->id);
});

test('assigned driver becomes working and is freed when rental ends', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['stock' => 5]);
    $driver = makeDriver();
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-900']);

    $booking = operationalBooking($vehicle, ['with_driver' => true]);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $driver->id])
        ->assertRedirect();

    // Status bekerja — tidak dapat ditempatkan di booking lain walau tanggal beda.
    expect($driver->fresh()->status)->toBe('working');

    $other = operationalBooking($vehicle, [
        'with_driver' => true,
        'start_date' => Carbon::today()->addDays(10)->toDateString(),
        'end_date' => Carbon::today()->addDays(12)->toDateString(),
    ]);
    $this->post("/admin/bookings/{$other->booking_code}/confirm");
    $this->post("/admin/bookings/{$other->booking_code}/assign-driver", ['driver_id' => $driver->id])
        ->assertSessionHasErrors('driver');
    expect($other->fresh()->driver_id)->toBeNull();

    // Selesaikan rental pertama sampai completed → driver kembali aktif.
    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id]);
    payOperationalDp($booking);
    $this->post("/admin/bookings/{$booking->booking_code}/ready")->assertRedirect();
    $this->post("/admin/bookings/{$booking->booking_code}/handover", [
        'checklist' => ['body', 'lampu', 'ban', 'rem', 'spion', 'stnk', 'kunci', 'bbm'],
    ])->assertRedirect();
    $this->post("/admin/bookings/{$booking->booking_code}/activate")->assertRedirect();
    $this->post("/admin/bookings/{$booking->booking_code}/return", [
        'return_condition' => 'normal',
        'return_fuel' => 'penuh',
    ])->assertRedirect();

    expect($driver->fresh()->status)->toBe('active');
});

test('cancelled booking frees working driver', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $driver = makeDriver();
    $booking = operationalBooking($vehicle, ['with_driver' => true]);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $driver->id]);

    expect($driver->fresh()->status)->toBe('working');

    $this->post("/admin/bookings/{$booking->booking_code}/cancel", ['cancel_reason' => 'Customer batal'])
        ->assertRedirect();

    expect($driver->fresh()->status)->toBe('active');
});

test('delivery and pickup tasks follow the rental driver automatically', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $driver = makeDriver();
    $booking = operationalBooking($vehicle, [
        'with_driver' => true,
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel Novotel',
        'delivery_address' => 'Jl. Slamet Riyadi',
        'return_method' => 'outlet',
    ]);
    // Dengan driver, pengembalian dikunci ke outlet — hanya tugas delivery yang ada.
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $driver->id])
        ->assertRedirect();

    $delivery = $booking->tasks()->where('type', 'delivery')->firstOrFail();
    expect($delivery->fresh()->driver_id)->toBe($driver->id)
        ->and($delivery->fresh()->status)->toBe('assigned');

    // Tugas pickup (bila ada) ikut juga — dibuat manual di sini karena
    // pengembalian dikunci ke outlet untuk rental dengan driver.
    $pickup = $booking->tasks()->create([
        'type' => 'pickup',
        'address' => 'Alamat customer',
        'scheduled_at' => now()->addDays(3),
        'status' => 'scheduled',
    ]);
    $other = makeDriver(['name' => 'Kedua', 'whatsapp' => '088888888881']);
    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $other->id])
        ->assertRedirect();

    expect($pickup->fresh()->driver_id)->toBe($other->id)
        ->and($pickup->fresh()->status)->toBe('assigned');
});

test('replacing rental driver moves open tasks to the new driver', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $old = makeDriver(['name' => 'Lama', 'whatsapp' => '084444444444']);
    $new = makeDriver(['name' => 'Baru', 'whatsapp' => '085555555555']);
    $booking = operationalBooking($vehicle, [
        'with_driver' => true,
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel Novotel',
        'delivery_address' => 'Jl. Slamet Riyadi',
        'return_method' => 'outlet',
    ]);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $old->id]);

    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $new->id])
        ->assertRedirect();

    $delivery = $booking->tasks()->where('type', 'delivery')->firstOrFail();
    expect($delivery->fresh()->driver_id)->toBe($new->id)
        ->and($old->fresh()->status)->toBe('active')
        ->and($new->fresh()->status)->toBe('working');
});

test('manually assigned task staff is not overridden by rental driver', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $rental = makeDriver(['name' => 'Rental', 'whatsapp' => '086666666666']);
    $courier = makeDriver(['name' => 'Kurir', 'whatsapp' => '087777777777']);
    $booking = operationalBooking($vehicle, [
        'with_driver' => true,
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel Novotel',
        'delivery_address' => 'Jl. Slamet Riyadi',
        'return_method' => 'outlet',
    ]);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    $delivery = $booking->tasks()->where('type', 'delivery')->firstOrFail();
    $this->post("/admin/tasks/{$delivery->id}/assign", ['driver_id' => $courier->id])
        ->assertRedirect();

    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $rental->id])
        ->assertRedirect();

    expect($delivery->fresh()->driver_id)->toBe($courier->id);
});

test('operations board columns stay JSON lists after tasks move status', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['stock' => 5]);
    $staff = makeDriver(['name' => 'Petugas', 'whatsapp' => '089999999991']);

    // Dua tugas delivery: satu maju ke assigned, satu tetap scheduled.
    // Filter where() mempertahankan key ([1] untuk kolom scheduled) — tanpa
    // values(), kolom ter-encode sebagai object dan frontend crash (blank page).
    $first = operationalBooking($vehicle, [
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel A',
        'delivery_address' => 'Jl. A No. 1',
        'return_method' => 'outlet',
    ]);
    $second = operationalBooking($vehicle, [
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel B',
        'delivery_address' => 'Jl. B No. 2',
        'return_method' => 'outlet',
    ]);
    $this->post("/admin/bookings/{$first->booking_code}/confirm");
    $this->post("/admin/bookings/{$second->booking_code}/confirm");

    $task = $first->tasks()->where('type', 'delivery')->firstOrFail();
    $this->post("/admin/tasks/{$task->id}/assign", ['driver_id' => $staff->id])
        ->assertRedirect();

    // Berangkat: assigned → on_the_way, lalu halaman operations harus render normal.
    $this->patch("/admin/tasks/{$task->id}/status", ['status' => 'on_the_way'])
        ->assertRedirect();

    $this->get('/admin/operations')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->where('board.scheduled.0.booking_code', $second->booking_code)
        ->where('board.on_the_way.0.booking_code', $first->booking_code)
    );
});

test('driver assignment is rejected for bookings without driver option', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $driver = makeDriver();
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $driver->id])
        ->assertStatus(422);
});

test('admin cannot assign inactive or conflicting driver', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['stock' => 5]);

    $inactive = makeDriver(['name' => 'Nonaktif', 'whatsapp' => '082222222222', 'status' => 'inactive']);
    $busy = makeDriver(['name' => 'Sibuk', 'whatsapp' => '083333333333']);

    $first = operationalBooking($vehicle, ['with_driver' => true]);
    $this->post("/admin/bookings/{$first->booking_code}/confirm");
    $this->post("/admin/bookings/{$first->booking_code}/assign-driver", ['driver_id' => $busy->id])
        ->assertRedirect();

    $second = operationalBooking($vehicle, [
        'with_driver' => true,
        'start_date' => Carbon::today()->addDays(2)->toDateString(),
        'end_date' => Carbon::today()->addDays(5)->toDateString(),
    ]);
    $this->post("/admin/bookings/{$second->booking_code}/confirm");

    $this->post("/admin/bookings/{$second->booking_code}/assign-driver", ['driver_id' => $inactive->id])
        ->assertSessionHasErrors('driver');
    $this->post("/admin/bookings/{$second->booking_code}/assign-driver", ['driver_id' => $busy->id])
        ->assertSessionHasErrors('driver');

    expect($second->fresh()->driver_id)->toBeNull();
});

// ---------- Delivery & pickup tasks ----------

test('delivery task can be assigned and flow through statuses', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $staff = makeDriver(['name' => 'Dimas', 'whatsapp' => '084444444444']);
    $booking = operationalBooking($vehicle, [
        'pickup_method' => 'delivery',
        'delivery_area' => 'Solo Kota',
        'delivery_name' => 'Hotel Novotel',
        'delivery_address' => 'Jl. Slamet Riyadi',
    ]);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    $task = $booking->tasks()->where('type', 'delivery')->first();
    expect($task->status)->toBe('scheduled');

    // Invalid jump is rejected.
    $this->patch("/admin/tasks/{$task->id}/status", ['status' => 'completed'])->assertStatus(422);

    $this->post("/admin/tasks/{$task->id}/assign", [
        'driver_id' => $staff->id,
        'scheduled_at' => Carbon::today()->addDay()->format('Y-m-d').' 09:00:00',
    ])->assertRedirect();
    expect($task->fresh()->status)->toBe('assigned');

    // Inactive staff cannot be assigned.
    $off = makeDriver(['name' => 'Off', 'whatsapp' => '085555555555', 'status' => 'inactive']);
    $pickup = operationalBooking($vehicle, ['return_method' => 'pickup', 'return_address' => 'Bandara']);
    $this->post("/admin/bookings/{$pickup->booking_code}/confirm");
    $pickupTask = $pickup->tasks()->where('type', 'pickup')->first();
    $this->post("/admin/tasks/{$pickupTask->id}/assign", ['driver_id' => $off->id])
        ->assertStatus(422);

    $this->patch("/admin/tasks/{$task->id}/status", ['status' => 'on_the_way'])->assertRedirect();
    $this->patch("/admin/tasks/{$task->id}/status", ['status' => 'arrived'])->assertRedirect();
    $this->patch("/admin/tasks/{$task->id}/status", ['status' => 'completed'])->assertRedirect();
    expect($task->fresh()->status)->toBe('completed');
});

// ---------- Ready / handover / return ----------

test('booking becomes ready only when fully assigned', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-010']);
    $driver = makeDriver(['name' => 'Rian', 'whatsapp' => '086666666666']);
    $booking = operationalBooking($vehicle, ['with_driver' => true]);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");

    $this->post("/admin/bookings/{$booking->booking_code}/ready")
        ->assertSessionHasErrors('readiness');

    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id]);
    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $driver->id]);
    // Aturan sewa: unit baru boleh dipakai setelah LUNAS penuh (DP saja belum cukup).
    $this->post("/admin/bookings/{$booking->booking_code}/ready")
        ->assertSessionHasErrors('readiness');

    payOperationalDp($booking);

    $this->post("/admin/bookings/{$booking->booking_code}/ready")->assertRedirect();
    expect($booking->fresh()->status)->toBe('preparing');
});

test('handover activates rental and return inspection completes it', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-011']);
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id]);
    payOperationalDp($booking);
    $this->post("/admin/bookings/{$booking->booking_code}/ready");

    // Activation blocked before handover.
    $this->post("/admin/bookings/{$booking->booking_code}/activate")->assertStatus(422);

    // Incomplete checklist rejected.
    $this->post("/admin/bookings/{$booking->booking_code}/handover", [
        'checklist' => ['body', 'ban'],
    ])->assertSessionHasErrors('checklist');

    $this->post("/admin/bookings/{$booking->booking_code}/handover", [
        'checklist' => ['body', 'lampu', 'ban', 'rem', 'spion', 'stnk', 'kunci', 'bbm'],
        'handover_notes' => 'Kondisi baik.',
    ])->assertRedirect();

    $this->post("/admin/bookings/{$booking->booking_code}/activate")->assertRedirect();
    expect($booking->fresh()->status)->toBe('active');

    $this->post("/admin/bookings/{$booking->booking_code}/return", [
        'return_condition' => 'normal',
        'return_fuel' => '3/4',
        'return_notes' => 'Tidak ada masalah.',
    ])->assertRedirect();

    $booking->refresh();
    expect($booking->status)->toBe('completed')
        ->and($booking->returned_at)->not->toBeNull();
});

// ---------- Units ----------

test('admin can manage units from vehicle detail', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $this->post("/admin/vehicles/{$vehicle->slug}/units", [
        'unit_code' => 'VR-100',
        'plate_number' => 'AD 9999 ZZ',
        'status' => 'active',
    ])->assertRedirect();
    $this->assertDatabaseHas('vehicle_units', ['unit_code' => 'VR-100']);

    $this->post("/admin/vehicles/{$vehicle->slug}/units", [
        'unit_code' => 'VR-100',
        'status' => 'active',
    ])->assertSessionHasErrors('unit_code');

    $unit = VehicleUnit::where('unit_code', 'VR-100')->first();
    $this->put("/admin/units/{$unit->id}", [
        'unit_code' => 'VR-100',
        'status' => 'inactive',
        'notes' => 'Sedang servis',
    ])->assertRedirect();
    expect($unit->fresh()->status)->toBe('inactive');

    // Inactive unit blocks assignment.
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id])
        ->assertSessionHasErrors('unit');
});

test('unit tied to active booking cannot be deleted', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['stock' => 5]);
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-101']);
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id]);

    $this->delete("/admin/units/{$unit->id}")->assertStatus(422);
    expect(VehicleUnit::whereKey($unit->id)->exists())->toBeTrue();
});

// ---------- Availability math ----------

test('availability is computed from active units minus overlapping bookings', function () {
    $vehicle = makeVehicle(['stock' => 6]);
    foreach (['VR-201', 'VR-202', 'VR-203', 'VR-204', 'VR-205', 'VR-206'] as $code) {
        makeUnit($vehicle, ['unit_code' => $code]);
    }

    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();

    $summary = $vehicle->availabilitySummary($start, $end);
    expect($summary)->toMatchArray(['mode' => 'units', 'available' => 6, 'total' => 6]);

    $this->actingAs(makeAdmin());
    $first = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$first->booking_code}/confirm");
    $this->post("/admin/bookings/{$first->booking_code}/assign-unit", [
        'vehicle_unit_id' => $vehicle->units()->where('unit_code', 'VR-201')->first()->id,
    ]);

    $second = operationalBooking($vehicle, [
        'start_date' => Carbon::today()->addDays(2)->toDateString(),
        'end_date' => Carbon::today()->addDays(5)->toDateString(),
    ]);
    $this->post("/admin/bookings/{$second->booking_code}/confirm");

    // 1 unit assigned + 1 generic overlap = 4 available.
    $overlap = $vehicle->availabilitySummary(
        Carbon::today()->addDays(2)->toDateString(),
        Carbon::today()->addDays(3)->toDateString()
    );
    expect($overlap['available'])->toBe(4);

    // 4 active units fully overlapped = 0 available.
    VehicleUnit::where('vehicle_id', $vehicle->id)->whereIn('unit_code', ['VR-205', 'VR-206'])
        ->update(['status' => 'inactive']);
    foreach (['VR-202', 'VR-203', 'VR-204'] as $i => $code) {
        $extra = operationalBooking($vehicle, [
            'start_date' => Carbon::today()->addDays(2)->toDateString(),
            'end_date' => Carbon::today()->addDays(3)->toDateString(),
        ]);
        $this->post("/admin/bookings/{$extra->booking_code}/confirm");
        $this->post("/admin/bookings/{$extra->booking_code}/assign-unit", [
            'vehicle_unit_id' => $vehicle->units()->where('unit_code', $code)->first()->id,
        ]);
    }
    $full = $vehicle->availabilitySummary(
        Carbon::today()->addDays(2)->toDateString(),
        Carbon::today()->addDays(3)->toDateString()
    );
    expect($full)->toMatchArray(['total' => 4, 'available' => 0]);
});

// ---------- Operations pages ----------

test('admin can view operations dashboard and calendar', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    operationalBooking($vehicle);

    $this->get('/admin/operations')->assertOk();
    $this->get('/admin/operations/calendar')->assertOk();
    $this->get('/admin/drivers/'.makeDriver(['whatsapp' => '087777777777'])->id)->assertOk();
});

// ---------- Customer regression ----------

test('customer booking with driver locks return to outlet, then track it', function () {
    $vehicle = makeVehicle();
    $driver = makeDriver(['name' => 'Joko Susilo', 'whatsapp' => '088888888888', 'sim_number' => 'SIM-RAHASIA-001']);

    // Dengan driver, pengembalian dikunci ke outlet walau request meminta pickup.
    $booking = operationalBooking($vehicle, [
        'with_driver' => true,
        'return_method' => 'pickup',
        'return_address' => 'Stasiun Solo Balapan',
    ]);

    expect($booking->fresh()->return_method)->toBe('outlet')
        ->and($booking->fresh()->return_address)->toBeNull();

    $this->actingAs(makeAdmin());
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-driver", ['driver_id' => $driver->id]);

    // Customer tracking exposes driver name + return info via props
    // (no SSR — rendered labels live in the JS bundle), never SIM details.
    $this->get('/booking/check?'.http_build_query(['code' => $booking->booking_code, 'phone' => '081234567890']))
        ->assertOk()
        ->assertSee('Joko Susilo')
        ->assertSee('"with_driver":true', false)
        ->assertSee('"return_method":"outlet"', false)
        ->assertDontSee('SIM-RAHASIA-001');
});

test('photo validation applies to handover uploads', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle, ['unit_code' => 'VR-300']);
    $booking = operationalBooking($vehicle);
    $this->post("/admin/bookings/{$booking->booking_code}/confirm");
    $this->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id]);
    payOperationalDp($booking);
    $this->post("/admin/bookings/{$booking->booking_code}/ready");

    $this->post("/admin/bookings/{$booking->booking_code}/handover", [
        'checklist' => ['body', 'lampu', 'ban', 'rem', 'spion', 'stnk', 'kunci', 'bbm'],
        'handover_photos' => [UploadedFile::fake()->create('note.txt', 10, 'text/plain')],
    ])->assertSessionHasErrors('handover_photos.0');
});
