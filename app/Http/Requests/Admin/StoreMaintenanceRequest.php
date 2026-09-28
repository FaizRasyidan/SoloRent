<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreMaintenanceRequest extends FormRequest
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
            'damage_record_id' => ['nullable', 'integer', 'exists:damage_records,id'],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'cost' => ['required', 'integer', 'min:0', 'max:100000000'],
            'priority' => ['nullable', 'in:rendah,sedang,tinggi,darurat'],
            'estimated_completed_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul maintenance wajib diisi.',
            'cost.required' => 'Biaya maintenance wajib diisi.',
            'cost.integer' => 'Biaya maintenance harus berupa angka.',
            'cost.min' => 'Biaya maintenance tidak boleh negatif.',
            'priority.in' => 'Prioritas tidak valid.',
            'estimated_completed_at.date' => 'Estimasi selesai tidak valid.',
        ];
    }
}
