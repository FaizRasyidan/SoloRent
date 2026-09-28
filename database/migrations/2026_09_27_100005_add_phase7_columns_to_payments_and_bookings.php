<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'damage_charge_id')) {
                $table->foreignId('damage_charge_id')->nullable()->after('booking_id')
                    ->constrained()->nullOnDelete();
                $table->index(['damage_charge_id', 'status']);
            }
        });

        Schema::table('bookings', function (Blueprint $table) {
            if (! Schema::hasColumn('bookings', 'cancelled_by_type')) {
                $table->string('cancelled_by_type', 20)->nullable()->after('cancel_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('damage_charge_id');
        });
        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'cancelled_by_type')) {
                $table->dropColumn('cancelled_by_type');
            }
        });
    }
};
