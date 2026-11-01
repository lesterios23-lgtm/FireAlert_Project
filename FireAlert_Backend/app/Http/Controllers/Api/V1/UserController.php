<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Api\V1\ReplaceUserRequest;
use App\Http\Requests\Api\V1\StoreUserRequest;
use App\Http\Requests\Api\V1\UpdateUserRequest;
use App\Http\Resources\V1\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Manager-only account management: list, create, show, replace, update, delete.
 * Every action asks the UserPolicy, which reads the user's JWT abilities.
 */
class UserController extends APIController
{
    public function index(): AnonymousResourceCollection|JsonResponse
    {
        if ($this->isAble('viewAny', User::class)) {
            return UserResource::collection(User::query()->paginate(15));
        }

        return $this->notAuthorized('You are not authorized to view that resource.');
    }

    public function store(StoreUserRequest $request): UserResource|JsonResponse
    {
        if ($this->isAble('store', User::class)) {
            $user = User::create($request->mappedAttributes());

            return new UserResource($user);
        }

        return $this->notAuthorized('You are not authorized to create that resource.');
    }

    public function show(User $user): UserResource|JsonResponse
    {
        if ($this->isAble('view', $user)) {
            return new UserResource($user);
        }

        return $this->notAuthorized('You are not authorized to view that resource.');
    }

    public function replace(ReplaceUserRequest $request, User $user): UserResource|JsonResponse
    {
        if ($this->isAble('replace', $user)) {
            $user->update($request->mappedAttributes());

            return new UserResource($user);
        }

        return $this->notAuthorized('You are not authorized to replace that resource.');
    }

    public function update(UpdateUserRequest $request, User $user): UserResource|JsonResponse
    {
        if ($this->isAble('update', $user)) {
            $user->update($request->mappedAttributes());

            return new UserResource($user);
        }

        return $this->notAuthorized('You are not authorized to update that resource.');
    }

    public function destroy(User $user): JsonResponse
    {
        if ($this->isAble('delete', $user)) {
            // fire_reports.resident_id uses restrictOnDelete to protect incident
            // history, so a user who owns reports cannot be removed. Return a
            // clean conflict instead of letting the FK violation surface as 500.
            if ($user->reports()->exists()) {
                return $this->error(
                    'This user still has fire reports and cannot be deleted.',
                    409,
                );
            }

            $user->delete();

            return $this->ok('User successfully deleted');
        }

        return $this->notAuthorized('You are not authorized to delete that resource.');
    }
}
