<?php

use App\Models\MaintenanceRecord;
use Inertia\Testing\AssertableInertia;

test('damage input creates repair automatically with default priority', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['repair_cost' => 200000]))
        ->assertRedirect();

    $repair = MaintenanceRecord::whereNotNull('damage_record_id')->first();
    expect($repair)->not->toBeNull()
        ->and($repair->cost)->toBe(200000)
        ->and($repair->priority)->toBe('sedang')
        ->and($repair->status)->toBe('scheduled')
        ->and($repair->booking_id)->toBe($booking->id);

    // Muncul di daftar Perbaikan.
    $this->get('/admin/repairs')->assertOk();
});

test('admin can create standalone repair without booking with priority and eta', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle);

    $eta = now()->addDays(3)->format('Y-m-d\TH:i');
    $this->post('/admin/repairs', [
        'vehicle_unit_id' => $unit->id,
        'title' => 'Rem blong',
        'cost' => 300000,
        'priority' => 'darurat',
        'estimated_completed_at' => $eta,
    ])->assertRedirect();

    $repair = MaintenanceRecord::first();
    expect($repair->booking_id)->toBeNull()
        ->and($repair->priority)->toBe('darurat')
        ->and($repair->estimated_completed_at)->not->toBeNull()
        ->and($repair->status)->toBe('scheduled');

    // Status bisa diubah dari pusat Perbaikan, unit ikut nonaktif/aktif.
    $this->patch("/admin/maintenances/{$repair->id}/status", ['status' => 'in_progress'])->assertRedirect();
    expect($unit->fresh()->status)->toBe('inactive');

    $this->patch("/admin/maintenances/{$repair->id}/status", ['status' => 'completed'])->assertRedirect();
    expect($unit->fresh()->status)->toBe('active');
});

test('repairs index supports priority and overdue filters', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle);

    MaintenanceRecord::create([
        'vehicle_unit_id' => $unit->id,
        'title' => 'Terlambat servis',
        'cost' => 50000,
        'priority' => 'tinggi',
        'status' => 'scheduled',
        'estimated_completed_at' => now()->subDay(),
        'unit_status_before' => 'active',
    ]);

    $this->get('/admin/repairs?overdue=1')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('filters.overdue', '1')
            ->has('repairs.data', 1));

    $this->get('/admin/repairs?priority=tinggi')->assertOk();
});

test('return inspection groups all damages into one repair per unit', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/return", [
        'return_condition' => 'damage',
        'return_fuel' => '3/4',
        'damages' => [
            ['title' => 'oli bocor', 'repair_cost' => 100000],
            ['title' => 'Tromol', 'repair_cost' => 120000],
            ['title' => 'Seker', 'repair_cost' => 200000],
        ],
    ])->assertRedirect();

    // Satu baris gabungan, bukan tiga baris terpisah.
    expect(MaintenanceRecord::count())->toBe(1);
    $repair = MaintenanceRecord::first();
    expect($repair->title)->toBe('oli bocor, Tromol, Seker')
        ->and($repair->cost)->toBe(420000)
        ->and($repair->status)->toBe('scheduled');

    // Tagihan tetap merinci per kerusakan.
    expect($booking->damageCharges()->first()->items()->count())->toBe(3);
});

test('follow-up damage merges into the scheduled group', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['title' => 'oli bocor', 'repair_cost' => 100000]))
        ->assertRedirect();
    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['title' => 'Skok Bocor', 'repair_cost' => 150000]))
        ->assertRedirect();

    expect(MaintenanceRecord::count())->toBe(1);
    $repair = MaintenanceRecord::first();
    expect($repair->title)->toBe('oli bocor, Skok Bocor')
        ->and($repair->cost)->toBe(250000);
});

test('deleting damage shrinks the group and removes it when empty', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/return", [
        'return_condition' => 'damage',
        'return_fuel' => '3/4',
        'damages' => [
            ['title' => 'oli bocor', 'repair_cost' => 100000],
            ['title' => 'Tromol', 'repair_cost' => 120000],
        ],
    ])->assertRedirect();

    $first = $booking->damageRecords()->orderBy('id')->first();
    $this->delete("/admin/damages/{$first->id}")->assertRedirect();

    $repair = MaintenanceRecord::first();
    expect($repair)->not->toBeNull()
        ->and($repair->title)->toBe('Tromol')
        ->and($repair->cost)->toBe(120000);

    $last = $booking->damageRecords()->first();
    $this->delete("/admin/damages/{$last->id}")->assertRedirect();
    expect(MaintenanceRecord::count())->toBe(0);
});

test('started repairs are left untouched by damage changes', function () {
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['title' => 'oli bocor', 'repair_cost' => 100000]))
        ->assertRedirect();
    $repair = MaintenanceRecord::first();
    $this->patch("/admin/maintenances/{$repair->id}/status", ['status' => 'in_progress'])->assertRedirect();

    // Kerusakan susulan membuat grup terjadwal baru, histori berjalan tidak diubah.
    $this->post("/admin/bookings/{$booking->booking_code}/damages", damagePayload(['title' => 'Skok Bocor', 'repair_cost' => 150000]))
        ->assertRedirect();

    expect(MaintenanceRecord::count())->toBe(2);
    expect($repair->fresh()->title)->toBe('oli bocor')
        ->and($repair->fresh()->cost)->toBe(100000);
});

test('non-admin cannot access repairs', function () {
    $this->actingAs(makeCustomer());
    $this->get('/admin/repairs')->assertForbidden();
    $this->post('/admin/repairs', ['title' => 'x'])->assertForbidden();
});

test('return inspection accepts browser multipart encoding with empty photo fields', function () {
    // Bentuk persis yang dikirim browser (forceFormData): field photo kosong
    // dikirim sebagai string kosong, satu file asli agar request multipart.
    $vehicle = makeVehicle();
    $booking = activeBooking($vehicle);

    $response = $this->call(
        'POST',
        "/admin/bookings/{$booking->booking_code}/return",
        [
            'return_condition' => 'damage',
            'return_fuel' => '3/4',
            'return_notes' => '',
            'damages' => [
                ['title' => 'spion', 'description' => '', 'repair_cost' => '20000', 'photo' => ''],
                ['title' => 'pedal', 'description' => '', 'repair_cost' => '20000', 'photo' => ''],
                ['title' => 'skok', 'description' => '', 'repair_cost' => '300000', 'photo' => ''],
                ['title' => 'body', 'description' => '', 'repair_cost' => '145000', 'photo' => ''],
            ],
        ],
        [],
        ['return_photos' => [Illuminate\Http\UploadedFile::fake()->create('r.jpg', 100, 'image/jpeg')]],
        ['HTTP_ACCEPT' => 'text/html, application/xhtml+xml', 'HTTP_X_INERTIA' => 'true']
    );

    $response->assertRedirect();
    expect($booking->damageCharges()->first()->total)->toBe(485000)
        ->and(MaintenanceRecord::count())->toBe(1)
        ->and(MaintenanceRecord::first()->title)->toBe('spion, pedal, skok, body');
});
