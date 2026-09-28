<?php

use App\Models\Booking;
use App\Models\Vehicle;
use App\Models\VehicleImage;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

function fakeImage(string $name = 'foto.png'): UploadedFile
{
    // Minimal 1x1 PNG bytes — no GD extension required.
    $path = tempnam(sys_get_temp_dir(), 'veh').'.png';
    file_put_contents($path, base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    ));

    return new UploadedFile($path, $name, 'image/png', null, true);
}

function vehiclePayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Honda Vario 160',
        'brand' => 'Honda',
        'model' => 'Vario 160',
        'category' => 'motor',
        'transmission' => 'automatic',
        'seats' => 2,
        'engine' => '160cc',
        'fuel' => 'Bensin',
        'baggage' => '18 Liter',
        'price_per_day' => 85000,
        'stock' => 3,
        'description' => 'Motor nyaman untuk harian.',
        'benefits' => ['2 Helm SNI', 'Jas Hujan'],
        'status' => 'active',
    ], $overrides);
}

test('guest cannot access vehicle management', function () {
    $vehicle = makeVehicle();

    $this->get('/admin/vehicles')->assertRedirect(route('admin.login'));
    $this->get('/admin/vehicles/create')->assertRedirect(route('admin.login'));
    $this->post('/admin/vehicles', vehiclePayload())->assertRedirect(route('admin.login'));
    $this->get("/admin/vehicles/{$vehicle->slug}")->assertRedirect(route('admin.login'));
    $this->get("/admin/vehicles/{$vehicle->slug}/edit")->assertRedirect(route('admin.login'));
    $this->put("/admin/vehicles/{$vehicle->slug}", vehiclePayload())->assertRedirect(route('admin.login'));
    $this->patch("/admin/vehicles/{$vehicle->slug}/status", ['status' => 'inactive'])->assertRedirect(route('admin.login'));
    $this->delete("/admin/vehicles/{$vehicle->slug}")->assertRedirect(route('admin.login'));
});

test('non-admin cannot access vehicle management', function () {
    $this->actingAs(makeCustomer());
    $vehicle = makeVehicle();

    $this->get('/admin/vehicles')->assertForbidden();
    $this->get('/admin/vehicles/create')->assertForbidden();
    $this->post('/admin/vehicles', vehiclePayload())->assertForbidden();
    $this->get("/admin/vehicles/{$vehicle->slug}")->assertForbidden();
    $this->put("/admin/vehicles/{$vehicle->slug}", vehiclePayload())->assertForbidden();
    $this->delete("/admin/vehicles/{$vehicle->slug}")->assertForbidden();
});

test('admin can view vehicle list with search and filters', function () {
    $this->actingAs(makeAdmin());
    makeVehicle();
    makeVehicle(['slug' => 'toyota-avanza', 'name' => 'Toyota Avanza', 'category' => 'mobil', 'price_per_day' => 350000]);

    $this->get('/admin/vehicles')->assertOk();

    $response = $this->get('/admin/vehicles?'.http_build_query(['search' => 'Vario', 'category' => 'motor', 'status' => 'active']));
    $response->assertOk();
    $response->assertInertia(
        fn (AssertableInertia $page) => $page
            ->has('vehicles.data', 1)
            ->where('vehicles.data.0.name', 'Honda Vario 160')
    );
});

test('admin can create vehicle with generated slug', function () {
    $this->actingAs(makeAdmin());

    $response = $this->post('/admin/vehicles', vehiclePayload());

    $vehicle = Vehicle::first();
    expect($vehicle->slug)->toBe('honda-vario-160')
        ->and($vehicle->brand)->toBe('Honda')
        ->and($vehicle->fuel)->toBe('Bensin')
        ->and($vehicle->benefits)->toBe(['2 Helm SNI', 'Jas Hujan'])
        ->and($vehicle->is_available)->toBeTrue();

    $response->assertRedirect(route('admin.vehicles.show', $vehicle));
});

