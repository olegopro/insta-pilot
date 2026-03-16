<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\DeviceProfile;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InstagramAccountController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    public function index(Request $request): JsonResponse {
        $accounts = $this->accountRepository->getAccountsByUser($request->user()->id);

        return response()->json([
            'success' => true,
            'data'    => $accounts,
            'message' => 'OK'
        ]);
    }

    public function deviceProfiles(): JsonResponse {
        $profiles = DeviceProfile::query()
            ->where('is_active', true)
            ->orderBy('title')
            ->get(['id', 'code', 'title']);

        return response()->json([
            'success' => true,
            'data'    => $profiles,
            'message' => 'OK'
        ]);
    }

    public function login(Request $request): JsonResponse {
        $validated = $request->validate([
            'instagram_login'    => 'required|string|unique:instagram_accounts,instagram_login',
            'instagram_password' => 'required|string',
            'proxy'              => 'nullable|string',
            'device_profile_id'  => 'required|integer|exists:device_profiles,id'
        ]);

        $deviceProfile = DeviceProfile::query()->find((int) $validated['device_profile_id']);

        if (!$deviceProfile) {
            return response()->json([
                'success' => false,
                'error'   => 'Профиль устройства не найден'
            ], 422);
        }

        $result = $this->instagramClient->login(
            $validated['instagram_login'],
            $validated['instagram_password'],
            $validated['proxy'] ?? null,
            [
                'device_settings' => $deviceProfile->device_settings,
                'user_agent'      => $deviceProfile->user_agent
            ]
        );

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка авторизации'
            ], 422);
        }

        $account = $this->accountRepository->createAccount([
            'user_id'            => $request->user()->id,
            'instagram_login'    => $validated['instagram_login'],
            'instagram_password' => $validated['instagram_password'],
            'session_data'       => $result['session_data'],
            'full_name'          => $result['full_name'] ?? null,
            'profile_pic_url'    => $result['profile_pic_url'] ?? null,
            'proxy'              => $validated['proxy'] ?? null,
            'device_profile_id'  => $deviceProfile->id,
            'device_model_name'  => $deviceProfile->title
        ]);

        return response()->json([
            'success' => true,
            'data'    => $account,
            'message' => 'Аккаунт добавлен'
        ]);
    }

    public function show(int $id, Request $request): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($id, $request->user()->id);

        if (!$account) {
            return $this->notFound();
        }

        $data                    = $account->toArray();
        $data['followers_count'] = null;
        $data['following_count'] = null;

        if ($account->session_data) {
            try {
                $info                    = $this->instagramClient->getUserInfo($account->session_data);
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

    public function destroy(int $id, Request $request): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($id, $request->user()->id);

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
