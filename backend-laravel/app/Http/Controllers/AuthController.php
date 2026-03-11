<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use App\Models\User;

final class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'                  => 'required|string|max:255',
            'email'                 => 'required|email|unique:users,email',
            'password'              => 'required|string|min:8|confirmed',
        ]);

        $user = User::create($validated);
        $user->assignRole('user');

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'success' => true,
            'data'    => ['user' => $user, 'token' => $token],
            'message' => 'Регистрация успешна',
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (! Auth::attempt($validated)) {
            return response()->json([
                'success' => false,
                'error'   => 'Неверный email или пароль',
            ], 401);
        }

        /** @var User $user */
        $user = Auth::user();

        if (! $user->is_active) {
            Auth::logout();

            return response()->json([
                'success' => false,
                'error'   => 'Аккаунт деактивирован',
            ], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'success' => true,
            'data'    => ['user' => $user->load('roles'), 'token' => $token],
            'message' => 'Авторизация успешна',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'data'    => null,
            'message' => 'Выход выполнен',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => $request->user()->load('roles'),
            'message' => 'OK',
        ]);
    }
}
