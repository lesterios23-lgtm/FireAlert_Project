<?php

namespace App\Policies\V1;

use App\Models\User;
use App\Permissions\V1\Abilities;

/**
 * Authorization rules for user account management.
 * Least privilege: every action requires the matching ability from the JWT,
 * destructive actions on the acting manager's own account are denied, and
 * changing a role or management flag additionally requires user:manage.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->tokenCan(Abilities::CreateUser)
            || $user->tokenCan(Abilities::UpdateUser)
            || $user->tokenCan(Abilities::ReplaceUser)
            || $user->tokenCan(Abilities::DeleteUser);
    }

    public function view(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function store(User $user): bool
    {
        return $user->tokenCan(Abilities::CreateUser);
    }

    /**
     * A manager may not replace their own account: PUT could strip their
     * management flag or role and lock them out of the system.
     */
    public function replace(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return false;
        }

        return $actor->tokenCan(Abilities::ReplaceUser);
    }

    public function update(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return false;
        }

        return $actor->tokenCan(Abilities::UpdateUser);
    }

    /**
     * A manager may not delete themselves.
     */
    public function delete(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return false;
        }

        return $actor->tokenCan(Abilities::DeleteUser);
    }

    /**
     * May this actor grant or revoke roles / management flags on $target?
     * Requires the explicit user:manage ability and is denied on self.
     */
    public function manage(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return false;
        }

        return $actor->tokenCan(Abilities::ManageUser);
    }
}
