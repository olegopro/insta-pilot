<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\LlmSettingsRepositoryInterface;
use App\Repositories\LlmSystemPromptRepositoryInterface;
use App\Services\LlmServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class LlmSettingsController extends Controller {
    public function __construct(
        private readonly LlmSettingsRepositoryInterface $repository,
        private readonly LlmServiceInterface $llmService,
        private readonly LlmSystemPromptRepositoryInterface $systemPromptRepository
    ) {}

    public function basePrompt(): JsonResponse {
        $prompt = $this->systemPromptRepository->findByKey('default_instagram_comment');

        if (!$prompt) {
            return response()->json(['success' => false, 'error' => 'Base prompt not found'], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'content'     => $prompt->content,
                'is_modified' => $prompt->content !== $prompt->default_content
            ],
            'message' => 'OK'
        ]);
    }

    public function updateBasePrompt(Request $request): JsonResponse {
        $data = $request->validate(['content' => 'required|string']);

        $prompt = $this->systemPromptRepository->updateByKey('default_instagram_comment', $data['content']);

        return response()->json([
            'success' => true,
            'data'    => [
                'content'     => $prompt->content,
                'is_modified' => $prompt->content !== $prompt->default_content
            ],
            'message' => 'Saved'
        ]);
    }

    public function resetBasePrompt(): JsonResponse {
        $current = $this->systemPromptRepository->findByKey('default_instagram_comment');

        if (!$current || !$current->default_content) {
            return response()->json(['success' => false, 'error' => 'Default content not found'], 404);
        }

        $prompt = $this->systemPromptRepository->updateByKey('default_instagram_comment', $current->default_content);

        return response()->json([
            'success' => true,
            'data'    => [
                'content'     => $prompt->content,
                'is_modified' => false
            ],
            'message' => 'Reset to default'
        ]);
    }

    public function index(): JsonResponse {
        $settings = $this->repository->getAll();

        return response()->json([
            'success' => true,
            'data'    => $settings,
            'message' => 'OK'
        ]);
    }

    public function show(int $id): JsonResponse {
        $setting = $this->repository->findById($id);

        if (!$setting) {
            return response()->json(['success' => false, 'error' => 'Not found'], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $setting->makeVisible(['api_key']),
            'message' => 'OK'
        ]);
    }

    public function store(Request $request): JsonResponse {
        $data = $request->validate([
            'provider'      => 'required|string|in:glm,openai',
            'api_key'       => 'required|string',
            'model_name'    => 'required|string',
            'system_prompt' => 'nullable|string',
            'tone'          => 'nullable|string|in:friendly,professional,casual,humorous',
            'use_caption'   => 'nullable|boolean'
        ]);

        $setting = $this->repository->upsert($data['provider'], $data);

        return response()->json([
            'success' => true,
            'data'    => $setting,
            'message' => 'Saved'
        ]);
    }

    public function setDefault(int $id): JsonResponse {
        $setting = $this->repository->findById($id);

        if (!$setting) {
            return response()->json(['success' => false, 'error' => 'Not found'], 404);
        }

        $this->repository->setDefault($id);

        return response()->json([
            'success' => true,
            'data'    => null,
            'message' => 'Default updated'
        ]);
    }

    public function destroy(int $id): JsonResponse {
        $setting = $this->repository->findById($id);

        if (!$setting) {
            return response()->json(['success' => false, 'error' => 'Not found'], 404);
        }

        $this->repository->delete($id);

        return response()->json([
            'success' => true,
            'data'    => null,
            'message' => 'Deleted'
        ]);
    }

    public function testConnection(Request $request): JsonResponse {
        $data = $request->validate([
            'provider'   => 'required|string|in:glm,openai',
            'api_key'    => 'required|string',
            'model_name' => 'required|string'
        ]);

        try {
            $ok = $this->llmService->testConnection(
                $data['provider'],
                $data['api_key'],
                $data['model_name']
            );

            if ($ok) {
                return response()->json([
                    'success' => true,
                    'data'    => null,
                    'message' => 'Connection successful'
                ]);
            }

            return response()->json([
                'success' => false,
                'error'   => 'Connection failed'
            ], 422);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error'   => Str::limit($e->getMessage(), 500)
            ], 500);
        }
    }
}
