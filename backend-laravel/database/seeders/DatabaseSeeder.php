<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        // Создаёт роли, admin@insta-pilot.local (пароль: password) с ролью admin
        $this->call([AdminSeeder::class]);

        // Обычный пользователь для E2E тестов
        $user = User::firstOrCreate(
            ['email' => 'user@insta-pilot.local'],
            [
                'name'      => 'Regular User',
                'password'  => bcrypt('password'),
                'is_active' => true,
            ]
        );

        $user->syncRoles(['user']);
    }
}
