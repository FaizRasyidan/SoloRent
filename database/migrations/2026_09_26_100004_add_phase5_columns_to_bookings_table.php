<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // Rental options (customer input, Phase 5)
            if (! Schema::hasColumn('bookings', 'with_driver')) {
                $table->boolean('with_driver')->default(false)->after('pickup_location');
            }
            if (! Schema::hasColumn('bookings', 'driver_id')) {
                $table->foreignId('driver_id')->nullable()->after('with_driver')
                    ->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('bookings', 'vehicle_unit_id')) {
                $table->foreignId('vehicle_unit_id')->nullable()->after('vehicle_id')
                    ->constrained()->nullOnDelete();
            }
            // Return method (customer input, Phase 5)
            if (! Schema::hasColumn('bookings', 'return_method')) {
                $table->string('return_method', 20)->default('outlet')->after('delivery_fee');
            }
            if (! Schema::hasColumn('bookings', 'return_address')) {
                $table->text('return_address')->nullable()->after('return_method');
            }
            if (! Schema::hasColumn('bookings', 'return_note')) {
                $table->string('return_note', 255)->nullable()->after('return_address');
            }
            // Status timeline (real timestamps, no fake timeline)
            foreach (['confirmed_at', 'prepared_at', 'activated_at', 'completed_at', 'cancelled_at'] as $column) {
                if (! Schema::hasColumn('bookings', $column)) {
                    $table->dateTime($column)->nullable()->after('updated_at');
                }
            }
            if (! Schema::hasColumn('bookings', 'unit_assigned_at')) {
                $table->dateTime('unit_assigned_at')->nullable()->after('cancelled_at');
            }
            if (! Schema::hasColumn('bookings', 'driver_assigned_at')) {
                $table->dateTime('driver_assigned_at')->nullable()->after('unit_assigned_at');
            }
            if (! Schema::hasColumn('bookings', 'cancel_reason')) {
                $table->string('cancel_reason', 255)->nullable()->after('driver_assigned_at');
            }
            // Handover (preparing -> active)
            if (! Schema::hasColumn('bookings', 'handover_checklist')) {
                $table->json('handover_checklist')->nullable()->after('cancel_reason');
            }
            if (! Schema::hasColumn('bookings', 'handover_notes')) {
                $table->text('handover_notes')->nullable()->after('handover_checklist');
            }
            if (! Schema::hasColumn('bookings', 'handover_photos')) {
                $table->json('handover_photos')->nullable()->after('handover_notes');
            }
            if (! Schema::hasColumn('bookings', 'handover_completed_at')) {
                $table->dateTime('handover_completed_at')->nullable()->after('handover_photos');
            }
            // Return inspection (active -> completed)
            if (! Schema::hasColumn('bookings', 'return_condition')) {
                $table->string('return_condition', 20)->nullable()->after('handover_completed_at');
            }
            if (! Schema::hasColumn('bookings', 'return_fuel')) {
                $table->string('return_fuel', 20)->nullable()->after('return_condition');
            }
            if (! Schema::hasColumn('bookings', 'return_notes')) {
                $table->text('return_notes')->nullable()->after('return_fuel');
            }
            if (! Schema::hasColumn('bookings', 'return_photos')) {
                $table->json('return_photos')->nullable()->after('return_notes');
            }
            if (! Schema::hasColumn('bookings', 'returned_at')) {
                $table->dateTime('returned_at')->nullable()->after('return_photos');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('driver_id');
            $table->dropConstrainedForeignId('vehicle_unit_id');
        });
        Schema::table('bookings', function (Blueprint $table) {
            foreach ([
                'with_driver', 'return_method', 'return_address', 'return_note',
                'confirmed_at', 'prepared_at', 'activated_at', 'completed_at', 'cancelled_at',
                'unit_assigned_at', 'driver_assigned_at', 'cancel_reason',
                'handover_checklist', 'handover_notes', 'handover_photos', 'handover_completed_at',
                'return_condition', 'return_fuel', 'return_notes', 'return_photos', 'returned_at',
            ] as $column) {
                if (Schema::hasColumn('bookings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
