<?php

return [
    'outlet' => [
        'name' => 'SoloRent — Outlet Slamet Riyadi',
        'address' => 'Jl. Slamet Riyadi No. 452, Laweyan, Solo',
        'city' => 'Solo, Jawa Tengah',
        'hours' => '08.00 – 21.00',
        'phone' => '0895-3647-27475',
        'whatsapp' => '62895364727475',
        'email' => 'halo@solorent.id',
    ],

    'delivery_areas' => [
        ['name' => 'Solo Kota', 'fee' => 20000],
        ['name' => 'Stasiun Solo Balapan', 'fee' => 15000],
        ['name' => 'Kartasura', 'fee' => 25000],
        ['name' => 'Sukoharjo', 'fee' => 35000],
        ['name' => 'Karanganyar', 'fee' => 40000],
        ['name' => 'Bandara Adi Soemarmo', 'fee' => 50000],
    ],

    'statuses_blocking_availability' => ['pending', 'confirmed', 'preparing', 'active'],

    'cancellation' => [
        'enabled' => true,
        // Customer & admin boleh membatalkan pada status ini. Active tidak
        // boleh (rental sudah berjalan); completed/cancelled terminal.
        'customer_allowed_statuses' => ['pending', 'confirmed', 'preparing'],
        'admin_allowed_statuses' => ['pending', 'confirmed', 'preparing'],
        // Booking lunas tidak dapat dibatalkan kecuali override admin.
        'block_when_fully_paid' => true,
        // 0 = tanpa gerbang waktu. Naikkan (mis. 24) untuk menutup
        // pembatalan X jam sebelum rental dimulai.
        'min_hours_before_start' => 0,
        'reasons' => [
            'customer' => [
                'plan_changed' => 'Perubahan rencana',
                'wrong_date' => 'Salah memilih tanggal',
                'wrong_vehicle' => 'Salah memilih kendaraan',
                'found_alternative' => 'Menemukan alternatif lain',
                'other' => 'Lainnya',
            ],
            'admin' => [
                'vehicle_issue' => 'Kendaraan bermasalah',
                'operational_issue' => 'Operasional tidak memungkinkan',
                'customer_request' => 'Permintaan customer',
                'other' => 'Lainnya',
            ],
        ],
    ],

    'refund' => [
        'enabled' => true,
        // Satu-satunya angka refund di seluruh project: 80% dari pembayaran
        // booking yang sudah paid (non-damage). Bukan dari tipe payment,
        // melainkan dari total yang benar-benar diterima.
        'percent' => 80,
        // Gateway belum tersedia: refund selalu manual. Jangan pernah
        // menampilkan "Refund Berhasil" tanpa verifikasi admin.
        'manual_only' => true,
        // Reference wajib diisi sebelum refund ditandai completed.
        'require_reference' => true,
        'reasons' => [
            'customer_cancellation' => 'Pembatalan customer',
            'admin_cancellation' => 'Pembatalan admin',
            'vehicle_unavailable' => 'Kendaraan tidak tersedia',
            'operational_issue' => 'Gangguan operasional',
            'payment_correction' => 'Koreksi pembayaran',
        ],
    ],

    'payment' => [
        'bank_name' => env('PAYMENT_BANK_NAME', 'BCA'),
        'account_number' => env('PAYMENT_ACCOUNT_NUMBER', '1234567890'),
        'account_holder' => env('PAYMENT_ACCOUNT_HOLDER', 'SoloRent'),
        // DP minimum agar booking dapat dikonfirmasi (50% dari grand total).
        'dp_percent' => 50,
        // bank_transfer = satu-satunya metode jalur customer (DP saja).
        // cash = khusus admin untuk mencatat pelunasan offline di outlet.
        'methods' => ['bank_transfer', 'cash'],
        'proof_max_kb' => 5120,
        'expiry_hours' => null, // null = tanpa batas waktu otomatis pada Phase 6
    ],
];
