<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class TriageAssessment extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['appointment_checkin_id', 'chief_complaint', 'severity', 'red_flags', 'priority', 'notes'];
    protected $casts = ['red_flags' => 'array'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) $model->{$model->getKeyName()} = (string) Str::uuid();
        });
    }

    public function checkin() { return $this->belongsTo(AppointmentCheckin::class, 'appointment_checkin_id'); }
}
