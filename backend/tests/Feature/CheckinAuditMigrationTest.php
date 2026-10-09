<?php

namespace Tests\Feature;

use App\Models\AppointmentCheckin;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Runs only against a fresh process-local database, never deployment data. */
class CheckinAuditMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'audit_testing', 'database.connections.audit_testing' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        config(['app.key' => 'base64:' . base64_encode(str_repeat('t', 32))]);
        \Illuminate\Support\Carbon::setTestNow(\Illuminate\Support\Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $this->withoutMiddleware(\App\Http\Middleware\ExpireStaleAppointments::class);
        (require database_path('migrations/2024_01_01_000000_create_users_table.php'))->up();
        require_once database_path('migrations/2026_10_09_000001_create_nurse_sync_tables.php');
        (new \CreateNurseSyncTables)->up();
        Schema::create('appointments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->enum('status', ['approved', 'expired']);
            $table->boolean('no_show')->default(false);
            $table->date('appointment_date')->default('2026-10-12');
            $table->string('time_slot')->default('8:00 AM');
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('appointment_checkins', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('appointment_id');
            $table->string('status')->default('waiting');
            $table->boolean('is_walk_in')->default(false);
            $table->timestamps();
        });
        Schema::create('consultations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('appointment_checkin_id')->nullable();
            $table->softDeletes();
        });
        (require database_path('migrations/2026_10_12_000001_add_skipped_queue_audit_fields.php'))->up();
        Schema::create('clinic_queue_locks', function (Blueprint $table) {
            $table->integer('id')->primary();
        });
        DB::table('clinic_queue_locks')->insert(['id' => 1]);
    }

    protected function tearDown(): void
    {
        \Illuminate\Support\Carbon::setTestNow();
        parent::tearDown();
    }

    private function migration()
    {
        return require database_path('migrations/2026_10_11_000001_add_appointment_expiration_and_no_show.php');
    }

    private function nurse(): User
    {
        $id = (string) Str::uuid();
        DB::table('users')->insert(['id' => $id, 'first_name' => 'Audit', 'last_name' => 'Nurse',
            'email' => $id . '@example.test', 'password' => 'unused', 'role' => 'nurse', 'status' => 'active']);
        return User::findOrFail($id);
    }

    public function test_migration_reapply_and_rollback_preserve_existing_schema_and_data()
    {
        $nurse = $this->nurse();
        $appointment = (string) Str::uuid();
        DB::table('appointments')->insert(['id' => $appointment, 'status' => 'expired']);
        // Simulate a pre-existing audit column: do not replace it or its values.
        Schema::table('appointment_checkins', function (Blueprint $table) {
            $table->timestamp('called_at')->nullable();
        });
        $id = (string) Str::uuid();
        DB::table('appointment_checkins')->insert(['id' => $id, 'appointment_id' => $appointment,
            'status' => 'called', 'called_at' => '2026-10-10 08:00:00']);
        $before = DB::table('appointments')->where('id', $appointment)->first();
        $migration = $this->migration();
        $migration->up();
        AppointmentCheckin::findOrFail($id)->update(['called_by' => $nurse->id, 'no_show_by' => $nurse->id]);
        $migration->up();
        $migration->down();
        $migration->up();
        $this->assertEquals($before, DB::table('appointments')->where('id', $appointment)->first());
        $this->assertSame('2026-10-10 08:00:00', DB::table('appointment_checkins')->where('id', $id)->value('called_at'));
        $this->assertSame($nurse->id, AppointmentCheckin::findOrFail($id)->called_by);
        $this->assertSame($nurse->id, AppointmentCheckin::findOrFail($id)->no_show_by);
        $indexes = array_filter(DB::select("PRAGMA index_list('appointment_checkins')"), function ($index) {
            return $index->name === 'checkins_called_status';
        });
        $this->assertCount(1, $indexes);
        foreach (['called_at', 'called_by', 'no_show_at', 'no_show_by'] as $column) {
            $this->assertTrue(Schema::hasColumn('appointment_checkins', $column));
        }
        // SQLite does not install foreign keys added via ALTER TABLE; the
        // PostgreSQL DDL test below checks the production deletion policy.
    }

    public function test_queue_endpoints_store_authenticated_audit_ids_not_client_values()
    {
        $this->migration()->up();
        $nurse = $this->nurse();
        $other = $this->nurse();
        $appointment = (string) Str::uuid();
        DB::table('appointments')->insert(['id' => $appointment, 'status' => 'approved']);
        $id = (string) Str::uuid();
        DB::table('appointment_checkins')->insert(['id' => $id, 'appointment_id' => $appointment, 'status' => 'called']);
        $this->actingAs($nurse, 'api');
        $this->postJson('/api/nurse/queue/' . $id . '/recall', ['called_by' => $other->id])->assertOk();
        $this->assertSame($nurse->id, AppointmentCheckin::findOrFail($id)->called_by);
        $this->withHeader('If-Match', AppointmentCheckin::findOrFail($id)->sync_version)
            ->postJson('/api/nurse/queue/' . $id . '/skip', ['skipped_by' => $other->id, 'skipped_at' => '2000-01-01'])->assertOk();
        $checkin = AppointmentCheckin::findOrFail($id);
        $this->assertSame($nurse->id, $checkin->skipped_by);
        $this->assertSame('skipped', $checkin->status);
        $this->assertSame('2026-10-12 08:00:00', $checkin->skipped_at->timezone('Asia/Manila')->format('Y-m-d H:i:s'));
        $this->withHeader('If-Match', $checkin->sync_version)
            ->postJson('/api/nurse/queue/' . $id . '/returned', ['returned_by' => $other->id])->assertOk();
        $this->assertSame($nurse->id, $checkin->fresh()->returned_by);
    }

    public function test_postgresql_migration_compiles_additive_schema_only()
    {
        // Compile the actual migration callbacks with Laravel's PostgreSQL
        // grammar without connecting to any PostgreSQL database.
        $connection = \Mockery::mock(\Illuminate\Database\PostgresConnection::class)->makePartial();
        $connection->shouldReceive('getDriverName')->andReturn('pgsql');
        $connection->shouldReceive('getTablePrefix')->andReturn('');
        $connection->shouldReceive('select')->once()->with(
            \Mockery::on(function ($sql) { return strpos($sql, 'pg_index') !== false; }),
            ['appointment_checkins', 'checkins_called_status']
        )->andReturn([]);
        $schema = \Mockery::mock(\Illuminate\Database\Schema\Builder::class);
        $connection->shouldReceive('getSchemaBuilder')->andReturn($schema);
        $schema->shouldReceive('hasColumn')->andReturn(false);
        $sql = [];
        $grammar = new \Illuminate\Database\Schema\Grammars\PostgresGrammar;
        $schema->shouldReceive('table')->twice()->with('appointment_checkins', \Mockery::on(
            function ($callback) use (&$sql, $connection, $grammar) {
                $blueprint = new Blueprint('appointment_checkins');
                $callback($blueprint);
                $sql = array_merge($sql, $blueprint->toSql($connection, $grammar));
                return true;
            }
        ));
        DB::shouldReceive('connection')->andReturn($connection);
        $migration = $this->migration();
        $migration->up();
        $migration->down(); // Must not emit destructive DDL.
        $ddl = implode("\n", $sql);
        $this->assertStringContainsString('"called_by" uuid null', $ddl);
        $this->assertStringContainsString('"no_show_by" uuid null', $ddl);
        $this->assertSame(2, substr_count($ddl, 'on delete set null'));
        $this->assertStringContainsString('create index "checkins_called_status"', $ddl);
        $this->assertStringNotContainsString('"appointments"', $ddl);
        $this->assertStringNotContainsString('ALTER TYPE', $ddl);
        $this->assertStringNotContainsString('drop', strtolower($ddl));
    }
}
