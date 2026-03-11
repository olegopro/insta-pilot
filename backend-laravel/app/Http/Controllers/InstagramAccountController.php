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
        try {
            $validated = $request->validate([
                'instagram_login'    => 'required|string|unique:instagram_accounts,instagram_login',
                'instagram_password' => 'required|string',
                'proxy'              => 'nullable|string'
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'error'   => 'Аккаунт с таким логином уже существует'
            ], 422);
        }

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

        $account = $this->accountRepository->createAccount([
            'instagram_login'    => $validated['instagram_login'],
            'instagram_password' => $validated['instagram_password'],
            'session_data'       => $result['session_data'],
            'full_name'          => $result['full_name'] ?? null,
            'profile_pic_url'    => $result['profile_pic_url'] ?? null,
            'proxy'              => $validated['proxy'] ?? null
        ]);

        return response()->json([
            'success' => true,
            'data'    => $account,
            'message' => 'Аккаунт добавлен'
        ]);
    }

    public function show(int $id): JsonResponse {
        $account = $this->accountRepository->findById($id);

        if (!$account) {
            return $this->notFound();
        }

        $data = $account->toArray();
        $data['followers_count'] = null;
        $data['following_count'] = null;

        if ($account->session_data) {
            try {
                $info = $this->instagramClient->getUserInfo($account->session_data);
                $data['followers_count'] = $info['followers_count'] ?? null;
                $data['following_count'] = $info['following_count'] ?? null;
            } catch (\Throwable) {
            }
        }

        return response()->json([
            'success' => true,
            'data'    => $data,
            'message' => 'OK'
        ]);
    }

    public function destroy(int $id): JsonResponse {
        $account = $this->accountRepository->findById($id);

        if (!$account) {
            return $this->notFound();
        }

        $this->accountRepository->deleteAccount($id);

        return response()->json([
            'success' => true,
            'data'    => null,
            'message' => 'Аккаунт удалён'
        ]);
    }

    private function notFound(): JsonResponse {
        return response()->json([
            'success' => false,
            'error'   => 'Аккаунт не найден'
        ], 404);
    }
}
