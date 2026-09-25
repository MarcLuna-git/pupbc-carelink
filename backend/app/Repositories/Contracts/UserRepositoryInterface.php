<?php

namespace App\Repositories\Contracts;

use App\Models\User;

interface UserRepositoryInterface
{
    public function create(array $data): User;

    public function findByStudentId(string $studentId): ?User;

    public function findByEmail(string $email): ?User;

    public function findById(string $id): ?User;

    public function update(User $user, array $data): bool;

    public function recordLogin(User $user, string $ip): bool;
}