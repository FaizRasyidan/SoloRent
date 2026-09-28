<?php

namespace App\Contracts\Insights;

interface AiInsightGenerator
{
    /**
     * Murni transformer: agregat minim → kandidat insight mentah.
     * Tidak boleh menyentuh DB, tidak boleh menulis, tidak boleh
     * melakukan HTTP bila implementasi null. Setiap throwable dari
     * implementasi nyata harus ditangkap pemanggil (fallback rule-based).
     *
     * @param  array<string, mixed>  $payload  Hanya kunci allowlist.
     * @return list<array<string, mixed>>
     */
    public function generate(array $payload): array;
}
