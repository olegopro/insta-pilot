<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'user',  'guard_name' => 'web']);

        $admin = User::firstOrCreate(
            ['email' => 'admin@insta-pilot.local'],
            [
                'name'     => 'Admin',
                'password' => bcrypt('password'),
                'is_active' => true,
            ]
        );

        $admin->syncRoles(['admin']);
    }
}
