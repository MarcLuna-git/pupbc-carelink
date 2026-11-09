<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/*
 * A document the nurse issues for a group of students at once (Batch Release), for example a Medical Clearance.
 * `type` is a key of config/batch_documents.php; `fields` holds that document's details.
 */
class BatchDocument extends Model
{
    use \App\Models\Concerns\HasSyncVersion;
    use SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['type', 'title', 'fields', 'students', 'issued_date', 'issued_by'];

    protected $casts = [
        'fields' => 'array',
        'students' => 'array',
        'issued_date' => 'date:Y-m-d',
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
