<?php

use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\PaymentService;
use App\Services\Reports\ReportService;
use App\Support\Reports\ReportPeriod;
use Carbon\Carbon;
use Inertia\Testing\AssertableInertia;

/** Bayar booking via jalur server dengan nominal & waktu custom (tanpa upload). */
function payTestAmount(Booking $booking, int $amount, ?Carbon $paidAt = null): Payment
{
    $at = $paidAt ?? now();
    $payment = Payment::create([
        'booking_id' => $booking->id,
        'payment_code' => app(PaymentService::class)->generatePaymentCode(),
        'type' => 'full_payment',
        'method' => 'bank_transfer',
        'amount' => $amount,
        'status' => Payment::STATUS_PAID,
        'paid_at' => $at,
        'submitted_at' => $at,
    ]);
    $payment->created_at = $at->copy();
    $payment->save();
    app(PaymentService::class)->syncBookingPayment($booking->fresh());

    return $payment->fresh();
}

/** Booking dengan total & timestamp eksak untuk skenario laporan. */
function datedBooking($vehicle, int $total, string $status = 'completed', ?Carbon $createdAt = null): Booking
{
    $booking = operationalBooking($vehicle);
    $at = $createdAt ?? now();
    $booking->total = $total;
    $booking->subtotal = $total;
    $booking->status = $status;
    $booking->payment_status = 'unpaid';
    $booking->created_at = $at->copy();
    $booking->updated_at = $at->copy();
    $booking->save();

    return $booking->fresh();
}

function completedRefund(Booking $booking, int $amount, ?Carbon $processedAt = null): Refund
{
    $at = $processedAt ?? now();
    $refund = Refund::create([
        'booking_id' => $booking->id,
        'refund_code' => Refund::generateCode(),
        'amount' => $amount,
        'status' => Refund::STATUS_COMPLETED,
        'reason' => 'Uji laporan',
        'channel' => Refund::CHANNEL_MANUAL,
        'reference' => 'REF-TEST-001',
        'processed_at' => $at,
    ]);
    $refund->created_at = $at->copy();
    $refund->save();

    return $refund->fresh();
}

function datedDamageCharge(Booking $booking, int $total, ?Carbon $createdAt = null): DamageCharge
{
    $at = $createdAt ?? now();
    $charge = DamageCharge::create([
        'booking_id' => $booking->id,
        'charge_code' => DamageCharge::generateCode(),
        'subtotal' => $total,
        'total' => $total,
        'status' => DamageCharge::STATUS_UNPAID,
    ]);
    $charge->created_at = $at->copy();
    $charge->save();

    return $charge->fresh();
}

function payTestDamage(DamageCharge $charge, int $amount, ?Carbon $paidAt = null): Payment
{
    $at = $paidAt ?? now();

    return Payment::create([
        'booking_id' => $charge->booking_id,
        'damage_charge_id' => $charge->id,
        'payment_code' => app(PaymentService::class)->generatePaymentCode(),
        'type' => Payment::TYPE_DAMAGE,
        'method' => 'bank_transfer',
        'amount' => $amount,
        'status' => Payment::STATUS_PAID,
        'paid_at' => $at,
        'submitted_at' => $at,
    ]);
}

// ---------- Authorization ----------

test('guest is redirected from reports to admin login', function () {
    $this->get('/admin/reports')->assertRedirect(route('admin.login'));
    $this->get('/admin/reports/export?report=booking')->assertRedirect(route('admin.login'));
});

test('customer cannot access reports or export', function () {
    $this->actingAs(makeCustomer());

    $this->get('/admin/reports')->assertForbidden();
    $this->get('/admin/reports/export?report=booking')->assertForbidden();
});

test('admin can access every report tab', function () {
    $this->actingAs(makeAdmin());

    foreach (['overview', 'booking', 'demand', 'revenue', 'vehicle', 'driver', 'customer', 'cancellation', 'refund', 'damage', 'maintenance', 'forecast', 'outstanding', 'insights'] as $tab) {
        $this->get("/admin/reports?tab={$tab}&period=last_30")->assertOk();
    }
});

// ---------- Skenario spec §48 ----------

