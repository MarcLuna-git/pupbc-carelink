<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;


$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
);

// Ipa-serve nang diretso ang existing static files sa built-in server.
if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    return false;
}

require_once __DIR__ . '/public/index.php';
