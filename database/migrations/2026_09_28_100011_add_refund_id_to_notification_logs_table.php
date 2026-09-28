<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('notification_logs', 'refund_id')) {
                $table->foreignId('refund_id')->nullable()->after('payment_id')
                    ->constrained('refunds')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            if (Schema::hasColumn('notification_logs', 'refund_id')) {
                $table->dropConstrainedForeignId('refund_id');
            }
        });
    }
};
