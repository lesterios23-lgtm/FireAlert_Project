<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing
|--------------------------------------------------------------------------
|
| The React app may live on a different host than the API, for example:
|
|   frontend: https://firealerts.site
|   API:      https://api.firealerts.site
|
| Set FRONTEND_URL in the backend .env to the frontend origin (comma-separated
| if you also use www):
|
|   FRONTEND_URL=https://firealerts.site,https://www.firealerts.site
|
| When FRONTEND_URL is empty the default "*" is kept, which is what a
| single-domain deployment needs. JWTs are sent in the Authorization header
| (not cookies), so supports_credentials stays false.
|
*/

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('FRONTEND_URL', '')),
)));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins ?: ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 3600,

    'supports_credentials' => false,

];
