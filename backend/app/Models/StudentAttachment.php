<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class StudentAttachment extends Model
{
    public const CATEGORIES = ['xray', 'laboratory', 'prescription', 'medical_document', 'photo', 'other'];

    protected $keyType = 'string';
    public $incrementing = false;

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
        'user_id',
        'uploaded_by',
        'category',
        'description',
        'original_name',
        'mime_type',
        'size',
        'path',
        'contents',
    ];

    // The file itself is only sent by the authenticated file endpoint, never in lists.
    protected $hidden = ['contents', 'path'];

    protected $casts = ['size' => 'integer'];

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
