<?php
/*
 * Copy a database into the Supabase project in SUPABASE_DB_* (the app's `pgsql` connection).
 *
 *   php scripts/copy_supabase.php --from=mysql   # from the local XAMPP MySQL (DB_* in .env)
 *   php scripts/copy_supabase.php --from=old     # from another Supabase project (OLD_SUPABASE_DB_*)
 *
 * 1. Runs the Laravel migrations on the Supabase project (creates the tables).
 * 2. Empties its copied tables and copies every row from the source.
 * 3. Resets id sequences and compares row counts.
 * The source is only read. Safe to run again: each run replaces the Supabase copy.
 */
if (PHP_SAPI !== 'cli') exit; // command line only, never through the web server

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

$from = 'mysql';
foreach ($argv as $arg) if (str_starts_with($arg, '--from=')) $from = substr($arg, 7);
if (!in_array($from, ['mysql', 'old'], true)) exit("Use --from=mysql or --from=old\n");
if (!env('SUPABASE_DB_PASSWORD')) exit("Missing SUPABASE_DB_PASSWORD in backend/.env\n");

if ($from === 'old') {
    if (!env('OLD_SUPABASE_DB_PASSWORD')) exit("Missing OLD_SUPABASE_DB_PASSWORD in backend/.env\n");
    config(['database.connections.old_supabase' => [
        'driver' => 'pgsql', 'host' => env('OLD_SUPABASE_DB_HOST'), 'port' => env('OLD_SUPABASE_DB_PORT', '5432'),
        'database' => env('OLD_SUPABASE_DB_DATABASE', 'postgres'), 'username' => env('OLD_SUPABASE_DB_USERNAME'),
        'password' => env('OLD_SUPABASE_DB_PASSWORD'), 'charset' => 'utf8', 'prefix' => '', 'schema' => 'public', 'sslmode' => 'require',
    ]]);
}
config(['database.connections.pgsql.options' => []]); // no persistent connection for a script
$src = DB::connection($from === 'old' ? 'old_supabase' : 'mysql');
$new = DB::connection('pgsql');

echo "From: {$src->getDriverName()} {$src->getConfig('username')} @ {$src->getConfig('host')}/{$src->getConfig('database')}\n";
echo "To:   {$new->getConfig('username')} @ {$new->getConfig('host')}\n\n";

echo "1. Migrating the Supabase project...\n";
Artisan::call('migrate', ['--database' => 'pgsql', '--force' => true]);
echo Artisan::output() . "\n";

$tablesIn = fn ($db) => $db->getDriverName() === 'mysql'
    ? array_map(fn ($r) => array_values((array) $r)[0], $db->select('show tables'))
    : array_map(fn ($r) => $r->tablename, $db->select("select tablename from pg_tables where schemaname = 'public'"));
$columnsOf = fn ($db, $t) => $db->getDriverName() === 'mysql'
    ? array_map(fn ($r) => $r->Field, $db->select("show columns from `$t`"))
    : array_map(fn ($r) => $r->column_name, $db->select(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = ? order by ordinal_position", [$t]));
// MySQL keeps booleans as 0/1; PostgreSQL needs true/false.
$booleansOf = fn ($t) => array_map(fn ($r) => $r->column_name, $new->select(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = ? and data_type = 'boolean'", [$t]));

$tables = array_values(array_diff(array_intersect($tablesIn($src), $tablesIn($new)), ['migrations']));
$skipped = array_diff($tablesIn($src), $tables, ['migrations']);
if ($skipped) echo "Not copied (no longer in the app): " . implode(', ', $skipped) . "\n";

// Parents before children, so foreign keys always find their row.
$parents = [];
foreach ($new->select("
    select tc.table_name as child, ccu.table_name as parent
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'") as $fk) {
    if ($fk->child !== $fk->parent) $parents[$fk->child][] = $fk->parent;
}
$ordered = [];
$visit = function ($t) use (&$visit, &$ordered, $parents, $tables) {
    if (in_array($t, $ordered, true) || !in_array($t, $tables, true)) return;
    foreach ($parents[$t] ?? [] as $p) $visit($p);
    $ordered[] = $t;
};
foreach ($tables as $t) $visit($t);

echo "2. Copying " . count($ordered) . " tables...\n";
$new->transaction(function () use ($new, $src, $ordered, $columnsOf, $booleansOf) {
    $new->statement('truncate table ' . implode(', ', array_map(fn ($t) => "\"$t\"", $ordered)) . ' restart identity cascade');
    foreach ($ordered as $t) {
        $cols = array_values(array_intersect($columnsOf($src, $t), $columnsOf($new, $t)));
        $bools = array_intersect($booleansOf($t), $cols);
        $rows = $src->table($t)->select($cols)->get()->map(function ($r) use ($bools) {
            $row = (array) $r;
            foreach ($bools as $b) if ($row[$b] !== null) $row[$b] = (bool) $row[$b];
            return $row;
        })->all();
        foreach (array_chunk($rows, 200) as $chunk) $new->table($t)->insert($chunk);
        echo sprintf("   %-32s %6d rows\n", $t, count($rows));
    }
});

echo "\n3. Resetting id sequences...\n";
foreach ($new->select("
    select table_name, column_name, pg_get_serial_sequence('\"' || table_name || '\"', column_name) as seq
    from information_schema.columns
    where table_schema = 'public' and column_default like 'nextval(%'") as $c) {
    if (!$c->seq || !in_array($c->table_name, $ordered, true)) continue;
    $new->select("select setval('{$c->seq}', coalesce((select max(\"{$c->column_name}\") from \"{$c->table_name}\"), 1),
        (select max(\"{$c->column_name}\") from \"{$c->table_name}\") is not null)");
}

echo "\n4. Checking row counts (source / Supabase):\n";
$bad = 0;
foreach ($ordered as $t) {
    $a = $src->table($t)->count();
    $b = $new->table($t)->count();
    if ($a !== $b) { $bad++; echo sprintf("   %-32s %6d / %-6d  <-- DIFFERENT\n", $t, $a, $b); }
}
echo $bad ? "\n$bad table(s) differ.\n" : "   All " . count($ordered) . " tables match.\n";
