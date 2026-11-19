<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\User;
use App\Services\AuthService;
use App\Support\Masterlist;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Course Management → Masterlist: importing the school list from Excel or CSV, and the
 * registration check that only lets students on the list sign up.
 */
class MasterlistTest extends TestCase
{
    use DatabaseTransactions;

    private User $nurse;
    private AcademicPeriod $period;
    private Course $course;
    private string $code;

    protected function setUp(): void
    {
        parent::setUp();
        $this->nurse = User::create([
            'first_name' => 'Nurse', 'last_name' => 'List', 'email' => Str::uuid() . '@example.test',
            'password' => 'unused-test-password', 'role' => 'nurse',
        ]);
        // Other active periods would make the check look at their lists too.
        AcademicPeriod::query()->update(['is_active' => false]);
        $this->period = AcademicPeriod::create(['academic_year_start' => 2090, 'academic_year_end' => 2091, 'semester' => '1st Semester', 'is_active' => true]);
        $this->code = 'ML' . strtoupper(Str::random(6));
        $this->course = Course::create(['code' => $this->code, 'name' => 'Bachelor of Science in Masterlist Testing', 'is_active' => true]);
    }

    // A small .xlsx in the grouped layout of the registrar's file.
    private function xlsx(array $rows): UploadedFile
    {
        $sheetRows = '';
        foreach ($rows as $index => $cells) {
            $line = $index + 1;
            $sheetRows .= "<row r=\"{$line}\">";
            foreach ($cells as $col => $text) {
                $ref = chr(65 + $col) . $line;
                $sheetRows .= "<c r=\"{$ref}\" t=\"inlineStr\"><is><t>" . htmlspecialchars($text, ENT_XML1) . '</t></is></c>';
            }
            $sheetRows .= '</row>';
        }
        $path = tempnam(sys_get_temp_dir(), 'ml') . '.xlsx';
        $zip = new \ZipArchive();
        $zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="List" sheetId="1" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
        $zip->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' . $sheetRows . '</sheetData></worksheet>');
        $zip->close();

        return new UploadedFile($path, 'masterlist.xlsx', null, null, true);
    }

    private function groupedFile(): UploadedFile
    {
        return $this->xlsx([
            ["BS in Masterlist Testing ({$this->code})", ''],
            ['2090-00001-BN-0', 'Señar, Edrian B.'],
            ['2090-00002-BN-0', 'Dela Cruz, Juan P.'],
            ['2090-00003-BN-1', 'Aquino Dan Uziel'],
            ['Diploma in Brand New Things (DBNT)', ''],
            ['2090-00004-BN-0', 'Reyes, Ana'],
        ]);
    }

    private function upload(string $action, UploadedFile $file)
    {
        return $this->actingAs($this->nurse, 'api')->post("/api/nurse/masterlist/{$action}", [
            'academic_period_id' => $this->period->id, 'file' => $file,
        ], ['Accept' => 'application/json']);
    }

    private function details(array $override = []): array
    {
        return $override + [
            'student_id' => '2090-00001-BN-0', 'first_name' => 'Edrian', 'middle_name' => null, 'last_name' => 'Senar',
            'email' => Str::random(8) . '@example.test', 'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'birthday' => '2000-01-01', 'gender' => 'male', 'course' => $this->code, 'year' => '1st Year', 'section' => '1-1',
            'mobile_number' => '+639171234567',
        ];
    }

    public function test_preview_reads_the_grouped_excel_layout_without_saving(): void
    {
        $response = $this->upload('preview', $this->groupedFile())->assertOk();

        $data = $response->json('data');
        $this->assertSame(4, $data['summary']['students']);
        $this->assertSame(4, $data['summary']['new']);
        $this->assertSame(0, $data['summary']['errors']);
        $this->assertSame(1, $data['summary']['warnings']); // "Aquino Dan Uziel" has no comma
        $this->assertSame([['id' => null, 'code' => 'DBNT', 'name' => 'Diploma in Brand New Things']], $data['new_courses']);
        $byId = collect($data['entries'])->keyBy('student_id');
        $this->assertSame($this->code, $byId['2090-00001-BN-0']['course_code']);
        $this->assertSame('Señar', $byId['2090-00001-BN-0']['last_name']);
        $this->assertSame('DBNT', $byId['2090-00004-BN-0']['course_code']);
        $this->assertSame(0, DB::table('student_masterlist')->where('academic_period_id', $this->period->id)->count());
    }

