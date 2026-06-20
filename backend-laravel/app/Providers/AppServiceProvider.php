<?php

declare(strict_types=1);

namespace App\Providers;

use App\Repositories\AccountLimitRepository;
use App\Repositories\AccountLimitRepositoryInterface;
use App\Repositories\ActivityLogRepository;
use App\Repositories\ActivityLogRepositoryInterface;
use App\Repositories\AutomationActionItemRepository;
use App\Repositories\AutomationActionItemRepositoryInterface;
use App\Repositories\AutomationTaskRepository;
use App\Repositories\AutomationTaskRepositoryInterface;
use App\Repositories\InstagramAccountRepository;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Repositories\LlmSettingsRepository;
use App\Repositories\LlmSettingsRepositoryInterface;
use App\Repositories\LlmSystemPromptRepository;
use App\Repositories\LlmSystemPromptRepositoryInterface;
use App\Repositories\ParsedTargetRepository;
use App\Repositories\ParsedTargetRepositoryInterface;
use App\Repositories\ParseRunRepository;
use App\Repositories\ParseRunRepositoryInterface;
use App\Repositories\UserRepository;
use App\Repositories\UserRepositoryInterface;
use App\Repositories\WorkingHoursRepository;
use App\Repositories\WorkingHoursRepositoryInterface;
use App\Services\ActivityLoggerService;
use App\Services\ActivityLoggerServiceInterface;
use App\Services\Automation\ActionPluginRegistry;
use App\Services\Automation\ActionPluginRegistryInterface;
use App\Services\Automation\ActionSchedulerService;
use App\Services\Automation\ActionSchedulerServiceInterface;
use App\Services\Automation\CommentActionPlugin;
use App\Services\Automation\LikeActionPlugin;
use App\Services\Automation\RateLimitGuardService;
use App\Services\Automation\RateLimitGuardServiceInterface;
use App\Services\Automation\TargetFilterService;
use App\Services\Automation\TargetFilterServiceInterface;
use App\Services\Automation\WorkingHoursService;
use App\Services\Automation\WorkingHoursServiceInterface;
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
                $app->make(ActivityLoggerServiceInterface::class),
                $app->make(InstagramAccountRepositoryInterface::class)
            )
        );

        $this->app->bind(
            LlmSettingsRepositoryInterface::class,
            LlmSettingsRepository::class
        );

        $this->app->bind(
            LlmSystemPromptRepositoryInterface::class,
            LlmSystemPromptRepository::class
        );

        $this->app->bind(
            LlmServiceInterface::class,
            fn (mixed $app) => new LlmService(
                $app->make(LlmSettingsRepositoryInterface::class),
                $app->make(LlmSystemPromptRepositoryInterface::class)
            )
        );

        $this->app->singleton(
            ActivityLoggerServiceInterface::class,
            ActivityLoggerService::class
        );

        $this->app->bind(
            ActivityLogRepositoryInterface::class,
            ActivityLogRepository::class
        );

        $this->app->bind(
            AutomationTaskRepositoryInterface::class,
            AutomationTaskRepository::class
        );

        $this->app->bind(
            ParseRunRepositoryInterface::class,
            ParseRunRepository::class
        );

        $this->app->bind(
            ParsedTargetRepositoryInterface::class,
            ParsedTargetRepository::class
        );

        $this->app->bind(
            AutomationActionItemRepositoryInterface::class,
            AutomationActionItemRepository::class
        );

        $this->app->bind(
            AccountLimitRepositoryInterface::class,
            AccountLimitRepository::class
        );

        $this->app->bind(
            WorkingHoursRepositoryInterface::class,
            WorkingHoursRepository::class
        );

        $this->app->bind(
            TargetFilterServiceInterface::class,
            TargetFilterService::class
        );

        $this->app->bind(
            RateLimitGuardServiceInterface::class,
            RateLimitGuardService::class
        );

        $this->app->bind(
            WorkingHoursServiceInterface::class,
            WorkingHoursService::class
        );

        $this->app->bind(
            ActionSchedulerServiceInterface::class,
            ActionSchedulerService::class
        );

        $this->app->tag(
            [
                CommentActionPlugin::class,
                LikeActionPlugin::class
            ],
            'automation.plugins'
        );

        $this->app->bind(
            ActionPluginRegistryInterface::class,
            fn (mixed $app) => new ActionPluginRegistry($app->tagged('automation.plugins'))
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void {
        //
    }
}
