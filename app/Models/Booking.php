<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Booking extends Model
{
    protected $fillable = [
        'booking_code',
        'vehicle_id',
        'vehicle_unit_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'identity_number',
        'notes',
        'start_date',
        'end_date',
        'duration_days',
        'price_per_day',
        'subtotal',
        'with_driver',
        'driver_id',
        'pickup_method',
        'pickup_location',
        'delivery_name',
        'delivery_address',
        'delivery_district',
        'delivery_note',
        'delivery_fee',
        'return_method',
        'return_address',
        'return_note',
        'total',
        'deposit_amount',
        'payment_status',
        'payment_expires_at',
        'status',
        'terms_accepted',
        'confirmed_at',
        'prepared_at',
        'activated_at',
        'completed_at',
        'cancelled_at',
        'unit_assigned_at',
        'driver_assigned_at',
        'cancel_reason',
        'cancelled_by_type',
        'handover_checklist',
        'handover_notes',
        'handover_photos',
        'handover_completed_at',
        'return_condition',
        'return_fuel',
        'return_notes',
        'return_photos',
        'returned_at',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'payment_expires_at' => 'datetime',
            'terms_accepted' => 'boolean',
            'with_driver' => 'boolean',
            'confirmed_at' => 'datetime',
            'prepared_at' => 'datetime',
            'activated_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'unit_assigned_at' => 'datetime',
            'driver_assigned_at' => 'datetime',
            'handover_checklist' => 'array',
            'handover_photos' => 'array',
            'handover_completed_at' => 'datetime',
            'return_photos' => 'array',
            'returned_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'booking_code';
    }

    public function vehicle(): BelongsTo
    {
        // Booking history must survive even if the vehicle is soft-deleted later.
        return $this->belongsTo(Vehicle::class)->withTrashed();
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(VehicleUnit::class, 'vehicle_unit_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(OperationalTask::class);
    }

    public function deliveryTask(): ?OperationalTask
    {
        return $this->tasks->firstWhere('type', OperationalTask::TYPE_DELIVERY);
    }

    public function pickupTask(): ?OperationalTask
    {
        return $this->tasks->firstWhere('type', OperationalTask::TYPE_PICKUP);
    }

    public function damageCharges(): HasMany
    {
        return $this->hasMany(DamageCharge::class)->orderByDesc('id');
    }

    public function damageRecords(): HasMany
    {
        return $this->hasMany(DamageRecord::class)->orderBy('id');
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class)->orderByDesc('id');
    }

    public function openDamageCharge(): ?DamageCharge
    {
        $relation = $this->relationLoaded('damageCharges')
            ? $this->damageCharges->first(fn (DamageCharge $charge) => $charge->isOpen())
            : $this->damageCharges()->whereIn('status', [DamageCharge::STATUS_UNPAID, DamageCharge::STATUS_PARTIAL])->first();

        return $relation;
    }

    public function items(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->orderByDesc('id');
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    public function cancellation(): HasOne
    {
        return $this->hasOne(Cancellation::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class)->orderByDesc('id');
    }

    public function activeRefund(): ?Refund
    {
        $relation = $this->relationLoaded('refunds')
            ? $this->refunds->first(fn (Refund $refund) => $refund->isActive())
            : $this->refunds()->whereIn('status', Refund::ACTIVE_STATUSES)->first();

        return $relation;
    }

    public function notificationLogs(): HasMany
    {
        return $this->hasMany(NotificationLog::class)->latest();
    }

    /** Grand total = snapshot booking (server-side source of truth). */
    public function grandTotal(): int
    {
        return (int) $this->total;
    }

    /** DP minimum 50%: syarat agar booking pending dapat dikonfirmasi (unit diamankan, belum boleh dipakai). */
    public function dpMinimum(): int
    {
        $percent = (int) config('solorent.payment.dp_percent', 50);

        return (int) ceil($this->grandTotal() * $percent / 100);
    }

    public function dpPercent(): int
    {
        return (int) config('solorent.payment.dp_percent', 50);
    }

    /**
     * Total booking payments (paid). Damage payments are tracked on their own
     * charge and NEVER count toward the booking total.
     */
    public function paidTotal(): int
    {
        $relation = $this->relationLoaded('payments')
            ? $this->payments->where('status', Payment::STATUS_PAID)->where('type', '!=', Payment::TYPE_DAMAGE)->sum('amount')
            : $this->payments()->where('status', Payment::STATUS_PAID)->where('type', '!=', Payment::TYPE_DAMAGE)->sum('amount');

        return (int) $relation;
    }

    public function outstanding(): int
    {
        return max(0, $this->grandTotal() - $this->paidTotal());
    }

    public function isDpSatisfied(): bool
    {
        if ($this->grandTotal() <= 0) {
            return true;
        }

        return $this->paidTotal() >= $this->dpMinimum();
    }

    public function isFullyPaid(): bool
    {
        return $this->outstanding() <= 0 && $this->grandTotal() > 0;
    }

    /** Booking boleh dikonfirmasi jika DP 50% sudah lunas (paid). Unit tetap belum boleh dipakai. */
    public function canBeConfirmed(): bool
    {
        return $this->status === 'pending' && $this->isDpSatisfied();
    }

    /** Unit baru boleh dipakai (siap / serah terima / aktif) jika sudah lunas penuh. */
    public function canUseUnit(): bool
    {
        return $this->isFullyPaid();
    }
}
