<?php

namespace App\Support;

class RegistrationAcademics
{
    public static function courses(): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../../resources/data/registration-academics.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    public static function sections(string $course, string $year): array
    {
        $years = ['1st Year' => '1', '2nd Year' => '2', '3rd Year' => '3', '4th Year' => '4'];
        if (!isset($years[$year])) return [];
        foreach (self::courses() as $entry) {
            if ($entry['code'] !== $course) continue;
            return array_values(array_filter($entry['sections'], function ($section) use ($years, $year) {
                return strpos($section, $years[$year] . '-') === 0;
            }));
        }
        return [];
    }
}
