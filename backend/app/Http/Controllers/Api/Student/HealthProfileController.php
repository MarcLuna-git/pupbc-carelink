<?php
namespace App\Http\Controllers\Api\Student;
use App\Http\Controllers\Controller;
use App\Models\HealthProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
class HealthProfileController extends Controller
{
    private const FIELD_MESSAGES = [
        'emergency_name.string' => 'Enter a valid name.',
        'emergency_name.regex' => 'Enter a valid name.',
        'emergency_phone.string' => 'Use +639XXXXXXXXX.',
        'emergency_phone.regex' => 'Use +639XXXXXXXXX.',
    ];

    public function show() { return response()->json(['success' => true, 'data' => $this->profileData(auth()->user()->healthProfile()->first())]); }
    public function checkStatus()
    {
        $profile = HealthProfile::where('user_id', auth()->id())->first(HealthProfile::COMPLETION_COLUMNS);
        return response()->json(['success' => true, 'data' => ['exists' => (bool) $profile, 'completed' => $profile && $profile->isComplete()]]);
    }
    public function store(Request $request)
    {
        $profile = DB::transaction(function () use ($request) {
            // Lock the existing user row even when no health profile exists yet.
            $user = User::whereKey(auth()->id())->lockForUpdate()->firstOrFail()->load('profile');
            abort_if(HealthProfile::where('user_id', auth()->id())->exists(), 409, 'Health profile already exists. Reload before editing.');
            $data = $request->validate(HealthProfile::validationRules(), self::FIELD_MESSAGES);
            $this->rejectInvalidSignature($data['consent_signature'], $user);
            $this->rejectOwnMobile($data['emergency_phone'], $user);
            return HealthProfile::create(array_merge($data, ['user_id' => auth()->id(), 'completed_at' => now()]));
        });
        return response()->json(['success' => true, 'data' => $this->profileData($profile)], 201);
    }
    public function update(Request $request)
    {
        $profile = HealthProfile::where('user_id', auth()->id())->firstOrFail();
        // Dapat valid pa rin ang buong record at consent pagkatapos ng partial edit.
        $data = Validator::make(array_merge($this->profileData($profile), $request->all()), HealthProfile::validationRules(), self::FIELD_MESSAGES)->validate();
        if (array_key_exists('emergency_phone', $request->all())) {
            $this->rejectOwnMobile($data['emergency_phone'], User::with('profile')->findOrFail(auth()->id()));
        }
        if (array_key_exists('consent_signature', $request->all())) {
            $this->rejectInvalidSignature($data['consent_signature'], auth()->user());
        }
        $profile->fill($data);
        $profile->completed_at = $profile->completed_at ?: now();
        $profile->save();
        return response()->json(['success' => true, 'data' => $this->profileData($profile->fresh())]);
    }

    private function rejectInvalidSignature(string $signature, User $user): void
    {
        $normalize = static fn (string $name): string => mb_strtolower(preg_replace('/\s+/u', ' ', trim($name)));
        $names = [$user->full_name];
        if (trim((string) $user->middle_name) !== '') $names[] = $user->full_name_with_middle;
        if (!in_array($normalize($signature), array_map($normalize, $names), true)) {
            throw ValidationException::withMessages(['consent_signature' => ['Signature must match your registered name.']]);
        }
    }

    private function rejectOwnMobile(string $phone, User $user): void
    {
        $number = self::canonicalPhone($phone);
        if ($number !== null && ($number === self::canonicalPhone($user->mobile_number)
            || $number === self::canonicalPhone($user->profile?->mobile_number))) {
            throw ValidationException::withMessages(['emergency_phone' => ['Emergency contact number must be different from your mobile number.']]);
        }
    }

    private static function canonicalPhone(?string $phone): ?string
    {
        if (preg_match('/^639[0-9]{9}$/', (string) $phone)) return '+' . $phone;
        return preg_match('/^\+639[0-9]{9}$/', (string) $phone) ? $phone : null;
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
