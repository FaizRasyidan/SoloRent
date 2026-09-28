<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class VehicleController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'category' => ['nullable', 'in:motor,mobil'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $category = $filters['category'] ?? null;
        $start = $filters['start_date'] ?? null;
        $end = $filters['end_date'] ?? null;
        $hasPeriod = $start && $end;

        $vehicles = Vehicle::query()
            ->where('is_available', true)
            ->orderByDesc('featured')
            ->orderBy('price_per_day')
            ->get()
            ->map(fn (Vehicle $vehicle) => $this->summary($vehicle, $hasPeriod ? $start : null, $hasPeriod ? $end : null));

        return Inertia::render('vehicles', [
            'vehicles' => $vehicles,
            'filters' => [
                'category' => $category,
                'start_date' => $start,
                'end_date' => $end,
            ],
        ]);
    }

    public function show(Vehicle $vehicle): Response
    {
        abort_if(! $vehicle->is_available, 404);

        return Inertia::render('vehicle-show', [
            'vehicle' => [
                ...$this->summary($vehicle),
                'gallery' => $vehicle->galleryUrls(),
                'description' => $vehicle->description,
                'benefits' => $vehicle->benefits ?? [],
                'stock' => $vehicle->stock,
            ],
        ]);
    }

    private function summary(Vehicle $vehicle, ?string $startDate = null, ?string $endDate = null): array
    {
        // Ketersediaan untuk periode yang diminta (landing → katalog).
        // Null bila tanpa filter tanggal: frontend memakai availability dasar.
        $periodAvailable = null;
        if ($startDate && $endDate) {
            $periodAvailable = $vehicle->availabilitySummary($startDate, $endDate)['available'];
        }

        return [
            'id' => $vehicle->id,
            'slug' => $vehicle->slug,
            'name' => $vehicle->name,
            'category' => $vehicle->category,
            'transmission' => $vehicle->transmission,
            'seats' => $vehicle->seats,
            'engine' => $vehicle->engine,
            'baggage' => $vehicle->baggage,
            'price_per_day' => $vehicle->price_per_day,
            'rating' => (float) $vehicle->rating,
            'trips_count' => $vehicle->trips_count,
            'image_url' => $vehicle->primaryImageUrl(),
            'availability' => $vehicle->baseAvailability(),
            'period_available' => $periodAvailable,
        ];
    }
}
