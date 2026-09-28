<?php

namespace App\Support\Insights;

/**
 * Satu item Needs Attention: dihitung LIVE dari query (tidak disimpan),
 * sehingga otomatis kedaluwarsa saat masalah diperbaiki.
 */
final class AttentionItem
{
    public function __construct(
        public readonly string $id,
        public readonly string $priority,
        public readonly string $title,
        public readonly string $detail,
        public readonly int $count,
        public readonly string $actionUrl,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'priority' => $this->priority,
            'title' => $this->title,
            'detail' => $this->detail,
            'count' => $this->count,
            'action_url' => $this->actionUrl,
        ];
    }
}
