<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\VehicleImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class VehicleImageController extends Controller
{
    public function store(Request $request, Vehicle $vehicle): RedirectResponse
    {
        $data = $request->validate([
            'images' => ['required', 'array', 'max:8'],
            'images.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ], [
            'images.required' => 'Pilih minimal satu foto.',
            'images.*.image' => 'File harus berupa gambar.',
            'images.*.mimes' => 'Foto harus berformat jpg, jpeg, png, atau webp.',
            'images.*.max' => 'Ukuran tiap foto maksimal 5MB.',
        ]);

        DB::transaction(function () use ($vehicle, $data) {
            $hasPrimary = $vehicle->images()->where('is_primary', true)->exists();
            $order = (int) ($vehicle->images()->max('sort_order') ?? -1) + 1;

            foreach ($data['images'] as $file) {
                $path = $file->store('vehicles', 'public');

                $vehicle->images()->create([
                    'path' => $path,
                    'is_primary' => ! $hasPrimary,
                    'sort_order' => $order++,
                ]);

                $hasPrimary = true;
            }
        });

        return redirect()->back()->with('success', 'Foto berhasil diupload.');
    }

    public function setPrimary(VehicleImage $image): RedirectResponse
    {
        DB::transaction(function () use ($image) {
            $image->vehicle()->firstOrFail()->images()->update(['is_primary' => false]);
            $image->update(['is_primary' => true]);
        });

        return redirect()->back()->with('success', 'Foto utama berhasil diperbarui.');
    }

    public function destroy(VehicleImage $image): RedirectResponse
    {
        DB::transaction(function () use ($image) {
            $vehicle = $image->vehicle()->firstOrFail();
            $wasPrimary = $image->is_primary;
            $path = $image->path;

            $image->delete();

            if ($wasPrimary) {
                $next = $vehicle->images()->first();

                if ($next) {
                    $next->update(['is_primary' => true]);
                }
            }

            if (! str_starts_with($path, 'http://') && ! str_starts_with($path, 'https://')) {
                Storage::disk('public')->delete($path);
            }
        });

        return redirect()->back()->with('success', 'Foto berhasil dihapus.');
    }
}
