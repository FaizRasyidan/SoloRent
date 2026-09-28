<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            if (! Schema::hasColumn('maintenance_records', 'priority')) {
                $table->string('priority', 20)->default('sedang')->after('cost')->index();
            }
            if (! Schema::hasColumn('maintenance_records', 'estimated_completed_at')) {
                $table->dateTime('estimated_completed_at')->nullable()->after('completed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            if (Schema::hasColumn('maintenance_records', 'estimated_completed_at')) {
                $table->dropColumn('estimated_completed_at');
            }
            if (Schema::hasColumn('maintenance_records', 'priority')) {
                $table->dropColumn('priority');
            }
        });
    }
};
