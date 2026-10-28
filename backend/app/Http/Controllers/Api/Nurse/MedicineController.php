<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\DatabaseSearch;
use App\Support\TimeGuard;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineStockMovement;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MedicineController extends Controller
{
    public function index(Request $request)
    {
        $query = Medicine::query();

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', DatabaseSearch::like($q), "%{$request->search}%")
                  ->orWhere('generic_name', DatabaseSearch::like($q), "%{$request->search}%")
                  ->orWhere('manufacturer', DatabaseSearch::like($q), "%{$request->search}%")
                  ->orWhere('category', DatabaseSearch::like($q), "%{$request->search}%");
            });
        }

        if ($request->category) {
            $query->where('category', $request->category);
        }

        if ($request->low_stock) {
            $query->lowStock();
        }

        if ($request->expiring_soon) {
            $query->expiringSoon();
        }

        if ($request->boolean('expired')) {
            $query->expired();
        }

        // The Stock Status filter: the same five states the status badge shows (see `status` below).
        if ($request->status) {
            $this->whereStatus($query, (string) $request->status);
        }

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $medicines = $query->orderBy('name')->paginate($perPage);

        // One query for the whole page: earliest expiry among batches that still hold stock.
        $batchInfo = MedicineBatch::whereIn('medicine_id', $medicines->getCollection()->pluck('id'))
            ->where('quantity', '>', 0)
            ->selectRaw('medicine_id, MIN(expiry_date) as next_expiry, COUNT(*) as batch_count')
            ->groupBy('medicine_id')
            ->get()->keyBy('medicine_id');

        $medicines->getCollection()->transform(function ($medicine) use ($batchInfo) {
            $info = $batchInfo->get($medicine->id);
            // First-expiry rule (see Medicine::nearestExpiry): a stocked batch's date beats the medicine's own.
            $expiry = $info && $info->next_expiry ? Carbon::parse($info->next_expiry) : $medicine->expiry_date;
            $medicine->next_expiry = $expiry ? $expiry->toDateString() : null;
            $medicine->batch_count = $info ? (int) $info->batch_count : 0;
            $medicine->is_low_stock = $medicine->quantity <= $medicine->minimum_stock;
            $medicine->is_out_of_stock = $medicine->quantity <= 0;
            $medicine->is_expired = $expiry && $expiry->isBefore(today());
            $medicine->is_expiring_soon = $expiry
                && !$medicine->is_expired
                && $expiry->lessThanOrEqualTo(now()->addMonths(3));
            // One state per medicine, strongest first: expired, out of stock, low stock, expiring soon, then OK.
            $medicine->status = $medicine->is_expired ? 'expired'
                : ($medicine->is_out_of_stock ? 'out_of_stock'
                : ($medicine->is_low_stock ? 'low_stock'
                : ($medicine->is_expiring_soon ? 'expiring_soon' : 'ok')));
            return $medicine;
        });

        return response()->json([
            'success' => true,
            'data' => $medicines
        ]);
    }

    /*
     * The Stock Status filter. Each state excludes the stronger ones above it, so the list matches
     * the badge shown on every row: a medicine that is expired is only "expired", not also "low stock".
     */
    private function whereStatus($query, string $status): void
    {
        $notExpired = fn ($q) => $q->whereNotIn('medicines.id', Medicine::query()->expired()->select('medicines.id'));
        $wellStocked = fn ($q) => $q->whereColumn('medicines.quantity', '>', 'medicines.minimum_stock');

        switch ($status) {
            case 'expired':
                $query->expired();
                break;
            case 'out_of_stock':
                $query->where('medicines.quantity', '<=', 0);
                $notExpired($query);
                break;
            case 'low_stock':
                $query->where('medicines.quantity', '>', 0)->whereColumn('medicines.quantity', '<=', 'medicines.minimum_stock');
                $notExpired($query);
                break;
            case 'expiring_soon':
                $wellStocked($query);
                $notExpired($query);
                $query->expiringSoon();
                break;
            case 'in_stock':
                $wellStocked($query);
                $notExpired($query);
                $query->whereNotIn('medicines.id', Medicine::query()->expiringSoon()->select('medicines.id'));
                break;
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'generic_name' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:150',
            'category' => 'nullable|string|max:100',
            'quantity' => 'required|integer|min:1',
            'minimum_stock' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:50',
            'dosage' => 'nullable|string|max:100',
            'expiry_date' => TimeGuard::nursePortalBypassed() ? 'nullable|date' : 'nullable|date|after_or_equal:today',
            'description' => 'nullable|string|max:200',
        ]);

        $this->ensureUniqueName($request->name);

        // The starting stock is the first line of the stock history (0 → quantity), so the history is complete.
        $medicine = DB::transaction(function () use ($request) {
            $medicine = Medicine::create([
                ...$request->all(),
                'added_by' => auth()->id(),
            ]);
            $this->recordMovement($medicine, null, 'stock_in', (int) $medicine->quantity, 'Initial stock');
            return $medicine;
        }, 3);

        return response()->json([
            'success' => true,
            'message' => 'Medicine added successfully.',
            'data' => $medicine->fresh()
        ], 201);
    }

    public function show($id)
    {
        $medicine = Medicine::findOrFail($id);
        return response()->json(['success' => true, 'data' => $medicine]);
    }

    public function batches($id)
    {
        Medicine::findOrFail($id);
        return response()->json(['success' => true, 'data' => MedicineBatch::where('medicine_id', $id)
            ->orderByRaw('CASE WHEN expiry_date IS NULL THEN 0 ELSE 1 END')
            ->orderBy('expiry_date')->get()]);
    }

    /*
     * The stock history of one medicine, newest first. Every line carries the signed change and the
     * stock before and after it. They are worked out from the current stock, walking back through the
     * movements (every change to a medicine's stock is a movement), so they always add up to what is on
     * the shelf now. The balances are computed over the whole history; the filters below only choose
     * which lines to show.
     *   from, to  – dates (inclusive, Asia/Manila)
     *   type      – stock_in, dispensed, wasted, expired or adjustment
     *   per_page  – lines per page (default 50, at most 100); all=1 returns every line, for export
     */
    public function movements(Request $request, $id)
    {
        $medicine = Medicine::findOrFail($id);
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'type' => 'nullable|string|in:stock_in,dispensed,wasted,expired,adjustment',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $running = (int) $medicine->quantity;
        $rows = MedicineStockMovement::with(['batch', 'performer:id,first_name,last_name', 'student:id,student_id,first_name,last_name'])
            ->where('medicine_id', $id)
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get()
            ->map(function ($movement) use (&$running) {
                $change = $movement->movement_type === 'stock_in' ? (int) $movement->quantity : -(int) $movement->quantity;
                $movement->quantity_change = $change;
                $movement->stock_after = $running;
                $movement->stock_before = $running - $change;
                $running = $movement->stock_before;
                return $movement;
            });

        $day = fn ($movement) => $movement->created_at->copy()->timezone('Asia/Manila')->toDateString();
        $from = $request->filled('from') ? Carbon::parse($request->from)->toDateString() : null;
        $to = $request->filled('to') ? Carbon::parse($request->to)->toDateString() : null;
        $rows = $rows
            ->when($request->filled('type'), fn ($list) => $list->where('movement_type', $request->type))
            ->when($from, fn ($list) => $list->filter(fn ($movement) => $day($movement) >= $from))
            ->when($to, fn ($list) => $list->filter(fn ($movement) => $day($movement) <= $to))
            ->values();

        $everything = $request->boolean('all');
        $perPage = $everything ? max(1, min($rows->count(), 5000)) : (int) $request->input('per_page', 50);
        $page = $everything ? 1 : max(1, (int) $request->input('page', 1));
        $paginator = new LengthAwarePaginator($rows->forPage($page, $perPage)->values(), $rows->count(), $perPage, $page, ['path' => $request->url()]);

        return response()->json(['success' => true, 'data' => $paginator]);
    }

    public function receiveBatch(Request $request, $id)
    {
        $data = $request->validate([
            'lot_number' => 'required|string|max:100',
            'quantity' => 'required|integer|min:1',
            'expiry_date' => TimeGuard::nursePortalBypassed() ? 'nullable|date' : 'nullable|date|after_or_equal:today',
            'received_at' => 'nullable|date',
            'supplier' => 'nullable|string|max:150',
            'reference' => 'nullable|string|max:150',
        ]);

        return DB::transaction(function () use ($data, $id) {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            $batch = MedicineBatch::firstOrCreate(
                ['medicine_id' => $medicine->id, 'lot_number' => $data['lot_number']],
                array_merge($data, ['medicine_id' => $medicine->id])
            );
            if (!$batch->wasRecentlyCreated) {
                $batch->increment('quantity', $data['quantity']);
            }
            $medicine->increment('quantity', $data['quantity']);
            $this->recordMovement($medicine, $batch, 'stock_in', $data['quantity'], $data['reference'] ?? null);
            $this->notifyIfLowStock($medicine->fresh());
            return response()->json(['success' => true, 'data' => $batch->fresh()], 201);
        }, 3);
    }

    public function moveStock(Request $request, $id)
    {
        $data = $request->validate([
            'movement_type' => 'required|string|in:dispensed,wasted,expired,adjustment',
            'quantity' => 'required|integer|min:1',
            'batch_id' => 'bail|nullable|uuid|exists:medicine_batches,id',
            'reason' => 'required|string|max:500',
            'student_id' => 'required_if:movement_type,dispensed|nullable|string|exists:users,student_id',
        ]);

        return DB::transaction(function () use ($data, $id) {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            $student = null;
            if (!empty($data['student_id'])) {
                $student = User::where('student_id', $data['student_id'])
                    ->where('role', 'student')
                    ->first();
                abort_unless($student, 422, 'Student ID does not match a student account.');
            }
            abort_if($medicine->quantity < $data['quantity'], 422, 'Insufficient medicine stock.');

            if (!empty($data['batch_id'])) {
                // The nurse picked a specific batch (for example to write off an expired lot).
                $batch = MedicineBatch::where('medicine_id', $medicine->id)->lockForUpdate()->findOrFail($data['batch_id']);
                abort_if($batch->quantity < $data['quantity'], 422, 'Insufficient batch stock.');
                abort_if(
                    $data['movement_type'] === 'dispensed' && $batch->expiry_date && $batch->expiry_date->isBefore(today()),
                    422,
                    'This batch has expired and cannot be dispensed.'
                );
                $batch->decrement('quantity', $data['quantity']);
                $this->recordMovement($medicine, $batch, $data['movement_type'], $data['quantity'], $data['reason'], $student);
                $allocations = [$this->allocation($batch, $data['quantity'])];
            } else {
                $allocations = $this->releaseFirstExpiryFirst($medicine, $data, $student);
            }

            $medicine->decrement('quantity', $data['quantity']);
            $this->notifyIfLowStock($medicine->fresh());
            return response()->json(['success' => true, 'data' => $medicine->fresh(), 'allocations' => $allocations]);
        }, 3);
    }

    /*
     * Stock going out without a chosen batch is taken first-expiry, first-out:
     * batches with the earliest expiry date go first, batches without a date
     * after them, and stock that was never entered as a batch last. Expired
     * batches are never dispensed to a patient (they can still be written off).
     * One movement is recorded per batch used, so batch balances stay true.
     */
    private function releaseFirstExpiryFirst(Medicine $medicine, array $data, ?User $student): array
    {
        $quantity = (int) $data['quantity'];
        $dispensing = $data['movement_type'] === 'dispensed';

        $allBatches = MedicineBatch::where('medicine_id', $medicine->id)->lockForUpdate()->get();
        $usable = $allBatches
            ->filter(fn ($batch) => $batch->quantity > 0)
            ->filter(fn ($batch) => !$dispensing || !$batch->expiry_date || !$batch->expiry_date->isBefore(today()))
            ->sortBy(fn ($batch) => [
                $batch->expiry_date ? 0 : 1,
                $batch->expiry_date ? $batch->expiry_date->toDateString() : '',
                $batch->received_at ? $batch->received_at->toDateString() : '',
                (string) $batch->created_at,
            ])
            ->values();

        $unbatched = max(0, $medicine->quantity - (int) $allBatches->sum('quantity'));

        abort_if(
            $dispensing && $quantity > (int) $usable->sum('quantity') + $unbatched,
            422,
            'Not enough unexpired stock. Expired stock cannot be dispensed; record it as expired instead.'
        );

        $allocations = [];
        $remaining = $quantity;
        foreach ($usable as $batch) {
            if ($remaining === 0) {
                break;
            }
            $take = min($remaining, $batch->quantity);
            $batch->decrement('quantity', $take);
            $this->recordMovement($medicine, $batch, $data['movement_type'], $take, $data['reason'], $student);
            $allocations[] = $this->allocation($batch, $take);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            $this->recordMovement($medicine, null, $data['movement_type'], $remaining, $data['reason'], $student);
            $allocations[] = ['batch_id' => null, 'lot_number' => null, 'expiry_date' => null, 'quantity' => $remaining];
        }

        return $allocations;
    }

    private function allocation(MedicineBatch $batch, int $quantity): array
    {
        return [
            'batch_id' => $batch->id,
            'lot_number' => $batch->lot_number,
            'expiry_date' => $batch->expiry_date ? $batch->expiry_date->toDateString() : null,
            'quantity' => $quantity,
        ];
    }

    private function recordMovement(Medicine $medicine, $batch, $type, $quantity, $reason = null, ?User $student = null)
    {
        return MedicineStockMovement::create([
            'medicine_id' => $medicine->id,
            'medicine_batch_id' => $batch ? $batch->id : null,
            'movement_type' => $type,
            'quantity' => $quantity,
            'reason' => $reason,
            'performed_by' => auth()->id(),
            'student_user_id' => $student ? $student->id : null,
        ]);
    }

    private function notifyIfLowStock(Medicine $medicine)
    {
        if ($medicine->quantity === 0) {
            foreach (User::where('role', 'nurse')->get(['id']) as $nurse) {
                Notification::create([
                    'user_id' => $nurse->id,
                    'type' => 'medicine_out_of_stock',
                    'title' => 'Medicine Out of Stock',
                    'message' => $medicine->name . ' is out of stock.',
                    'data' => ['medicine_id' => $medicine->id, 'quantity' => 0],
                ]);
            }
            return;
        }

        if ($medicine->quantity > $medicine->minimum_stock) {
            return;
        }
        foreach (User::where('role', 'nurse')->get(['id']) as $nurse) {
            Notification::create([
                'user_id' => $nurse->id,
                'type' => 'medicine_low_stock',
                'title' => 'Low Medicine Stock',
                'message' => $medicine->name . ' has reached its minimum stock level.',
                'data' => ['medicine_id' => $medicine->id, 'quantity' => $medicine->quantity],
            ]);
        }
    }

    public function update(Request $request, $id)
    {
        $medicine = Medicine::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'generic_name' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:150',
            'category' => 'nullable|string|max:100',
            'minimum_stock' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:50',
            'dosage' => 'nullable|string|max:100',
            'expiry_date' => TimeGuard::nursePortalBypassed() ? 'nullable|date' : 'nullable|date|after_or_equal:today',
            'description' => 'nullable|string|max:200',
        ]);

        if (isset($data['name'])) {
            $this->ensureUniqueName($data['name'], $medicine->id);
        }

        $medicine->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Medicine updated successfully.',
            'data' => $medicine->fresh()
        ]);
    }

    private function ensureUniqueName(string $name, ?string $ignoreId = null): void
    {
        $query = Medicine::whereRaw('LOWER(name) = ?', [strtolower(trim($name))]);
        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages([
                'name' => 'A medicine with this name already exists.',
            ]);
        }
    }

    public function addStock(Request $request, $id)
    {
        $request->validate([
            'quantity' => 'required|integer|min:1',
            // Shown as the Reference / Reason of the restock line in the stock history (e.g. a delivery number).
            'reason' => 'nullable|string|max:500',
        ]);

        $medicine = DB::transaction(function () use ($request, $id) {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            $medicine->increment('quantity', $request->quantity);
            $this->recordMovement($medicine, null, 'stock_in', $request->quantity, trim((string) $request->reason) ?: 'Stock added (no batch)');
            return $medicine->fresh();
        }, 3);

        return response()->json([
            'success' => true,
            'message' => "Added {$request->quantity} units. New stock: {$medicine->quantity}.",
            'data' => $medicine->fresh()
        ]);
    }

    public function reduceStock(Request $request, $id)
    {
        $request->validate([
            'quantity' => 'required|integer|min:1',
        ]);

        $medicine = DB::transaction(function () use ($request, $id) {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            if ($medicine->quantity < $request->quantity) {
                abort(422, 'Insufficient stock.');
            }
            $medicine->decrement('quantity', $request->quantity);
            $this->recordMovement($medicine, null, 'adjustment', $request->quantity, 'Legacy stock reduction');
            $this->notifyIfLowStock($medicine->fresh());
            return $medicine->fresh();
        }, 3);

        return response()->json([
            'success' => true,
            'message' => "Removed {$request->quantity} units. Remaining stock: {$medicine->quantity}.",
            'data' => $medicine->fresh()
        ]);
    }

    public function destroy($id)
    {
        $medicine = Medicine::findOrFail($id);
        $medicine->delete();

        return response()->json([
            'success' => true,
            'message' => 'Medicine deleted successfully.'
        ]);
    }

    public function stats()
    {
        $total = Medicine::count();
        $lowStock = Medicine::lowStock()->count();
        $expiringSoon = Medicine::expiringSoon()->count();
        $expired = Medicine::expired()->count();
        $totalQuantity = Medicine::sum('quantity');

        return response()->json([
            'success' => true,
            'data' => [
                'total_medicines' => $total,
                'low_stock' => $lowStock,
                'expiring_soon' => $expiringSoon,
                'expired' => $expired,
                'total_quantity' => $totalQuantity,
            ]
        ]);
    }

    public function categories()
    {
        $categories = Medicine::whereNotNull('category')
            ->distinct()
            ->pluck('category');

        return response()->json(['success' => true, 'data' => $categories]);
    }
}
