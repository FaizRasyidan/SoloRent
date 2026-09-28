<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Driver extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_WORKING = 'working';

    protected $fillable = [
        'name',
        'whatsapp',
        'sim_type',
        'sim_number',
        'notes',
        'status',
    ];

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(OperationalTask::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isWorking(): bool
    {
        return $this->status === self::STATUS_WORKING;
    }

    /**
     * A driver with an overlapping rental cannot take another one
     * in the same period (end-exclusive, same rule as units).
     */
    public function isAvailableFor(string $startDate, string $endDate, ?int $ignoreBookingId = null): bool
    {
        if (! $this->isActive()) {
            return false;
        }

        return ! $this->bookings()
            ->whereIn('status', config('solorent.statuses_blocking_availability'))
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId))
            ->whereDate('start_date', '<', $endDate)
            ->whereDate('end_date', '>', $startDate)
            ->exists();
    }

    /** @return Booking|null the overlapping rental blocking this driver, if any */
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

    public function upcomingBookings(int $limit = 5): Collection
    {
        return $this->bookings()
            ->with('vehicle:id,name')
            ->whereIn('status', config('solorent.statuses_blocking_availability'))
            ->where('end_date', '>=', today()->toDateString())
            ->orderBy('start_date')
            ->limit($limit)
            ->get();
    }
}
