<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Index baca untuk tren/insight Phase 9. Murni aditif (tanpa ubah
     * kolom, tanpa hapus data).
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->index('created_at', 'bookings_created_at_index');
            $table->index('customer_phone', 'bookings_customer_phone_index');
            $table->index(['status', 'start_date'], 'bookings_status_start_date_index');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->index('paid_at', 'payments_paid_at_index');
            $table->index(['status', 'paid_at'], 'payments_status_paid_at_index');
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->index('processed_at', 'refunds_processed_at_index');
            $table->index(['status', 'processed_at'], 'refunds_status_processed_at_index');
        });

        Schema::table('maintenance_records', function (Blueprint $table) {
            $table->index('created_at', 'maintenance_records_created_at_index');
        });

        Schema::table('damage_charges', function (Blueprint $table) {
            $table->index('created_at', 'damage_charges_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('damage_charges', function (Blueprint $table) {
            $table->dropIndex('damage_charges_created_at_index');
        });

        Schema::table('maintenance_records', function (Blueprint $table) {
            $table->dropIndex('maintenance_records_created_at_index');
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->dropIndex('refunds_status_processed_at_index');
            $table->dropIndex('refunds_processed_at_index');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_status_paid_at_index');
            $table->dropIndex('payments_paid_at_index');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_status_start_date_index');
            $table->dropIndex('bookings_customer_phone_index');
            $table->dropIndex('bookings_created_at_index');
        });
    }
};
