<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MedicineBatch extends Model
{
    use HasFactory, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['medicine_id', 'lot_number', 'quantity', 'expiry_date', 'received_at', 'supplier', 'reference'];
    protected $casts = ['quantity' => 'integer', 'expiry_date' => 'date:Y-m-d', 'received_at' => 'date:Y-m-d'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }

    public function movements()
    {
        return $this->hasMany(MedicineStockMovement::class);
    }
}