    public function test_import_saves_the_list_and_a_second_import_changes_nothing(): void
    {
        $this->upload('import', $this->groupedFile())->assertOk()->assertJsonPath('data.added', 4);

        $this->assertSame(4, DB::table('student_masterlist')->where('academic_period_id', $this->period->id)->count());
        $newCourse = Course::where('code', 'DBNT')->first();
        $this->assertNotNull($newCourse);
        $this->assertSame($newCourse->id, DB::table('student_masterlist')->where('student_id', '2090-00004-BN-0')->value('course_id'));
        $this->assertDatabaseHas('masterlist_imports', ['academic_period_id' => $this->period->id, 'added_count' => 4]);

        $again = $this->upload('preview', $this->groupedFile())->assertOk()->json('data.summary');
        $this->assertSame(['students' => 4, 'new' => 0, 'update' => 0, 'same' => 4], array_intersect_key($again, array_flip(['students', 'new', 'update', 'same'])));

        $list = $this->actingAs($this->nurse, 'api')->getJson('/api/nurse/masterlist?academic_period_id=' . $this->period->id)->assertOk();
        $this->assertSame(4, $list->json('summary.total'));
        $this->assertSame(0, $list->json('summary.registered'));
    }

    public function test_csv_table_layout_reads_year_and_section_and_skips_bad_rows(): void
    {
        $csv = "Student ID,Last Name,First Name,Course,Year Level,Section\n"
            . "2090-00010-BN-0,Santos,Maria,{$this->code},3,3-1\n"
            . "2090-0011-BN-0,Wrong,Format,{$this->code},1,1-1\n"
            . "2090-00010-BN-0,Santos,Again,{$this->code},3,3-1\n"
            . "2090-00012-BN-0,,NoLast,{$this->code},2,2-1\n";
        $file = UploadedFile::fake()->createWithContent('list.csv', $csv);

        $data = $this->upload('preview', $file)->assertOk()->json('data');
        $this->assertSame(1, $data['summary']['students']);
        $this->assertSame(3, $data['summary']['errors']);
        $this->assertSame('3rd Year', $data['entries'][0]['year_level']);
        $this->assertSame('3-1', $data['entries'][0]['section']);
        $this->assertStringContainsString('2023-00000-BN-0', $data['errors'][0]['message']);
        $this->assertStringContainsString('line 2', $data['errors'][1]['message']);
    }

    public function test_other_file_types_and_non_nurses_are_refused(): void
    {
        $this->upload('preview', UploadedFile::fake()->createWithContent('list.xls', 'old'))->assertStatus(422);

        $student = User::create(['first_name' => 'S', 'last_name' => 'T', 'email' => Str::uuid() . '@example.test', 'password' => 'x', 'role' => 'student', 'student_id' => '2090-09999-BN-0']);
        $this->actingAs($student, 'api')->getJson('/api/nurse/masterlist')->assertStatus(403);
    }

    public function test_masterlist_check_is_always_required_and_list_can_be_cleared(): void
    {
        $this->assertTrue(Masterlist::required());
        $this->upload('import', $this->groupedFile())->assertOk();
        $this->actingAs($this->nurse, 'api')->postJson('/api/nurse/masterlist/clear', ['academic_period_id' => $this->period->id])->assertOk();
        $this->assertSame(0, DB::table('student_masterlist')->where('academic_period_id', $this->period->id)->count());
    }

