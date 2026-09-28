<?php

namespace App\Contracts\Insights;

use App\Support\Insights\Insight;

interface InsightProvider
{
    /**
     * @param  array<string, mixed>  $context  Agregat minim per periode
     *                                         (counts, amounts, utilization). Tidak berisi PII.
     * @return list<Insight>
     */
    public function provide(array $context): array;
}