test('duplicate names get unique slugs without breaking history', function () {
    $this->actingAs(makeAdmin());

    $this->post('/admin/vehicles', vehiclePayload());
    $this->post('/admin/vehicles', vehiclePayload(['price_per_day' => 90000]));

    expect(Vehicle::pluck('slug')->all())->toBe(['honda-vario-160', 'honda-vario-160-2']);
});

test('admin can view detail and edit vehicle', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $this->get("/admin/vehicles/{$vehicle->slug}")->assertOk();
    $this->get("/admin/vehicles/{$vehicle->slug}/edit")->assertOk();

    $this->put("/admin/vehicles/{$vehicle->slug}", vehiclePayload([
        'price_per_day' => 90000,
        'benefits' => ['2 Helm SNI', 'Jas Hujan', 'STNK'],
    ]))->assertRedirect(route('admin.vehicles.show', $vehicle));

    $vehicle->refresh();
    expect($vehicle->price_per_day)->toBe(90000)
        ->and($vehicle->benefits)->toHaveCount(3)
        ->and($vehicle->slug)->toBe('honda-vario-160');
});

test('admin can deactivate and reactivate vehicle', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $this->patch("/admin/vehicles/{$vehicle->slug}/status", ['status' => 'inactive'])
        ->assertRedirect();

    $vehicle->refresh();
    expect($vehicle->status)->toBe('inactive')->and($vehicle->is_available)->toBeFalse();

    $this->patch("/admin/vehicles/{$vehicle->slug}/status", ['status' => 'active']);
    expect($vehicle->fresh()->is_available)->toBeTrue();
});

test('vehicle without history is hard deleted with its files', function () {
    Storage::fake('public');
    $this->actingAs(makeAdmin());

    $this->post('/admin/vehicles', array_merge(vehiclePayload(), [
        'images' => [fakeImage('vario.png')],
    ]));

    $vehicle = Vehicle::first();
    $path = $vehicle->images()->first()->path;
    Storage::disk('public')->assertExists($path);

    $this->delete("/admin/vehicles/{$vehicle->slug}")->assertRedirect(route('admin.vehicles.index'));

    $this->assertDatabaseCount('vehicles', 0);
    $this->assertDatabaseCount('vehicle_images', 0);
    Storage::disk('public')->assertMissing($path);
});

test('vehicle with booking history is soft deleted and history survives', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['price_per_day' => 100000, 'stock' => 2]);

    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();
    $this->post('/booking', bookingPayload($vehicle, [
        'start_date' => $start,
        'end_date' => $end,
    ]))->assertRedirect();

    $code = Booking::first()->booking_code;

    $this->delete("/admin/vehicles/{$vehicle->slug}")->assertRedirect(route('admin.vehicles.index'));

    expect(Vehicle::count())->toBe(0)
        ->and(Vehicle::withTrashed()->count())->toBe(1);

    // Booking history (incl. vehicle relation) still resolves
    $this->get('/booking/success/'.$code)->assertOk();
    $this->get('/booking/check?'.http_build_query(['code' => $code, 'phone' => '081234567890']))->assertOk();
});

test('vehicle validation rejects bad input', function () {
    $this->actingAs(makeAdmin());

    $this->post('/admin/vehicles', vehiclePayload(['name' => '']))
        ->assertSessionHasErrors('name');

    $this->post('/admin/vehicles', vehiclePayload(['price_per_day' => null]))
        ->assertSessionHasErrors('price_per_day');

    $this->post('/admin/vehicles', vehiclePayload(['price_per_day' => -50000]))
        ->assertSessionHasErrors('price_per_day');

    $this->post('/admin/vehicles', vehiclePayload(['category' => 'pesawat']))
        ->assertSessionHasErrors('category');

    $this->post('/admin/vehicles', vehiclePayload(['status' => 'rusak']))
        ->assertSessionHasErrors('status');

    $this->assertDatabaseCount('vehicles', 0);
});

