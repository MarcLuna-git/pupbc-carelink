<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Consultation;
use Illuminate\Http\Request;

class ConsultationController extends Controller
{
    public function index()
    {
        $consultations = Consultation::with('nurse:id,first_name,last_name')
            ->where('user_id', auth()->id())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['success' => true, 'data' => $consultations]);
    }

    public function show($id)
    {
        $consultation = Consultation::with('nurse:id,first_name,last_name')
            ->where('user_id', auth()->id())
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $consultation]);
    }

    public function latest()
    {
        $consultation = Consultation::with('nurse:id,first_name,last_name')
            ->where('user_id', auth()->id())
            ->latest()
            ->first();

        return response()->json(['success' => true, 'data' => $consultation]);
    }
}
