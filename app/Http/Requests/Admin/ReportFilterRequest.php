<?php

namespace App\Http\Requests\Admin;

use App\Support\Reports\ReportPeriod;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi filter laporan. URL yang diketik manual dan tidak valid
 * dinormalisasi ke default yang bersih (bukan error).
 */
class ReportFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user() && $this->user()->role === 'admin';
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'period' => ['nullable', 'string', 'in:'.implode(',', ReportPeriod::PRESETS)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'group' => ['nullable', 'string', 'in:day,week,month,auto'],
            'category' => ['nullable', 'string', 'in:motor,mobil'],
            'vehicle' => ['nullable', 'integer', 'exists:vehicles,id'],
            'tab' => ['nullable', 'string', 'in:overview,booking,demand,revenue,vehicle,driver,customer,cancellation,refund,damage,maintenance,forecast,outstanding,insights'],
            'report' => ['nullable', 'string', 'in:overview,booking,customers,demand,revenue,vehicle,driver,customer,cancellation,refund,damage,maintenance,forecast,outstanding,insights,payments'],
            'status' => ['nullable', 'string', 'max:20'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, mixed> */
    public function reportInput(): array
    {
        $validated = $this->validated();

        return [
            'period' => $validated['period'] ?? 'this_month',
            'from' => $validated['from'] ?? null,
            'to' => $validated['to'] ?? null,
            'group' => $validated['group'] ?? 'auto',
            'category' => $validated['category'] ?? null,
            'vehicle' => isset($validated['vehicle']) ? (int) $validated['vehicle'] : null,
            'tab' => $validated['tab'] ?? 'overview',
            'report' => $validated['report'] ?? null,
            'status' => $validated['status'] ?? null,
            'search' => $validated['search'] ?? null,
        ];
    }
}
