<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()) {
            if ($request->expectsJson() || $request->header('X-Inertia')) {
                // Inertia handles redirect via 302; keep consistent with auth middleware
                return redirect()->guest(route('admin.login'));
            }

            return redirect()->guest(route('admin.login'));
        }

        if ($request->user()->role !== 'admin') {
            abort(403, 'Akses tidak diizinkan.');
        }

        return $next($request);
    }
}
