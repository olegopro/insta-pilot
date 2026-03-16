<?php

declare(strict_types=1);

namespace App\Providers;

use App\Repositories\ActivityLogRepository;
use App\Repositories\ActivityLogRepositoryInterface;
use App\Repositories\InstagramAccountRepository;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Repositories\LlmSettingsRepository;
use App\Repositories\LlmSettingsRepositoryInterface;
use App\Repositories\UserRepository;
use App\Repositories\UserRepositoryInterface;
use App\Services\ActivityLoggerService;
use App\Services\ActivityLoggerServiceInterface;
use App\Services\InstagramClientService;
use App\Services\InstagramClientServiceInterface;
use App\Services\LlmService;
use App\Services\LlmServiceInterface;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider {
    /**
     * Register any application services.
     */
    public function register(): void {
        $this->app->bind(
            InstagramAccountRepositoryInterface::class,
            InstagramAccountRepository::class
        );

        $this->app->bind(
            UserRepositoryInterface::class,
            UserRepository::class
        );

        $this->app->singleton(
            InstagramClientServiceInterface::class,
            fn (mixed $app) => new InstagramClientService(
                config('services.instagram.python_url'),
                $app->make(ActivityLoggerServiceInterface::class)
            )
        );

        $this->app->bind(
            LlmSettingsRepositoryInterface::class,
            LlmSettingsRepository::class
        );

        $this->app->bind(
            LlmServiceInterface::class,
            LlmService::class
        );

        $this->app->singleton(
            ActivityLoggerServiceInterface::class,
            ActivityLoggerService::class
        );

        $this->app->bind(
            ActivityLogRepositoryInterface::class,
            ActivityLogRepository::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void {
        //
    }
}
