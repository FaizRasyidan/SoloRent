<?php

use App\Models\Vehicle;
use Carbon\Carbon;

function makeVehicle(array $overrides = []): Vehicle
{
    return Vehicle::create(array_merge([
        'slug' => 'honda-vario-160',
        'name' => 'Honda Vario 160',
        'category' => 'motor',
        'transmission' => 'automatic',
        'seats' => 2,
        'engine' => '160cc',
        'price_per_day' => 85000,
        'stock' => 3,
        'is_available' => true,
    ], $overrides));
}

test('catalog page loads for guests', function () {
    makeVehicle();

    $this->get('/vehicles')->assertOk();
});

test('vehicle detail page loads by slug', function () {
    makeVehicle();

    $this->get('/vehicles/honda-vario-160')->assertOk();
});

test('vehicle detail returns 404 for unknown slug', function () {
    $this->get('/vehicles/kendaraan-tidak-ada')->assertNotFound();
});

test('cara rental guide page loads for guests', function () {
    $this->get('/cara-rental')->assertOk();
});

test('catalog accepts landing search filters and reports period availability', function () {
    $vehicle = makeVehicle();
    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();

    $this->get("/vehicles?category=motor&start_date={$start}&end_date={$end}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('filters.category', 'motor')
            ->where('filters.start_date', $start)
            ->where('filters.end_date', $end)
            ->has('vehicles', 1)
            ->where('vehicles.0.period_available', 3)
        );
});

test('fully booked vehicle shows zero period availability', function () {
    $vehicle = makeVehicle(['stock' => 1]);
    operationalBooking($vehicle);
    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();

    $this->get("/vehicles?category=motor&start_date={$start}&end_date={$end}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('vehicles.0.period_available', 0)
        );
});
