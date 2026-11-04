<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\CourseSection;
use App\Support\RegistrationAcademics;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class RegistrationAcademicsTest extends TestCase
{
    use DatabaseTransactions;

    private function section(AcademicPeriod $period, Course $course, string $year, string $code, bool $active = true): void
    {
        CourseSection::create(['academic_period_id' => $period->id, 'course_id' => $course->id, 'year_level' => $year, 'section_code' => $code, 'is_active' => $active]);
    }

    public function test_registration_lists_only_active_course_management_entries(): void
    {
        $tag = 'T' . strtoupper(Str::random(8));
        $start = random_int(3000, 9000);
        $active = AcademicPeriod::create(['academic_year_start' => $start, 'academic_year_end' => $start + 1, 'semester' => '1st Semester', 'is_active' => true]);
        $inactive = AcademicPeriod::create(['academic_year_start' => $start, 'academic_year_end' => $start + 1, 'semester' => '2nd Semester', 'is_active' => false]);

        $open = Course::create(['code' => "$tag-OPEN", 'name' => 'Open Course', 'is_active' => true]);
        $closed = Course::create(['code' => "$tag-CLOSED", 'name' => 'Closed Course', 'is_active' => false]);
        $deleted = Course::create(['code' => "$tag-DELETED", 'name' => 'Deleted Course', 'is_active' => true]);
        $oldTerm = Course::create(['code' => "$tag-OLDTERM", 'name' => 'Old Term Course', 'is_active' => true]);

        $this->section($active, $open, '2nd Year', '2-1');
        $this->section($active, $open, '1st Year', '1-2');
        $this->section($active, $open, '1st Year', '1-1');
        $this->section($active, $open, '3rd Year', '3-1', false);
        $this->section($active, $closed, '1st Year', '1-1');
        $this->section($active, $deleted, '1st Year', '1-1');
        $deleted->delete();
        $this->section($inactive, $oldTerm, '1st Year', '1-1');

        $catalog = RegistrationAcademics::courses();
        $codes = array_column($catalog, 'code');
        $this->assertContains("$tag-OPEN", $codes);
        $this->assertNotContains("$tag-CLOSED", $codes);
        $this->assertNotContains("$tag-DELETED", $codes);
        $this->assertNotContains("$tag-OLDTERM", $codes);

        $course = RegistrationAcademics::find($catalog, "$tag-OPEN");
        $this->assertSame(['1st Year', '2nd Year'], RegistrationAcademics::yearsFor($course));
        $this->assertSame(['1-1', '1-2'], RegistrationAcademics::sectionsFor($course, '1st Year'));
        $this->assertSame([], RegistrationAcademics::sectionsFor($course, '3rd Year'));
        $this->assertSame([], RegistrationAcademics::sectionsFor(null, '1st Year'));

        $this->getJson('/api/auth/registration-options')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonFragment(['code' => "$tag-OPEN", 'name' => 'Open Course']);
    }

    public function test_registration_rejects_a_course_not_offered_in_course_management(): void
    {
        $this->postJson('/api/auth/register', ['course' => 'NOT-A-COURSE-' . Str::random(6), 'year' => '1st Year', 'section' => '1-1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['course', 'year', 'section']);
    }
}
