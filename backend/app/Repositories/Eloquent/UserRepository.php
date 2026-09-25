<?php

namespace App\Repositories\Eloquent;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;

class UserRepository implements UserRepositoryInterface
{
    public function create(array $data): User
    {
        $user = User::create($data);

        $user->profile()->updateOrCreate(
            [
                'user_id' => $user->id,
            ],
            [
                'course' => $data['course'] ?? null,
                'year' => $data['year'] ?? null,
                'section' => $data['section'] ?? null,
                'birthday' => $data['birthday'] ?? null,
                'gender' => $data['gender'] ?? null,
                'mobile_number' => $data['mobile_number'] ?? null,
            ]
        );

        return $user;
    }

    public function findByStudentId(string $studentId): ?User
    {
        return User::where(
            'student_id',
            $studentId
        )->first();
    }

    public function findByEmail(string $email): ?User
    {
        return User::where(
            'email',
            $email
        )->first();
    }

    public function findById(string $id): ?User
    {
        return User::find($id);
    }

    public function update(User $user, array $data): bool
    {
        return $user->update($data);
    }

    public function recordLogin(User $user, string $ip): bool
    {
        return $user->update([
            'last_login_at' => now(),
            'ip_address' => $ip,
        ]);
    }
}