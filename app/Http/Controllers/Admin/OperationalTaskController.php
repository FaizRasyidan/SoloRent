<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\OperationalTask;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OperationalTaskController extends Controller
{
    public function assign(Request $request, OperationalTask $task): RedirectResponse
    {
        abort_unless($task->isOpen(), 422, 'Task yang sudah selesai tidak dapat diubah.');

        $data = $request->validate([
            'driver_id' => ['required', 'integer', 'exists:drivers,id'],
            'scheduled_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], ['driver_id.required' => 'Pilih petugas.']);

        $driver = Driver::findOrFail($data['driver_id']);
        abort_unless($driver->isActive(), 422, "Petugas {$driver->name} sedang nonaktif.");

        DB::transaction(function () use ($task, $driver, $data) {
            $task->update([
                'driver_id' => $driver->id,
                'scheduled_at' => $data['scheduled_at'] ?? $task->scheduled_at,
                'notes' => $data['notes'] ?? $task->notes,
                'status' => $task->status === OperationalTask::STATUS_SCHEDULED
                    ? OperationalTask::STATUS_ASSIGNED
                    : $task->status,
            ]);
        });

        return redirect()->back()->with('success', "Petugas {$driver->name} berhasil ditugaskan.");
    }

    public function changeStatus(Request $request, OperationalTask $task): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string'],
        ]);

        abort_unless($task->canTransitionTo($data['status']), 422, 'Perubahan status tidak valid.');

        if (in_array($data['status'], [OperationalTask::STATUS_ASSIGNED, OperationalTask::STATUS_ON_THE_WAY], true)) {
            abort_unless($task->driver_id, 422, 'Tugaskan petugas terlebih dahulu.');
        }

        $task->update(['status' => $data['status']]);

        return redirect()->back()->with('success', 'Status tugas berhasil diperbarui.');
    }
}
