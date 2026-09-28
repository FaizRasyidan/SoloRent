<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DriverRequest;
use App\Models\Driver;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DriverController extends Controller
{
    public function index(): Response
    {
        $drivers = Driver::query()
            ->withCount(['bookings as active_bookings_count' => fn ($query) => $query
                ->whereIn('status', config('solorent.statuses_blocking_availability'))])
            ->orderBy('name')
            ->paginate(10)
            ->through(fn (Driver $driver) => [
                'id' => $driver->id,
                'name' => $driver->name,
                'whatsapp' => $driver->whatsapp,
                'sim_type' => $driver->sim_type,
                'status' => $driver->status,
                'active_bookings_count' => $driver->active_bookings_count,
                'today_tasks_count' => $driver->tasks()
                    ->whereDate('scheduled_at', today())
                    ->whereNotIn('status', ['completed', 'cancelled'])
                    ->count(),
            ]);

        return Inertia::render('admin/drivers/index', ['drivers' => $drivers]);
    }

    public function show(Driver $driver): Response
    {
        $driver->load(['bookings.vehicle:id,name', 'tasks.booking:id,booking_code,customer_name']);

        return Inertia::render('admin/drivers/show', [
            'driver' => [
                'id' => $driver->id,
                'name' => $driver->name,
                'whatsapp' => $driver->whatsapp,
                'sim_type' => $driver->sim_type,
                'sim_number' => $driver->sim_number,
                'notes' => $driver->notes,
                'status' => $driver->status,
                'upcoming' => $driver->upcomingBookings()->map(fn ($booking) => [
                    'booking_code' => $booking->booking_code,
                    'vehicle_name' => $booking->vehicle?->name,
                    'customer_name' => $booking->customer_name,
                    'start_date' => $booking->start_date->toDateString(),
                    'end_date' => $booking->end_date->toDateString(),
                    'status' => $booking->status,
                ])->all(),
                'tasks' => $driver->tasks()->with('booking:id,booking_code')->latest()->limit(10)
                    ->get()->map(fn ($task) => [
                        'id' => $task->id,
                        'type' => $task->type,
                        'booking_code' => $task->booking?->booking_code,
                        'scheduled_at' => $task->scheduled_at?->format('d M Y H:i'),
                        'status' => $task->status,
                    ])->all(),
            ],
        ]);
    }

    public function store(DriverRequest $request): RedirectResponse
    {
        Driver::create($request->validated());

        return redirect()->back()->with('success', 'Driver berhasil ditambahkan.');
    }

    public function update(DriverRequest $request, Driver $driver): RedirectResponse
    {
        $data = $request->validated();

        // Status driver yang sedang bekerja dikelola sistem (kembali aktif
        // otomatis saat rental selesai/dibatalkan) — tidak dapat diubah manual.
        if ($driver->isWorking()) {
            $data['status'] = Driver::STATUS_WORKING;
        }

        $driver->update($data);

        return redirect()->back()->with('success', 'Data driver berhasil diperbarui.');
    }

    public function destroy(Driver $driver): RedirectResponse
    {
        $hasActive = $driver->bookings()
            ->whereIn('status', config('solorent.statuses_blocking_availability'))
            ->exists()
            || $driver->tasks()->whereNotIn('status', ['completed', 'cancelled'])->exists();

        if ($hasActive) {
            $driver->update(['status' => Driver::STATUS_INACTIVE]);

            return redirect()->back()
                ->with('success', 'Driver memiliki tugas aktif sehingga dinonaktifkan, bukan dihapus.');
        }

        $driver->delete();

        return redirect()->route('admin.drivers.index')->with('success', 'Driver berhasil dihapus.');
    }
}
