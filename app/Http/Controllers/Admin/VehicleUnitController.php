<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\VehicleUnitRequest;
use App\Models\Vehicle;
use App\Models\VehicleUnit;
use Illuminate\Http\RedirectResponse;

class VehicleUnitController extends Controller
{
    public function store(VehicleUnitRequest $request, Vehicle $vehicle): RedirectResponse
    {
        $vehicle->units()->create($request->validated());

        return redirect()->back()->with('success', "Unit {$request->validated('unit_code')} berhasil ditambahkan.");
    }

    public function update(VehicleUnitRequest $request, VehicleUnit $unit): RedirectResponse
    {
        $unit->update($request->validated());

        return redirect()->back()->with('success', "Unit {$unit->unit_code} berhasil diperbarui.");
    }

    public function destroy(VehicleUnit $unit): RedirectResponse
    {
        $assigned = $unit->bookings()
            ->whereIn('status', config('solorent.statuses_blocking_availability'))
            ->exists();

        abort_if($assigned, 422, "Unit {$unit->unit_code} sedang terikat booking aktif dan tidak dapat dihapus.");

        $unit->delete();

        return redirect()->back()->with('success', "Unit {$unit->unit_code} berhasil dihapus.");
    }
}
