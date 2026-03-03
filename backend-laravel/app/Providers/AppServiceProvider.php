<?php

declare(strict_types=1);

namespace App\Providers;

use App\Repositories\InstagramAccountRepository;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientService;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            InstagramAccountRepositoryInterface::class,
            InstagramAccountRepository::class
        );

        $this->app->bind(
            InstagramClientServiceInterface::class,
            InstagramClientService::class
        );

        $this->app->singleton(
            'InstagramClient',
            fn() => new InstagramClientService(config('services.instagram.python_url'))
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
