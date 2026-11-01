<?php

namespace App\Http\Requests\Api\V1;

/**
 * Validates the body of PUT /users/{user}: full replacement of account fields.
 */
class ReplaceUserRequest extends BaseUserRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
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
            'data.attributes.role' => ['required', 'string', 'in:resident,bfp'],
            'data.attributes.isManager' => ['sometimes', 'boolean'],
        ];
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
