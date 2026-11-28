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
// Serve public storage files safely if Hostinger's hbuilds removes the storage symlink.
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($requestPath, '/storage/')) {
    $relativePath = ltrim(substr($requestPath, strlen('/storage/')), '/');
    $storageRoot = realpath($appPath.'/storage/app/public');
    $targetFile = $storageRoot ? realpath($storageRoot.'/'.$relativePath) : false;
    if ($storageRoot && $targetFile && str_starts_with($targetFile, $storageRoot.DIRECTORY_SEPARATOR) && is_file($targetFile)) {
        $mime = function_exists('mime_content_type') ? (mime_content_type($targetFile) ?: 'application/octet-stream') : 'application/octet-stream';
        header('Content-Type: '.$mime);
        header('Content-Length: '.filesize($targetFile));
        header('Cache-Control: public, max-age=31536000');
        readfile($targetFile);
        exit;
    }
    http_response_code(404);
    exit;
}
// Shared hosting can inject stale server-level env vars (e.g. old DB_* / APP_*)
// that override .env. Make this app's .env authoritative for web requests.
$envFile = $appPath.'/.env';
if (is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key] = explode('=', $line, 2);
        $key = trim($key);
        if ($key === '') {
            continue;
        }
        putenv($key);
        unset($_ENV[$key], $_SERVER[$key]);
    }
}


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
