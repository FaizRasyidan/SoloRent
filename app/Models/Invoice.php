<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = [
        'booking_id',
        'invoice_number',
        'customer_name',
        'vehicle_name',
        'start_date',
        'end_date',
        'duration_days',
        'price_per_day',
        'subtotal',
        'delivery_fee',
        'deposit_amount',
        'total',
        'payment_status',
        'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'issued_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'invoice_number';
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
