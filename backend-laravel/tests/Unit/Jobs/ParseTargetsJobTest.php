<?php

declare(strict_types=1);

namespace Tests\Unit\Jobs;

use App\Jobs\ParseTargetsJob;
use App\Models\AutomationActionItem;
use App\Models\AutomationTask;
use App\Models\InstagramAccount;
use App\Models\ParsedTarget;
use App\Models\ParseRun;
use App\Models\User;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Repositories\ParsedTargetRepositoryInterface;
use App\Repositories\ParseRunRepositoryInterface;
use App\Services\Automation\TargetFilterServiceInterface;
use App\Services\InstagramClientServiceInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class ParseTargetsJobTest extends TestCase {
    #[DataProvider('likeSkipProvider')]
    public function test_like_parsing_skips_unavailable_media_and_fetches_more(string $skipReason): void {
        $user = User::factory()->create();
        $account = InstagramAccount::factory()->create([
            'user_id' => $user->id,
            'session_data' => '{"session":"ok"}'
        ]);
        $parseRun = $this->makeParseRun($user, $account);
        $this->makeTask($user, $account, $parseRun->id, 'like');

        if ($skipReason === 'already_actioned') {
            $oldTask = $this->makeTask($user, $account, null, 'like');
            $this->makeExistingLikeItem($user, $account, $oldTask, 1001);
        }

        $skippedTarget = $this->target(501, 1001, $skipReason === 'already_liked');
        $firstFreshTarget = $this->target(502, 1002);
        $secondFreshTarget = $this->target(503, 1003);

        $mock = $this->mock(InstagramClientServiceInterface::class);
        $mock->shouldReceive('parseTargetsCandidates')
            ->once()
            ->withArgs(fn (array $params, ?int $userId): bool => $userId === $user->id
                && !isset($params['next_max_id'])
                && $params['account_id'] === $account->id
                && $params['source_type'] === 'hashtag')
            ->andReturn([
                'success' => true,
                'candidates' => [
                    $skippedTarget,
                    $firstFreshTarget
                ],
                'next_max_id' => 'cursor-1'
            ]);
        $mock->shouldReceive('parseTargetsCandidates')
            ->once()
            ->withArgs(fn (array $params, ?int $userId): bool => $userId === $user->id
                && ($params['next_max_id'] ?? null) === 'cursor-1'
                && $params['account_id'] === $account->id
                && $params['source_type'] === 'hashtag')
            ->andReturn([
                'success' => true,
                'candidates' => [
                    $secondFreshTarget
                ],
                'next_max_id' => null
            ]);
        $mock->shouldReceive('parseTargetsEnrich')
            ->once()
            ->withArgs(fn (array $params, ?int $userId): bool => $userId === $user->id
                && count($params['targets']) === 2)
            ->andReturn([
                'success' => true,
                'targets' => [
                    $skippedTarget,
                    $firstFreshTarget
                ]
            ]);
        $mock->shouldReceive('parseTargetsEnrich')
            ->once()
            ->withArgs(fn (array $params, ?int $userId): bool => $userId === $user->id
                && count($params['targets']) === 1)
            ->andReturn([
                'success' => true,
                'targets' => [
                    $secondFreshTarget
                ]
            ]);

        $job = new ParseTargetsJob((int) $parseRun->id);
        $job->handle(
            app(ParseRunRepositoryInterface::class),
            app(ParsedTargetRepositoryInterface::class),
            app(InstagramAccountRepositoryInterface::class),
            app(InstagramClientServiceInterface::class),
            app(TargetFilterServiceInterface::class)
        );

        $mediaPks = ParsedTarget::where('parse_run_id', $parseRun->id)
            ->orderBy('id')
            ->pluck('media_pk')
            ->map(static fn (mixed $mediaPk): string => (string) $mediaPk)
            ->all();

        $this->assertSame([
            '1002',
            '1003'
        ], $mediaPks);
        $this->assertDatabaseMissing('parsed_targets', [
            'parse_run_id' => $parseRun->id,
            'media_pk' => 1001
        ]);

        $parseRun->refresh();
        $this->assertSame(3, $parseRun->scanned_count);
        $this->assertSame(2, $parseRun->collected_count);
        $this->assertSame('completed', $parseRun->status);
    }

    public static function likeSkipProvider(): array {
        return [
            'already liked anchor post' => ['already_liked'],
            'already scheduled or done media' => ['already_actioned']
        ];
    }

    private function makeParseRun(User $user, InstagramAccount $account): ParseRun {
        return ParseRun::create([
            'user_id' => $user->id,
            'instagram_account_id' => $account->id,
            'mode' => 'semi_auto',
            'source_type' => 'hashtag',
            'source_value' => ['hashtags' => ['test']],
            'filters_snapshot' => [],
            'target_limit' => 2,
            'status' => 'pending'
        ]);
    }

    private function makeTask(
        User $user,
        InstagramAccount $account,
        ?int $parseRunId,
        string $actionType
    ): AutomationTask {
        return AutomationTask::create([
            'user_id' => $user->id,
            'instagram_account_id' => $account->id,
            'parse_run_id' => $parseRunId,
            'mode' => 'semi_auto',
            'action_type' => $actionType,
            'action_config' => [],
            'target_count' => 2,
            'spread_seconds' => 3600,
            'jitter_seconds' => 0,
            'respect_working_hours' => false,
            'status' => 'draft'
        ]);
    }

    private function makeExistingLikeItem(
        User $user,
        InstagramAccount $account,
        AutomationTask $task,
        int $mediaPk
    ): void {
        AutomationActionItem::create([
            'automation_task_id' => $task->id,
            'instagram_account_id' => $account->id,
            'user_id' => $user->id,
            'action_type' => 'like',
            'target_user_pk' => 9001,
            'media_pk' => $mediaPk,
            'payload' => [],
            'status' => 'done',
            'run_at' => now()
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function target(int $userPk, int $mediaPk, bool $hasLiked = false): array {
        return [
            'user_pk' => (string) $userPk,
            'username' => 'user_' . $userPk,
            'user' => [
                'pk' => (string) $userPk,
                'username' => 'user_' . $userPk,
                'full_name' => 'User ' . $userPk,
                'profile_pic_url' => null,
                'follower_count' => 100,
                'following_count' => 50,
                'media_count' => 10,
                'is_private' => false,
                'is_verified' => false
            ],
            'anchor_post' => [
                'pk' => (string) $mediaPk,
                'has_liked' => $hasLiked,
                'caption_text' => 'caption',
                'like_count' => 10,
                'comment_count' => 2,
                'thumbnail_url' => null,
                'user' => [
                    'follower_count' => 100
                ]
            ],
            'metrics' => [
                'likes_sum_last_n' => 20,
                'likes_avg_last_n' => 10,
                'likes_min' => 5,
                'likes_max' => 15,
                'last_post_age_days' => 1,
                'posts_analyzed' => 2,
                'captions_concat' => 'caption'
            ]
        ];
    }
}
