<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Consultation extends Model
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
        'appointment_id', 'appointment_checkin_id', 'user_id', 'nurse_id',
        'chief_complaint', 'vital_signs', 'general_remarks',
        'medical_certificate', 'medical_certificate_ref',
        'follow_up_required', 'follow_up_date', 'status',
    ];

    protected $casts = [
        'vital_signs' => \App\Casts\NormalizedArray::class,
        'medical_certificate' => 'boolean',
        'follow_up_required' => 'boolean',
        'follow_up_date' => 'date:Y-m-d',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function nurse()
    {
        return $this->belongsTo(User::class, 'nurse_id');
    }

    public function appointment()
    {
        return $this->belongsTo(Appointment::class);
    }

    public function checkin()
    {
        return $this->belongsTo(AppointmentCheckin::class, 'appointment_checkin_id');
    }
}
