<?php

return [



    'duplicate_detection' => [

        'radius_meters' => (float) env('DUPLICATE_RADIUS_METERS', 200),


        'window_minutes' => (int) env('DUPLICATE_WINDOW_MINUTES', 15),


        'description_threshold' => (float) env('DUPLICATE_DESCRIPTION_THRESHOLD', 0.35),


        'tight_radius_meters' => (float) env('DUPLICATE_TIGHT_RADIUS_METERS', 60),


        'active_statuses' => ['pending', 'accepted', 'responding'],
    ],

    /*
    | Optional first administrator for a fresh deployment. When both the email
    | and password are set, the reference-data seeder creates the account if no
    | administrator exists yet. Read through config() so it also works when
    | config is cached in production.
    */
    'admin' => [
        'email' => env('FIREALERT_ADMIN_EMAIL'),
        'password' => env('FIREALERT_ADMIN_PASSWORD'),
        'name' => env('FIREALERT_ADMIN_NAME', 'System Administrator'),
        'contact' => env('FIREALERT_ADMIN_CONTACT', ''),
    ],

];
