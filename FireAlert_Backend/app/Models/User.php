<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Permissions\V1\Abilities;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

#[Fillable([
    'name',
    'full_name',
    'contact_number',
    'address',
    'email',
    'password',
    'password_hash',
    'role',
    'role_id',
    'is_manager',
])]
#[Hidden(['password', 'password_hash', 'remember_token'])]
class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $appends = ['id', 'name', 'role', 'is_manager'];

    public const ROLE_RESIDENT = 'resident';

    public const ROLE_BFP = 'bfp';

    public function getKeyName()
    {
        return Schema::hasColumn($this->getTable(), 'user_id')
            ? 'user_id'
            : parent::getKeyName();
    }

    public function getIdAttribute(): mixed
    {
        return $this->attributes[$this->getKeyName()] ?? null;
    }

    public function getNameAttribute(?string $value): ?string
    {
        return $this->attributes['full_name'] ?? $value;
    }

    public function setNameAttribute(string $value): void
    {
        $column = Schema::hasColumn($this->getTable(), 'full_name') ? 'full_name' : 'name';
        $this->attributes[$column] = $value;
    }

    public function setPasswordAttribute(string $value): void
    {
        $column = Schema::hasColumn($this->getTable(), 'password_hash')
            ? 'password_hash'
            : 'password';
        $this->attributes[$column] = $value;
    }

    public function getAuthPasswordName(): string
    {
        return Schema::hasColumn($this->getTable(), 'password_hash')
            ? 'password_hash'
            : 'password';
    }

    public function getAuthPassword(): string
    {
        return (string) $this->getAttribute($this->getAuthPasswordName());
    }

    public function setRoleAttribute(?string $value): void
    {
        if (! Schema::hasColumn($this->getTable(), 'role_id')) {
            $this->attributes['role'] = $value;

            return;
        }

        if ($value === null) {
            $this->attributes['role_id'] = null;

            return;
        }

        $roleName = match ($value) {
            self::ROLE_RESIDENT => 'Resident',
            self::ROLE_BFP => 'BFP Staff',
            'admin' => 'System Admin',
            default => throw new \InvalidArgumentException('Unsupported user role.'),
        };
        $roleId = DB::table('roles')
            ->whereRaw('LOWER(role_name) = ?', [mb_strtolower($roleName)])
            ->value('role_id');

        if ($roleId === null) {
            throw new \RuntimeException("The '{$roleName}' role is not configured.");
        }

        $this->attributes['role_id'] = $roleId;
    }

    public function getRoleAttribute(?string $value): ?string
    {
        if (! array_key_exists('role_id', $this->attributes)) {
            return $value;
        }

        $roleName = DB::table('roles')
            ->where('role_id', $this->attributes['role_id'])
            ->value('role_name');

        return match (mb_strtolower((string) $roleName)) {
            'resident' => self::ROLE_RESIDENT,
            'bfp staff' => self::ROLE_BFP,
            'system admin' => 'admin',
            default => null,
        };
    }

    public function getIsManagerAttribute(?bool $value): bool
    {
        return Schema::hasColumn($this->getTable(), 'is_manager')
            ? (bool) ($this->attributes['is_manager'] ?? false)
            : false;
    }

    public function getUpdatedAtColumn()
    {
        return Schema::hasColumn($this->getTable(), 'updated_at')
            ? parent::getUpdatedAtColumn()
            : null;
    }

    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    /**
     * Custom claims stored inside the JWT payload.
     * The abilities are read on every request by tokenCan().
     */
    public function getJWTCustomClaims(): array
    {
        return [
            'abilities' => Abilities::getAbilities($this),
        ];
    }

    /**
     * Checks an ability stored in the current JWT, for example 'report:update'.
     * Sanctum's own tokenCan() does not read JWT claims, so we implement it here.
     */
    public function tokenCan(string $ability): bool
    {
        try {
            // Read the "abilities" claim of the token sent with this request
            $abilities = auth('api')->payload()->get('abilities') ?? [];
        } catch (\Throwable $e) {
            // No token, or an unreadable one: no abilities
            return false;
        }

        return in_array($ability, $abilities, true);
    }

    /**
     * A user's fire reports (via resident_id).
     * Required by Laravel's scoped route model binding on /users/{user}/reports.
     */
    public function reports(): HasMany
    {
        return $this->hasMany(FireReport::class, FireReport::residentForeignKey(), $this->getKeyName());
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'is_manager'        => 'boolean',
        ];
    }
}
