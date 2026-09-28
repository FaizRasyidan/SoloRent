<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Insights\InsightEngine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class InsightController extends Controller
{
    public function refresh(Request $request, InsightEngine $engine): RedirectResponse
    {
        $filters = $request->validate([
            'category' => ['nullable', 'in:motor,mobil'],
            'vehicle' => ['nullable', 'integer', 'exists:vehicles,id'],
        ]);

        $engine->refresh(
            $filters['category'] ?? null,
            isset($filters['vehicle']) ? (int) $filters['vehicle'] : null,
        );

        return redirect()->back()->with('status', 'Insight diperbarui.');
    }
}
