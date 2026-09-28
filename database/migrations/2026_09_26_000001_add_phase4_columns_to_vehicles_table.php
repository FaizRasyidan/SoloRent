<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (! Schema::hasColumn('vehicles', 'brand')) {
                $table->string('brand', 100)->nullable()->after('name');
            }
            if (! Schema::hasColumn('vehicles', 'model')) {
                $table->string('model', 100)->nullable()->after('brand');
            }
            if (! Schema::hasColumn('vehicles', 'fuel')) {
                $table->string('fuel', 50)->nullable()->after('engine');
            }
            if (! Schema::hasColumn('vehicles', 'status')) {
                $table->string('status', 20)->default('active')->after('is_available')->index();
            }
            if (! Schema::hasColumn('vehicles', 'deleted_at')) {
                $table->softDeletes()->after('updated_at');
            }
        });

        // Backfill: existing rows derive status from the legacy is_available flag.
        DB::table('vehicles')->where('is_available', false)->where('status', 'active')->update(['status' => 'inactive']);
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            foreach (['brand', 'model', 'fuel', 'status', 'deleted_at'] as $column) {
                if (Schema::hasColumn('vehicles', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
