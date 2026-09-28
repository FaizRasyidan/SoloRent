<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreDamageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'vehicle_unit_id' => ['nullable', 'integer', 'exists:vehicle_units,id'],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'repair_cost' => ['required', 'integer', 'min:0', 'max:100000000'],
            'photo' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul kerusakan wajib diisi.',
            'repair_cost.required' => 'Biaya perbaikan wajib diisi.',
            'repair_cost.integer' => 'Biaya perbaikan harus berupa angka.',
            'repair_cost.min' => 'Biaya perbaikan tidak boleh negatif.',
            'photo.image' => 'File harus berupa gambar.',
            'photo.mimes' => 'Foto harus berformat jpg, jpeg, png, atau webp.',
            'photo.max' => 'Ukuran foto maksimal 5MB.',
        ];
    }
}
