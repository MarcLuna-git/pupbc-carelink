<?php

namespace Tests\Feature;

use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class StudentDirectoryTest extends TestCase
{
    use DatabaseTransactions;

    public function test_filters_combine_before_pagination_and_preserve_response_shape()
    {
        $prefix = 'Directory-' . Str::random(12);
        $make = function ($suffix, $course = 'BSIT', $year = '3rd Year', $section = '3-1', $status = null, $role = 'student') use ($prefix) {
            $user = User::create([
                'student_id' => $prefix . $suffix,
                'first_name' => 'Directory', 'last_name' => $suffix,
                'email' => Str::uuid() . '@example.test', 'password' => 'unused-test-password',
                'role' => $role, 'status' => $status,
                'course' => $course, 'year' => $year, 'section' => $section,
            ]);
            StudentProfile::create(['user_id' => $user->id, 'course' => $course, 'year' => $year, 'section' => $section]);
            return $user;
        };
        $nurse = $make('Nurse', role: 'nurse');
        $this->actingAs($nurse, 'api');
        for ($i = 0; $i < 21; $i++) {
            $make(sprintf('Match%02d', $i));
        }
        $make('OtherCourse', 'BSCS');
        $make('OtherYear', year: '2nd Year');
        $make('OtherSection', section: '3-2');
        $make('Inactive', status: 'inactive');
        $make('Archived', status: 'archived');
        $query = ['search' => $prefix];
        $get = fn ($filters) => $this->getJson('/api/nurse/students?' . http_build_query($filters));
        $get($query)->assertOk()->assertJsonPath('data.total', 26);
        foreach (['course' => 'BSIT', 'year' => '3rd Year', 'section' => '3-1'] as $field => $value) {
            $get($query + [$field => $value])->assertOk()->assertJsonPath('data.total', 25);
        }
        foreach (['inactive', 'archived'] as $status) {
            $get($query + ['status' => $status])->assertOk()->assertJsonPath('data.total', 1);
        }
        $combined = $query + ['course' => 'BSIT', 'year' => '3rd Year', 'section' => '3-1'];
        // 21 normal students plus one inactive and one archived student match
        // all three academic filters. There is deliberately no status filter.
        $get($combined)->assertOk()->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 23)->assertJsonPath('data.per_page', 20)
            ->assertJsonCount(20, 'data.data')->assertJsonPath('data.data.0.student_profile.year', '3rd Year');
        $get($combined + ['page' => 2])->assertOk()->assertJsonPath('data.total', 23)
            ->assertJsonPath('data.current_page', 2)->assertJsonCount(3, 'data.data');
        $get($combined + ['page' => 3])->assertOk()->assertJsonCount(0, 'data.data');
        $get($query + ['section' => 'no-match'])->assertOk()->assertJsonPath('data.total', 0);
    }
}
