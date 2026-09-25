<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up()
    {
        DB::table('pending_registrations')->orderBy('id')->chunk(100, function ($rows) {
            foreach ($rows as $row) {
                $payload = json_decode($row->payload, true);
                if (!is_array($payload)) continue;
                if (isset($payload['password'])) {
                    $payload['password_hash'] = Hash::make($payload['password']);
                }
                unset($payload['password'], $payload['password_confirmation']);
                DB::table('pending_registrations')->where('id', $row->id)
                    ->update(['payload' => json_encode($payload)]);
            }
        });
    }

    public function down() { /* Password hashing is intentionally irreversible. */ }
};
