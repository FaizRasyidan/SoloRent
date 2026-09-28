<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Smart Insights — ambang batas rule (Phase 9)
    |--------------------------------------------------------------------------
    | Seluruh angka di bawah adalah dokumentasi bisnis sekaligus konfigurasi.
    | Ubah di sini (bukan di kode) bila operasional SoloRent berubah.
    | Bahasa UI tetap Indonesia; evidence selalu menampilkan angka mentah.
    */

    'cache_ttl' => 600, // detik; insight di-cache 10 menit + tombol Refresh manual.
    'dashboard_limit' => 3, // Smart Insights card: maks 3.
    'attention_limit' => 5, // Needs Attention card: maks 5.

    'rules' => [
        'weekend_demand' => [
            'enabled' => true,
            // Rata-rata booking akhir pekan (Sabtu–Minggu) dibagi rata-rata
            // hari kerja (Senin–Jumat) harus melewati rasio ini.
            'ratio' => 1.20,
            // Minimum total booking dalam jendela agar sinyal valid.
            'min_sample' => 8,
            // Jendela observasi ke belakang (minggu kalender penuh tidak
            // diwajibkan; cukup N×7 hari terakhir).
            'window_weeks' => 4,
            'priority' => 10,
        ],
        'booking_growth' => [
            'enabled' => true,
            // Pertumbuhan = (cur - prev) / prev; ambang 20%.
            'change_pct' => 20.0,
            'min_sample' => 20, // minimum booking di MASING-MASING periode.
            'window_days' => 30,
            'priority' => 20,
        ],
        'revenue_change' => [
            'enabled' => true,
            'change_pct' => 20.0,
            // Minimum net revenue periode berjalan agar fluktuasi receh
            // (mis. Rp 50rb → Rp 100rb = +100%) tidak menjadi insight.
            'min_net' => 1000000,
            'window_days' => 30,
            'priority' => 30,
        ],
        'fleet_utilization' => [
            'enabled' => true,
            // Utilisasi = hari sewa / (unit aktif × hari) × 100.
            'high_pct' => 70.0,
            'low_pct' => 30.0,
            'min_capacity_days' => 10,
            'window_days' => 30,
            'priority' => 40,
        ],
        'top_vehicle' => [
            'enabled' => true,
            'utilization_pct' => 80.0,
            'min_capacity_days' => 10,
            'window_days' => 30,
            'priority' => 50,
        ],
        'repeat_customer' => [
            'enabled' => true,
            // repeat_pct = customer (per customer_phone) dengan ≥2 booking
            // dibagi total customer unik × 100.
            'repeat_pct' => 20.0,
            'min_sample' => 20, // minimum total booking periode.
            'window_days' => 30,
            'priority' => 60,
        ],
        'cancellation_rate' => [
            'enabled' => true,
            'rate_pct' => 25.0,
            'min_sample' => 20,
            'window_days' => 30,
            'priority' => 70,
        ],
        'maintenance_frequency' => [
            'enabled' => true,
            // Unit disorot bila dalam jendela punya ≥2 record DAN ≥3 hari
            // downtime (agar servis rutin sekali tidak menjadi insight).
            'min_records' => 2,
            'min_days' => 3,
            'window_days' => 90,
            'priority' => 80,
        ],
        'low_stock' => [
            'enabled' => true,
            // Tipe kendaraan disorot bila stok tersisa ≤ ambang DAN masih
            // berstatus tersedia (stok 0 yang nonaktif = keputusan armada,
            // bukan sinyal permintaan).
            'max_stock' => 1,
            'max_items' => 5,
            'priority' => 90,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | AI Insight Layer (opsional, default MATI)
    |--------------------------------------------------------------------------
    | AI hanya menerima agregat yang di-allowlist (lihat
    | AiInsightProvider::PAYLOAD_KEYS). Tidak ada nama, telepon, alamat,
    | kredensial, atau secret yang pernah dikirim. AI tidak pernah menulis DB.
    */
    'ai' => [
        'enabled' => false,
        'timeout' => 8, // detik; lewat dari ini → fallback rule-based.
        'max_evidence' => 5,
        'max_title' => 120,
        'max_summary' => 400,
        'max_recommendation' => 300,
    ],

    'forecast' => [
        // Rata-rata bergerak dari N bulan kalender penuh terakhir
        // (bulan berjalan dikecualikan karena belum lengkap).
        'months' => 3,
    ],
];
