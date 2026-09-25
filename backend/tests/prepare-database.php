<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('local', 'testing') || config('database.default') !== 'mysql' || config('database.connections.mysql.host') !== '127.0.0.1') throw new RuntimeException('Only a local MySQL test database can be prepared.');
DB::statement('CREATE DATABASE IF NOT EXISTS carelink_stability_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
DB::purge('mysql');
config(['database.connections.mysql.database' => 'carelink_stability_testing', 'database.connections.mysql.url' => null]);
if (DB::connection()->getDatabaseName() !== 'carelink_stability_testing') throw new RuntimeException('Test database isolation failed.');
Artisan::call('migrate', ['--force' => true]);
echo Artisan::output();
