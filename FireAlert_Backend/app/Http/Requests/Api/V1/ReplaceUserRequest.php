<?php

namespace App\Http\Requests\Api\V1;

use App\Permissions\V1\Abilities;
use App\Models\User;

/**
 * Validates the body of PUT /users/{user}: full replacement of account fields.
 * Changing role or management flag additionally requires user:manage.
 */
class ReplaceUserRequest extends BaseUserRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $target = $this->route('user');
        $userId = $target?->id;

        $rules = [
            'data' => ['required', 'array:type,attributes'],
            'data.type' => ['required', 'string', 'in:user'],
            'data.attributes' => [
                'required',
                'array:name,email,password,role,isManager',
            ],
            'data.attributes.name' => ['required', 'string', 'max:150'],
            'data.attributes.email' => [
                'required',
                'email',
                'max:255',
                'unique:users,email'.($userId ? ','.$userId : ''),
            ],
            'data.attributes.password' => ['required', 'string', 'min:8'],
            'data.attributes.role' => ['required', 'string', 'in:'.User::ROLE_RESIDENT.','.User::ROLE_BFP],
            'data.attributes.isManager' => ['sometimes', 'boolean'],
        ];

        // Privilege changes on an existing account need the explicit manage ability.
        $elevates = $this->boolean('data.attributes.isManager')
            || $this->input('data.attributes.role') === User::ROLE_BFP
            || ($target && ($target->role === User::ROLE_BFP || $target->is_manager));

        if ($elevates && ! $this->user()->tokenCan(Abilities::ManageUser)) {
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
