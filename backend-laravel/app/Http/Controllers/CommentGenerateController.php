<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Jobs\GenerateCommentJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class CommentGenerateController extends Controller {
    public function generate(Request $request): JsonResponse {
        $request->validate([
            'image_url'    => 'required|url',
            'caption_text' => 'nullable|string|max:2000',
            'account_id'   => 'nullable|integer',
        ]);

        $jobId  = (string) Str::uuid();
        $userId = $request->user()?->id;

        // Привязываем job к владельцу ДО dispatch и до ответа клиенту — иначе гонка с
        // /broadcasting/auth (клиент подпишется на канал раньше, чем появится маппинг). TTL с запасом.
        $userId !== null && Cache::put("comment-job-owner:{$jobId}", $userId, now()->addMinutes(30));

        GenerateCommentJob::dispatch(
            $jobId,
            $request->input('image_url'),
            $request->input('caption_text'),
            $request->input('account_id') ? (int) $request->input('account_id') : null,
            $userId,
        );

        return response()->json([
            'success' => true,
            'data'    => ['job_id' => $jobId],
            'message' => 'Generation started'
        ]);
    }
}
