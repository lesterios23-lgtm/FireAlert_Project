<?php

namespace App\Policies\V1;

use App\Models\FireReport;
use App\Models\User;
use App\Permissions\V1\Abilities;

/**
 * Authorization rules for fire reports. Each method returns true (allowed) or false (denied).
 * The rules read the abilities stored in the user's JWT.
 */
class FireReportPolicy
{
    /**
     * May this user create a report? Needs the broad or the "own" create ability.
     */
    public function store(User $user): bool
    {
        return $user->tokenCan(Abilities::CreateReport)
            || $user->tokenCan(Abilities::CreateOwnReport);
    }

    /**
     * May this user update this report (PATCH)?
     */
    public function update(User $user, FireReport $report): bool
    {
        // Broad ability: any report
        if ($user->tokenCan(Abilities::UpdateReport)) {
            return true;
        }

        // "Own" ability: only a report the user owns
        if ($user->tokenCan(Abilities::UpdateOwnReport)) {
            return $user->id === $report->resident_id;
        }

        return false;
    }

    /**
     * May this user replace this report (PUT)? Managers only.
     */
    public function replace(User $user, FireReport $report): bool
    {
        return $user->tokenCan(Abilities::ReplaceReport);
    }

    /**
     * May this user delete this report?
     */
    public function delete(User $user, FireReport $report): bool
    {
        // Broad ability: any report
        if ($user->tokenCan(Abilities::DeleteReport)) {
            return true;
        }

        // "Own" ability: only a report the user owns
        if ($user->tokenCan(Abilities::DeleteOwnReport)) {
            return $user->id === $report->resident_id;
        }

        return false;
    }
}
