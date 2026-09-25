<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;

trait CreatesApplication
{
    /** @return \Illuminate\Foundation\Application */
    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';

        $app->make(Kernel::class)->bootstrap();

        if ($app->environment() !== 'testing'
            || config('database.default') !== 'mysql'
            || config('database.connections.mysql.database') !== 'carelink_stability_testing'
            || config('database.connections.mysql.host') !== '127.0.0.1'
            || (string) config('database.connections.mysql.port') !== '3307'
            || config('database.connections.mysql.unix_socket')
            || config('database.connections.mysql.url')) {
            throw new \RuntimeException('Refusing tests outside isolated carelink_stability_testing at 127.0.0.1:3307.');
        }
        return $app;
    }
}
