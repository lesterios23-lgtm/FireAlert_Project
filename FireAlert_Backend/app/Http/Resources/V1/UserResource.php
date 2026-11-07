<?php

namespace App\Http\Resources\V1;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Safe JSON shape of a user. Password and remember_token never leave the server.
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->resource;

        return [
            'type' => 'user',
            'id' => $user->id,
            'attributes' => [
                'name' => $user->name,
                'contactNumber' => $user->contact_number,
                'address' => $user->address,
                'email' => $user->email,
                'role' => $user->role,
                'createdAt' => $user->created_at,
                'updatedAt' => $user->updated_at,
            ],
        ];
    }
}
