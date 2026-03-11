<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\InstagramAccount;
use Illuminate\Database\Eloquent\Collection;

interface InstagramAccountRepositoryInterface {
    public function getAllAccounts(): Collection;
    public function createAccount(array $accountData): InstagramAccount;
    public function updateSessionData(int $id, string $sessionData): void;
    public function findById(int $id): InstagramAccount | null;
    public function findByLogin(string $login): InstagramAccount | null;
    public function deleteAccount(int $id): bool;
}
