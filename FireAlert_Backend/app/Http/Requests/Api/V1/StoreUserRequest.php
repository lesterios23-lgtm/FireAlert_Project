<?php

namespace App\Http\Requests\Api\V1;

use App\Permissions\V1\Abilities;
use App\Models\User;
use Illuminate\Validation\Rule;

/**
 * Validates the body of POST /users (manager-only user creation).
 * Creating an account with a management role/flag requires user:manage.
 */
class StoreUserRequest extends BaseUserRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = [
            'data' => ['required', 'array:type,attributes'],
            'data.type' => ['required', 'string', 'in:user'],
            'data.attributes' => [
                'required',
                'array:name,email,password,role,isManager',
            ],
            'data.attributes.name' => ['required', 'string', 'max:150'],
            'data.attributes.email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'data.attributes.password' => ['required', 'string', 'min:8'],
            'data.attributes.role' => ['required', 'string', 'in:'.User::ROLE_RESIDENT.','.User::ROLE_BFP],
            'data.attributes.isManager' => ['sometimes', 'boolean'],
        ];

        // Privilege-granting fields need the explicit manage ability.
        $elevated = $this->boolean('data.attributes.isManager')
            || $this->input('data.attributes.role') === User::ROLE_BFP;

        if ($elevated && ! $this->user()->tokenCan(Abilities::ManageUser)) {
            $rules['data.attributes.role'] = ['prohibited'];
            $rules['data.attributes.isManager'] = ['prohibited'];
        }

        return $rules;
    }

    public function mappedAttributes(): array
    {
        $attributes = $this->validated('data.attributes');

        return [
            'name' => $attributes['name'],
            'email' => $attributes['email'],
            'password' => $attributes['password'],
            'role' => $attributes['role'],
            'is_manager' => $attributes['isManager'] ?? false,
        ];
    }
}
