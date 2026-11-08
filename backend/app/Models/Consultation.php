<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Consultation extends Model
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
        'appointment_id', 'appointment_checkin_id', 'user_id', 'nurse_id',
        'chief_complaint', 'vital_signs', 'general_remarks',
        'history_present_illness', 'nursing_assessment', 'nursing_interventions', 'treatment_plan',
        'medical_certificate', 'medical_certificate_ref', 'liability_form', 'liability_activity',
        'ojt_certificate', 'ojt_certificate_ref', 'ojt_company',
        'sick_certificate', 'sick_certificate_ref', 'sick_rest_days',
        'follow_up_required', 'follow_up_date', 'status',
    ];

    protected $casts = [
        'vital_signs' => \App\Casts\NormalizedArray::class,
        'medical_certificate' => 'boolean',
        'liability_form' => 'boolean',
        'ojt_certificate' => 'boolean',
        'sick_certificate' => 'boolean',
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
