<?php

namespace App\Policies\V1;

use App\Models\User;
use App\Permissions\V1\Abilities;

/**
 * Authorization rules for user account management.
 * Every action requires the matching broad user ability from the JWT.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->tokenCan(Abilities::UpdateUser)
            || $user->tokenCan(Abilities::ReplaceUser)
            || $user->tokenCan(Abilities::DeleteUser)
            || $user->tokenCan(Abilities::CreateUser);
    }

    public function view(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function store(User $user): bool
    {
        return $user->tokenCan(Abilities::CreateUser);
    }

    public function replace(User $user): bool
    {
        return $user->tokenCan(Abilities::ReplaceUser);
    }

    public function update(User $user): bool
    {
        return $user->tokenCan(Abilities::UpdateUser);
    }

    public function delete(User $user): bool
    {
        return $user->tokenCan(Abilities::DeleteUser);
    }
}
