<?php

namespace App\Support\Insights;

/**
 * Satu insight faktual untuk dashboard / halaman insights.
 * Bahasa: Indonesia, faktual ("naik/turun X%"), tanpa kata sifat
 * ("terbaik", "baik", "buruk").
 */
final class Insight
{
    /**
     * @param  list<string>  $evidence
     */
    public function __construct(
        public readonly string $id,
        public readonly string $category,
        public readonly string $title,
        public readonly string $summary,
        public readonly array $evidence,
        public readonly string $recommendation,
        public readonly string $confidence,
        public readonly int $priority,
        public readonly string $actionUrl,
        public readonly string $generatedBy = 'rule',
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'title' => $this->title,
            'summary' => $this->summary,
            'evidence' => $this->evidence,
            'recommendation' => $this->recommendation,
            'confidence' => $this->confidence,
            'priority' => $this->priority,
            'action_url' => $this->actionUrl,
            'generated_by' => $this->generatedBy,
        ];
    }
}
