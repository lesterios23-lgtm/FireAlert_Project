<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Permissions\V1\Abilities;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

#[Fillable(['name', 'email', 'password', 'role', 'is_manager'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public const ROLE_RESIDENT = 'resident';

    public const ROLE_BFP = 'bfp';

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
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_manager' => 'boolean',
        ];
    }
}
