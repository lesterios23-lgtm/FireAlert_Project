<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use App\Permissions\V1\Abilities;

abstract class BaseUserRequest extends FormRequest
{
    /**
     * Only managers with user:create may set role/is_manager on an account.
     */
    protected function canAssignRole(): bool
    {
        return $this->user()?->tokenCan(Abilities::CreateUser) ?? false;
    }

    public function messages(): array
    {
        return [
            'data.type.in' => 'The data.type value must be user.',
        ];
    }
}
