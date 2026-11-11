<?php

return [



    'duplicate_detection' => [

        'radius_meters' => (float) env('DUPLICATE_RADIUS_METERS', 200),


        'window_minutes' => (int) env('DUPLICATE_WINDOW_MINUTES', 15),


        'description_threshold' => (float) env('DUPLICATE_DESCRIPTION_THRESHOLD', 0.35),


        'tight_radius_meters' => (float) env('DUPLICATE_TIGHT_RADIUS_METERS', 60),


        'active_statuses' => ['pending', 'accepted', 'responding'],
    ],

];
