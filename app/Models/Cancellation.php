<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Cancellation extends Model
{
    public const STATUS_CANCELLED = 'cancelled';

    public const BY_CUSTOMER = 'customer';

    public const BY_ADMIN = 'admin';

    public const BY_SYSTEM = 'system';

    protected $fillable = [
        'booking_id',
        'cancelled_by_type',
        'cancelled_by_id',
        'reason_code',
        'reason',
        'policy_rule',
        'policy_percent',
        'original_amount',
        'refund_amount',
        'non_refundable_amount',
        'status',
        'cancelled_at',
        'override_policy_amount',
        'override_amount',
        'override_reason',
        'overridden_by',
    ];

    protected function casts(): array
    {
        return [
            'cancelled_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function refund(): HasOne
    {
        return $this->hasOne(Refund::class)->latestOfMany();
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by_id');
    }

    public function overrider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'overridden_by');
    }

    public function wasOverridden(): bool
    {
        return $this->override_amount !== null;
    }
}
