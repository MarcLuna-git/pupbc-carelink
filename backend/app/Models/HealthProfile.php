<?php

namespace App\Models;

use App\Casts\NormalizedArray;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class HealthProfile extends Model
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

        'emergency_name',
        'emergency_relationship',
        'emergency_phone',

        'medical_history',
        'allergy_details',
        'other_medical_history',
        'medications',

        'hospitalized',
        'hospitalization_date',
        'hospitalization_diagnosis',

        'surgery',
        'surgery_date',
        'surgery_diagnosis',

        'had_covid',
        'covid_date',
        'covid_diagnosis',

        'occupation',
        'marital_status',

        'tobacco_use',
        'tobacco_amount',
        'tobacco_duration',

        'alcohol_use',
        'other_substance_use',

        'has_disability',
        'disability_details',

        'last_menstrual_period',
        'has_children',
        'number_of_children',
        'age_first_pregnancy',

        'gravidity',
        'term',
        'premature',
        'abortion',
        'living_children',

        'family_history',

        'consent_signature',
        'agree_privacy',
        'agree_terms',
        'consent_date',

        'completed_at',
    ];

    protected $casts = [
        'medical_history' => NormalizedArray::class,
        'family_history' => NormalizedArray::class,

        'hospitalized' => 'boolean',
        'surgery' => 'boolean',
        'had_covid' => 'boolean',
        'has_disability' => 'boolean',
        'has_children' => 'boolean',

        'gravidity' => 'boolean',
        'term' => 'boolean',
        'premature' => 'boolean',
        'abortion' => 'boolean',
        'living_children' => 'boolean',

        'agree_privacy' => 'boolean',
        'agree_terms' => 'boolean',

        'hospitalization_date' => 'date:Y-m-d',
        'surgery_date' => 'date:Y-m-d',
        'covid_date' => 'date:Y-m-d',
        'last_menstrual_period' => 'date:Y-m-d',
        'consent_date' => 'date:Y-m-d',

        'completed_at' => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    |
    | These rules are used when a Student actually submits or updates the
    | Health Profile.
    |
    | Do NOT use the complete validation rule set as the permanent onboarding
    | status check. Optional/historical values can legitimately differ over
    | time and should not unexpectedly send an already-completed Student back
    | through onboarding.
    |
    */

    public static function validationRules(): array
    {
        $rules = [
            'emergency_name' => [
                'required',
                'string',
                'max:100',
            ],

            'emergency_relationship' => [
                'required',
                'string',
                'max:100',
            ],

            'emergency_phone' => [
                'required',
                'string',

                /*
                 * Existing Health Profile form currently stores the
                 * Philippine local format:
                 *
                 * 09XXXXXXXXX
                 *
                 * We will centralize +63 normalization later when we
                 * update the contact/profile forms.
                 */
                'regex:/^09[0-9]{9}$/',
            ],

            'consent_signature' => [
                'required',
                'string',
                'max:191',
            ],

            'consent_date' => [
                'required',
                'date',
                'before_or_equal:today',
            ],

            'agree_privacy' => [
                'required',
                'accepted',
            ],

            'agree_terms' => [
                'required',
                'accepted',
            ],

            'medical_history' => [
                'nullable',
                'array',
            ],

            'medical_history.*' => [
                'string',
                'max:255',
            ],

            'family_history' => [
                'nullable',
                'array',
            ],

            'family_history.*' => [
                'string',
                'max:255',
            ],

            'number_of_children' => [
                'nullable',
                'integer',
                'min:0',
                'max:30',
            ],

            'age_first_pregnancy' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ];

        foreach (
            [
                'hospitalized',
                'surgery',
                'had_covid',
                'has_disability',
                'has_children',
                'gravidity',
                'term',
                'premature',
                'abortion',
                'living_children',
            ] as $field
        ) {
            $rules[$field] = [
                'sometimes',
                'boolean',
            ];
        }

        foreach (
            [
                'hospitalization_date',
                'surgery_date',
                'covid_date',
                'last_menstrual_period',
            ] as $field
        ) {
            $rules[$field] = [
                'nullable',
                'date',
                'before_or_equal:today',
            ];
        }

        foreach (
            [
                'allergy_details',
                'other_medical_history',
                'hospitalization_diagnosis',
                'surgery_diagnosis',
                'covid_diagnosis',
                'occupation',
            ] as $field
        ) {
            $rules[$field] = [
                'nullable',
                'string',
                'max:191',
            ];
        }

        foreach (['marital_status' => 50, 'tobacco_use' => 20, 'tobacco_amount' => 100, 'tobacco_duration' => 100, 'alcohol_use' => 20] as $field => $limit) {
            $rules[$field] = ['nullable', 'string', 'max:' . $limit];
        }

        foreach (
            [
                'medications',
                'other_substance_use',
                'disability_details',
            ] as $field
        ) {
            $rules[$field] = [
                'nullable',
                'string',
                'max:2000',
            ];
        }

        return $rules;
    }

    /*
    |--------------------------------------------------------------------------
    | Health Profile Completion
    |--------------------------------------------------------------------------
    |
    | This determines whether the Student already completed the REQUIRED
    | onboarding Health Profile.
    |
    | Important distinction:
    |
    | validationRules()
    |     = validates a form submission/update
    |
    | isComplete()
    |     = determines whether onboarding has already been completed
    |
    | We intentionally do NOT rerun every optional medical-history validation
    | here. Otherwise a historical optional value can suddenly make an old,
    | already-saved profile "incomplete" during a future login.
    |
    */

    public function isComplete(): bool
    {
        /*
         * Required identity/contact portion of the Health Profile.
         */
        if (!$this->hasText($this->emergency_name)) {
            return false;
        }

        if (!$this->hasText($this->emergency_relationship)) {
            return false;
        }

        if (!$this->hasValidEmergencyPhone()) {
            return false;
        }

        /*
         * Required consent portion.
         */
        if (!$this->hasText($this->consent_signature)) {
            return false;
        }

        if (!$this->consent_date) {
            return false;
        }

        if (!$this->agree_privacy) {
            return false;
        }

        if (!$this->agree_terms) {
            return false;
        }

        /*
         * At this point, the required onboarding information exists.
         *
         * completed_at is useful as an audit timestamp, but it is NOT used
         * as the sole completion flag because older records may have received
         * a timestamp before all required fields were truly populated.
         */
        return true;
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function hasText($value): bool
    {
        return is_string($value)
            && trim($value) !== '';
    }

    private function hasValidEmergencyPhone(): bool
    {
        $phone = preg_replace(
            '/[\s\-\(\)]/',
            '',
            (string) $this->emergency_phone
        );

        /*
         * Current canonical local format.
         */
        if (preg_match('/^09\d{9}$/', $phone)) {
            return true;
        }

        /*
         * Backward/future compatibility for an equivalent Philippine +63
         * value if an existing record was normalized that way.
         *
         * Example:
         * +639123456789
         */
        if (preg_match('/^\+639\d{9}$/', $phone)) {
            return true;
        }

        return false;
    }
}
