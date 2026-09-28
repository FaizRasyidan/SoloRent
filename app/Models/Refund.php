<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class Refund extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    /** Status refund yang mengurangi jatah refundable (anti double-claim). */
    public const ACTIVE_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PROCESSING,
        self::STATUS_COMPLETED,
    ];

    public const CHANNEL_MANUAL = 'manual';

    public const CHANNEL_GATEWAY = 'gateway';

    protected $fillable = [
        'booking_id',
        'cancellation_id',
        'payment_id',
        'refund_code',
        'amount',
        'status',
        'reason_code',
        'reason',
        'channel',
        'reference',
        'failure_reason',
        'processed_at',
        'processed_by',
    ];

    protected function casts(): array
    {
        return [
            'processed_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'refund_code';
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function cancellation(): BelongsTo
    {
        return $this->belongsTo(Cancellation::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function isFinal(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_FAILED, self::STATUS_CANCELLED], true);
    }

    public static function generateCode(): string
    {
        $prefix = 'RF-'.now()->format('Ymd').'-';

        return DB::transaction(function () use ($prefix) {
            $sequence = self::whereDate('created_at', today())->lockForUpdate()->count() + 1;

            do {
                $code = $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
                $sequence++;
            } while (self::where('refund_code', $code)->exists());

            return $code;
        });
    }
}
