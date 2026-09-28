<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DamageCharge extends Model
{
    public const STATUS_UNPAID = 'unpaid';

    public const STATUS_PARTIAL = 'partial';

    public const STATUS_PAID = 'paid';

    public const STATUS_WAIVED = 'waived';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'booking_id',
        'charge_code',
        'subtotal',
        'total',
        'status',
        'notes',
        'created_by',
        'waived_reason',
        'waived_by',
        'waived_at',
    ];

    protected function casts(): array
    {
        return [
            'waived_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'charge_code';
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(DamageChargeItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, [self::STATUS_UNPAID, self::STATUS_PARTIAL], true);
    }

    public function isLocked(): bool
    {
        return in_array($this->status, [self::STATUS_PAID, self::STATUS_WAIVED, self::STATUS_CANCELLED], true);
    }

    public function paidTotal(): int
    {
        $relation = $this->relationLoaded('payments')
            ? $this->payments->where('status', Payment::STATUS_PAID)->sum('amount')
            : $this->payments()->where('status', Payment::STATUS_PAID)->sum('amount');

        return (int) $relation;
    }

    public function outstanding(): int
    {
        return max(0, (int) $this->total - $this->paidTotal());
    }

    /** Server-side source of truth: total selalu = sum(items.amount). */
    public function recalculate(): self
    {
        $total = (int) $this->items()->sum('amount');
        $this->update(['subtotal' => $total, 'total' => $total]);
        $this->syncStatus();

        return $this->fresh();
    }

    public function syncStatus(): self
    {
        if (! $this->isOpen()) {
            return $this;
        }

        $paid = $this->paidTotal();
        $total = (int) $this->total;

        $this->update([
            'status' => $paid <= 0 ? self::STATUS_UNPAID : ($paid >= $total ? self::STATUS_PAID : self::STATUS_PARTIAL),
        ]);

        return $this->fresh();
    }

    public static function generateCode(): string
    {
        $prefix = 'DC-'.now()->format('Ymd').'-';

        return DB::transaction(function () use ($prefix) {
            $sequence = self::whereDate('created_at', today())->lockForUpdate()->count() + 1;

            do {
                $code = $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
                $sequence++;
            } while (self::where('charge_code', $code)->exists());

            return $code;
        });
    }

    public static function photoUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return Storage::disk('public')->url(ltrim($path, '/'));
    }
}
