<?php

/**
 * FireAlert - front controller for Hostinger shared hosting.
 *
 * The web root (public_html) only contains public files. The Laravel
 * application itself lives OUTSIDE the web root, in a sibling folder:
 *
 *   /home/u123456789/domains/example.com/
 *   ├── firealert/          <- the Laravel application (artisan, app/, vendor/)
 *   └── public_html/        <- this folder (Laravel public + React build)
 *
 * If you uploaded the application somewhere else, change $appPath below.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Default: the "firealert" folder next to public_html.
$appPath = __DIR__.'/../firealert';

if (! is_file($appPath.'/vendor/autoload.php')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');

    echo "FireAlert backend not found.\n\n";
    echo "Expected Laravel application at:\n  ".$appPath."\n\n";
    echo "Upload the backend there (the folder that contains artisan, app/ and vendor/),\n";
    echo "or edit \$appPath in this file.\n";
    exit;
}

// Serve the maintenance page when "php artisan down" was used.
if (file_exists($maintenance = $appPath.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $appPath.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $appPath.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
