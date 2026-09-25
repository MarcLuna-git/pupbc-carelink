<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\SoftDeletes;

class Appointment extends Model
{
    use HasFactory, SoftDeletes;

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

            if (!$model->reference_number) {
                $model->reference_number =
                    'APT-' . strtoupper(
                        Str::random(6)
                    );
            }
        });
    }

    protected $fillable = [
        'user_id',
        'service',
        'appointment_date',
        'time_slot',
        'concern',
        'status',
        'reference_number',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'cancellation_reason',
        'cancelled_by',
        'cancelled_at',
    ];

    protected $casts = [
        // A clinic calendar date is not an instant; never serialize it in UTC.
        'appointment_date' => 'date:Y-m-d',
        'approved_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(
            User::class
        );
    }

    public function approvedBy()
    {
        return $this->belongsTo(
            User::class,
            'approved_by'
        );
    }

    public function checkins()
    {
        return $this->hasMany(
            AppointmentCheckin::class,
            'appointment_id'
        );
    }

    public function latestCheckin()
    {
        return $this->hasOne(
            AppointmentCheckin::class,
            'appointment_id'
        )
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    public function consultation()
    {
        return $this->hasOne(
            Consultation::class,
            'appointment_id'
        );
    }
}
