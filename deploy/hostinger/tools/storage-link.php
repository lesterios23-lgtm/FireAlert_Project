<?php

/**
 * One-time helper for Hostinger plans without SSH.
 *
 * 1. Upload this file to public_html/
 * 2. Change TOKEN below to any random string.
 * 3. Open https://example.com/storage-link.php?token=YOUR-TOKEN
 * 4. DELETE this file afterwards.
 *
 * It creates public_html/storage -> ../firealert/storage/app/public, which is
 * where profile photos are written. Evidence photos are streamed by the API and
 * do not need this link.
 */

declare(strict_types=1);

const TOKEN = 'CHANGE-ME-8f3a91c7';

if (($_GET['token'] ?? '') !== TOKEN) {
    http_response_code(403);
    exit('Forbidden. Set TOKEN in this file and open this page with ?token=...');
}

header('Content-Type: text/plain; charset=utf-8');

$target = realpath(__DIR__.'/../firealert/storage/app/public');
$link = __DIR__.'/storage';

if ($target === false) {
    http_response_code(500);
    echo "Target folder not found: ../firealert/storage/app/public\n";
    echo "Upload the Laravel application to the firealert folder first.\n";
    exit;
}

if (is_link($link)) {
    unlink($link);
} elseif (file_exists($link)) {
    http_response_code(409);
    echo "A real file or folder already exists at public_html/storage.\n";
    echo "Remove or rename it, then reload this page.\n";
    exit;
}

if (@symlink($target, $link)) {
    echo "OK - created public_html/storage -> {$target}\n";
    echo "Delete this script now: public_html/storage-link.php\n";
} else {
    http_response_code(500);
    echo "symlink() failed. Create the link over SSH instead:\n";
    echo "  cd ~/domains/example.com/public_html\n";
    echo "  ln -s ../firealert/storage/app/public storage\n";
}
