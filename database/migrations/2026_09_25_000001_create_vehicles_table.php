<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->enum('category', ['motor', 'mobil'])->index();
            $table->enum('transmission', ['automatic', 'manual'])->default('automatic');
            $table->unsignedTinyInteger('seats')->default(2);
            $table->string('engine', 50)->nullable();
            $table->string('baggage', 50)->nullable();
            $table->unsignedInteger('price_per_day');
            $table->decimal('rating', 2, 1)->default(5.0);
            $table->unsignedInteger('trips_count')->default(0);
            $table->string('image_url', 500)->nullable();
            $table->json('gallery')->nullable();
            $table->text('description')->nullable();
            $table->json('benefits')->nullable();
            $table->unsignedInteger('stock')->default(1);
            $table->boolean('is_available')->default(true);
            $table->boolean('featured')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
