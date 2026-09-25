<?php
namespace App\Http\Controllers\Api\Student;
use App\Http\Controllers\Controller;
use App\Models\HealthProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
class HealthProfileController extends Controller
{
    public function show() { return response()->json(['success' => true, 'data' => $this->profileData(auth()->user()->healthProfile()->first())]); }
    public function checkStatus()
    {
        $profile = HealthProfile::where('user_id', auth()->id())->first();
        return response()->json(['success' => true, 'data' => ['exists' => (bool) $profile, 'completed' => $profile && $profile->isComplete()]]);
    }
    public function store(Request $request)
    {
        $profile = DB::transaction(function () use ($request) {
            // Lock the existing user row even when no health profile exists yet.
            User::whereKey(auth()->id())->lockForUpdate()->firstOrFail();
            abort_if(HealthProfile::where('user_id', auth()->id())->exists(), 409, 'Health profile already exists. Reload before editing.');
            $data = $request->validate(HealthProfile::validationRules());
            return HealthProfile::create(array_merge($data, ['user_id' => auth()->id(), 'completed_at' => now()]));
        });
        return response()->json(['success' => true, 'data' => $this->profileData($profile)], 201);
    }
    public function update(Request $request)
    {
        $profile = HealthProfile::where('user_id', auth()->id())->firstOrFail();
        // Dapat valid pa rin ang buong record at consent pagkatapos ng partial edit.
        $data = Validator::make(array_merge($this->profileData($profile), $request->all()), HealthProfile::validationRules())->validate();
        $profile->fill($data);
        $profile->completed_at = $profile->completed_at ?: now();
        $profile->save();
        return response()->json(['success' => true, 'data' => $this->profileData($profile->fresh())]);
    }

    private function profileData(?HealthProfile $profile): ?array
    {
        if (!$profile) return null;
        $data = $profile->toArray();
        // Calendar dates must not shift to the previous day when serialized in UTC.
        foreach (['hospitalization_date', 'surgery_date', 'covid_date', 'last_menstrual_period', 'consent_date'] as $field) {
            $data[$field] = $profile->$field ? $profile->$field->format('Y-m-d') : null;
        }
        return $data;
    }
}
