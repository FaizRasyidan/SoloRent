<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_code', 20)->unique();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('customer_name', 100);
            $table->string('customer_phone', 20);
            $table->string('customer_email', 150)->nullable();
            $table->string('identity_number', 30)->nullable();
            $table->text('notes')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedInteger('duration_days');
            $table->unsignedInteger('price_per_day');
            $table->unsignedInteger('subtotal');
            $table->enum('pickup_method', ['outlet', 'delivery'])->default('outlet');
            $table->string('pickup_location', 255)->nullable();
            $table->string('delivery_name', 150)->nullable();
            $table->text('delivery_address')->nullable();
            $table->string('delivery_district', 100)->nullable();
            $table->text('delivery_note')->nullable();
            $table->unsignedInteger('delivery_fee')->default(0);
            $table->unsignedInteger('total');
            $table->enum('status', ['pending', 'confirmed', 'preparing', 'active', 'completed', 'cancelled'])->default('pending');
            $table->boolean('terms_accepted')->default(false);
            $table->timestamps();

            $table->index(['vehicle_id', 'start_date', 'end_date']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
