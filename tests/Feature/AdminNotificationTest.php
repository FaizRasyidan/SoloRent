<?php

use App\Models\AdminNotification;
use App\Models\Booking;
use App\Models\DamageCharge;
use App\Models\Refund;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

function damageChargeForTest(Booking $booking, int $total = 150000): DamageCharge
{
    return DamageCharge::create([
        'booking_id' => $booking->id,
        'charge_code' => DamageCharge::generateCode(),
        'subtotal' => $total,
        'total' => $total,
        'status' => DamageCharge::STATUS_UNPAID,
    ]);
}

// ---------- P0: booking baru ----------

test('customer booking creates unread admin notification', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->assertDatabaseHas('admin_notifications', [
        'booking_id' => $booking->id,
        'type' => AdminNotification::TYPE_BOOKING_CREATED,
        'level' => AdminNotification::LEVEL_ACTION,
        'read_at' => null,
    ]);

    $notif = AdminNotification::where('booking_id', $booking->id)
        ->where('type', AdminNotification::TYPE_BOOKING_CREATED)
        ->firstOrFail();

    expect($notif->action_url)->toBe('/admin/bookings/'.$booking->booking_code)
        ->and($notif->title)->toContain($booking->booking_code)
        ->and($notif->isRead())->toBeFalse();
});

// ---------- P0: pembayaran menunggu verifikasi ----------

test('customer payment submission creates admin notification', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $payment = submitPayment($booking, 127500);

    $this->assertDatabaseHas('admin_notifications', [
        'payment_id' => $payment->id,
        'type' => AdminNotification::TYPE_PAYMENT_SUBMITTED,
        'level' => AdminNotification::LEVEL_ACTION,
        'read_at' => null,
    ]);

    // Satu booking = 1 booking_created + 1 payment_submitted.
    expect(AdminNotification::where('booking_id', $booking->id)->count())->toBe(2);
});

test('customer damage payment submission creates admin notification', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $charge = damageChargeForTest($booking);

    Storage::fake('local');

    $this->post("/booking/damage/{$charge->charge_code}/pay", [
        'customer_phone' => '081234567890',
        'method' => 'bank_transfer',
        'proof' => UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    $this->assertDatabaseHas('admin_notifications', [
        'damage_charge_id' => $charge->id,
        'type' => AdminNotification::TYPE_DAMAGE_PAYMENT_SUBMITTED,
        'level' => AdminNotification::LEVEL_ACTION,
        'read_at' => null,
    ]);
});

// ---------- P0: pembatalan & refund gagal ----------

test('customer cancellation creates admin notification', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Jadwal berubah',
    ])->assertRedirect();

    $this->assertDatabaseHas('admin_notifications', [
        'booking_id' => $booking->id,
        'type' => AdminNotification::TYPE_BOOKING_CANCELLED,
        'level' => AdminNotification::LEVEL_WARNING,
        'read_at' => null,
    ]);
});

test('failed refund creates danger admin notification', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    payPartialTest($booking, 127500);

    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Perubahan rencana',
    ])->assertRedirect();

    $refund = Refund::where('booking_id', $booking->id)->firstOrFail();

    $this->actingAs(makeAdmin())->post("/admin/refunds/{$refund->refund_code}/fail", [
        'failure_reason' => 'Rekening customer tidak valid',
    ])->assertRedirect();

    $this->assertDatabaseHas('admin_notifications', [
        'refund_id' => $refund->id,
        'type' => AdminNotification::TYPE_REFUND_FAILED,
        'level' => AdminNotification::LEVEL_DANGER,
        'read_at' => null,
    ]);
});

// ---------- Guard: rollback & aksi admin sendiri ----------

test('rolled back transaction leaves no admin notification', function () {
    $vehicle = makeVehicle();

    try {
        DB::transaction(function () use ($vehicle) {
            Booking::create([
                'booking_code' => 'SR-ROLLBACK-0001',
                'vehicle_id' => $vehicle->id,
                'customer_name' => 'Budi Santoso',
                'customer_phone' => '081234567890',
                'start_date' => Carbon::today()->addDay()->toDateString(),
                'end_date' => Carbon::today()->addDays(4)->toDateString(),
                'duration_days' => 3,
                'price_per_day' => $vehicle->price_per_day,
                'subtotal' => $vehicle->price_per_day * 3,
                'pickup_method' => 'outlet',
                'total' => $vehicle->price_per_day * 3,
                'status' => 'pending',
                'terms_accepted' => true,
            ]);

            throw new RuntimeException('boom');
        });
    } catch (RuntimeException) {
        // Sengaja di-rollback.
    }

    expect(Booking::where('booking_code', 'SR-ROLLBACK-0001')->count())->toBe(0)
        ->and(AdminNotification::count())->toBe(0);
});

