<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\OperationalTask;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class OperationsController extends Controller
{
    public function index(): Response
    {
        $today = today()->toDateString();
        $blocking = config('solorent.statuses_blocking_availability');

        $todayBookings = Booking::query()
            ->with(['vehicle:id,name', 'unit:id,unit_code', 'driver:id,name'])
            ->where('start_date', '<=', $today)
            ->where('end_date', '>=', $today)
            ->whereIn('status', $blocking)
            ->orderBy('start_date')
            ->get();

        $tasks = OperationalTask::query()
            ->with(['booking:id,booking_code,customer_name,vehicle_id,start_date,end_date', 'booking.vehicle:id,name', 'driver:id,name'])
            ->whereNotIn('status', [OperationalTask::STATUS_COMPLETED, OperationalTask::STATUS_CANCELLED])
            ->orderByRaw('scheduled_at IS NULL, scheduled_at')
            ->get();

        $board = [
            'scheduled' => $this->taskCards($tasks->where('status', OperationalTask::STATUS_SCHEDULED)),
            'assigned' => $this->taskCards($tasks->where('status', OperationalTask::STATUS_ASSIGNED)),
            'on_the_way' => $this->taskCards($tasks->whereIn('status', [OperationalTask::STATUS_ON_THE_WAY, OperationalTask::STATUS_ARRIVED])),
            'completed' => OperationalTask::query()
                ->with(['booking:id,booking_code,customer_name', 'driver:id,name'])
                ->where('status', OperationalTask::STATUS_COMPLETED)
                ->whereDate('updated_at', $today)
                ->orderByDesc('updated_at')
                ->limit(8)
                ->get()
                ->map(fn (OperationalTask $task) => $this->taskCard($task))->all(),
        ];

        $needsUnit = Booking::query()
            ->whereIn('status', ['confirmed', 'preparing'])
            ->whereNull('vehicle_unit_id')
            ->count();
        $needsDriver = Booking::query()
            ->whereIn('status', ['confirmed', 'preparing'])
            ->where('with_driver', true)
            ->whereNull('driver_id')
            ->count();
        $unassignedTasks = OperationalTask::query()
            ->whereNull('driver_id')
            ->whereNotIn('status', [OperationalTask::STATUS_COMPLETED, OperationalTask::STATUS_CANCELLED])
            ->count();

        return Inertia::render('admin/operations/index', [
            'today' => today()->isoFormat('dddd, D MMMM YYYY'),
            'kpis' => [
                'todayBookings' => Booking::whereDate('created_at', $today)->count(),
                'deliveries' => $tasks->where('type', OperationalTask::TYPE_DELIVERY)->count(),
                'pickups' => $tasks->where('type', OperationalTask::TYPE_PICKUP)->count(),
                'activeRentals' => Booking::where('status', 'active')->count(),
                'unassigned' => $needsUnit + $needsDriver + $unassignedTasks,
            ],
            'attention' => [
                ['key' => 'unit', 'label' => 'booking belum memiliki unit', 'count' => $needsUnit],
                ['key' => 'driver', 'label' => 'booking membutuhkan driver', 'count' => $needsDriver],
                ['key' => 'task', 'label' => 'tugas belum ditugaskan', 'count' => $unassignedTasks],
            ],
            'board' => $board,
            'todayRentals' => $todayBookings->map(fn (Booking $booking) => [
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer_name,
                'vehicle_name' => $booking->vehicle?->name,
                'unit_code' => $booking->unit?->unit_code,
                'driver_name' => $booking->driver?->name,
                'start_date' => $booking->start_date->toDateString(),
                'end_date' => $booking->end_date->toDateString(),
                'status' => $booking->status,
            ])->all(),
        ]);
    }

    public function calendar(Request $request): Response
    {
        $month = $request->date('month') ?? today()->startOfMonth();
        $start = $month->copy()->startOfMonth()->startOfWeek();
        $end = $month->copy()->endOfMonth()->endOfWeek();

        $bookings = Booking::query()
            ->with('vehicle:id,name')
            ->where('status', '!=', 'cancelled')
            ->where('start_date', '<=', $end->toDateString())
            ->where('end_date', '>=', $start->toDateString())
            ->get();

        $tasks = OperationalTask::query()
            ->with(['booking:id,booking_code,customer_name', 'driver:id,name'])
            ->whereNotIn('status', [OperationalTask::STATUS_CANCELLED])
            ->whereBetween('scheduled_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
            ->get();

        $events = [];
        foreach ($bookings as $booking) {
            $events[] = [
                'id' => "start-{$booking->id}",
                'date' => $booking->start_date->toDateString(),
                'time' => null,
                'kind' => 'rental_start',
                'title' => "Mulai — {$booking->booking_code}",
                'subtitle' => $booking->vehicle?->name,
                'booking_code' => $booking->booking_code,
            ];
            $events[] = [
                'id' => "end-{$booking->id}",
                'date' => $booking->end_date->toDateString(),
                'time' => null,
                'kind' => 'rental_end',
                'title' => "Selesai — {$booking->booking_code}",
                'subtitle' => $booking->vehicle?->name,
                'booking_code' => $booking->booking_code,
            ];
        }
        foreach ($tasks as $task) {
            $events[] = [
                'id' => "task-{$task->id}",
                'date' => $task->scheduled_at?->toDateString() ?? today()->toDateString(),
                'time' => $task->scheduled_at?->format('H:i'),
                'kind' => $task->type,
                'title' => ($task->type === OperationalTask::TYPE_DELIVERY ? 'Antar' : 'Jemput')." — {$task->booking?->booking_code}",
                'subtitle' => $task->driver?->name ?? 'Belum ditugaskan',
                'booking_code' => $task->booking?->booking_code,
            ];
        }

        return Inertia::render('admin/operations/calendar', [
            'month' => $month->format('Y-m'),
            'monthLabel' => $month->isoFormat('MMMM YYYY'),
            'weekStart' => $start->toDateString(),
            'events' => $events,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function taskCards(Collection $tasks): array
    {
        // values(): where() mempertahankan key asli koleksi — tanpa ini,
        // kolom yang terfilter (mis. key [1,2]) ter-encode sebagai JSON OBJECT
        // {"1":...} bukan array, lalu board[col].map di frontend crash → blank page.
        // values(): where() mempertahankan key asli koleksi — tanpa ini,
        // kolom yang terfilter (mis. key [1,2]) ter-encode sebagai JSON OBJECT
        // {"1":...} bukan array, lalu board[col].map di frontend crash → blank page.
        return $tasks->map(fn (OperationalTask $task) => $this->taskCard($task))->values()->all();
    }

    /** @return array<string, mixed> */
    private function taskCard(OperationalTask $task): array
    {
        return [
            'id' => $task->id,
            'type' => $task->type,
            'booking_code' => $task->booking?->booking_code,
            'customer_name' => $task->booking?->customer_name,
            'vehicle_name' => $task->booking?->vehicle?->name,
            'staff_name' => $task->driver?->name,
            'scheduled_at' => $task->scheduled_at?->format('d M H:i'),
            'address' => $task->address,
            'status' => $task->status,
        ];
    }
}
