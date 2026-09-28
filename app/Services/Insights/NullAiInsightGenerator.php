<?php

namespace App\Services\Insights;

use App\Contracts\Insights\AiInsightGenerator;

/**
 * Implementasi null: tidak ada jaringan, tidak ada dependensi baru.
 * Mengembalikan list kosong sehingga dashboard 100% rule-based.
 */
class NullAiInsightGenerator implements AiInsightGenerator
{
    /** @param  array<string, mixed>  $payload  @return list<array<string, mixed>> */
    public function generate(array $payload): array
    {
        return [];
    }
}
