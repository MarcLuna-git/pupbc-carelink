<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/*
 * A faculty or staff member the clinic gives medicine to. Kept by the nurse; not a login account.
 * Deleting one only hides it (soft delete), so the medicines already dispensed stay on record.
 */
class FacultyMember extends Model
{
    use \App\Models\Concerns\HasSyncVersion;
    use SoftDeletes;

    public const TYPES = ['full_time', 'part_time'];
    public const STATUSES = ['active', 'inactive'];

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'full_name', 'faculty_type', 'course', 'designation', 'department',
        'email', 'phone', 'notes', 'status', 'created_by',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function dispensings()
    {
        return $this->hasMany(FacultyDispensing::class);
    }

    public function consultations()
    {
        return $this->hasMany(FacultyConsultation::class);
    }
}
