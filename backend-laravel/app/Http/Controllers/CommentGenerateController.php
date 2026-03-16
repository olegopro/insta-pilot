<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Jobs\GenerateCommentJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class CommentGenerateController extends Controller {
    public function generate(Request $request): JsonResponse {
        $request->validate([
            'image_url'    => 'required|url',
            'caption_text' => 'nullable|string|max:2000',
            'account_id'   => 'nullable|integer',
        ]);

        $jobId = (string) Str::uuid();

        GenerateCommentJob::dispatch(
            $jobId,
            $request->input('image_url'),
            $request->input('caption_text'),
            $request->input('account_id') ? (int) $request->input('account_id') : null,
            $request->user()?->id,
        );

        return response()->json([
            'success' => true,
            'data'    => ['job_id' => $jobId],
            'message' => 'Generation started'
        ]);
    }
}
