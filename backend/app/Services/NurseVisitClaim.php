<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NurseVisitClaim
{
    public static function session(Request $request): string
    {
        return hash('sha256', $request->bearerToken() ?: (string) $request->user()->id);
    }

    // Caller holds ClinicQueue::lock() in a transaction.
    public static function acquire(Request $request, string $checkin): void
    {
        $claim = DB::table('nurse_visit_claims')->where('checkin_id', $checkin)->first();
        $session = self::session($request);
        abort_if($claim && $claim->session_hash !== $session && now()->lt($claim->expires_at), 409,
            'This visit is open on another device. Close it there before continuing, or wait 15 minutes for its inactive editing claim to expire. Your inputs are preserved.');
        DB::table('nurse_visit_claims')->updateOrInsert(['checkin_id' => $checkin], [
            'session_hash' => $session, 'expires_at' => now()->addMinutes(15),
        ]);
    }
}
