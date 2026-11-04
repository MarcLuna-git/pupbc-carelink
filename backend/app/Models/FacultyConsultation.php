<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/* One clinic consultation for a faculty member: complaint, vital signs, findings, and what was done. */
class FacultyConsultation extends Model
{
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'faculty_member_id', 'chief_complaint', 'blood_pressure', 'temperature', 'pulse_rate',
        'assessment', 'intervention', 'notes', 'consulted_by',
    ];
    protected $casts = ['temperature' => 'float', 'pulse_rate' => 'integer'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) {
                $model->{$model->getKeyName()} = (string) Str::orderedUuid();
            }
        });
    }

    public function faculty()
    {
        return $this->belongsTo(FacultyMember::class, 'faculty_member_id')->withTrashed();
    }

    public function consultant()
    {
        return $this->belongsTo(User::class, 'consulted_by');
    }
}
