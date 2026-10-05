<?php

namespace Tests\Unit;

use App\Support\RegistrationAcademics;
use PHPUnit\Framework\TestCase;

class RegistrationAcademicsTest extends TestCase
{
    public function test_catalog_matches_the_requested_non_ladderized_sections(): void
    {
        $expected = [
            'BSCPE' => ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'],
            'DCET' => ['1-1', '2-1', '3-1'],
            'BSBA-HRM' => ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'],
            'BSIT' => ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1'],
            'DIT' => ['1-1', '2-1', '3-1'],
            'BSIE' => ['1-1', '2-1', '3-1', '4-1'],
            'BSPSYCH' => ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1'],
            'BSED-English' => ['1-1', '1-2', '2-1', '3-1', '4-1'],
            'BSED-SS' => ['1-1', '1-2', '2-1', '3-1', '4-1'],
            'BEED' => ['1-1', '2-1', '3-1', '4-1'],
        ];
        $actual = [];
        foreach (RegistrationAcademics::courses() as $course) {
            $actual[$course['code']] = $course['sections'];
            $this->assertNotEmpty($course['abbreviation']);
            $this->assertNotEmpty($course['name']);
        }
        $this->assertSame($expected, $actual);
        $frontendCatalog = dirname(__DIR__, 3) . '/frontend/src/data/registration-academics.json';
        if (file_exists($frontendCatalog)) {
            $this->assertSame(RegistrationAcademics::courses(), json_decode(file_get_contents($frontendCatalog), true));
        }
    }

    public function test_sections_are_restricted_to_the_selected_course_and_year(): void
    {
        $years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
        foreach (RegistrationAcademics::courses() as $course) {
            foreach ($course['sections'] as $section) {
                foreach ($years as $index => $year) {
                    $this->assertSame((string) ($index + 1) === $section[0], in_array($section, RegistrationAcademics::sections($course['code'], $year), true));
                }
            }
        }
        $this->assertSame([], RegistrationAcademics::sections('DIT', '4th Year'));
        $this->assertSame([], RegistrationAcademics::sections('DCET', '4th Year'));
        $this->assertSame([], RegistrationAcademics::sections('unknown', '1st Year'));
        $this->assertSame([], RegistrationAcademics::sections('BSIT', 'unknown'));
        $this->assertNotContains('4-2', RegistrationAcademics::sections('BSIT', '4th Year'));
        $this->assertNotContains('1-3', RegistrationAcademics::sections('BSIT', '1st Year'));
        $this->assertNotContains('2-3', RegistrationAcademics::sections('BSIT', '2nd Year'));
    }
}
