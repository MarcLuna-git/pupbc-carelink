<?php

namespace App\Console\Commands;

use App\Services\AppointmentExpiry;
use Illuminate\Console\Command;

class ExpireAppointments extends Command
{
    protected $signature = 'appointments:expire';
    protected $description = 'Expire overdue pending appointments and approved appointments past their check-in deadline';

    public function handle(AppointmentExpiry $expiry): int
    {
        $count = $expiry->run();

        $this->info("Expired {$count} appointment(s).");
        return self::SUCCESS;
    }
}
