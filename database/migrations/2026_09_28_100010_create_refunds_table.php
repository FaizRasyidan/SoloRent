<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cancellation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('refund_code', 24)->unique();
            $table->unsignedInteger('amount');
            $table->string('status', 20)->default('pending');
            $table->string('reason_code', 50)->nullable();
            $table->string('reason', 255)->nullable();
            $table->string('channel', 20)->default('manual');
            $table->string('reference', 150)->nullable();
            $table->string('failure_reason', 500)->nullable();
            $table->dateTime('processed_at')->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
            $table->index('booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
    }
};
