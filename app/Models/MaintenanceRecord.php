<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceRecord extends Model
{
    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const PRIORITY_RENDAH = 'rendah';

    public const PRIORITY_SEDANG = 'sedang';

    public const PRIORITY_TINGGI = 'tinggi';

    public const PRIORITY_DARURAT = 'darurat';

    public const PRIORITIES = [
        self::PRIORITY_RENDAH,
        self::PRIORITY_SEDANG,
        self::PRIORITY_TINGGI,
        self::PRIORITY_DARURAT,
    ];

    public const SOURCE_AUTO = 'auto';

    public const SOURCE_MANUAL = 'manual';

    protected $fillable = [
        'vehicle_unit_id',
        'booking_id',
        'damage_record_id',
        'title',
        'description',
        'cost',
        'priority',
        'status',
        'source',
        'unit_status_before',
        'started_at',
        'completed_at',
        'estimated_completed_at',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'estimated_completed_at' => 'datetime',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(VehicleUnit::class, 'vehicle_unit_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function damageRecord(): BelongsTo
    {
        return $this->belongsTo(DamageRecord::class, 'damage_record_id');
    }

    public function isActive(): bool
    {
        return in_array($this->status, [self::STATUS_SCHEDULED, self::STATUS_IN_PROGRESS], true);
    }

    public function canTransitionTo(string $status): bool
    {
        return match ($this->status) {
            self::STATUS_SCHEDULED => in_array($status, [self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED], true),
            self::STATUS_IN_PROGRESS => in_array($status, [self::STATUS_COMPLETED, self::STATUS_CANCELLED], true),
            default => false,
        };
    }

    public function isAuto(): bool
    {
        return $this->source === self::SOURCE_AUTO;
    }

    public function isOverdue(): bool
    {
        return $this->estimated_completed_at !== null
            && $this->isActive()
            && $this->estimated_completed_at->isPast();
    }
}
