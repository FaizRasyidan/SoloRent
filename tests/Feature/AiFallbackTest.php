<?php

use App\Contracts\Insights\AiInsightGenerator;
use App\Services\Insights\AiInsightProvider;
use App\Services\Insights\NullAiInsightGenerator;

class ThrowingAiGenerator implements AiInsightGenerator
{
    /** @param  array<string, mixed>  $payload  @return list<array<string, mixed>> */
    public function generate(array $payload): array
    {
        throw new RuntimeException('AI timeout');
    }
}

class CapturingAiGenerator implements AiInsightGenerator
{
    /** @var array<string, mixed> */
    public static array $seen = [];

    /** @param  array<string, mixed>  $payload  @return list<array<string, mixed>> */
    public function generate(array $payload): array
    {
        self::$seen = $payload;

        return [];
    }
}

class MalformedAiGenerator implements AiInsightGenerator
{
    /** @param  array<string, mixed>  $payload  @return list<array<string, mixed>> */
    public function generate(array $payload): array
    {
        return [
            ['title' => 'Terbaik sedunia', 'summary' => 'x', 'evidence' => ['y'], 'recommendation' => 'z', 'confidence' => 'high', 'category' => 'demand'],
            ['title' => str_repeat('a', 500), 'summary' => 'x', 'evidence' => ['y'], 'recommendation' => 'z', 'confidence' => 'high'],
            ['title' => 'Valid tetapi bukti berlebih', 'summary' => 'x', 'evidence' => ['1', '2', '3', '4', '5', '6'], 'recommendation' => 'z', 'confidence' => 'high'],
            ['title' => 'Confidence asing', 'summary' => 'x', 'evidence' => ['y'], 'recommendation' => 'z', 'confidence' => 'super'],
            'bukan-array',
        ];
    }
}

function aiProviderWith(AiInsightGenerator $generator): AiInsightProvider
{
    return new AiInsightProvider($generator);
}

test('ai disabled by default returns no insights', function () {
    expect(config('insights.ai.enabled'))->toBeFalse();

    $out = aiProviderWith(new NullAiInsightGenerator)->provide(['booking_count' => 10]);

    expect($out)->toBeEmpty();
});

test('ai timeout falls back to empty without throwing', function () {
    config(['insights.ai.enabled' => true]);

    $out = aiProviderWith(new ThrowingAiGenerator)->provide(['booking_count' => 10]);

    expect($out)->toBeEmpty();
});

test('ai payload contains only allowlisted aggregate keys', function () {
    config(['insights.ai.enabled' => true]);
    CapturingAiGenerator::$seen = [];

    aiProviderWith(new CapturingAiGenerator)->provide([
        'booking_count' => 10,
        'customer_name' => 'Budi Santoso',
        'customer_phone' => '081234567890',
        'password' => 'secret',
    ]);

    $seen = CapturingAiGenerator::$seen;
    expect($seen)->not->toHaveKey('customer_name')
        ->and($seen)->not->toHaveKey('customer_phone')
        ->and($seen)->not->toHaveKey('password');

    foreach (array_keys($seen) as $key) {
        expect(AiInsightProvider::PAYLOAD_KEYS)->toContain($key);
    }
});

test('ai malformed output is dropped entirely', function () {
    config(['insights.ai.enabled' => true]);

    $out = aiProviderWith(new MalformedAiGenerator)->provide(['booking_count' => 10]);

    expect($out)->toBeEmpty();
});