test('phase 8 financial scenario matches spec numbers', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    // Booking A Rp500.000 completed, Booking C Rp700.000 completed.
    $bookingA = datedBooking($vehicle, 500000, 'completed');
    payTestAmount($bookingA, 500000);
    $bookingC = datedBooking($vehicle, 700000, 'completed');
    payTestAmount($bookingC, 700000);

    // Booking B Rp300.000 cancelled dengan refund Rp200.000.
    $bookingB = datedBooking($vehicle, 300000, 'cancelled');
    payTestAmount($bookingB, 300000);
    completedRefund($bookingB, 200000);

    // Damage charge Rp150.000 paid.
    $charge = datedDamageCharge($bookingA, 150000);
    payTestDamage($charge, 150000);

    $service = app(ReportService::class);
    $period = ReportPeriod::fromArray(['period' => 'last_30']);
    $financial = $service->financial($period);

    expect($financial['grossPaidBooking'])->toBe(1500000)
        ->and($financial['refundedAmount'])->toBe(200000)
        ->and($financial['netBookingRevenue'])->toBe(1300000)
        ->and($financial['damagePaid'])->toBe(150000)
        ->and($financial['totalCustomerPayments'])->toBe(1650000);
});

// ---------- Cancellation tidak dihitung completed ----------

test('cancelled booking is not counted as completed and retained share is visible', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $booking = datedBooking($vehicle, 300000, 'cancelled');
    payTestAmount($booking, 300000);
    completedRefund($booking, 200000);

    $service = app(ReportService::class);
    $period = ReportPeriod::fromArray(['period' => 'last_30']);

    $bookingReport = $service->booking($period);
    expect($bookingReport['counts']['total'])->toBe(1)
        ->and($bookingReport['counts']['cancelled'])->toBe(1)
        ->and($bookingReport['counts']['completed'])->toBe(0);

    $financial = $service->financial($period);
    expect($financial['cancelledRetained'])->toBe(100000)
        ->and($financial['netBookingRevenue'])->toBe(100000);
});

// ---------- Refund tidak dihitung dua kali ----------

test('refund reduces net booking revenue exactly once', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $booking = datedBooking($vehicle, 500000, 'completed');
    payTestAmount($booking, 500000);
    completedRefund($booking, 300000);

    $financial = app(ReportService::class)->financial(ReportPeriod::fromArray(['period' => 'last_30']));

    expect($financial['grossPaidBooking'])->toBe(500000)
        ->and($financial['refundedAmount'])->toBe(300000)
        ->and($financial['netBookingRevenue'])->toBe(200000);
});

// ---------- Damage terpisah dari rental revenue ----------

test('damage revenue is separated from rental revenue', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $booking = datedBooking($vehicle, 500000, 'completed');
    payTestAmount($booking, 500000);
    $charge = datedDamageCharge($booking, 150000);
    payTestDamage($charge, 150000);

    $financial = app(ReportService::class)->financial(ReportPeriod::fromArray(['period' => 'last_30']));

    expect($financial['grossPaidBooking'])->toBe(500000)
        ->and($financial['damagePaid'])->toBe(150000)
        ->and($financial['netBookingRevenue'])->toBe(500000)
        ->and($financial['totalCustomerPayments'])->toBe(650000);

    $damage = app(ReportService::class)->damage(ReportPeriod::fromArray(['period' => 'last_30']));
    expect($damage['charged'])->toBe(150000)
        ->and($damage['paid'])->toBe(150000);
});

// ---------- Penanganan tanggal Asia/Jakarta ----------

test('late night Jakarta payment stays on Jakarta date', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = datedBooking($vehicle, 255000, 'completed');

    // 28 Sep 23:30 WIB = 28 Sep 16:30 UTC (tanggal UTC sama).
    // Disimpan sebagai UTC seperti perilaku produksi (now() dalam app TZ UTC).
    payTestAmount($booking, 255000, Carbon::parse('2026-09-28 23:30', 'Asia/Jakarta')->timezone('UTC'));
    // 28 Sep 00:30 WIB = 27 Sep 17:30 UTC (tanggal UTC SEBELUMnya).
    // Tanpa konversi +07:00, payment ini jatuh ke 27 Sep (bug 00:00 UTC).
    $booking2 = datedBooking($vehicle, 255000, 'completed');
    payTestAmount($booking2, 255000, Carbon::parse('2026-09-28 00:30', 'Asia/Jakarta')->timezone('UTC'));

    $period = ReportPeriod::fromArray(['period' => 'custom', 'from' => '2026-09-28', 'to' => '2026-09-28']);
    $financial = app(ReportService::class)->financial($period);

    expect($financial['grossPaidBooking'])->toBe(510000);
});

