<?php

use App\Models\Booking;
use App\Services\PaymentService;
use Carbon\Carbon;
use Inertia\Testing\AssertableInertia;

function dashboardAsAdmin(): void
{
    test()->actingAs(makeAdmin());
}

test('guest is redirected from dashboard to admin login', function () {
    $this->get('/admin/dashboard')->assertRedirect(route('admin.login'));
});

test('non-admin cannot access dashboard', function () {
    $this->actingAs(makeCustomer());
    $this->get('/admin/dashboard')->assertForbidden();
});

test('dashboard exposes exactly 4 kpis with trend insights attention recent', function () {
    $vehicle = makeVehicle();
    dashboardAsAdmin();

    $this->get('/admin/dashboard')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->has('kpis', 7)
            ->where('kpis.bookings_today', 0)
            ->where('kpis.revenue_today', 0)
            ->where('kpis.active_rentals', 0)
            ->where('kpis.total_units', 3)
            ->where('kpis.attention_count', 0)
            ->has('trend.points', 30)
            ->where('trend.range', 30)
            ->where('trend.metric', 'booking')
            ->has('insights.insights')
            ->has('insights.generated_at')
            ->has('attention.items', 0)
            ->has('recentBookings', 0)
            ->missing('overview')
            ->missing('ops')
            ->missing('bookingTrend')
            ->missing('attentionVehicles')
            ->missing('notificationCounts')
    );
});

test('dashboard kpis reflect today bookings and revenue', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payTestAmount($booking, 200000);
    dashboardAsAdmin();

    // Pelunasan penuh mengonfirmasi booking (auto-confirm PaymentService),
    // sehingga tidak ada lagi yang pending.
    $this->get('/admin/dashboard')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->where('kpis.bookings_today', 1)
            ->where('kpis.bookings_pending', 0)
            ->where('kpis.revenue_today', 200000)
            ->where('kpis.revenue_count', 1)
            ->has('recentBookings', 1)
    );
});

test('dashboard trend ranges return matching buckets', function () {
    dashboardAsAdmin();

    $this->get('/admin/dashboard?range=7')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->has('trend.points', 7)
            ->where('trend.range', 7)
    );

    $this->get('/admin/dashboard?range=30&metric=revenue')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->has('trend.points', 30)
            ->where('trend.range', 30)
            ->where('trend.metric', 'revenue')
    );

    $this->get('/admin/dashboard?range=90')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page->where('trend.range', 90)
    );
});

test('dashboard normalizes invalid range and metric instead of error', function () {
    dashboardAsAdmin();

    $this->get('/admin/dashboard?range=999&metric=foo')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->where('trend.range', 30)
            ->where('trend.metric', 'booking')
    );
});

test('dashboard recent bookings capped at 5 rows', function () {
    $vehicle = makeVehicle();
    // Periode tidak overlap agar batas ketersediaan tidak menolak booking.
    for ($i = 0; $i < 7; $i++) {
        $start = Carbon::today()->addDays(1 + $i * 5)->toDateString();
        $end = Carbon::today()->addDays(4 + $i * 5)->toDateString();
        operationalBooking($vehicle, ['start_date' => $start, 'end_date' => $end]);
    }
    dashboardAsAdmin();

    $this->get('/admin/dashboard')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page->has('recentBookings', 5)
    );
});

test('dashboard active rentals counts blocking bookings covering today', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $booking->status = 'active';
    $booking->start_date = Carbon::today()->toDateString();
    $booking->end_date = Carbon::today()->addDays(2)->toDateString();
    $booking->save();
    dashboardAsAdmin();

    $this->get('/admin/dashboard')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page->where('kpis.active_rentals', 1)
    );
});

test('dashboard attention link for unassigned driver uses driver filter', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $booking->with_driver = true;
    $booking->driver_id = null;
    $booking->status = 'confirmed';
    $booking->save();
    dashboardAsAdmin();

    // Filter baru harus menerima nilai unassigned.
    $this->get('/admin/bookings?driver=unassigned')->assertOk();

    $this->get('/admin/dashboard')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->where('kpis.attention_count', 1)
            ->where('attention.items.0.id', 'driver_unassigned')
            ->where('attention.items.0.action_url', '/admin/bookings?driver=unassigned')
    );
});
