<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/*
 * A batch Medical Clearance: the nurse certifies that the listed students were assessed and are
 * physically fit to join an activity. Names are typed in by the nurse; they are not student accounts.
 */
class MedicalClearance extends Model
{
    use \App\Models\Concerns\HasSyncVersion;
    use SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['activity', 'venue', 'group_label', 'activity_date', 'certified_date', 'students', 'issued_by'];

    protected $casts = [
        'students' => 'array',
        'activity_date' => 'date:Y-m-d',
        'certified_date' => 'date:Y-m-d',
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

    public function issuer()
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}
