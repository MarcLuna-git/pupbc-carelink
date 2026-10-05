<?php

namespace Tests\Unit;

use App\Models\StudentProfile;
use App\Models\User;
use App\Services\ClinicHistory;
use PHPUnit\Framework\TestCase;

class ClinicHistoryAcademicTest extends TestCase
{
    public function test_records_use_profile_academics_and_only_expose_student_summary(): void
    {
        $student = new User(['first_name' => 'Test', 'last_name' => 'Student', 'student_id' => '2026-001',
            'course' => 'BEED', 'year' => '2nd Year', 'section' => '2-1', 'email' => 'private@example.test']);
        $student->setRelation('profile', new StudentProfile(['course' => 'BSIT', 'year' => '1st Year', 'section' => '1-2']));
        $method = new \ReflectionMethod(ClinicHistory::class, 'studentData');
        $method->setAccessible(true);
        $summary = $method->invoke(new ClinicHistory(), $student);
        $this->assertSame('BSIT', $summary['course']);
        $this->assertSame('1st Year', $summary['year']);
        $this->assertSame('1-2', $summary['section']);
        $this->assertArrayNotHasKey('email', $summary);
        $student->setRelation('profile', null);
        $summary = $method->invoke(new ClinicHistory(), $student);
        $this->assertSame('BEED', $summary['course']);
        $this->assertSame('2nd Year', $summary['year']);
        $this->assertSame('2-1', $summary['section']);
    }
}