test('valid image upload is accepted and first image becomes primary', function () {
    Storage::fake('public');
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $this->post("/admin/vehicles/{$vehicle->slug}/images", [
        'images' => [fakeImage('depan.png'), fakeImage('samping.png')],
    ])->assertRedirect();

    $images = $vehicle->images()->orderBy('id')->get();
    expect($images)->toHaveCount(2)
        ->and($images[0]->is_primary)->toBeTrue()
        ->and($images[1]->is_primary)->toBeFalse();

    foreach ($images as $image) {
        Storage::disk('public')->assertExists($image->path);
    }
});

test('non-image file upload is rejected', function () {
    Storage::fake('public');
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $this->post("/admin/vehicles/{$vehicle->slug}/images", [
        'images' => [UploadedFile::fake()->create('exploit.php', 100, 'application/x-php')],
    ])->assertSessionHasErrors('images.0');

    $this->assertDatabaseCount('vehicle_images', 0);
});

test('only one primary image exists and deletion promotes another', function () {
    Storage::fake('public');
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    VehicleImage::create(['vehicle_id' => $vehicle->id, 'path' => 'vehicles/a.jpg', 'is_primary' => true, 'sort_order' => 0]);
    VehicleImage::create(['vehicle_id' => $vehicle->id, 'path' => 'vehicles/b.jpg', 'is_primary' => false, 'sort_order' => 1]);

    $second = $vehicle->images()->where('path', 'vehicles/b.jpg')->first();

    $this->patch("/admin/vehicle-images/{$second->id}/primary")->assertRedirect();
    expect($vehicle->images()->where('is_primary', true)->count())->toBe(1)
        ->and($second->fresh()->is_primary)->toBeTrue();

    $this->delete("/admin/vehicle-images/{$second->id}")->assertRedirect();
    $remaining = $vehicle->images()->first();
    expect($remaining->is_primary)->toBeTrue();
    expect($vehicle->images()->where('is_primary', true)->count())->toBe(1);
});

test('customer catalog hides inactive vehicles and blocks their booking', function () {
    $active = makeVehicle();
    $inactive = makeVehicle(['slug' => 'motor-rusak', 'name' => 'Motor Rusak', 'status' => 'inactive']);

    $this->get('/vehicles')->assertOk()->assertSee($active->name)->assertDontSee('Motor Rusak');
    $this->get("/vehicles/{$inactive->slug}")->assertNotFound();
    $this->get("/vehicles/{$active->slug}")->assertOk();

    $this->post('/booking', bookingPayload($inactive))->assertSessionHasErrors('availability');
    $this->assertDatabaseCount('bookings', 0);

    $response = $this->getJson('/booking/availability?'.http_build_query([
        'vehicle_id' => $inactive->id,
        'start_date' => Carbon::today()->addDay()->toDateString(),
        'end_date' => Carbon::today()->addDays(4)->toDateString(),
    ]));
    $response->assertOk()->assertJson(['available' => false]);
});

test('price change does not alter old bookings but applies to new ones', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle(['price_per_day' => 85000, 'stock' => 5]);

    $this->post('/booking', bookingPayload($vehicle))->assertRedirect();
    expect(Booking::first()->price_per_day)->toBe(85000);

    $this->put("/admin/vehicles/{$vehicle->slug}", vehiclePayload(['price_per_day' => 90000]))
        ->assertRedirect();

    expect(Booking::first()->fresh()->price_per_day)->toBe(85000);

    $this->post('/booking', bookingPayload($vehicle, [
        'start_date' => Carbon::today()->addDays(10)->toDateString(),
        'end_date' => Carbon::today()->addDays(13)->toDateString(),
    ]))->assertRedirect();

    expect(Booking::orderBy('id', 'desc')->first()->price_per_day)->toBe(90000);
});

test('customer detail reflects latest admin data', function () {
    $vehicle = makeVehicle();
    $vehicle->update(['benefits' => ['2 Helm', 'Jas Hujan', 'STNK'], 'price_per_day' => 95000]);

    $this->get("/vehicles/{$vehicle->slug}")
        ->assertOk()
        ->assertSee('Jas Hujan')
        ->assertSee('95000');
});
