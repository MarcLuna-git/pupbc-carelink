<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Medicine extends Model
{
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
        'name', 'generic_name', 'category', 'quantity',
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

    public function scopeExpiringSoon($query)
    {
        return $query->whereNotNull('expiry_date')
            ->where('expiry_date', '<=', now()->addMonths(3));
    }

    public function scopeExpired($query)
    {
        return $query->whereNotNull('expiry_date')
            ->where('expiry_date', '<', now());
    }
}