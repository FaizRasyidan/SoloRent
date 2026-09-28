<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreVehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'category' => ['required', 'in:motor,mobil'],
            'transmission' => ['required', 'in:automatic,manual'],
            'seats' => ['required', 'integer', 'min:1', 'max:50'],
            'engine' => ['nullable', 'string', 'max:50'],
            'fuel' => ['nullable', 'string', 'max:50'],
            'baggage' => ['nullable', 'string', 'max:50'],
            'price_per_day' => ['required', 'integer', 'min:0', 'max:100000000'],
            'stock' => ['required', 'integer', 'min:0', 'max:1000'],
            'description' => ['nullable', 'string', 'max:5000'],
            'benefits' => ['nullable', 'array', 'max:20'],
            'benefits.*' => ['string', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
            'featured' => ['nullable', 'boolean'],
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama kendaraan wajib diisi.',
            'category.required' => 'Kategori wajib dipilih.',
            'category.in' => 'Kategori tidak valid.',
            'transmission.required' => 'Transmisi wajib dipilih.',
            'price_per_day.required' => 'Harga rental wajib diisi.',
            'price_per_day.integer' => 'Harga rental harus berupa angka.',
            'price_per_day.min' => 'Harga rental tidak boleh negatif.',
            'stock.required' => 'Jumlah unit wajib diisi.',
            'stock.min' => 'Jumlah unit tidak boleh negatif.',
            'status.required' => 'Status wajib dipilih.',
            'status.in' => 'Status tidak valid.',
            'images.*.image' => 'File harus berupa gambar.',
            'images.*.mimes' => 'Foto harus berformat jpg, jpeg, png, atau webp.',
            'images.*.max' => 'Ukuran tiap foto maksimal 5MB.',
        ];
    }

    /** @return array<string, mixed> */
    public function vehicleAttributes(): array
    {
        $validated = $this->validated();

        return [
            'name' => $validated['name'],
            'brand' => $validated['brand'] ?? null,
            'model' => $validated['model'] ?? null,
            'category' => $validated['category'],
            'transmission' => $validated['transmission'],
            'seats' => $validated['seats'],
            'engine' => $validated['engine'] ?? null,
            'fuel' => $validated['fuel'] ?? null,
            'baggage' => $validated['baggage'] ?? null,
            'price_per_day' => $validated['price_per_day'],
            'stock' => $validated['stock'],
            'description' => $validated['description'] ?? null,
            'benefits' => array_values(array_filter($validated['benefits'] ?? [])),
            'status' => $validated['status'],
            'featured' => (bool) ($validated['featured'] ?? false),
        ];
    }
}
