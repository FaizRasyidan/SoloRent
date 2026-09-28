<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('unit_code', 30);
            $table->string('plate_number', 20)->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            $table->unique('unit_code');
            $table->index('vehicle_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_units');
    }
};
