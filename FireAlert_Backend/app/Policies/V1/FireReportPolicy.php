<?php

namespace App\Policies\V1;

use App\Models\FireReport;
use App\Models\User;

/**
 * Authorization rules for fire reports. Each method returns true (allowed) or false (denied).
 */
class FireReportPolicy
{
    /**
     * May this user update this fire report? Only its owner (resident) may (for now).
     */
    public function update(User $user, FireReport $report): bool
    {
        return $user->id === $report->resident_id;
    }
}

