<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class StudentProfile extends Model
{
    use HasFactory;

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
    'user_id',
    'course',
    'year',
    'section',
    'birthday',
    'gender',
    'mobile_number',
    'address',
    'profile_picture',
    'guardian_name',
    'guardian_relationship',
    'guardian_contact',
];  

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}