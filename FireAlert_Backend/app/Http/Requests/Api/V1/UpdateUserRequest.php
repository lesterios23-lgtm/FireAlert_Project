<?php

namespace App\Http\Requests\Api\V1;

use App\Permissions\V1\Abilities;
use App\Models\User;

/**
 * Validates the body of PATCH /users/{user}: only the fields sent are checked.
 * Changing role or management flag additionally requires user:manage.
 */
class UpdateUserRequest extends BaseUserRequest
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
            'data' => ['sometimes', 'array:type,attributes'],
            'data.type' => ['sometimes', 'string', 'in:user'],
            'data.attributes' => [
                'sometimes',
                'array:name,email,password,role,isManager',
            ],
            'data.attributes.name' => ['sometimes', 'string', 'max:150'],
            'data.attributes.email' => [
                'sometimes',
                'email',
                'max:255',
                'unique:users,email'.($userId ? ','.$userId : ''),
            ],
            'data.attributes.password' => ['sometimes', 'string', 'min:8'],
            'data.attributes.role' => ['sometimes', 'string', 'in:'.User::ROLE_RESIDENT.','.User::ROLE_BFP],
            'data.attributes.isManager' => ['sometimes', 'boolean'],
        ];

        $attributes = $this->input('data.attributes', []) ?? [];

        // A privilege change is attempted if the body grants or touches an
        // elevated account (or revokes elevation from one).
        $elevates = (array_key_exists('isManager', $attributes) && $this->boolean('data.attributes.isManager'))
            || (array_key_exists('role', $attributes) && $attributes['role'] === User::ROLE_BFP)
            || ($target && ($target->role === User::ROLE_BFP || $target->is_manager));

        if ($elevates && ! $this->user()->tokenCan(Abilities::ManageUser)) {
            $rules['data.attributes.role'] = ['prohibited'];
            $rules['data.attributes.isManager'] = ['prohibited'];
        }

        return $rules;
    }

    public function mappedAttributes(): array
    {
        $attributes = $this->validated('data.attributes', []);
        $mapped = [];

        foreach (['name', 'email', 'password', 'role'] as $field) {
            if (array_key_exists($field, $attributes)) {
                $mapped[$field] = $attributes[$field];
            }
        }

        if (array_key_exists('isManager', $attributes)) {
            $mapped['is_manager'] = $attributes['isManager'];
        }

        return $mapped;
    }
}
