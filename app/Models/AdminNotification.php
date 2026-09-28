<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Lonceng admin: ringkasan kejadian yang butuh perhatian admin
 * (booking baru, pembayaran menunggu verifikasi, pembatalan, refund gagal).
 *
 * Disengaja terpisah dari notification_logs (outbox pesan ke customer).
 *
 * @property int $id
 * @property string $type
 * @property string $level
 * @property string $title
 * @property string|null $body
 * @property int|null $booking_id
 * @property int|null $payment_id
 * @property int|null $refund_id
 * @property int|null $damage_charge_id
 * @property string|null $action_url
 * @property Carbon|null $read_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */

/**
 * Lonceng admin: ringkasan kejadian yang butuh perhatian admin
 * (booking baru, pembayaran menunggu verifikasi, pembatalan, refund gagal).
 *
 * Disengaja terpisah dari notification_logs (outbox pesan ke customer).
 */
class AdminNotification extends Model
{
    public const TYPE_BOOKING_CREATED = 'booking_created';

    public const TYPE_PAYMENT_SUBMITTED = 'payment_submitted';

    public const TYPE_DAMAGE_PAYMENT_SUBMITTED = 'damage_payment_submitted';

    public const TYPE_BOOKING_CANCELLED = 'booking_cancelled';

    public const TYPE_REFUND_FAILED = 'refund_failed';

    public const LEVEL_INFO = 'info';

    public const LEVEL_ACTION = 'action';

    public const LEVEL_SUCCESS = 'success';

    public const LEVEL_WARNING = 'warning';

    public const LEVEL_DANGER = 'danger';

    /** @var list<string> */
    public const LEVELS = [
        self::LEVEL_INFO,
        self::LEVEL_ACTION,
        self::LEVEL_SUCCESS,
        self::LEVEL_WARNING,
        self::LEVEL_DANGER,
    ];

    protected $fillable = [
        'type',
        'level',
        'title',
        'body',
        'booking_id',
        'payment_id',
        'refund_id',
        'damage_charge_id',
        'action_url',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<Payment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /** @return BelongsTo<Refund, $this> */
    public function refund(): BelongsTo
    {
        return $this->belongsTo(Refund::class);
    }

    /** @return BelongsTo<DamageCharge, $this> */
    public function damageCharge(): BelongsTo
    {
        return $this->belongsTo(DamageCharge::class);
    }

    /**
     * @param  Builder<AdminNotification>  $query
     * @return Builder<AdminNotification>
     */
    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }
}
