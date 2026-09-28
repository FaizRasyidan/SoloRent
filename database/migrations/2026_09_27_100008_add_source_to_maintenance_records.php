<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            if (! Schema::hasColumn('maintenance_records', 'source')) {
                $table->string('source', 20)->default('manual')->after('status')->index();
            }
        });

        // Tandai entri otomatis yang sudah ada (terhubung ke kerusakan).
        // Catatan: FK nullOnDelete dapat mengosongkan damage_record_id milik
        // grup yang kerusakannya dihapus — karenanya penanda eksplisit ini
        // dipakai sebagai acuan, bukan lagi kolom relasi.
        DB::table('maintenance_records')
            ->whereNotNull('damage_record_id')
            ->update(['source' => 'auto']);
    }

    public function down(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            if (Schema::hasColumn('maintenance_records', 'source')) {
                $table->dropColumn('source');
            }
        });
    }
};
