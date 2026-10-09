<?php

namespace App\Console\Commands;

use App\Services\SkippedQueueExpiry;
use Illuminate\Console\Command;

class ExpireSkippedQueue extends Command
{
    protected $signature = 'queue:expire-skipped';
    protected $description = 'Mark still-skipped scheduled visits no-show after their original check-in deadline';

    public function handle(SkippedQueueExpiry $expiry): int
    {
        $this->info('Marked ' . $expiry->run() . ' skipped visit(s) no-show.');
        return self::SUCCESS;
    }
}
