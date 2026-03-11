<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\InstagramAccount;
use Illuminate\Database\Eloquent\Collection;

class InstagramAccountRepository implements InstagramAccountRepositoryInterface {
    public function getAllAccounts(): Collection {
        return InstagramAccount::all();
    }

    public function getAccountsByUser(int $userId): Collection {
        return InstagramAccount::where('user_id', $userId)->get();
    }

    public function createAccount(array $accountData): InstagramAccount {
        return InstagramAccount::create($accountData);
    }

    public function updateSessionData(int $id, string $sessionData): void {
        InstagramAccount::where('id', $id)->update(['session_data' => $sessionData]);
    }

    public function findById(int $id): InstagramAccount | null {
        return InstagramAccount::find($id);
    }

    public function findByIdAndUser(int $id, int $userId): InstagramAccount | null {
        return InstagramAccount::where('id', $id)->where('user_id', $userId)->first();
    }

    public function findByLogin(string $login): InstagramAccount | null {
        return InstagramAccount::where(['instagram_login' => $login])->first();
    }

    public function deleteAccount(int $id): bool {
        return InstagramAccount::destroy($id) > 0;
    }
}
