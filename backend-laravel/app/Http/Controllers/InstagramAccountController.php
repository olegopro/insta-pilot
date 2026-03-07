<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InstagramAccountController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    public function index(): JsonResponse {
        $accounts = $this->accountRepository->getAllAccounts();

        return response()->json([
            'success' => true,
            'data'    => $accounts,
            'message' => 'OK'
        ]);
    }

    public function login(Request $request): JsonResponse {
        $validated = $request->validate([
            'instagram_login'    => 'required|string',
            'instagram_password' => 'required|string',
            'proxy'              => 'nullable|string'
        ]);

        $result = $this->instagramClient->login(
            $validated['instagram_login'],
            $validated['instagram_password'],
            $validated['proxy'] ?? null
        );

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка авторизации'
            ], 422);
        }

        $existing = $this->accountRepository->findByLogin($validated['instagram_login']);

        if ($existing) {
            $this->accountRepository->updateSessionData($existing->id, $result['session_data']);
            $account = $existing->fresh();
        } else {
            $account = $this->accountRepository->createAccount([
                'instagram_login'    => $validated['instagram_login'],
                'instagram_password' => $validated['instagram_password'],
                'session_data'       => $result['session_data'],
                'full_name'          => $result['full_name'] ?? null,
                'profile_pic_url'    => $result['profile_pic_url'] ?? null,
                'proxy'              => $validated['proxy'] ?? null
            ]);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'id'              => $account->id,
                'instagram_login' => $account->instagram_login,
                'full_name'       => $account->full_name,
                'profile_pic_url' => $account->profile_pic_url
            ],
            'message' => 'Успешно авторизован'
        ]);
    }
}
