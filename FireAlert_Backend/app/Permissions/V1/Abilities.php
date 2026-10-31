<?php

namespace App\Permissions\V1;

use App\Models\User;

/**
 * Every ability name in one place, plus the rule that decides who receives which.
 * Format: resource:action. "own" means "only for things I own".
 */
final class Abilities
{
    // Report abilities
    public const CreateReport = 'report:create';
    public const CreateOwnReport = 'report:own:create';
    public const UpdateReport = 'report:update';
    public const UpdateOwnReport = 'report:own:update';
    public const ReplaceReport = 'report:replace';
    public const DeleteReport = 'report:delete';
    public const DeleteOwnReport = 'report:own:delete';

    // Product aliases to support exact tutorial constant names
    public const CreateProduct = self::CreateReport;
    public const CreateOwnProduct = self::CreateOwnReport;
    public const UpdateProduct = self::UpdateReport;
    public const UpdateOwnProduct = self::UpdateOwnReport;
    public const ReplaceProduct = self::ReplaceReport;
    public const DeleteProduct = self::DeleteReport;
    public const DeleteOwnProduct = self::DeleteOwnReport;

    // User management abilities (managers only)
    public const CreateUser = 'user:create';
    public const UpdateUser = 'user:update';
    public const ReplaceUser = 'user:replace';
    public const DeleteUser = 'user:delete';

    /**
     * Returns the list of abilities a user receives. The list is written into the
     * JWT at login, so the policies can read it without querying the database.
     */
    public static function getAbilities(User $user): array
    {
        // Managers / BFP personnel may act on anything
        if ($user->is_manager || $user->role === User::ROLE_BFP) {
            return [
                self::CreateReport,
                self::UpdateReport,
                self::ReplaceReport,
                self::DeleteReport,
                self::CreateUser,
                self::UpdateUser,
                self::ReplaceUser,
                self::DeleteUser,
            ];
        }

        // Regular users / residents may only act on their own reports
        return [
            self::CreateOwnReport,
            self::UpdateOwnReport,
            self::DeleteOwnReport,
        ];
    }
}

