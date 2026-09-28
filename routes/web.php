<?php

use App\Http\Controllers\BookingController;
use App\Http\Controllers\DamagePaymentController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\VehicleController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::get('/vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show'])->name('vehicles.show');

Route::inertia('/cara-rental', 'cara-rental')->name('cara-rental');

Route::get('/booking', [BookingController::class, 'create'])->name('booking.create');
Route::get('/booking/availability', [BookingController::class, 'availability'])->name('booking.availability');
Route::get('/booking/check', [BookingController::class, 'check'])->name('booking.check');
Route::post('/booking/check', [BookingController::class, 'checkStore'])->name('booking.check.store');
Route::get('/booking/success/{booking}', [BookingController::class, 'success'])->name('booking.success');
Route::get('/booking/{booking}/payment', [PaymentController::class, 'show'])->name('booking.payment');
Route::post('/booking/{booking}/payment', [PaymentController::class, 'store'])->name('booking.payment.store');
Route::get('/booking/{booking}/invoice', [PaymentController::class, 'invoice'])->name('booking.invoice');
Route::post('/booking/{booking}/cancel', [BookingController::class, 'cancel'])->name('booking.cancel');
Route::get('/booking/refunds/{refund}', [BookingController::class, 'refundReceipt'])->name('booking.refund');
Route::get('/booking/damage/{damageCharge}', [DamagePaymentController::class, 'show'])->name('booking.damage');
Route::post('/booking/damage/{damageCharge}/pay', [DamagePaymentController::class, 'pay'])->name('booking.damage.pay');
Route::get('/booking/{vehicle?}', [BookingController::class, 'create'])->name('booking.vehicle');
Route::post('/booking', [BookingController::class, 'store'])->name('booking.store');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
require __DIR__.'/admin.php';
