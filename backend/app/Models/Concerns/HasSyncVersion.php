<?php

namespace App\Models\Concerns;

trait HasSyncVersion
{
    public function initializeHasSyncVersion()
    {
        $this->append('sync_version');
    }

    public function getSyncVersionAttribute(): string
    {
        // Original persisted fields only: computed presentation flags and relations are excluded.
        $attributes = $this->getRawOriginal();
        ksort($attributes);
        return hash_hmac('sha256', json_encode($attributes), config('app.key'));
    }
}
