<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DamageChargeItem extends Model
{
    protected $fillable = [
        'damage_charge_id',
        'damage_record_id',
        'description',
        'amount',
    ];

    public function charge(): BelongsTo
    {
        return $this->belongsTo(DamageCharge::class, 'damage_charge_id');
    }

    public function record(): BelongsTo
    {
        return $this->belongsTo(DamageRecord::class, 'damage_record_id');
    }
}
