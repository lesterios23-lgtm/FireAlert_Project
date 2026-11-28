<?php

namespace App\Http\Controllers\Api\V1;

use Illuminate\Http\JsonResponse;

class AnnouncementController extends APIController
{
    /**
     * Return public safety announcements for the resident portal.
     */
    public function index(): JsonResponse
    {
        return $this->ok('Announcements retrieved', []);
    }
}
