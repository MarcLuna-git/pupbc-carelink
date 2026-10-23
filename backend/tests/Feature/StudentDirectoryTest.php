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

    public function test_search_matches_name_tokens_without_leaking_into_filters()
    {
        $tag = Str::upper(Str::random(10));
        $first = 'Amara'.$tag;
        $middle = 'Luz'.$tag;
        $last = 'Santos'.$tag;
        $course = 'BSIT'.$tag;
        $nurse = User::create([
            'first_name' => 'Nurse', 'last_name' => 'Search',
            'email' => Str::uuid().'@example.test', 'password' => 'unused-test-password',
            'role' => 'nurse',
        ]);
        $make = function ($status, $suffix) use ($first, $middle, $last, $course, $tag) {
            $student = User::create([
                'student_id' => 'SEARCH-'.$tag.$suffix,
                'first_name' => $first, 'middle_name' => $middle, 'last_name' => $last,
                'email' => Str::uuid().'@example.test', 'password' => 'unused-test-password',
                'role' => 'student', 'status' => $status,
            ]);
            StudentProfile::create(['user_id' => $student->id, 'course' => $course, 'year' => '2nd Year', 'section' => '2-1']);
            return $student;
        };
        $active = $make(null, 'ACTIVE');
        $archived = $make('archived', 'ARCHIVED');
        $archived->delete();
        $this->actingAs($nurse, 'api');
        $get = fn ($search, $filters = []) => $this->getJson('/api/nurse/students?' . http_build_query(array_merge(['search' => $search, 'status' => 'active'], $filters)));

        foreach ([
            "$first $last", "$last, $first", "$first $middle $last", "$first   $middle,  $last",
            $first, $last, substr($first, 0, 7), substr($last, 0, 8),
            substr($first, 0, 7).' '.substr($last, 0, 8), $middle, $active->student_id,
        ] as $search) {
            $get($search)->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $active->id);
        }

        $get("$first Missing$tag")->assertOk()->assertJsonPath('data.total', 0);
        $get("$first $last", ['course' => $course, 'year' => '2nd Year', 'section' => '2-1'])
            ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $active->id);
        foreach (['course' => 'BSCS', 'year' => '3rd Year', 'section' => '2-2', 'status' => 'inactive'] as $field => $value) {
            $get("$first $last", [$field => $value])->assertOk()->assertJsonPath('data.total', 0);
        }
        $get("$first $last", ['status' => 'archived'])
            ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $archived->id);
        foreach (['', ',, ,'] as $search) {
            $get($search, ['course' => $course])->assertOk()->assertJsonPath('data.total', 1);
        }
        $get(implode(' ', array_fill(0, 8, $first))." Missing$tag")
            ->assertOk()->assertJsonPath('data.total', 1);
    }
}
