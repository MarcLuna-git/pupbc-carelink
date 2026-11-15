<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Mobile numbers now use one format everywhere: +639XXXXXXXXX. This turns every saved
 * 09XXXXXXXXX (spaces and dashes ignored) into +639XXXXXXXXX. Other values are left as they
 * are. Written row by row so it runs the same on MySQL and PostgreSQL.
 */
return new class extends Migration
{
    private const COLUMNS = [
        ['users', 'mobile_number'],
        ['student_profiles', 'mobile_number'],
        ['student_profiles', 'guardian_contact'],
        ['health_profiles', 'emergency_phone'],
        ['faculty_members', 'phone'],
    ];

    public function up()
    {
        foreach (self::COLUMNS as [$table, $column]) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) continue;

            DB::table($table)->where($column, 'like', '%0%')->orderBy('id')
                ->select(['id', $column])
                ->chunk(500, function ($rows) use ($table, $column) {
                    foreach ($rows as $row) {
                        $phone = preg_replace('/[\s\-()]/', '', (string) $row->{$column});
                        if (!preg_match('/^09\d{9}$/', $phone)) continue;
                        DB::table($table)->where('id', $row->id)->update([$column => '+63' . substr($phone, 1)]);
                    }
                });
        }
    }

    public function down()
    {
        // +639... is the format the app uses now; the old 09... values are not restored.
    }
};
