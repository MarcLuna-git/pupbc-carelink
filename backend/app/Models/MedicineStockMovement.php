<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class MedicineStockMovement extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['medicine_id', 'medicine_batch_id', 'movement_type', 'quantity', 'reason', 'performed_by', 'student_user_id', 'faculty_member_id'];
    protected $casts = ['quantity' => 'integer'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (!$model->getKey()) {
                // Time-ordered, so two movements written in the same second still list in the order they happened.
                $model->{$model->getKeyName()} = (string) Str::orderedUuid();
            }
        });
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }

    public function batch()
    {
        return $this->belongsTo(MedicineBatch::class, 'medicine_batch_id');
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function faculty()
    {
        return $this->belongsTo(FacultyMember::class, 'faculty_member_id')->withTrashed();
    }
}