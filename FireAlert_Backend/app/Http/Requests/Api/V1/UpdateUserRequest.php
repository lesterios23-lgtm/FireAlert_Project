<?php

namespace App\Http\Requests\Api\V1;

/**
 * Validates the body of PATCH /users/{user}: only the fields sent are checked.
 */
class UpdateUserRequest extends BaseUserRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
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
            'data.attributes.role' => ['sometimes', 'string', 'in:resident,bfp'],
            'data.attributes.isManager' => ['sometimes', 'boolean'],
        ];
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
