<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Types for the cast attributes, so editors do not read the `date:Y-m-d` cast as a class name.
 *
 * @property \Illuminate\Support\Carbon|null $expiry_date
 */
class Medicine extends Model
{
    use \App\Models\Concerns\HasSyncVersion;
    use HasFactory, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'name', 'generic_name', 'manufacturer', 'category', 'quantity',
        'minimum_stock', 'unit', 'dosage', 'expiry_date',
        'description', 'added_by',
    ];

    protected $casts = [
        'expiry_date' => 'date:Y-m-d',
        'quantity' => 'integer',
        'minimum_stock' => 'integer',
    ];

    public function addedBy()
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function batches()
    {
        return $this->hasMany(MedicineBatch::class);
    }

    public function stockMovements()
    {
        return $this->hasMany(MedicineStockMovement::class);
    }

    public function scopeLowStock($query)
    {
        return $query->whereColumn('quantity', '<=', 'minimum_stock');
    }

    /*
     * Expiry rule used everywhere (badge, filters, notifications): when the
     * medicine has batches that still hold stock and carry an expiry date, the
     * earliest of those dates is what matters (first-expiry, first-out);
     * otherwise the medicine's own expiry date applies.
     */
    private function whereEffectiveExpiry($query, string $operator, string $date)
    {
        $stocked = fn ($batches) => $batches
            ->where('medicine_batches.quantity', '>', 0)
            ->whereNotNull('medicine_batches.expiry_date');

        return $query->where(function ($query) use ($stocked, $operator, $date) {
            $query->whereHas('batches', fn ($batches) => $stocked($batches)
                    ->whereDate('medicine_batches.expiry_date', $operator, $date))
                ->orWhere(function ($query) use ($stocked, $operator, $date) {
                    $query->whereDoesntHave('batches', fn ($batches) => $stocked($batches))
                        ->whereNotNull('medicines.expiry_date')
                        ->whereDate('medicines.expiry_date', $operator, $date);
                });
        });
    }

    public function scopeExpiringSoon($query)
    {
        return $this->whereEffectiveExpiry($query, '<=', now()->addMonths(3)->toDateString());
    }

    public function scopeExpired($query)
    {
        return $this->whereEffectiveExpiry($query, '<', today()->toDateString());
    }

    /** The expiry date is today: still usable today, expired from tomorrow. */
    public function scopeExpiresToday($query)
    {
        return $this->whereEffectiveExpiry($query, '=', today()->toDateString());
    }

    /*
     * The same expiry rule as one SQL expression, for sorting the inventory by expiry date.
     * Plain SQL that MySQL/MariaDB and PostgreSQL both accept.
     */
    public const EFFECTIVE_EXPIRY_SQL = 'COALESCE((SELECT MIN(mb.expiry_date) FROM medicine_batches mb'
        . ' WHERE mb.medicine_id = medicines.id AND mb.quantity > 0 AND mb.expiry_date IS NOT NULL AND mb.deleted_at IS NULL),'
        . ' medicines.expiry_date)';

    /** Earliest expiry that matters for this medicine (see the rule above). */
    public function nearestExpiry(): ?Carbon
    {
        $batchExpiry = $this->batches()
            ->where('quantity', '>', 0)
            ->whereNotNull('expiry_date')
            ->min('expiry_date');

        $date = $batchExpiry ?: $this->expiry_date;

        return $date ? Carbon::parse($date) : null;
    }
}
