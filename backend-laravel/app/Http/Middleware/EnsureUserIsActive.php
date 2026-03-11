<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && ! $request->user()->is_active) {
            return response()->json([
                'success' => false,
                'error'   => 'Аккаунт деактивирован',
            ], 403);
        }

        return $next($request);
    }
}
