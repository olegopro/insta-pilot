<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\InstagramAccount;
use App\Models\User;
use App\Repositories\InstagramAccountRepository;
use Tests\TestCase;

class InstagramAccountRepositoryTest extends TestCase {
    private InstagramAccountRepository $repository;

    protected function setUp(): void {
        parent::setUp();
        $this->repository = new InstagramAccountRepository();
    }

    public function test_get_all_accounts_returns_all(): void {
        InstagramAccount::factory()->count(3)->create();

        $result = $this->repository->getAllAccounts();

        $this->assertCount(3, $result);
    }

    public function test_get_accounts_by_user_returns_only_that_users_accounts(): void {
        $user = User::factory()->create();
        InstagramAccount::factory()->count(2)->create(['user_id' => $user->id]);
        InstagramAccount::factory()->create(); // чужой аккаунт

        $result = $this->repository->getAccountsByUser($user->id);

        $this->assertCount(2, $result);
        $result->each(fn ($a) => $this->assertEquals($user->id, $a->user_id));
    }

    public function test_create_account_persists_to_db(): void {
        $user = User::factory()->create();

        $account = $this->repository->createAccount([
            'user_id'            => $user->id,
            'instagram_login'    => 'testlogin',
            'instagram_password' => 'secret',
            'is_active'          => true,
        ]);

        $this->assertInstanceOf(InstagramAccount::class, $account);
        $this->assertEquals('testlogin', $account->instagram_login);
        $this->assertDatabaseHas('instagram_accounts', ['instagram_login' => 'testlogin']);
    }

    public function test_find_by_id_returns_account(): void {
        $account = InstagramAccount::factory()->create();

        $result = $this->repository->findById($account->id);

        $this->assertNotNull($result);
        $this->assertEquals($account->id, $result->id);
    }

    public function test_find_by_id_returns_null_for_nonexistent(): void {
        $result = $this->repository->findById(99999);

        $this->assertNull($result);
    }

    public function test_find_by_id_and_user_returns_account_for_owner(): void {
        $user = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $user->id]);

        $result = $this->repository->findByIdAndUser($account->id, $user->id);

        $this->assertNotNull($result);
        $this->assertEquals($account->id, $result->id);
    }

    public function test_find_by_id_and_user_returns_null_for_other_user(): void {
        $account = InstagramAccount::factory()->create();
        $otherUser = User::factory()->create();

        $result = $this->repository->findByIdAndUser($account->id, $otherUser->id);

        $this->assertNull($result);
    }

    public function test_find_by_login_returns_account(): void {
        $account = InstagramAccount::factory()->create(['instagram_login' => 'uniquelogin']);

        $result = $this->repository->findByLogin('uniquelogin');

        $this->assertNotNull($result);
        $this->assertEquals($account->id, $result->id);
    }

    public function test_find_by_login_returns_null_for_unknown(): void {
        $result = $this->repository->findByLogin('no_such_user');

        $this->assertNull($result);
    }

    public function test_delete_account_removes_from_db(): void {
        $account = InstagramAccount::factory()->create();

        $result = $this->repository->deleteAccount($account->id);

        $this->assertTrue($result);
        $this->assertDatabaseMissing('instagram_accounts', ['id' => $account->id]);
    }

    public function test_deactivate_account_sets_is_active_false(): void {
        $account = InstagramAccount::factory()->create(['is_active' => true]);

        $this->repository->deactivateAccount($account->id);

        $this->assertDatabaseHas('instagram_accounts', ['id' => $account->id, 'is_active' => false]);
    }

    public function test_update_session_data_persists(): void {
        $account = InstagramAccount::factory()->create(['session_data' => null]);
        $newSessionData = '{"uuids":{"phone_id":"test"},"cookies":{},"last_login":0,"device_settings":{},"user_agent":"","country":"US","country_code":1,"locale":"en_US","timezone_offset":0,"authorization_data":{}}';

        $this->repository->updateSessionData($account->id, $newSessionData);

        // session_data зашифрован — проверяем через getter модели
        $fresh = InstagramAccount::find($account->id);
        $this->assertEquals($newSessionData, $fresh->session_data);
    }
}
