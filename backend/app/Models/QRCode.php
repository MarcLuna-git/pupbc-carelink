<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class QRCode extends Model
{
    use HasFactory;

    protected $table = 'qr_codes';

    protected $keyType = 'string';

    public $incrementing = false;

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (!$model->getKey()) {
                $model->{$model->getKeyName()} =
                    (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'user_id',
        'qr_code_hash',
        'qr_code_path',
        'last_scanned_at',
        'scan_count',
        'is_active',
        'expires_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'scan_count' => 'integer',
        'last_scanned_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(
            User::class
        );
    }

    public function isUsable(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if (
            $this->expires_at &&
            $this->expires_at->isPast()
        ) {
            return false;
        }

        return true;
    }
}