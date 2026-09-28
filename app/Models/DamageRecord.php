<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DamageRecord extends Model
{
    protected $fillable = [
        'booking_id',
        'vehicle_unit_id',
        'title',
        'description',
        'repair_cost',
        'photo_path',
        'created_by',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(VehicleUnit::class, 'vehicle_unit_id');
    }

    public function photoUrl(): ?string
    {
        return DamageCharge::photoUrl($this->photo_path);
    }
}
