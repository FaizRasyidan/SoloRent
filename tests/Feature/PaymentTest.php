<?php

use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function makePaidBooking(array $overrides = []): Booking
{
    $vehicle = makeVehicle();
    $start = Carbon::today()->addDay()->toDateString();
    $end = Carbon::today()->addDays(4)->toDateString();

    $response = test()->post('/booking', array_merge([
        'vehicle_id' => $vehicle->id,
        'start_date' => $start,
        'end_date' => $end,
        'pickup_method' => 'outlet',
        'return_method' => 'outlet',
        'customer_name' => 'Budi Santoso',
        'customer_phone' => '081234567890',
        'terms' => true,
    ], $overrides));

    $response->assertRedirect();

    return Booking::firstOrFail();
}

function submitPayment(Booking $booking, int $amount, string $phone = '081234567890'): Payment
{
    Storage::fake('local');

    test()->post("/booking/{$booking->booking_code}/payment", [
        'customer_phone' => $phone,
        'amount' => $amount,
        'method' => 'bank_transfer',
        'type' => 'full_payment',
        'proof' => UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    return Payment::where('booking_id', $booking->id)->orderByDesc('id')->firstOrFail();
}

test('customer can see payment information with breakdown and DP', function () {
    $booking = makePaidBooking();

    $response = $this->get("/booking/{$booking->booking_code}/payment?phone=081234567890");
    $response->assertOk();

    $response->assertInertia(fn ($page) => $page
        ->where('verified', true)
        ->where('booking.booking_code', $booking->booking_code)
        ->where('totals.grand_total', 255000)
        ->where('totals.dp_minimum', 127500)
        ->where('totals.dp_percent', 50)
        ->has('history')
    );
});

test('payment amount is calculated server-side and overpayment rejected', function () {
    $booking = makePaidBooking();
    Storage::fake('local');

    // Outstanding 255000, minta 500000 harus ditolak.
    $this->post("/booking/{$booking->booking_code}/payment", [
        'customer_phone' => '081234567890',
        'amount' => 500000,
        'method' => 'bank_transfer',
        'proof' => UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf'),
    ])->assertSessionHasErrors();

    $this->assertDatabaseCount('payments', 0);
});

test('payment can be submitted and becomes submitted', function () {
    $booking = makePaidBooking();
    $payment = submitPayment($booking, 127500);

    expect($payment->status)->toBe('submitted')
        ->and($payment->payment_code)->toMatch('/^PAY-\d{8}-\d{4}$/')
        ->and($payment->proof_path)->not->toBeNull();

    $this->assertDatabaseHas('notification_logs', [
        'booking_id' => $booking->id,
        'type' => 'payment_submitted',
    ]);
});

test('admin can verify payment and booking auto-confirmed when DP met', function () {
    $booking = makePaidBooking();
    $payment = submitPayment($booking, 127500);

    $admin = makeAdmin();
    $this->actingAs($admin)
        ->post("/admin/payments/{$payment->payment_code}/confirm", [])
        ->assertRedirect();

    $payment->refresh();
    expect($payment->status)->toBe('paid')
        ->and($payment->paid_at)->not->toBeNull();

    $booking->refresh();
    // DP 50% (127500) terpenuhi → pending menjadi confirmed otomatis.
    expect($booking->status)->toBe('confirmed')
        ->and($booking->payment_status)->toBe('partial')
        ->and($booking->confirmed_at)->not->toBeNull();
});

test('manual confirm stays available but ready requires full payment', function () {
    $booking = makePaidBooking();
    $admin = makeAdmin();

    // Konfirmasi manual tetap diizinkan sebagai override admin.
    $this->actingAs($admin)
        ->post("/admin/bookings/{$booking->booking_code}/confirm")
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($booking->fresh()->status)->toBe('confirmed');

    // Namun Ready diblokir sampai LUNAS penuh (DP saja belum cukup untuk memakai unit).
    $this->actingAs($admin)
        ->post("/admin/bookings/{$booking->booking_code}/ready")
        ->assertSessionHasErrors('readiness');
});

test('dp-only booking cannot use unit until fully paid', function () {
    $booking = makePaidBooking();
    $admin = makeAdmin();
    $vehicle = $booking->vehicle;
    $unit = makeUnit($vehicle);

    $this->actingAs($admin)->post("/admin/bookings/{$booking->booking_code}/confirm");

    // Bayar DP 50% saja via jalur server.
    $dp = (int) ceil((int) $booking->total * 50 / 100);
    App\Models\Payment::create([
        'booking_id' => $booking->id,
        'payment_code' => app(App\Services\PaymentService::class)->generatePaymentCode(),
        'type' => 'full_payment',
        'method' => 'bank_transfer',
        'amount' => $dp,
        'status' => App\Models\Payment::STATUS_PAID,
        'paid_at' => now(),
        'submitted_at' => now(),
    ]);
    app(App\Services\PaymentService::class)->syncBookingPayment($booking->fresh());

    expect($booking->fresh()->payment_status)->toBe('partial');

    $this->actingAs($admin)->post("/admin/bookings/{$booking->booking_code}/assign-unit", ['vehicle_unit_id' => $unit->id]);

    // DP + unit lengkap pun Ready tetap diblokir: unit belum boleh dipakai.
    $this->actingAs($admin)
        ->post("/admin/bookings/{$booking->booking_code}/ready")
        ->assertSessionHasErrors('readiness');
    expect($booking->fresh()->status)->toBe('confirmed');

    // Lunasi sisa tagihan → Ready terbuka.
    $rest = $booking->fresh()->outstanding();
    App\Models\Payment::create([
        'booking_id' => $booking->id,
        'payment_code' => app(App\Services\PaymentService::class)->generatePaymentCode(),
        'type' => 'full_payment',
        'method' => 'bank_transfer',
        'amount' => $rest,
        'status' => App\Models\Payment::STATUS_PAID,
        'paid_at' => now(),
        'submitted_at' => now(),
    ]);
    app(App\Services\PaymentService::class)->syncBookingPayment($booking->fresh());

    expect($booking->fresh()->payment_status)->toBe('paid');

    $this->actingAs($admin)
        ->post("/admin/bookings/{$booking->booking_code}/ready")
        ->assertRedirect()
        ->assertSessionHasNoErrors();
    expect($booking->fresh()->status)->toBe('preparing');
});

test('admin can reject payment and customer can resubmit preserving history', function () {
    $booking = makePaidBooking();
    $first = submitPayment($booking, 127500);

    $this->actingAs(makeAdmin())->post("/admin/payments/{$first->payment_code}/reject", [
        'rejection_reason' => 'Nominal transfer tidak sesuai',
    ])->assertRedirect();

    expect($first->fresh()->status)->toBe('rejected');

    $second = submitPayment($booking, 127500);
    expect($second->id)->not->toBe($first->id);

    expect(Payment::where('booking_id', $booking->id)->count())->toBe(2);
});

test('deposit is included in total but separated from rental revenue', function () {
    $booking = makePaidBooking();
    $booking->update(['deposit_amount' => 100000, 'total' => 355000]);

    $totals = app(App\Services\PaymentService::class)->totals($booking->fresh());

    expect($totals['deposit_amount'])->toBe(100000)
        ->and($totals['grand_total'])->toBe(355000)
        ->and($totals['subtotal'])->toBe(255000)
        ->and($totals['dp_minimum'])->toBe(177500);
});

test('guest cannot access another customer payment (IDOR)', function () {
    $bookingA = makePaidBooking();
    $vehicle = makeVehicle(['slug' => 'toyota-avanza', 'name' => 'Toyota Avanza', 'category' => 'mobil', 'price_per_day' => 350000]);

    $this->post('/booking', [
        'vehicle_id' => $vehicle->id,
        'start_date' => Carbon::today()->addDay()->toDateString(),
        'end_date' => Carbon::today()->addDays(4)->toDateString(),
        'pickup_method' => 'outlet',
        'return_method' => 'outlet',
        'customer_name' => 'Siti',
        'customer_phone' => '089999999999',
        'terms' => true,
    ])->assertRedirect();

    $bookingB = Booking::where('customer_phone', '089999999999')->firstOrFail();

    // A mencoba akses B dengan phone A → tidak verified / 403 saat POST.
    $this->get("/booking/{$bookingB->booking_code}/payment?phone=081234567890")
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('verified', false));

    Storage::fake('local');
    $this->post("/booking/{$bookingB->booking_code}/payment", [
        'customer_phone' => '081234567890',
        'amount' => 100000,
        'method' => 'bank_transfer',
        'proof' => UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf'),
    ])->assertForbidden();

    $this->get("/booking/{$bookingB->booking_code}/invoice?phone=081234567890")->assertForbidden();
});

test('non-admin cannot verify payment', function () {
    $booking = makePaidBooking();
    $payment = submitPayment($booking, 127500);

    $this->actingAs(makeCustomer())
        ->post("/admin/payments/{$payment->payment_code}/confirm", [])
        ->assertForbidden();

    expect($payment->fresh()->status)->toBe('submitted');
});

test('duplicate payment is blocked while one awaits verification', function () {
    $booking = makePaidBooking();
    submitPayment($booking, 127500);

    Storage::fake('local');
    $this->post("/booking/{$booking->booking_code}/payment", [
        'customer_phone' => '081234567890',
        'amount' => 127500,
        'method' => 'bank_transfer',
        'proof' => UploadedFile::fake()->create('bukti2.pdf', 100, 'application/pdf'),
    ])->assertSessionHasErrors();

    expect(Payment::where('booking_id', $booking->id)->count())->toBe(1);
});

test('customer payment is capped at DP minimum', function () {
    $booking = makePaidBooking();
    Storage::fake('local');

    // DP minimum 127500 — customer minta 200000 harus ditolak walau di bawah outstanding.
    $this->post("/booking/{$booking->booking_code}/payment", [
        'customer_phone' => '081234567890',
        'amount' => 200000,
        'method' => 'bank_transfer',
        'proof' => UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf'),
    ])->assertSessionHasErrors();

    $this->assertDatabaseCount('payments', 0);
});

test('customer cannot pay settlement after DP is satisfied', function () {
    $booking = makePaidBooking();
    $payment = submitPayment($booking, 127500);

    $this->actingAs(makeAdmin())->post("/admin/payments/{$payment->payment_code}/confirm", []);

    expect($booking->fresh()->payment_status)->toBe('partial');

    Storage::fake('local');
    $this->post("/booking/{$booking->booking_code}/payment", [
        'customer_phone' => '081234567890',
        'amount' => 127500,
        'method' => 'bank_transfer',
        'proof' => UploadedFile::fake()->create('bukti2.pdf', 100, 'application/pdf'),
    ])->assertSessionHasErrors();

    expect(Payment::where('booking_id', $booking->id)->count())->toBe(1);
});

test('admin can record settlement to mark booking paid', function () {
    $booking = makePaidBooking();
    $payment = submitPayment($booking, 127500);

    $admin = makeAdmin();
    $this->actingAs($admin)->post("/admin/payments/{$payment->payment_code}/confirm", []);

    $rest = $booking->fresh()->outstanding();

    $this->actingAs($admin)->post('/admin/payments', [
        'booking_code' => $booking->booking_code,
        'amount' => $rest,
        'method' => 'cash',
        'notes' => 'Dibayar tunai di outlet',
    ])->assertRedirect()->assertSessionHasNoErrors();

    $settlement = Payment::where('booking_id', $booking->id)->orderByDesc('id')->firstOrFail();
    expect($settlement->status)->toBe('paid')
        ->and($settlement->method)->toBe('cash')
        ->and($settlement->paid_at)->not->toBeNull();

    expect($booking->fresh()->payment_status)->toBe('paid')
        ->and($booking->fresh()->outstanding())->toBe(0);
});

test('admin settlement overpayment is rejected', function () {
    $booking = makePaidBooking();
    $admin = makeAdmin();

    $this->actingAs($admin)->post('/admin/payments', [
        'booking_code' => $booking->booking_code,
        'amount' => 500000,
        'method' => 'cash',
    ])->assertSessionHasErrors();

    $this->assertDatabaseCount('payments', 0);
});

test('admin settlement is blocked while a payment awaits verification', function () {
    $booking = makePaidBooking();
    submitPayment($booking, 127500);

    $this->actingAs(makeAdmin())->post('/admin/payments', [
        'booking_code' => $booking->booking_code,
        'amount' => 127500,
        'method' => 'cash',
    ])->assertSessionHasErrors();

    expect(Payment::where('booking_id', $booking->id)->count())->toBe(1);
});

test('full payment marks booking paid', function () {
    $booking = makePaidBooking();
    $payment = submitPayment($booking, 127500);

    $admin = makeAdmin();
    $this->actingAs($admin)->post("/admin/payments/{$payment->payment_code}/confirm", []);

    // Pelunasan hanya via admin.
    $rest = $booking->fresh()->outstanding();
    $this->actingAs($admin)->post('/admin/payments', [
        'booking_code' => $booking->booking_code,
        'amount' => $rest,
        'method' => 'cash',
    ])->assertRedirect();

    expect($booking->fresh()->payment_status)->toBe('paid')
        ->and($booking->fresh()->outstanding())->toBe(0);
});

test('invoice number is unique per booking', function () {
    $a = makePaidBooking();
    Booking::query()->delete();
    Payment::query()->delete();
    Invoice::query()->delete();

    $vehicle = makeVehicle(['slug' => 'v1-'.uniqid(), 'name' => 'V1']);
    $this->post('/booking', [
        'vehicle_id' => $vehicle->id,
        'start_date' => Carbon::today()->addDay()->toDateString(),
        'end_date' => Carbon::today()->addDays(4)->toDateString(),
        'pickup_method' => 'outlet',
        'return_method' => 'outlet',
        'customer_name' => 'A',
        'customer_phone' => '081111111111',
        'terms' => true,
    ])->assertRedirect();

    $vehicle2 = makeVehicle(['slug' => 'v2-'.uniqid(), 'name' => 'V2']);
    $this->post('/booking', [
        'vehicle_id' => $vehicle2->id,
        'start_date' => Carbon::today()->addDays(10)->toDateString(),
        'end_date' => Carbon::today()->addDays(12)->toDateString(),
        'pickup_method' => 'outlet',
        'return_method' => 'outlet',
        'customer_name' => 'B',
        'customer_phone' => '082222222222',
        'terms' => true,
    ])->assertRedirect();

    $numbers = Invoice::pluck('invoice_number');
    expect($numbers->unique()->count())->toBe(2)
        ->and($numbers->first())->toMatch('/^INV-\d{8}-\d{4}$/');
});
