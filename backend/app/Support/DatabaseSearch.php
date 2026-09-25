<?php

namespace App\Support;

class DatabaseSearch
{
    public static function like($query): string
    {
        // Preserve the local case-insensitive search on PostgreSQL too.
        return $query->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }
}
