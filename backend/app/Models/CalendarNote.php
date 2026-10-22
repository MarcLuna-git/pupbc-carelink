<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CalendarNote extends Model
{
    use \App\Models\Concerns\HasSyncVersion;

    public const COLORS = ['maroon', 'blue', 'green', 'amber', 'purple'];

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
        'note_date',
        'title',
        'details',
        'color',
        'created_by',
    ];

    protected $casts = [
        // A calendar date is not an instant; never serialize it in UTC.
        'note_date' => 'date:Y-m-d',
    ];

    public function author()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
