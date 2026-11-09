<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/*
 * Nurse portal → Consultation → Batch Release: one document for a whole group of students. `type` names the
 * document (see config/batch_documents.php), `fields` holds its own details, and `students` is a list of
 * { name, student_id } where student_id is set only when the nurse picked a registered student.
 * The existing batch Medical Clearances are copied in; the old table is kept, unused.
 */
return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('batch_documents')) {
            Schema::create('batch_documents', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('type', 50);
                $table->string('title');
                $table->json('fields');
                $table->json('students');
                $table->date('issued_date');
                $table->foreignUuid('issued_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();
                $table->index('type');
                $table->index('issued_date');
            });
        }

        if (Schema::hasTable('medical_clearances') && !DB::table('batch_documents')->where('type', 'clearance')->exists()) {
            DB::table('medical_clearances')->whereNull('deleted_at')->orderBy('created_at')->get()->each(function ($row) {
                $names = json_decode($row->students, true) ?: [];
                DB::table('batch_documents')->insert([
                    'id' => (string) Str::uuid(),
                    'type' => 'clearance',
                    'title' => $row->activity,
                    'fields' => json_encode([
                        'activity' => $row->activity,
                        'venue' => $row->venue,
                        'group_label' => $row->group_label,
                        'activity_date' => substr((string) $row->activity_date, 0, 10),
                        'certified_date' => substr((string) $row->certified_date, 0, 10),
                    ]),
                    'students' => json_encode(array_map(fn ($name) => ['name' => $name, 'student_id' => null], $names)),
                    'issued_date' => substr((string) $row->certified_date, 0, 10),
                    'issued_by' => $row->issued_by,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ]);
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('batch_documents');
    }
};
