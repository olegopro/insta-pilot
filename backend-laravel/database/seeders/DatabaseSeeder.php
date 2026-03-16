<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        $this->call([
            AdminSeeder::class,
            DeviceProfileSeeder::class
        ]);

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
