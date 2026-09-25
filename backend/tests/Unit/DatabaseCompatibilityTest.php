<?php

namespace Tests\Unit;

use App\Support\DatabaseSearch;
use Illuminate\Container\Container;
use Illuminate\Database\MySqlConnection;
use Illuminate\Database\PostgresConnection;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Schema;
use Mockery;
use PHPUnit\Framework\TestCase;

/** Offline SQL-plan checks only: these tests cannot open a database connection. */
class DatabaseCompatibilityTest extends TestCase
{
    private $previousApplication;
    private $connection;
    private $db;
    private $schema;
    private $sql = [];
    private $writes = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousApplication = Facade::getFacadeApplication();
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(new Container());
    }

    protected function tearDown(): void
    {
        Mockery::close();
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($this->previousApplication);
        parent::tearDown();
    }

    private function recordPlan(string $driver, bool $tablesExist = false, array $indexes = []): void
    {
        $class = $driver === 'pgsql' ? PostgresConnection::class : MySqlConnection::class;
        $this->connection = new $class(function () {
            throw new \LogicException('Offline compatibility tests must never connect to a database.');
        }, 'offline', '', ['driver' => $driver]);
        $this->connection->useDefaultSchemaGrammar();

        $this->db = Mockery::mock();
        DB::swap($this->db);
        $metadata = Mockery::mock();
        $metadata->shouldReceive('getDriverName')->andReturn($driver);
        $metadata->shouldReceive('getTablePrefix')->andReturn('');
        $metadata->shouldReceive('select')->andReturnUsing(function ($sql, $bindings) use ($indexes) {
            $this->sql[] = $sql;
            $this->assertContains('academic_periods', $bindings);
            return $indexes;
        });
        $this->db->shouldReceive('connection')->andReturn($metadata);
        $this->db->shouldReceive('statement')->andReturnUsing(function ($sql) {
            $this->sql[] = $sql;
            return true;
        });
        $this->db->shouldReceive('table')->andReturnUsing(function ($table) {
            $query = Mockery::mock();
            $conditions = [];
            $query->shouldReceive('where')->andReturnUsing(function ($column, $value) use ($query, &$conditions) {
                $conditions[$column] = $value;
                return $query;
            });
            $query->shouldReceive('whereNull')->andReturnUsing(function ($column) use ($query, &$conditions) {
                $conditions[$column] = null;
                return $query;
            });
            foreach (['update', 'insert'] as $method) {
                $query->shouldReceive($method)->andReturnUsing(function ($values) use ($table, &$conditions, $method) {
                    $this->writes[] = [$table, $method, $conditions, $values];
                    $this->sql[] = strtoupper($method) . ' ' . $table;
                    return 1;
                });
            }
            return $query;
        });

        $this->schema = Mockery::mock();
        $metadata->shouldReceive('getSchemaBuilder')->andReturn($this->schema);
        $this->schema->shouldReceive('hasColumn')->andReturn(true);
        $this->schema->shouldReceive('hasTable')->andReturn($tablesExist);
        foreach (['create', 'table'] as $method) {
            $this->schema->shouldReceive($method)->andReturnUsing(function ($table, $callback) use ($method) {
                $blueprint = new Blueprint($table);
                if ($method === 'create') {
                    $blueprint->create();
                }
                $callback($blueprint);
                foreach ($blueprint->toSql($this->connection, $this->connection->getSchemaGrammar()) as $sql) {
                    $this->sql[] = $sql;
                }
            });
        }
    }

    private function migration(string $name)
    {
        // Two pre-existing migration files contain leading whitespace.
        ob_start();
        try {
            return require __DIR__ . '/../../database/migrations/' . $name . '.php';
        } finally {
            ob_end_clean();
        }
    }

    public function test_postgres_user_status_conversion_and_rollback_order(): void
    {
        $this->recordPlan('pgsql');
        $migration = $this->migration('2026_09_23_000002_remove_active_user_status');
        $migration->up();
        $this->assertStringContainsString('DROP NOT NULL', $this->sql[0]);
        $this->assertStringContainsString('DROP DEFAULT', $this->sql[1]);
        $this->assertSame('UPDATE users', $this->sql[2]);
        $this->assertStringContainsString("CHECK (status IN ('pending','inactive','archived'))", $this->sql[3]);
        $this->assertSame(['users', 'update', ['status' => 'active'], ['status' => null]], $this->writes[0]);

        $this->sql = [];
        $migration->down();
        $this->assertStringContainsString("CHECK (status IN ('pending','active','inactive','archived'))", $this->sql[0]);
        $this->assertSame('UPDATE users', $this->sql[1]);
        $this->assertStringContainsString("SET DEFAULT 'pending'", $this->sql[2]);
        $this->assertStringContainsString('SET NOT NULL', $this->sql[3]);
        $this->assertSame(['users', 'update', ['status' => null], ['status' => 'active']], $this->writes[1]);
    }

    public function test_postgres_expiration_check_and_rollback_order(): void
    {
        $this->recordPlan('pgsql');
        $migration = $this->migration('2026_09_23_000001_add_nurse_appointment_lifecycle');
        $migration->up();
        $this->assertStringContainsString("'cancelled','expired'", implode('\n', $this->sql));
        $this->assertStringContainsString('ADD CONSTRAINT appointments_status_check', implode('\n', $this->sql));
        $this->sql = [];
        $migration->down();
        $this->assertSame('UPDATE appointments', $this->sql[0]);
        $this->assertStringNotContainsString('expired', $this->sql[1]);
        $this->assertStringContainsString('ADD CONSTRAINT appointments_status_check', $this->sql[1]);
        $this->assertSame(['appointments', 'update', ['status' => 'expired'], ['status' => 'rejected']], $this->writes[0]);
    }

    /** @dataProvider drivers */
    public function test_academic_repair_recognizes_existing_keys_by_columns(string $driver): void
    {
        $indexes = [(object) ['index_name' => 'legacy_primary', 'column_name' => 'id', 'ordinal_position' => 1, 'is_primary' => 1]];
        // Metadata can arrive out of order, and legacy names can differ.
        foreach ([3 => 'semester', 1 => 'academic_year_start', 2 => 'academic_year_end'] as $position => $column) {
            $indexes[] = (object) ['index_name' => 'legacy_unique', 'column_name' => $column, 'ordinal_position' => $position, 'is_primary' => 0];
        }
        $this->recordPlan($driver, true, $indexes);
        $this->migration('2026_09_23_000003_create_academic_management_tables')->up();
        $this->assertCount(1, $this->sql, 'Existing primary and unique indexes must not be recreated.');
        $this->assertStringNotContainsString('SHOW INDEX', $this->sql[0]);
        if ($driver === 'pgsql') {
            $this->assertStringContainsString('to_regclass(?)', $this->sql[0]);
            $this->assertStringContainsString('ind.indpred IS NULL', $this->sql[0]);
            $this->assertStringContainsString('ind.indisvalid', $this->sql[0]);
            $this->assertStringContainsString('key.ordinality <= ind.indnkeyatts', $this->sql[0]);
        } else {
            $this->assertStringContainsString('table_schema = DATABASE()', $this->sql[0]);
        }
    }

    /** @dataProvider drivers */
    public function test_academic_repair_adds_missing_keys(string $driver): void
    {
        $this->recordPlan($driver, true);
        $this->migration('2026_09_23_000003_create_academic_management_tables')->up();
        $this->assertCount(3, $this->sql);
        $this->assertStringContainsString('primary key', $this->sql[1]);
        $this->assertStringContainsString('academic_periods_year_semester_unique', $this->sql[2]);
    }

    public function test_postgres_unsigned_columns_keep_mysql_ranges(): void
    {
        $this->recordPlan('pgsql');
        foreach (['2026_09_23_000003_create_academic_management_tables', '2026_09_23_000004_create_medicine_batches_and_movements', '2026_09_18_000001_add_password_resets_and_queue_locks'] as $name) {
            $this->migration($name)->up();
        }
        $sql = implode('\n', $this->sql);
        $this->assertStringContainsString('"academic_year_start" integer', $sql);
        $this->assertStringContainsString('"academic_year_end" integer', $sql);
        $this->assertSame(2, substr_count($sql, 'BETWEEN 0 AND 65535'));
        $this->assertSame(4, substr_count($sql, 'BETWEEN 0 AND 4294967295'));
        $this->assertSame(2, substr_count($sql, '"quantity" bigint'));
        $this->assertStringContainsString('"last_number" bigint', $sql);
    }

    /** @dataProvider drivers */
    public function test_search_operator_is_driver_aware_and_keeps_bound_values(string $driver): void
    {
        $this->recordPlan($driver);
        $query = (new Builder($this->connection))->from('users');
        $pattern = "%O'ReIlLy%";
        $query->where('last_name', DatabaseSearch::like($query), $pattern);
        $this->assertStringContainsString($driver === 'pgsql' ? ' ilike ?' : ' like ?', $query->toSql());
        $this->assertSame([$pattern], $query->getBindings());
        $this->assertStringNotContainsString($pattern, $query->toSql());
    }

    public static function drivers(): array
    {
        return [['mysql'], ['pgsql']];
    }
}
