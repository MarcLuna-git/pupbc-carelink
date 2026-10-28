<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/* One medicine given to one faculty member: what, how many, why, by whom, and when. */
class FacultyDispensing extends Model
{
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['faculty_member_id', 'medicine_id', 'medicine_name', 'quantity', 'unit', 'reason', 'dispensed_by'];
    protected $casts = ['quantity' => 'integer'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) {
                // Time-ordered, so two dispensings in the same second still list in the order they happened.
                $model->{$model->getKeyName()} = (string) Str::orderedUuid();
            }
        });
    }

    public function faculty()
    {
        return $this->belongsTo(FacultyMember::class, 'faculty_member_id')->withTrashed();
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class)->withTrashed();
    }

    public function dispenser()
    {
        return $this->belongsTo(User::class, 'dispensed_by');
    }
}