test('admin settlement does not notify about own action', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);

    $this->actingAs(makeAdmin())->post('/admin/payments', [
        'booking_code' => $booking->booking_code,
        'amount' => (int) $booking->total,
        'method' => 'cash',
    ])->assertRedirect();

    expect(AdminNotification::where('type', AdminNotification::TYPE_PAYMENT_SUBMITTED)->count())->toBe(0)
        ->and(AdminNotification::count())->toBe(1);
});

test('admin confirm and admin cancel do not create notifications', function () {
    $admin = makeAdmin();
    $this->actingAs($admin);

    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    $payment = submitPayment($booking, 127500);

    // Konfirmasi admin: transisi submitted → paid bukan hal baru.
    $this->post("/admin/payments/{$payment->payment_code}/confirm", [])
        ->assertRedirect();

    // Pembatalan admin: aksi sendiri, bukan dari customer.
    $bookingB = operationalBooking($vehicle);
    $this->post("/booking/{$booking->booking_code}/cancel", [
        'customer_phone' => '081234567890',
        'cancel_reason' => 'Jadwal berubah',
    ])->assertRedirect();
    $this->post("/admin/bookings/{$bookingB->booking_code}/cancel", [
        'cancel_reason' => 'Kendaraan bermasalah',
    ])->assertRedirect();

    expect(AdminNotification::where('type', AdminNotification::TYPE_BOOKING_CANCELLED)->count())->toBe(1)
        ->and(AdminNotification::where('booking_id', $bookingB->id)->where('type', AdminNotification::TYPE_BOOKING_CANCELLED)->count())->toBe(0);
});

test('notification actions never touch customer notification_logs', function () {
    $vehicle = makeVehicle();
    operationalBooking($vehicle);
    $before = DB::table('notification_logs')->count();

    $admin = makeAdmin();
    $this->actingAs($admin)->post('/admin/notifications/read-all')->assertRedirect();
    $this->actingAs($admin)->get('/admin/notifications')->assertOk();
    $this->actingAs($admin)->getJson('/admin/notifications/feed')->assertOk();

    expect(DB::table('notification_logs')->count())->toBe($before);
});

// ---------- Otorisasi ----------

test('guest is redirected and non-admin is forbidden from notifications', function () {
    $this->get('/admin/notifications')->assertRedirect(route('admin.login'));
    $this->getJson('/admin/notifications/feed')->assertRedirect(route('admin.login'));

    $this->actingAs(makeCustomer());
    $this->get('/admin/notifications')->assertForbidden();
    $this->getJson('/admin/notifications/feed')->assertForbidden();
});

// ---------- Index, feed, read ----------

test('admin can list filter feed and mark notifications read', function () {
    $vehicle = makeVehicle();
    $booking = operationalBooking($vehicle);
    submitPayment($booking, 127500);

    $admin = makeAdmin();
    $this->actingAs($admin);

    $this->get('/admin/notifications')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->where('unread', 2)
            ->has('notifications.data', 2)
    );

    $this->get('/admin/notifications?level=action')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->where('filters.level', 'action')
            ->has('notifications.data', 2)
    );

    $this->get('/admin/notifications?level=danger')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->has('notifications.data', 0)
    );

    $this->getJson('/admin/notifications/feed')->assertOk()
        ->assertJsonPath('unread', 2)
        ->assertJsonCount(2, 'latest');

    $first = AdminNotification::orderBy('id')->firstOrFail();
    $this->post("/admin/notifications/{$first->id}/read")->assertRedirect();
    expect($first->fresh()->read_at)->not->toBeNull();

    $this->getJson('/admin/notifications/feed')->assertOk()->assertJsonPath('unread', 1);

    $this->post('/admin/notifications/read-all')->assertRedirect();
    expect(AdminNotification::unread()->count())->toBe(0);
});

// ---------- Prune ----------

test('prune only deletes read notifications older than 30 days', function () {
    $oldRead = AdminNotification::create([
        'type' => AdminNotification::TYPE_BOOKING_CREATED,
        'level' => AdminNotification::LEVEL_ACTION,
        'title' => 'Lama sudah dibaca',
        'read_at' => Carbon::now()->subDays(31),
    ]);
    $recentRead = AdminNotification::create([
        'type' => AdminNotification::TYPE_BOOKING_CREATED,
        'level' => AdminNotification::LEVEL_ACTION,
        'title' => 'Baru dibaca',
        'read_at' => Carbon::now()->subDays(10),
    ]);
    $oldUnread = AdminNotification::create([
        'type' => AdminNotification::TYPE_PAYMENT_SUBMITTED,
        'level' => AdminNotification::LEVEL_ACTION,
        'title' => 'Lama belum dibaca',
    ]);
    $oldUnread->created_at = Carbon::now()->subDays(60);
    $oldUnread->save();

    Artisan::call('admin:notifications:prune', ['--pretend' => true]);
    expect(AdminNotification::count())->toBe(3);

    Artisan::call('admin:notifications:prune');
    expect(AdminNotification::find($oldRead->id))->toBeNull()
        ->and(AdminNotification::find($recentRead->id))->not->toBeNull()
        ->and(AdminNotification::find($oldUnread->id))->not->toBeNull();
});
