<?php

use App\Http\Controllers\Admin\AdminAuthController;
use App\Http\Controllers\Admin\BookingController;
use App\Http\Controllers\Admin\DamageController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DriverController;
use App\Http\Controllers\Admin\InsightController;
use App\Http\Controllers\Admin\MaintenanceController;
use App\Http\Controllers\Admin\NotificationController;
use App\Http\Controllers\Admin\OperationalTaskController;
use App\Http\Controllers\Admin\OperationsController;
use App\Http\Controllers\Admin\PaymentController;
use App\Http\Controllers\Admin\RefundController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\VehicleController;
use App\Http\Controllers\Admin\VehicleImageController;
use App\Http\Controllers\Admin\VehicleUnitController;
use Illuminate\Support\Facades\Route;

Route::prefix('admin')->name('admin.')->group(function () {
    // NOTE: intentionally NOT using the default `guest`/`auth` middleware here.
    // The default `guest` redirects authenticated users to /dashboard and the
    // default `auth` redirects guests to /login — both wrong for the admin area.
    // Guest/admin handling lives in AdminAuthController + EnsureUserIsAdmin so
    // the admin flow stays on /admin/login <-> /admin/dashboard.
    Route::get('/login', [AdminAuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AdminAuthController::class, 'login'])
        ->middleware('throttle:5,1')
        ->name('login.store');

    Route::post('/logout', [AdminAuthController::class, 'logout'])
        ->middleware('auth')
        ->name('logout');

    Route::middleware(['admin'])->group(function () {
        Route::get('/', fn () => redirect()->route('admin.dashboard'));
        Route::get('/dashboard', DashboardController::class)->name('dashboard');

        Route::resource('vehicles', VehicleController::class);
        Route::patch('/vehicles/{vehicle}/status', [VehicleController::class, 'updateStatus'])
            ->name('vehicles.status');

        Route::post('/vehicles/{vehicle}/images', [VehicleImageController::class, 'store'])
            ->name('vehicles.images.store');
        Route::patch('/vehicle-images/{image}/primary', [VehicleImageController::class, 'setPrimary'])
            ->name('vehicle-images.primary');
        Route::delete('/vehicle-images/{image}', [VehicleImageController::class, 'destroy'])
            ->name('vehicle-images.destroy');

        // Units live under their vehicle — no top-level menu (Phase 5).
        Route::post('/vehicles/{vehicle}/units', [VehicleUnitController::class, 'store'])
            ->name('vehicles.units.store');
        Route::put('/units/{unit}', [VehicleUnitController::class, 'update'])
            ->name('units.update');
        Route::delete('/units/{unit}', [VehicleUnitController::class, 'destroy'])
            ->name('units.destroy');

        // Booking & rental operations.
        Route::get('/bookings', [BookingController::class, 'index'])->name('bookings.index');
        Route::get('/bookings/{booking}', [BookingController::class, 'show'])->name('bookings.show');
        Route::post('/bookings/{booking}/confirm', [BookingController::class, 'confirm'])->name('bookings.confirm');
        Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel'])->name('bookings.cancel');
        Route::post('/bookings/{booking}/ready', [BookingController::class, 'markReady'])->name('bookings.ready');
        Route::post('/bookings/{booking}/activate', [BookingController::class, 'activate'])->name('bookings.activate');
        Route::post('/bookings/{booking}/assign-unit', [BookingController::class, 'assignUnit'])->name('bookings.assign-unit');
        Route::post('/bookings/{booking}/assign-driver', [BookingController::class, 'assignDriver'])->name('bookings.assign-driver');
        Route::post('/bookings/{booking}/handover', [BookingController::class, 'handover'])->name('bookings.handover');
        Route::post('/bookings/{booking}/return', [BookingController::class, 'returnInspection'])->name('bookings.return');

        Route::resource('drivers', DriverController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

        Route::post('/tasks/{task}/assign', [OperationalTaskController::class, 'assign'])->name('tasks.assign');
        Route::patch('/tasks/{task}/status', [OperationalTaskController::class, 'changeStatus'])->name('tasks.status');

        // Damage & maintenance (Phase 7). No deposit anywhere.
        Route::post('/bookings/{booking}/damages', [DamageController::class, 'storeRecord'])->name('bookings.damages.store');
        Route::put('/damages/{record}', [DamageController::class, 'updateRecord'])->name('damages.update');
        Route::delete('/damages/{record}', [DamageController::class, 'destroyRecord'])->name('damages.destroy');
        Route::post('/damage-charges/{charge}/items', [DamageController::class, 'storeItem'])->name('damage-charges.items.store');
        Route::delete('/damage-charge-items/{item}', [DamageController::class, 'destroyItem'])->name('damage-charge-items.destroy');
        Route::patch('/damage-charges/{charge}/notes', [DamageController::class, 'updateNotes'])->name('damage-charges.notes');
        Route::post('/damage-charges/{charge}/waive', [DamageController::class, 'waive'])->name('damage-charges.waive');
        Route::post('/damage-charges/{charge}/cancel', [DamageController::class, 'cancelCharge'])->name('damage-charges.cancel');
        Route::post('/damage-charges/{charge}/cash', [DamageController::class, 'recordCash'])->name('damage-charges.cash');
        Route::post('/bookings/{booking}/maintenances', [MaintenanceController::class, 'store'])->name('bookings.maintenances.store');
        Route::patch('/maintenances/{maintenance}/status', [MaintenanceController::class, 'transition'])->name('maintenances.status');

        // Pusat Perbaikan: pantau semua unit yang diperbaiki + ubah status dari satu tempat.
        Route::get('/repairs', [MaintenanceController::class, 'index'])->name('repairs.index');
        Route::post('/repairs', [MaintenanceController::class, 'storeStandalone'])->name('repairs.store');
        Route::get('/repairs/{maintenance}', [MaintenanceController::class, 'show'])->name('repairs.show');
        Route::put('/repairs/{maintenance}', [MaintenanceController::class, 'update'])->name('repairs.update');

        Route::get('/operations', [OperationsController::class, 'index'])->name('operations.index');
        Route::get('/operations/calendar', [OperationsController::class, 'calendar'])->name('operations.calendar');

        Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
        Route::post('/payments', [PaymentController::class, 'store'])->name('payments.store');
        Route::get('/payments/{payment}', [PaymentController::class, 'show'])->name('payments.show');
        Route::post('/payments/{payment}/confirm', [PaymentController::class, 'confirm'])->name('payments.confirm');
        Route::post('/payments/{payment}/reject', [PaymentController::class, 'reject'])->name('payments.reject');
        Route::get('/payments/{payment}/proof', [PaymentController::class, 'proof'])->name('payments.proof');
        Route::get('/bookings/{booking}/invoice', [PaymentController::class, 'invoice'])->name('bookings.invoice');

        // Refund & pembatalan (Phase 7A). Refund selalu manual: pending → processing → completed.
        Route::get('/refunds', [RefundController::class, 'index'])->name('refunds.index');
        Route::post('/refunds/{refund}/process', [RefundController::class, 'process'])->name('refunds.process');
        Route::post('/refunds/{refund}/complete', [RefundController::class, 'complete'])->name('refunds.complete');
        Route::post('/refunds/{refund}/fail', [RefundController::class, 'fail'])->name('refunds.fail');

        // Laporan & analitik bisnis (Phase 8). Read-only: agregasi + export CSV.
        Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
        Route::get('/reports/export', [ReportController::class, 'export'])->name('reports.export');

        // Smart Insights: refresh cache insight (Phase 9). Tidak menulis data bisnis.
        Route::post('/insights/refresh', [InsightController::class, 'refresh'])->name('insights.refresh');

        // Lonceng admin: booking & pembayaran terbaru dari customer.
        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::get('/notifications/feed', [NotificationController::class, 'feed'])->name('notifications.feed');
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.readAll');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    });
});
