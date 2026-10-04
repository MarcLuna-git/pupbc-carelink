<?php

namespace App\Console\Commands;

use App\Models\Medicine;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;

class NotifyExpiringMedicines extends Command
{
    protected $signature = 'medicines:notify-expiring';

    protected $description = 'Notify nurses about medicines expiring within three months.';

    public function handle(): int
    {
        $today = today('Asia/Manila');
        $expiryLimit = $today->copy()->addMonths(3);
        $nurses = User::where('role', 'nurse')->get(['id']);
        $medicines = Medicine::whereNotNull('expiry_date')
            ->whereDate('expiry_date', '>=', $today)
            ->whereDate('expiry_date', '<=', $expiryLimit)
            ->get(['id', 'name', 'expiry_date']);
        $created = 0;

        foreach ($medicines as $medicine) {
            foreach ($nurses as $nurse) {
                $alreadyNotified = Notification::where('user_id', $nurse->id)
                    ->where('type', 'medicine_expiring_soon')
                    ->where('data->medicine_id', $medicine->id)
                    ->exists();

                if ($alreadyNotified) {
                    continue;
                }

                Notification::create([
                    'user_id' => $nurse->id,
                    'type' => 'medicine_expiring_soon',
                    'title' => 'Medicine Expiring Soon',
                    'message' => $medicine->name . ' expires on ' . $medicine->expiry_date->format('M j, Y') . '.',
                    'data' => [
                        'medicine_id' => $medicine->id,
                        'expiry_date' => $medicine->expiry_date->toDateString(),
                    ],
                ]);
                $created++;
            }
        }

        $this->info("Created {$created} medicine expiry notification(s).");

        return self::SUCCESS;
    }
}
