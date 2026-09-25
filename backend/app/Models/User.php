<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

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
        'student_id',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'role',
        'password',
        'birthday',
        'gender',
        'course',
        'year',
        'section',
        'mobile_number',

        // Retained for legacy/staff compatibility.
        // Student access no longer depends on this field.
        'status',
        'archive_reason',
        'archived_by',
        'archived_at',

        'email_verified_at',
        'last_login_at',
        'ip_address',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'birthday' => 'date:Y-m-d',
        'last_login_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [];
    }

    public function studentProfile()
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function profile()
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function healthProfile()
    {
        return $this->hasOne(HealthProfile::class);
    }

    public function qrCode()
    {
        return $this->hasOne(QRCode::class);
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }

    public function consultations()
    {
        return $this->hasMany(Consultation::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function emailVerifications()
    {
        return $this->hasMany(EmailVerification::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    public function getFullNameAttribute()
    {
        return trim(
            $this->first_name . ' ' . $this->last_name
        );
    }

    public function getFullNameWithMiddleAttribute()
    {
        $middle = $this->middle_name
            ? ' ' . $this->middle_name
            : '';

        return trim(
            $this->first_name .
            $middle .
            ' ' .
            $this->last_name
        );
    }

    public function scopeVerified($query)
    {
        return $query->whereNotNull(
            'email_verified_at'
        );
    }

    public function scopeStudents($query)
    {
        return $query->where(
            'role',
            'student'
        );
    }

    public function scopeNurses($query)
    {
        return $query->where(
            'role',
            'nurse'
        );
    }
}