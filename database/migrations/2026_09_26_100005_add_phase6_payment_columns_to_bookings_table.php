<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (! Schema::hasColumn('bookings', 'deposit_amount')) {
                $table->unsignedInteger('deposit_amount')->default(0)->after('delivery_fee');
            }
            if (! Schema::hasColumn('bookings', 'payment_status')) {
                $table->string('payment_status', 20)->default('unpaid')->after('status');
            }
            if (! Schema::hasColumn('bookings', 'payment_expires_at')) {
                $table->dateTime('payment_expires_at')->nullable()->after('payment_status');
            }
        });

        Schema::table('bookings', function (Blueprint $table) {
            $existing = [];
            try {
                $existing = Schema::getIndexes('bookings');
            } catch (\Throwable) {
                $existing = [];
            }
            $names = collect($existing)->map(fn ($i) => is_array($i) ? ($i['name'] ?? null) : ($i->name ?? null))->all();
            if (! in_array('bookings_payment_status_index', $names, true)) {
                $table->index('payment_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'payment_status')) {
                try {
                    $table->dropIndex(['payment_status']);
                } catch (\Throwable) {
                }
            }
            foreach (['payment_expires_at', 'payment_status', 'deposit_amount'] as $column) {
                if (Schema::hasColumn('bookings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
