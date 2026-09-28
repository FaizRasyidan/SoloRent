<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cancellations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('cancelled_by_type', 20)->default('customer');
            $table->foreignId('cancelled_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason_code', 50)->nullable();
            $table->string('reason', 255)->nullable();
            $table->string('policy_rule', 100)->nullable();
            $table->unsignedTinyInteger('policy_percent')->default(80);
            $table->unsignedInteger('original_amount')->default(0);
            $table->unsignedInteger('refund_amount')->default(0);
            $table->unsignedInteger('non_refundable_amount')->default(0);
            $table->string('status', 20)->default('cancelled');
            $table->dateTime('cancelled_at')->nullable();
            // Audit trail override admin (Butir 64/65): nilai policy vs nilai final.
            $table->unsignedInteger('override_policy_amount')->nullable();
            $table->unsignedInteger('override_amount')->nullable();
            $table->string('override_reason', 500)->nullable();
            $table->foreignId('overridden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('booking_id');
            $table->index('status');
            $table->index('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cancellations');
    }
};
