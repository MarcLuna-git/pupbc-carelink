<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class AppointmentCheckin extends Model
{
    use \App\Models\Concerns\HasSyncVersion;
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'appointment_id',
        'user_id',
        'queue_number',
        'queue_type',
        'triage_reason',
        'is_walk_in',
        'status',
        'check_in_time',
        'checked_in_at',
        'called_at',
        'called_by',
        'no_show_at',
        'no_show_by',
        'skipped_at',
        'skipped_by',
        'returned_at',
        'returned_by',
        'chief_complaint',
        'checkin_status',
    ];

    protected $casts = [
        'is_walk_in' => 'boolean',
        'check_in_time' => 'datetime',
        'checked_in_at' => 'datetime',
        'called_at' => 'datetime',
        'no_show_at' => 'datetime',
        'skipped_at' => 'datetime',
        'returned_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function triage()
    {
        return $this->hasOne(TriageAssessment::class);
    }

    public function consultation()
    {
        return $this->hasOne(Consultation::class, 'appointment_checkin_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }
}
