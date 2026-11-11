<?php

namespace App\Console\Commands;

use App\Models\Medicine;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;

class NotifyExpiringMedicines extends Command
{
    protected $signature = 'medicines:notify-expiring';

    protected $description = 'Notify nurses about medicines expiring within three months, expiring today, or already expired.';

    public function handle(): int
    {
        $today = today('Asia/Manila');
        $expiryLimit = $today->copy()->addMonths(3);
        $nurses = User::where('role', 'nurse')->get(['id']);
        // Medicine::nearestExpiry is the first-expiry rule: stocked batches before the medicine's own date.
        $medicines = Medicine::expiringSoon()->get(['id', 'name', 'expiry_date']);
        $created = 0;

        foreach ($medicines as $medicine) {
            $expiry = $medicine->nearestExpiry();
            if (!$expiry || $expiry->lt($today) || $expiry->gt($expiryLimit)) {
                continue;
            }

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
                    'message' => $medicine->name . ' expires on ' . $expiry->format('M j, Y') . '.',
                    'data' => [
                        'medicine_id' => $medicine->id,
                        'expiry_date' => $expiry->toDateString(),
                    ],
                ]);
                $created++;
            }
        }

        // "Expires today" and "Expired", once per medicine and expiry date.
        foreach ($nurses as $nurse) {
            $created += \App\Services\MedicineExpiryAlerts::generateFor($nurse);
        }

        $this->info("Created {$created} medicine expiry notification(s).");

        return self::SUCCESS;
    }
}
