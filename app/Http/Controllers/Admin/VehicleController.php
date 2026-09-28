<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreVehicleRequest;
use App\Http\Requests\Admin\UpdateVehicleRequest;
use App\Models\Vehicle;
use App\Models\VehicleImage;
use App\Models\VehicleUnit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class VehicleController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'in:motor,mobil'],
            'status' => ['nullable', 'in:active,inactive'],
            'sort' => ['nullable', 'in:latest,name_asc,name_desc,price_asc,price_desc'],
        ]);

        $search = $filters['search'] ?? null;
        $category = $filters['category'] ?? null;
        $status = $filters['status'] ?? null;
        $sort = $filters['sort'] ?? 'latest';

        $vehicles = Vehicle::query()
            ->with('images')
            ->withCount(['units', 'units as active_units_count' => fn ($query) => $query->where('status', 'active')])
            ->when($search, fn ($query) => $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('brand', 'like', "%{$search}%")
                ->orWhere('model', 'like', "%{$search}%")))
            ->when($category, fn ($query) => $query->where('category', $category))
            ->when($status, fn ($query) => $query->where('status', $status))
            ->when($sort === 'latest', fn ($query) => $query->latest())
            ->when($sort === 'name_asc', fn ($query) => $query->orderBy('name'))
            ->when($sort === 'name_desc', fn ($query) => $query->orderByDesc('name'))
            ->when($sort === 'price_asc', fn ($query) => $query->orderBy('price_per_day'))
            ->when($sort === 'price_desc', fn ($query) => $query->orderByDesc('price_per_day'))
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Vehicle $vehicle) => $this->row($vehicle));

        return Inertia::render('admin/vehicles/index', [
            'vehicles' => $vehicles,
            'filters' => [
                'search' => $search,
                'category' => $category,
                'status' => $status,
                'sort' => $sort,
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/vehicles/form', [
            'vehicle' => null,
        ]);
    }

    public function store(StoreVehicleRequest $request): RedirectResponse
    {
        $vehicle = DB::transaction(function () use ($request) {
            $vehicle = Vehicle::create([
                ...$request->vehicleAttributes(),
                'slug' => $this->uniqueSlug($request->validated('name')),
            ]);

            $this->storeUploadedImages($vehicle, $request);

            return $vehicle;
        });

        return redirect()->route('admin.vehicles.show', $vehicle)
            ->with('success', 'Kendaraan berhasil ditambahkan.');
    }

    public function show(Vehicle $vehicle): Response
    {
        $vehicle->load(['images', 'bookings' => fn ($query) => $query->latest()->limit(5)]);

        return Inertia::render('admin/vehicles/show', [
            'vehicle' => $this->detail($vehicle),
        ]);
    }

    public function edit(Vehicle $vehicle): Response
    {
        $vehicle->load('images');

        return Inertia::render('admin/vehicles/form', [
            'vehicle' => $this->detail($vehicle),
        ]);
    }

    public function update(UpdateVehicleRequest $request, Vehicle $vehicle): RedirectResponse
    {
        DB::transaction(function () use ($request, $vehicle) {
            $vehicle->update($request->vehicleAttributes());

            $this->storeUploadedImages($vehicle, $request);
        });

        return redirect()->route('admin.vehicles.show', $vehicle)
            ->with('success', 'Data kendaraan berhasil diperbarui.');
    }

    public function updateStatus(Request $request, Vehicle $vehicle): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:active,inactive'],
        ], [
            'status.in' => 'Status tidak valid.',
        ]);

        $vehicle->update(['status' => $data['status']]);

        $message = $data['status'] === Vehicle::STATUS_ACTIVE
            ? 'Kendaraan berhasil diaktifkan.'
            : 'Kendaraan berhasil dinonaktifkan.';

        return redirect()->back()->with('success', $message);
    }

    public function destroy(Vehicle $vehicle): RedirectResponse
    {
        if ($vehicle->hasHistory()) {
            // Never erase rental history: soft delete keeps bookings intact.
            $vehicle->delete();

            return redirect()->route('admin.vehicles.index')
                ->with('success', 'Kendaraan diarsipkan. Histori booking tetap tersimpan.');
        }

        DB::transaction(function () use ($vehicle) {
            $paths = $vehicle->images()->pluck('path')->all();
            $vehicle->forceDelete();

            foreach ($paths as $path) {
                $this->deleteStoredFile($path);
            }
        });

        return redirect()->route('admin.vehicles.index')
            ->with('success', 'Kendaraan berhasil dihapus.');
    }

    /** @return array<string, mixed> */
    private function row(Vehicle $vehicle): array
    {
        return [
            'id' => $vehicle->id,
            'slug' => $vehicle->slug,
            'name' => $vehicle->name,
            'brand' => $vehicle->brand,
            'model' => $vehicle->model,
            'category' => $vehicle->category,
            'price_per_day' => $vehicle->price_per_day,
            'stock' => $vehicle->stock,
            'total_units' => (int) ($vehicle->units_count ?? 0),
            'active_units' => (int) ($vehicle->active_units_count ?? 0),
            'status' => $vehicle->status ?? Vehicle::STATUS_ACTIVE,
            'featured' => $vehicle->featured,
            'image_url' => $vehicle->primaryImageUrl(),
            'bookings_count' => $vehicle->bookings()->count(),
        ];
    }

    /** @return array<string, mixed> */
    private function detail(Vehicle $vehicle): array
    {
        $today = today()->toDateString();
        $tomorrow = today()->addDay()->toDateString();

        return [
            ...$this->row($vehicle),
            'transmission' => $vehicle->transmission,
            'seats' => $vehicle->seats,
            'engine' => $vehicle->engine,
            'fuel' => $vehicle->fuel,
            'baggage' => $vehicle->baggage,
            'description' => $vehicle->description,
            'benefits' => $vehicle->benefits ?? [],
            'images' => $vehicle->images->map(fn (VehicleImage $image) => [
                'id' => $image->id,
                'url' => $image->url(),
                'is_primary' => $image->is_primary,
            ])->all(),
            'gallery' => $vehicle->galleryUrls(),
            'units' => $vehicle->units->map(fn (VehicleUnit $unit) => [
                'id' => $unit->id,
                'unit_code' => $unit->unit_code,
                'plate_number' => $unit->plate_number,
                'status' => $unit->status,
                'notes' => $unit->notes,
                'maintenance' => ($active = $unit->activeMaintenance()) ? [
                    'title' => $active->title,
                    'status' => $active->status,
                ] : null,
            ])->all(),
            'unit_summary' => $vehicle->availabilitySummary($today, $tomorrow),
            'recent_bookings' => $vehicle->relationLoaded('bookings')
                ? $vehicle->bookings->map(fn ($booking) => [
                    'booking_code' => $booking->booking_code,
                    'customer_name' => $booking->customer_name,
                    'status' => $booking->status,
                    'total' => $booking->total,
                ])->all()
                : [],
        ];
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'kendaraan';
        $slug = $base;
        $counter = 2;

        while (Vehicle::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    private function storeUploadedImages(Vehicle $vehicle, StoreVehicleRequest $request): void
    {
        $files = $request->file('images', []);

        if ($files === []) {
            return;
        }

        $hasPrimary = $vehicle->images()->where('is_primary', true)->exists();
        $order = (int) ($vehicle->images()->max('sort_order') ?? -1) + 1;

        foreach ($files as $file) {
            if (! $file || ! $file->isValid()) {
                continue;
            }

            $path = $file->store('vehicles', 'public');

            $vehicle->images()->create([
                'path' => $path,
                'is_primary' => ! $hasPrimary,
                'sort_order' => $order++,
            ]);

            $hasPrimary = true;
        }
    }

    private function deleteStoredFile(string $path): void
    {
        if (! str_starts_with($path, 'http://') && ! str_starts_with($path, 'https://')) {
            Storage::disk('public')->delete($path);
        }
    }
}
