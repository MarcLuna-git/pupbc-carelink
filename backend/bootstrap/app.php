<?php


$app = new Illuminate\Foundation\Application(
    $_ENV['APP_BASE_PATH'] ?? dirname(__DIR__)
);

/*
| cPanel: the server's settings live outside the uploaded backend folder, at
| /home/<user>/carelink.env, so re-uploading the code never overwrites them.
| Checked one and two levels above the backend folder (backend/ in home or in
| public_html). Never place carelink.env inside public_html. Local XAMPP and
| Render have no carelink.env and keep using backend/.env / env vars.
*/
foreach ([dirname(__DIR__, 2), dirname(__DIR__, 3)] as $envDirectory) {
    if (is_file($envDirectory . '/carelink.env')) {
        $app->useEnvironmentPath($envDirectory);
        $app->loadEnvironmentFrom('carelink.env');
        break;
    }
}

/*
| A config cache built on another machine (e.g. uploaded from XAMPP) holds that
| machine's paths and .env values, so this server would ignore its own
| settings. Drop it when it does not mention this install's base path.
*/
$cachedConfig = $app->getCachedConfigPath();
if (is_file($cachedConfig)
    && strpos(file_get_contents($cachedConfig), addslashes($app->basePath())) === false) {
    @unlink($cachedConfig);
}


$app->singleton(
    Illuminate\Contracts\Http\Kernel::class,
    App\Http\Kernel::class
);

$app->singleton(
    Illuminate\Contracts\Console\Kernel::class,
    App\Console\Kernel::class
);

$app->singleton(
    Illuminate\Contracts\Debug\ExceptionHandler::class,
    App\Exceptions\Handler::class
);


return $app;
