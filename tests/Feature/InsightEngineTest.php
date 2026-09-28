<?php

use App\Models\MaintenanceRecord;
use App\Services\Insights\InsightEngine;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

function insightEngine(): InsightEngine
{
    return app(InsightEngine::class);
}

beforeEach(function () {
    // Engine memakai Cache 10 menit — flush antar test agar hasil segar.
    Cache::flush();
});

test('empty database yields no insights but keeps timestamp', function () {
    $result = insightEngine()->get(null, null, 100);

    expect($result['insights'])->toBeArray()->toBeEmpty();
    expect($result['generated_at'])->toBeString()->not->toBeEmpty();
});

test('rules below min sample emit nothing', function () {
    $vehicle = makeVehicle();
    for ($i = 0; $i < 3; $i++) {
        datedBooking($vehicle, 100000, 'completed');
    }

    $result = insightEngine()->get(null, null, 100);
    $ids = array_column($result['insights'], 'id');

    expect($ids)->not->toContain('booking_growth')
        ->and($ids)->not->toContain('cancellation_rate')
        ->and($ids)->not->toContain('repeat_customer');
});

test('weekend demand rule fires with factual wording', function () {
    $vehicle = makeVehicle();
    $tz = 'Asia/Jakarta';
    $saturday = Carbon::now($tz)->previous(Carbon::SATURDAY)->setTime(12, 0);
    $monday = $saturday->copy()->previous(Carbon::MONDAY)->setTime(12, 0);

    for ($i = 0; $i < 8; $i++) {
        datedBooking($vehicle, 100000, 'completed', $saturday->copy());
    }
    for ($i = 0; $i < 2; $i++) {
        datedBooking($vehicle, 100000, 'completed', $monday->copy());
    }

    $result = insightEngine()->get(null, null, 100);
    $ids = array_column($result['insights'], 'id');

    expect($ids)->toContain('weekend_demand');

    $insight = collect($result['insights'])->firstWhere('id', 'weekend_demand');
    expect($insight['title'])->not->toMatch('/terbaik|terburuk/i')
        ->and($insight['evidence'])->not->toBeEmpty()
        ->and($insight['action_url'])->toBe('/admin/reports?tab=demand');
});

test('cancellation rate rule fires above threshold', function () {
    $vehicle = makeVehicle();
    for ($i = 0; $i < 14; $i++) {
        datedBooking($vehicle, 100000, 'completed');
    }
    for ($i = 0; $i < 6; $i++) {
        datedBooking($vehicle, 100000, 'cancelled');
    }

    $result = insightEngine()->get(null, null, 100);
    $ids = array_column($result['insights'], 'id');

    expect($ids)->toContain('cancellation_rate');
});

test('maintenance frequency rule fires for repeated unit downtime', function () {
    $vehicle = makeVehicle();
    $unit = makeUnit($vehicle);
    $at = now()->subDays(10);

    foreach ([[9, 6], [4, 1]] as [$startAgo, $endAgo]) {
        $record = MaintenanceRecord::create([
            'vehicle_unit_id' => $unit->id,
            'title' => 'Servis berkala',
            'status' => MaintenanceRecord::STATUS_COMPLETED,
            'started_at' => now()->subDays($startAgo),
            'completed_at' => now()->subDays($endAgo),
        ]);
        $record->created_at = $at->copy();
        $record->save();
    }

    $result = insightEngine()->get(null, null, 100);
    $ids = array_column($result['insights'], 'id');

    expect($ids)->toContain('maintenance_unit_'.$unit->id);
});

test('low stock rule fires for nearly empty available types', function () {
    makeVehicle(['slug' => 'suzuki-nex', 'name' => 'Suzuki Nex', 'stock' => 1, 'is_available' => true]);

    $result = insightEngine()->get(null, null, 100);
    $ids = array_column($result['insights'], 'id');

    expect($ids)->toContain('low_stock');
});

test('insight ids are unique across rules', function () {
    $vehicle = makeVehicle();
    for ($i = 0; $i < 25; $i++) {
        datedBooking($vehicle, 100000, 'completed');
    }

    $result = insightEngine()->get(null, null, 100);
    $ids = array_column($result['insights'], 'id');

    expect($ids)->toHaveCount(count(array_unique($ids)));
});

test('dashboard insight cap is at most 3', function () {
    $vehicle = makeVehicle();
    for ($i = 0; $i < 25; $i++) {
        datedBooking($vehicle, 100000, 'completed');
    }
    makeVehicle(['slug' => 'suzuki-nex', 'name' => 'Suzuki Nex', 'stock' => 1, 'is_available' => true]);

    $all = insightEngine()->get(null, null, 100);
    expect(count($all['insights']))->toBeGreaterThanOrEqual(3);

    $capped = insightEngine()->get(null, null, 3);
    expect($capped['insights'])->toHaveCount(3);
});
