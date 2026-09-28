<?php

use App\Models\Booking;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\Carbon;
use Inertia\Testing\AssertableInertia;

function makeAdmin(array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'name' => 'SoloRent Admin',
        'email' => 'admin@solorent.test',
        'role' => 'admin',
    ], $overrides));
}

function makeCustomer(array $overrides = []): User
{
    return User::factory()->create(array_merge(['role' => 'customer'], $overrides));
}

test('guest cannot access admin dashboard and is redirected to admin login', function () {
    $this->get('/admin/dashboard')->assertRedirect(route('admin.login'));
    $this->get('/admin/login')->assertOk();
});

test('authenticated non-admin cannot access admin dashboard', function () {
    $this->actingAs(makeCustomer());

    $this->get('/admin/dashboard')->assertForbidden();
});

test('non-admin cannot login through admin login', function () {
    $user = makeCustomer(['email' => 'user@solorent.test']);

    $this->post('/admin/login', [
        'email' => 'user@solorent.test',
        'password' => 'password',
    ])->assertForbidden();

    expect($user->fresh()->role)->toBe('customer');
});

test('invalid credentials cannot login to admin', function () {
    makeAdmin();

    $this->post('/admin/login', [
        'email' => 'admin@solorent.test',
        'password' => 'wrong-password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('admin can login and access dashboard', function () {
    makeAdmin();

    $response = $this->post('/admin/login', [
        'email' => 'admin@solorent.test',
        'password' => 'password',
    ]);

    $response->assertRedirect(route('admin.dashboard'));
    $this->assertAuthenticated();

    $this->get('/admin/dashboard')->assertOk();
});

test('logged in admin visiting login page is redirected to dashboard', function () {
    $this->actingAs(makeAdmin());

    $this->get('/admin/login')->assertRedirect(route('admin.dashboard'));
});

test('admin can logout and loses dashboard access', function () {
    $this->actingAs(makeAdmin());

    $this->post('/admin/logout')->assertRedirect(route('admin.login'));
    $this->assertGuest();

    $this->get('/admin/dashboard')->assertRedirect(route('admin.login'));
});

test('admin login requires valid email and password', function () {
    $this->post('/admin/login', ['email' => 'not-an-email', 'password' => 'password'])
        ->assertSessionHasErrors('email');

    $this->post('/admin/login', ['email' => 'admin@solorent.test'])
        ->assertSessionHasErrors('password');
});

test('admin dashboard shows real database counts without dummy data', function () {
    makeVehicle(['slug' => 'honda-vario-160', 'stock' => 3]);
    makeVehicle([
        'slug' => 'toyota-avanza',
        'name' => 'Toyota Avanza',
        'category' => 'mobil',
        'price_per_day' => 350000,
        'stock' => 2,
    ]);

    $vehicle = Vehicle::where('slug', 'honda-vario-160')->first();
    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();

    Booking::create([
        'booking_code' => 'SR-20260925-0001',
        'vehicle_id' => $vehicle->id,
        'customer_name' => 'Budi Santoso',
        'customer_phone' => '081234567890',
        'start_date' => $start,
        'end_date' => $end,
        'duration_days' => 3,
        'price_per_day' => $vehicle->price_per_day,
        'subtotal' => $vehicle->price_per_day * 3,
        'pickup_method' => 'outlet',
        'total' => $vehicle->price_per_day * 3,
        'status' => 'pending',
        'terms_accepted' => true,
    ]);

    $this->actingAs(makeAdmin());

    $response = $this->get('/admin/dashboard');
    $response->assertOk();

    $response->assertInertia(
        fn (AssertableInertia $page) => $page
            ->where('kpis.bookings_today', 1)
            ->where('kpis.bookings_pending', 1)
            ->where('kpis.revenue_today', 0)
            ->where('kpis.active_rentals', 0)
            ->where('kpis.total_units', 5)
            ->where('kpis.attention_count', 0)
            ->has('trend.points', 30)
            ->has('insights.insights')
            ->has('attention.items', 0)
            ->has('recentBookings', 1)
    );
});

test('customer pages remain accessible without login', function () {
    makeVehicle();

    $this->get('/')->assertOk();
    $this->get('/vehicles')->assertOk();
    $this->get('/vehicles/honda-vario-160')->assertOk();
    $this->get('/booking')->assertOk();
    $this->get('/booking/check')->assertOk();
});
