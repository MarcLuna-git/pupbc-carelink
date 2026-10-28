<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Faculty and staff the clinic gives medicine to. They are records kept by the nurse, not user accounts.
        if (!Schema::hasTable('faculty_members')) {
            Schema::create('faculty_members', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('full_name', 150);
                $table->string('faculty_type', 20)->default('full_time'); // full_time | part_time
                $table->string('course', 50)->nullable();                 // program code, e.g. BSIT
                $table->string('designation', 100)->nullable();
                $table->string('department', 150)->nullable();
                $table->string('email', 150)->nullable();
                $table->string('phone', 50)->nullable();
                $table->text('notes')->nullable();
                $table->string('status', 20)->default('active');          // active | inactive
                $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();
                $table->index(['status', 'faculty_type']);
                $table->index('full_name');
            });
        }

        // One row per dispensing (a movement is also recorded for every batch the stock came from).
        if (!Schema::hasTable('faculty_dispensings')) {
            Schema::create('faculty_dispensings', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('faculty_member_id')->constrained('faculty_members')->cascadeOnDelete();
                $table->foreignUuid('medicine_id')->nullable()->constrained('medicines')->nullOnDelete();
                $table->string('medicine_name', 255);   // kept as written, even if the medicine is renamed or deleted later
                $table->unsignedInteger('quantity');
                $table->string('unit', 50)->nullable();
                $table->string('reason', 500);
                $table->foreignUuid('dispensed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['faculty_member_id', 'created_at']);
                $table->index('created_at');
            });
        }

        // Lets the medicine's own stock history say who the stock went to.
        if (!Schema::hasColumn('medicine_stock_movements', 'faculty_member_id')) {
            Schema::table('medicine_stock_movements', function (Blueprint $table) {
                $table->foreignUuid('faculty_member_id')->nullable()->after('student_user_id')->constrained('faculty_members')->nullOnDelete();
            });
        }

        if (!DB::table('nurse_sync_revisions')->where('topic', 'faculty')->exists()) {
            DB::table('nurse_sync_revisions')->insert(['topic' => 'faculty', 'revision' => 0]);
        }
    }

    public function down()
    {
        DB::table('nurse_sync_revisions')->where('topic', 'faculty')->delete();
        if (Schema::hasColumn('medicine_stock_movements', 'faculty_member_id')) {
            Schema::table('medicine_stock_movements', function (Blueprint $table) {
                $table->dropConstrainedForeignId('faculty_member_id');
            });
        }
        Schema::dropIfExists('faculty_dispensings');
        Schema::dropIfExists('faculty_members');
    }
};
