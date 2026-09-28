<?php

use App\Services\Reports\ForecastService;
use Carbon\Carbon;

function forecastService(): ForecastService
{
    return app(ForecastService::class);
}

test('forecast reports insufficient data on fresh database', function () {
    $result = forecastService()->forecast();

    expect($result['sufficient'])->toBeFalse()
        ->and($result['message'])->toBe('Belum tersedia cukup data')
        ->and($result['forecast_next'])->toBeNull();
});

test('forecast averages last 3 full months and labels estimasi', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $tz = 'Asia/Jakarta';

    // Bangun skenario deterministik: 3 bulan penuh terakhir dengan
    // net 300rb / 600rb / 900rb + 1 bulan lebih tua sebagai riwayat.
    $monthNets = [300000, 600000, 900000];
    foreach ([4, 3, 2, 1] as $idx => $monthsAgo) {
        $month = Carbon::now($tz)->startOfMonth()->subMonthsNoOverflow($monthsAgo);
        $amount = $idx === 0 ? 100000 : $monthNets[$idx - 1];
        $booking = datedBooking($vehicle, $amount, 'completed', $month->copy()->addDays(5)->setTime(12, 0));
        payTestAmount($booking, $amount, $month->copy()->addDays(6)->setTime(12, 0));
    }

    $result = forecastService()->forecast();

    expect($result['sufficient'])->toBeTrue()
        ->and($result['average_net'])->toBe(600000)
        ->and($result['forecast_next'])->toBe(600000)
        ->and($result['forecast_label'])->toStartWith('Estimasi ');
});

test('forecast tab renders insufficient state without crashing', function () {
    $this->actingAs(makeAdmin());

    $this->get('/admin/reports?tab=forecast&period=this_month')->assertOk();
});

test('forecast export csv is downloadable', function () {
    $this->actingAs(makeAdmin());

    $this->get('/admin/reports/export?report=forecast&period=this_month')
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=UTF-8');
});
