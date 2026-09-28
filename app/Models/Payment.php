<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_PAID = 'paid';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_CANCELLED = 'cancelled';

    public const TYPE_DEPOSIT = 'deposit';

    public const TYPE_RENTAL = 'rental';

    public const TYPE_ADDITIONAL = 'additional';

    public const TYPE_FULL = 'full_payment';

    public const TYPE_DAMAGE = 'damage';

    public const METHOD_BANK_TRANSFER = 'bank_transfer';

    protected $fillable = [
        'booking_id',
        'damage_charge_id',
        'payment_code',
        'type',
        'method',
        'amount',
        'status',
        'submitted_at',
        'paid_at',
        'reference',
        'proof_path',
        'proof_original_name',
        'notes',
        'admin_note',
        'rejection_reason',
        'verified_by',
        'verified_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'paid_at' => 'datetime',
            'verified_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'payment_code';
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function damageCharge(): BelongsTo
    {
        return $this->belongsTo(DamageCharge::class);
    }

    public function isDamage(): bool
    {
        return $this->type === self::TYPE_DAMAGE;
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function isFinal(): bool
    {
        return in_array($this->status, [self::STATUS_PAID, self::STATUS_CANCELLED, self::STATUS_EXPIRED], true);
    }

    public function isSubmittable(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_REJECTED], true);
    }
}
