<?php

namespace App\Console\Commands;

use App\Services\AppointmentExpiry;
use Illuminate\Console\Command;

class ExpireAppointments extends Command
{
    protected $signature = 'appointments:expire';
    protected $description = 'Expire pending appointments whose appointment date has passed';

    public function handle(AppointmentExpiry $expiry): int
    {
        $count = $expiry->run();

        $this->info("Expired {$count} appointment(s).");
        return self::SUCCESS;
    }
}