    public function test_the_student_id_field_check_only_says_found_or_not_found(): void
    {
        $this->upload('import', $this->groupedFile())->assertOk();
        $check = fn ($id) => $this->postJson('/api/auth/check-student-id', ['student_id' => $id]);

        $this->getJson('/api/auth/registration-options')->assertJsonPath('data.masterlist_required', true);
        $found = $check('2090-00001-bn-0')->assertOk()->assertJsonPath('data.status', 'found');
        $this->assertSame(['status'], array_keys($found->json('data'))); // no name, no account info
        $check('2090-00098-BN-0')->assertOk()->assertJsonPath('data.status', 'not_found');
        $check('2090-1-BN-0')->assertStatus(422);

        // On the list but already has an account (an archived one counts too).
        $taken = User::create(['first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'email' => Str::uuid() . '@example.test', 'password' => 'x', 'role' => 'student', 'student_id' => '2090-00002-BN-0']);
        $check('2090-00002-BN-0')->assertOk()->assertJsonPath('data.status', 'registered');
        $taken->delete();
        $check('2090-00002-BN-0')->assertOk()->assertJsonPath('data.status', 'registered');
    }

    public function test_registration_is_strictly_limited_to_the_masterlist(): void
    {
        Mail::fake();
        $this->upload('import', $this->groupedFile())->assertOk();
        $service = app(AuthService::class);
        $refused = function (array $details) use ($service): array {
            try {
                $service->requestRegistrationOtp($details);
            } catch (ValidationException $e) {
                return $e->errors();
            }
            $this->fail('The registration was accepted.');
        };

        // Not on the list and wrong last name give the same message.
        $notOnList = $refused($this->details(['student_id' => '2090-00098-BN-0']));
        $wrongName = $refused($this->details(['last_name' => 'Somebody']));
        $this->assertSame($notOnList, $wrongName);
        $this->assertArrayHasKey('student_id', $notOnList);

        // Another course than the one on the list.
        $this->assertArrayHasKey('course', $refused($this->details(['course' => 'BSIT'])));

        // Same Student ID and last name: "Senar" matches "Señar"; a name without a comma
        // matches on its first word.
        $service->requestRegistrationOtp($this->details());
        $service->requestRegistrationOtp($this->details(['student_id' => '2090-00003-BN-1', 'last_name' => 'Aquino']));
        $this->assertSame(2, \App\Models\PendingRegistration::whereIn('student_id', ['2090-00001-BN-0', '2090-00003-BN-1'])->count());

        // A list from a period that is not active does not count.
        $this->period->update(['is_active' => false]);
        $this->assertArrayHasKey('student_id', $refused($this->details(['student_id' => '2090-00002-BN-0', 'last_name' => 'Dela Cruz'])));
    }

    public function test_nurse_can_update_a_masterlist_student_and_duplicate_id_is_rejected(): void
    {
        $this->upload('import', $this->groupedFile())->assertOk();
        $row = DB::table('student_masterlist')
            ->where('academic_period_id', $this->period->id)
            ->where('student_id', '2090-00001-BN-0')
            ->first();

        $this->actingAs($this->nurse, 'api')->putJson("/api/nurse/masterlist/{$row->id}", [
            'student_id' => '2090-00099-BN-0',
            'last_name' => 'Santos',
            'first_name' => 'Maria L.',
            'course_id' => $this->course->id,
            'year_level' => '2nd Year',
            'section' => '2-1',
        ])->assertOk();

        $updated = DB::table('student_masterlist')->where('id', $row->id)->first();
        $this->assertSame('2090-00099-BN-0', $updated->student_id);
        $this->assertSame('Santos, Maria L.', $updated->full_name);
        $this->assertSame('2nd Year', $updated->year_level);
        $this->assertSame('2-1', $updated->section);

        $this->actingAs($this->nurse, 'api')->putJson("/api/nurse/masterlist/{$row->id}", [
            'student_id' => '2090-00002-BN-0',
            'last_name' => 'Santos',
        ])->assertStatus(422)->assertJsonValidationErrors(['student_id']);
    }
}
