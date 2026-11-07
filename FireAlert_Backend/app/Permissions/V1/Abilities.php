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

    // User management abilities (BFP managers only)
    public const CreateUser = 'user:create';
    public const UpdateUser = 'user:update';
    public const ReplaceUser = 'user:replace';
    public const DeleteUser = 'user:delete';

    /**
     * Separate, explicit grant for privilege-granting operations: changing an
     * account's role or management flag. Not implied by user:update, so an
     * account-management token alone cannot create more managers.
     */
    public const ManageUser = 'user:manage';

    /**
     * Returns the list of abilities a user receives. The list is written into the
     * JWT at login, so the policies can read it without querying the database.
     */
    public static function getAbilities(User $user): array
    {
        // Managers / BFP personnel: report management plus explicit account
        // management. Least privilege: each ability is granted for a reason;
        // role/is_manager changes additionally require user:manage.
        if ($user->is_manager || in_array($user->role, [User::ROLE_BFP, 'admin'], true)) {
            return [
                self::CreateReport,
                self::UpdateReport,
                self::ReplaceReport,
                self::DeleteReport,
                self::CreateUser,
                self::UpdateUser,
                self::ReplaceUser,
                self::DeleteUser,
                self::ManageUser,
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
