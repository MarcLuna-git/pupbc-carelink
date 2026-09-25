<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\DatabaseSearch;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineStockMovement;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MedicineController extends Controller
{
    public function index(Request $request)
    {
        $query = Medicine::query();

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', DatabaseSearch::like($q), "%{$request->search}%")
                  ->orWhere('generic_name', DatabaseSearch::like($q), "%{$request->search}%")
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

        $medicines = $query->orderBy('name')->paginate(20);

        $medicines->getCollection()->transform(function ($medicine) {
            $medicine->is_low_stock = $medicine->quantity <= $medicine->minimum_stock;
            $medicine->is_expiring_soon = $medicine->expiry_date && $medicine->expiry_date <= now()->addMonths(3);
            $medicine->is_expired = $medicine->expiry_date && $medicine->expiry_date < now();
            $medicine->status = $medicine->is_expired ? 'expired' : ($medicine->is_low_stock ? 'low_stock' : ($medicine->is_expiring_soon ? 'expiring_soon' : 'ok'));
            return $medicine;
        });

        return response()->json([
            'success' => true,
            'data' => $medicines
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'generic_name' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:100',
            'quantity' => 'required|integer|min:0',
            'minimum_stock' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:50',
            'dosage' => 'nullable|string|max:100',
            'expiry_date' => 'nullable|date',
            'description' => 'nullable|string',
        ]);

        $medicine = Medicine::create([
            ...$request->all(),
            'added_by' => auth()->id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Medicine added successfully.',
            'data' => $medicine
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

    public function movements(Request $request, $id)
    {
        Medicine::findOrFail($id);
        return response()->json(['success' => true, 'data' => MedicineStockMovement::with(['batch', 'performer:id,first_name,last_name'])->where('medicine_id', $id)->latest()->paginate(50)]);
    }

    public function receiveBatch(Request $request, $id)
    {
        $data = $request->validate([
            'lot_number' => 'required|string|max:100',
            'quantity' => 'required|integer|min:1',
            'expiry_date' => 'nullable|date',
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
        ]);

        return DB::transaction(function () use ($data, $id) {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            $batch = null;
            if (!empty($data['batch_id'])) {
                $batch = MedicineBatch::where('medicine_id', $medicine->id)->lockForUpdate()->findOrFail($data['batch_id']);
                abort_if($batch->quantity < $data['quantity'], 422, 'Insufficient batch stock.');
                $batch->decrement('quantity', $data['quantity']);
            }
            abort_if($medicine->quantity < $data['quantity'], 422, 'Insufficient medicine stock.');
            $medicine->decrement('quantity', $data['quantity']);
            $this->recordMovement($medicine, $batch, $data['movement_type'], $data['quantity'], $data['reason']);
            $this->notifyIfLowStock($medicine->fresh());
            return response()->json(['success' => true, 'data' => $medicine->fresh()]);
        }, 3);
    }

    private function recordMovement(Medicine $medicine, $batch, $type, $quantity, $reason = null)
    {
        return MedicineStockMovement::create([
            'medicine_id' => $medicine->id,
            'medicine_batch_id' => $batch ? $batch->id : null,
            'movement_type' => $type,
            'quantity' => $quantity,
            'reason' => $reason,
            'performed_by' => auth()->id(),
        ]);
    }

    private function notifyIfLowStock(Medicine $medicine)
    {
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

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'generic_name' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:100',
            'quantity' => 'sometimes|integer|min:0',
            'minimum_stock' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:50',
            'dosage' => 'nullable|string|max:100',
            'expiry_date' => 'nullable|date',
            'description' => 'nullable|string',
        ]);

        $medicine->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Medicine updated successfully.',
            'data' => $medicine->fresh()
        ]);
    }

    public function addStock(Request $request, $id)
    {
        $request->validate([
            'quantity' => 'required|integer|min:1',
        ]);

        $medicine = DB::transaction(function () use ($request, $id) {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            $medicine->increment('quantity', $request->quantity);
            $this->recordMovement($medicine, null, 'stock_in', $request->quantity, 'Legacy stock receipt');
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
