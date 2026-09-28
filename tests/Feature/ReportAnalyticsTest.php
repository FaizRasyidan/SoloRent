<?php

use App\Services\Reports\BusinessAnalyticsService;
use App\Support\Reports\ReportPeriod;

function analytics(): BusinessAnalyticsService
{
    return app(BusinessAnalyticsService::class);
}

test('demand comparison math matches manual counts', function () {
    $vehicle = makeVehicle();
    for ($i = 0; $i < 6; $i++) {
        datedBooking($vehicle, 100000, 'completed');
    }

    $period = ReportPeriod::fromArray(['period' => 'last_30']);
    $cmp = analytics()->comparison($period);

    expect($cmp['booking_current'])->toBe(6)
        ->and($cmp['booking_previous'])->toBe(0)
        ->and($cmp['booking_change_pct'])->toBeNull();
});

test('demand tab returns weekend split and rankings', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    datedBooking($vehicle, 100000, 'completed');

    $this->get('/admin/reports?tab=demand&period=last_30')->assertOk();

    $period = ReportPeriod::fromArray(['period' => 'last_30']);
    $demand = analytics()->demand($period);
    expect($demand['total'])->toBe(1)
        ->and($demand['weekend'])->toHaveKeys(['weekend_count', 'weekday_count', 'ratio'])
        ->and($demand['by_vehicle'])->not->toBeEmpty();
});

test('customer stats group by phone with repeat share', function () {
    $vehicle = makeVehicle();
    for ($i = 0; $i < 4; $i++) {
        datedBooking($vehicle, 100000, 'completed');
    }

    $period = ReportPeriod::fromArray(['period' => 'last_30']);
    $stats = analytics()->customerStats($period);

    // operationalBooking selalu memakai phone yang sama → 1 customer, 4 booking.
    expect($stats['total_customers'])->toBe(1)
        ->and($stats['total_bookings'])->toBe(4)
        ->and($stats['repeat_customers'])->toBe(1)
        ->and($stats['repeat_pct'])->toBe(100.0);
});

test('customer and maintenance tabs render', function () {
    $this->actingAs(makeAdmin());

    $this->get('/admin/reports?tab=customer&period=last_30')->assertOk();
    $this->get('/admin/reports?tab=maintenance&period=last_30')->assertOk();
    $this->get('/admin/reports?tab=insights&period=last_30')->assertOk();
});

test('new tabs respect category and vehicle filters', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $this->get("/admin/reports?tab=demand&period=last_30&category=motor&vehicle={$vehicle->id}")->assertOk();
    $this->get('/admin/reports?tab=customer&period=last_30&category=motor')->assertOk();
    $this->get('/admin/reports?tab=maintenance&period=this_month')->assertOk();
});

test('new tabs export csv without breaking existing export', function () {
    $this->actingAs(makeAdmin());

    foreach (['demand', 'customer', 'maintenance', 'insights', 'booking', 'revenue'] as $report) {
        $this->get("/admin/reports/export?report={$report}&period=last_30")->assertOk();
    }
});
