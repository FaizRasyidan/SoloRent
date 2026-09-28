<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('payment_code', 24)->unique();
            $table->string('type', 20)->default('full_payment');
            $table->string('method', 30)->default('bank_transfer');
            $table->unsignedInteger('amount');
            $table->string('status', 20)->default('pending');
            $table->dateTime('submitted_at')->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->string('reference', 100)->nullable();
            $table->string('proof_path', 255)->nullable();
            $table->string('proof_original_name', 255)->nullable();
            $table->text('notes')->nullable();
            $table->text('admin_note')->nullable();
            $table->string('rejection_reason', 500)->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('verified_at')->nullable();
            $table->dateTime('expires_at')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
