<?php

/*
| cPanel front controller, uploaded once to public_html/index.php.
| Finds the Laravel backend folder either outside the web root
| (/home/<user>/backend, recommended) or at public_html/backend.
| Server settings are read from /home/<user>/carelink.env (see
| backend/bootstrap/app.php), so uploading new code needs no edits here.
*/

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$backend = is_dir(__DIR__.'/../backend/vendor') ? __DIR__.'/../backend' : __DIR__.'/backend';

if (file_exists($maintenance = $backend.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $backend.'/vendor/autoload.php';

$app = require_once $backend.'/bootstrap/app.php';

$app->instance('path.public', __DIR__);

$kernel = $app->make(Kernel::class);

$response = $kernel->handle(
    $request = Request::capture()
)->send();

$kernel->terminate($request, $response);
