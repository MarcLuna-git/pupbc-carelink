<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class EmergencyEncounter extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['user_id', 'recorded_by', 'incident_datetime', 'reason', 'symptoms', 'assessment', 'intervention', 'disposition', 'notes'];
    protected $casts = ['incident_datetime' => 'datetime'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) $model->{$model->getKeyName()} = (string) Str::uuid();
        });
    }

    public function student() { return $this->belongsTo(User::class, 'user_id'); }
    public function nurse() { return $this->belongsTo(User::class, 'recorded_by'); }
}
