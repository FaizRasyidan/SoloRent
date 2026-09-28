<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Vehicle extends Model
{
    use SoftDeletes;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'slug',
        'name',
        'brand',
        'model',
        'category',
        'transmission',
        'seats',
        'engine',
        'fuel',
        'baggage',
        'price_per_day',
        'rating',
        'trips_count',
        'image_url',
        'gallery',
        'description',
        'benefits',
        'stock',
        'is_available',
        'status',
        'featured',
    ];

    protected function casts(): array
    {
        return [
            'gallery' => 'array',
            'benefits' => 'array',
            'rating' => 'decimal:1',
            'is_available' => 'boolean',
            'featured' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // `status` is the single source of truth; the legacy `is_available`
        // flag is derived so every existing customer query keeps working.
        static::saving(function (Vehicle $vehicle) {
            $vehicle->is_available = ($vehicle->status ?? self::STATUS_ACTIVE) === self::STATUS_ACTIVE;
        });
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function bookingItems(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(VehicleImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function units(): HasMany
    {
        return $this->hasMany(VehicleUnit::class)->orderBy('unit_code');
    }

    public function activeUnits(): Collection
    {
        return $this->units()->where('status', VehicleUnit::STATUS_ACTIVE)->get();
    }

    /**
     * Units free for the given period (end-exclusive overlap).
     * Falls back to stock-based capacity when no physical units exist yet.
     *
     * @return array{mode: 'units'|'stock', available: int, total: int, rented: int}
     */
    public function availabilitySummary(string $startDate, string $endDate): array
    {
        $units = $this->activeUnits();

        if ($units->isEmpty()) {
            $rented = $this->activeOverlappingCount($startDate, $endDate);

            return [
                'mode' => 'stock',
                'available' => max(0, $this->stock - $rented),
                'total' => $this->stock,
                'rented' => $rented,
            ];
        }

        // Units under active maintenance leave the rentable pool entirely.
        $maintenanceBlockedIds = MaintenanceRecord::query()
            ->whereIn('vehicle_unit_id', $units->pluck('id')->all())
            ->whereIn('status', [MaintenanceRecord::STATUS_SCHEDULED, MaintenanceRecord::STATUS_IN_PROGRESS])
            ->pluck('vehicle_unit_id')
            ->all();
        $units = $units->reject(fn (VehicleUnit $unit) => in_array($unit->id, $maintenanceBlockedIds, true))->values();

        $blocking = config('solorent.statuses_blocking_availability');
        $assignedUnitIds = Booking::query()
            ->where('vehicle_id', $this->id)
            ->whereIn('status', $blocking)
            ->whereDate('start_date', '<', $endDate)
            ->whereDate('end_date', '>', $startDate)
            ->whereNotNull('vehicle_unit_id')
            ->pluck('vehicle_unit_id')
            ->all();

        $genericOverlaps = Booking::query()
            ->where('vehicle_id', $this->id)
            ->whereIn('status', $blocking)
            ->whereDate('start_date', '<', $endDate)
            ->whereDate('end_date', '>', $startDate)
            ->whereNull('vehicle_unit_id')
            ->count();

        $free = $units->reject(fn (VehicleUnit $unit) => in_array($unit->id, $assignedUnitIds, true));
        $available = max(0, $free->count() - $genericOverlaps);

        return [
            'mode' => 'units',
            'available' => $available,
            'total' => $units->count(),
            'rented' => $units->count() - $free->count() + min($genericOverlaps, $free->count()),
        ];
    }

    public function primaryImage(): ?VehicleImage
    {
        return $this->images()->where('is_primary', true)->first() ?? $this->images()->first();
    }

    /**
     * Resolve the display-ready primary image URL.
     * Uploaded files live on the public disk; legacy seed data may hold
     * absolute URLs in `image_url` / `gallery`.
     */
    public function primaryImageUrl(): ?string
    {
        $primary = $this->primaryImage();

        if ($primary) {
            return $primary->url();
        }

        if ($this->image_url) {
            return self::resolveImageUrl($this->image_url);
        }

        $gallery = $this->gallery ?: [];

        return isset($gallery[0]) ? self::resolveImageUrl($gallery[0]) : null;
    }

    /** @return list<string> */
    public function galleryUrls(): array
    {
        $urls = $this->images()->get()->map(fn (VehicleImage $image) => $image->url())->all();

        if ($urls === []) {
            $legacy = $this->gallery ?: array_filter([$this->image_url]);
            $urls = array_values(array_filter(array_map(
                fn ($url) => $url ? self::resolveImageUrl((string) $url) : null,
                is_array($legacy) ? $legacy : []
            )));
        }

        return array_values(array_unique($urls));
    }

    public static function resolveImageUrl(?string $path): string
    {
        $path = (string) $path;

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return Storage::disk('public')->url(ltrim($path, '/'));
    }

    public function isActive(): bool
    {
        return ($this->status ?? self::STATUS_ACTIVE) === self::STATUS_ACTIVE;
    }

    public function hasHistory(): bool
    {
        return $this->bookings()->exists() || $this->bookingItems()->exists();
    }

    public function activeOverlappingCount(string $startDate, string $endDate): int
    {
        return $this->bookings()
            ->whereIn('status', config('solorent.statuses_blocking_availability'))
            ->where('start_date', '<=', $endDate)
            ->where('end_date', '>=', $startDate)
            ->count();
    }

    public function isAvailableFor(string $startDate, string $endDate): bool
    {
        if (! $this->is_available || $this->stock < 1) {
            return false;
        }

        return $this->activeOverlappingCount($startDate, $endDate) < $this->stock;
    }

    public function baseAvailability(): string
    {
        if (! $this->is_available || $this->stock < 1) {
            return 'unavailable';
        }

        return $this->stock === 1 ? 'limited' : 'available';
    }
}
