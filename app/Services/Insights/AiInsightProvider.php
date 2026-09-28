<?php

namespace App\Services\Insights;

use App\Contracts\Insights\AiInsightGenerator;
use App\Contracts\Insights\InsightProvider;
use App\Support\Insights\Insight;
use Illuminate\Support\Facades\Log;

/**
 * Provider AI: transformer murni agregat-allowlist → Insight[].
 * Mati secara default (config insights.ai.enabled=false). Setiap
 * throwable/timeout/output tak valid → [] (fallback rule-based).
 */
class AiInsightProvider implements InsightProvider
{
    /** Kunci agregat yang BOLEH dikirim ke generator. Tanpa PII. */
    public const PAYLOAD_KEYS = [
        'period',
        'booking_count',
        'booking_count_previous',
        'booking_change_pct',
        'cancelled',
        'cancellation_rate',
        'net_revenue',
        'net_revenue_previous',
        'revenue_change_pct',
        'utilization_pct',
        'fleet_types',
        'fleet_units',
        'weekend_ratio',
        'repeat_customer_pct',
        'maintenance_days',
    ];

    private const CATEGORIES = [
        'demand', 'revenue', 'fleet', 'customer',
        'cancellation', 'maintenance', 'general',
    ];

    public function __construct(private AiInsightGenerator $generator) {}

    /** @param  array<string, mixed>  $context  @return list<Insight> */
    public function provide(array $context): array
    {
        if (config('insights.ai.enabled', false) !== true) {
            return [];
        }

        $payload = [];
        foreach (self::PAYLOAD_KEYS as $key) {
            if (array_key_exists($key, $context)) {
                $payload[$key] = $context[$key];
            }
        }

        try {
            $raw = $this->generator->generate($payload);
        } catch (\Throwable $e) {
            Log::warning('insight.ai.failed', ['error' => $e->getMessage()]);

            return [];
        }

        $out = [];
        foreach ($raw as $item) {
            $insight = $this->validate($item);
            if ($insight instanceof Insight) {
                $out[] = $insight;
            }
        }

        return $out;
    }

    private function validate(mixed $item): ?Insight
    {
        if (! is_array($item)) {
            Log::warning('insight.ai.invalid', ['reason' => 'not_array']);

            return null;
        }

        $maxTitle = (int) config('insights.ai.max_title', 120);
        $maxSummary = (int) config('insights.ai.max_summary', 400);
        $maxRec = (int) config('insights.ai.max_recommendation', 300);
        $maxEv = (int) config('insights.ai.max_evidence', 5);

        $title = (string) ($item['title'] ?? '');
        $summary = (string) ($item['summary'] ?? '');
        $recommendation = (string) ($item['recommendation'] ?? '');
        $confidence = (string) ($item['confidence'] ?? '');
        $evidence = $item['evidence'] ?? null;
        $category = (string) ($item['category'] ?? 'general');

        if ($title === '' || mb_strlen($title) > $maxTitle
            || $summary === '' || mb_strlen($summary) > $maxSummary
            || $recommendation === '' || mb_strlen($recommendation) > $maxRec
            || ! in_array($confidence, ['high', 'medium', 'low'], true)
            || ! is_array($evidence) || $evidence === [] || count($evidence) > $maxEv
            || ! in_array($category, self::CATEGORIES, true)
        ) {
            Log::warning('insight.ai.invalid', ['reason' => 'schema']);

            return null;
        }

        $clean = [];
        foreach ($evidence as $line) {
            if (! is_string($line) || $line === '' || mb_strlen($line) > 300) {
                Log::warning('insight.ai.invalid', ['reason' => 'evidence']);

                return null;
            }
            $clean[] = $line;
        }

        // Batas fakta: evidence AI tidak boleh mengandung kata sifat absolut.
        foreach ([$title, $summary] as $text) {
            if (preg_match('/\b(terbaik|terburuk)\b/i', $text)) {
                Log::warning('insight.ai.invalid', ['reason' => 'wording']);

                return null;
            }
        }

        return new Insight(
            id: 'ai_'.substr(md5($title), 0, 12),
            category: $category,
            title: $title,
            summary: $summary,
            evidence: $clean,
            recommendation: $recommendation,
            confidence: $confidence,
            priority: 100,
            actionUrl: '/admin/reports?tab=insights',
            generatedBy: 'ai',
        );
    }
}
