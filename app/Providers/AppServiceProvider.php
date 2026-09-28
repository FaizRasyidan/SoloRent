<?php

namespace App\Providers;

use App\Contracts\Insights\AiInsightGenerator;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Refund;
use App\Observers\BookingObserver;
use App\Observers\PaymentObserver;
use App\Observers\RefundObserver;
use App\Services\Insights\NullAiInsightGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // AI insight generator: default null (tanpa jaringan/dependensi).
        // Implementasi nyata dapat di-bind di sini tanpa menyentuh engine.
        $this->app->bind(AiInsightGenerator::class, NullAiInsightGenerator::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // Lonceng admin: observer ikut transaksi yang sama sehingga
        // notifikasi otomatis hilang jika transaksi di-rollback.
        Booking::observe(BookingObserver::class);
        Payment::observe(PaymentObserver::class);
        Refund::observe(RefundObserver::class);
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