// ---------- Filter ----------

test('vehicle category filter narrows report counts', function () {
    $this->actingAs(makeAdmin());
    $motor = makeVehicle();
    $mobil = makeVehicle(['slug' => 'toyota-avanza', 'name' => 'Toyota Avanza', 'category' => 'mobil', 'price_per_day' => 350000]);

    datedBooking($motor, 255000, 'completed');
    datedBooking($mobil, 350000, 'completed');

    $service = app(ReportService::class);
    $period = ReportPeriod::fromArray(['period' => 'last_30']);

    expect($service->booking($period)['counts']['total'])->toBe(2)
        ->and($service->booking($period, 'motor')['counts']['total'])->toBe(1)
        ->and($service->booking($period, 'mobil')['counts']['total'])->toBe(1)
        ->and($service->booking($period, null, $mobil->id)['counts']['total'])->toBe(1);
});

test('weekly and monthly grouping buckets sum to daily totals', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    datedBooking($vehicle, 255000, 'completed');

    $service = app(ReportService::class);

    $daily = $service->booking(ReportPeriod::fromArray(['period' => 'custom', 'from' => '2026-01-01', 'to' => '2026-03-31', 'group' => 'day']));
    $weekly = $service->booking(ReportPeriod::fromArray(['period' => 'custom', 'from' => '2026-01-01', 'to' => '2026-03-31', 'group' => 'week']));
    $monthly = $service->booking(ReportPeriod::fromArray(['period' => 'custom', 'from' => '2026-01-01', 'to' => '2026-03-31', 'group' => 'month']));

    $sum = fn (array $trend) => array_sum(array_column($trend, 'count'));
    expect($sum($daily['trend']))->toBe($sum($weekly['trend']))
        ->and($sum($weekly['trend']))->toBe($sum($monthly['trend']));
});

// ---------- Export ----------

test('admin can export booking csv honoring date filter', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();

    $inside = datedBooking($vehicle, 255000, 'completed', Carbon::parse('2026-09-10 10:00', 'Asia/Jakarta'));
    datedBooking($vehicle, 255000, 'completed', Carbon::parse('2026-07-01 10:00', 'Asia/Jakarta'));

    $response = $this->get('/admin/reports/export?report=booking&period=custom&from=2026-09-01&to=2026-09-30');
    $response->assertOk();
    $content = (string) $response->streamedContent();
    expect($response->headers->get('Content-Type'))->toContain('text/csv')
        ->and($content)->toContain('Booking Code')
        ->and($content)->toContain($inside->booking_code);
});

// ---------- Outstanding ----------

test('unpaid booking and open damage appear in outstanding', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $totals = app(ReportService::class)->outstandingTotals();
    expect($totals['booking_outstanding'])->toBe((int) $booking->total)
        ->and($totals['total'])->toBe((int) $booking->total);

    $damageBooking = activeBooking($vehicle);
    $charge = datedDamageCharge($damageBooking, 150000);

    $totals = app(ReportService::class)->outstandingTotals();
    expect($totals['damage_outstanding'])->toBe(150000);
});

// ---------- Struktur halaman ----------

test('overview page exposes accounting split and trends', function () {
    $this->actingAs(makeAdmin());
    $vehicle = makeVehicle();
    $booking = datedBooking($vehicle, 255000, 'completed');
    payTestAmount($booking, 255000);

    $this->get('/admin/reports?tab=overview&period=last_30')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('section.overview.kpis.totalBooking', 1)
            ->where('section.overview.accounting.grossPaidBooking', 255000)
            ->where('section.overview.accounting.netBookingRevenue', 255000)
            ->has('section.bookingTrend')
            ->has('section.revenueTrend'));
});
