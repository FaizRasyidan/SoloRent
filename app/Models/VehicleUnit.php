<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VehicleUnit extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'vehicle_id',
        'unit_code',
        'plate_number',
        'status',
        'notes',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class)->orderByDesc('id');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /** Unit with scheduled/in-progress maintenance cannot take new bookings. */
    public function hasActiveMaintenance(): bool
    {
        $relation = $this->relationLoaded('maintenances')
            ? $this->maintenances->first(fn (MaintenanceRecord $record) => $record->isActive()) !== null
            : $this->maintenances()->whereIn('status', [MaintenanceRecord::STATUS_SCHEDULED, MaintenanceRecord::STATUS_IN_PROGRESS])->exists();

        return (bool) $relation;
    }

    public function activeMaintenance(): ?MaintenanceRecord
    {
        return $this->maintenances()->whereIn('status', [MaintenanceRecord::STATUS_SCHEDULED, MaintenanceRecord::STATUS_IN_PROGRESS])
            ->orderByDesc('id')->first();
    }

    /**
     * End-exclusive overlap: a unit returned on day X can be
     * assigned to another booking starting day X.
     * whereDate is used so boundary comparison stays correct
     * on SQLite (stores dates with time part) and MySQL alike.
     */
    public function isAvailableFor(string $startDate, string $endDate, ?int $ignoreBookingId = null): bool
    {
        if (! $this->isActive() || $this->hasActiveMaintenance()) {
            return false;
        }

        return ! $this->bookings()
            ->whereIn('status', config('solorent.statuses_blocking_availability'))
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId))
            ->whereDate('start_date', '<', $endDate)
            ->whereDate('end_date', '>', $startDate)
            ->exists();
    }

    /** @return Booking|null the overlapping booking blocking this unit, if any */
    public function blockingBooking(string $startDate, string $endDate, ?int $ignoreBookingId = null): ?Booking
    {
        return $this->bookings()
            ->whereIn('status', config('solorent.statuses_blocking_availability'))
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId))
            ->whereDate('start_date', '<', $endDate)
            ->whereDate('end_date', '>', $startDate)
            ->orderBy('start_date')
            ->first();
    }
}
