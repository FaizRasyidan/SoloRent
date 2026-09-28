<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('damage_charge_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('damage_charge_id')->constrained()->cascadeOnDelete();
            $table->foreignId('damage_record_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description', 255);
            $table->unsignedInteger('amount')->default(0);
            $table->timestamps();

            $table->index('damage_charge_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('damage_charge_items');
    }
};
