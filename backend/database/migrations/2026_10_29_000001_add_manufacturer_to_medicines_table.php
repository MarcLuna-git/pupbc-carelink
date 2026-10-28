<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // "Brand / Manufacturer (optional)" on the Add Medicine form. Nullable, so existing rows stay valid.
        if (!Schema::hasColumn('medicines', 'manufacturer')) {
            Schema::table('medicines', function (Blueprint $table) {
                $table->string('manufacturer', 150)->nullable()->after('generic_name');
            });
        }
    }

    public function down()
    {
        if (Schema::hasColumn('medicines', 'manufacturer')) {
            Schema::table('medicines', function (Blueprint $table) {
                $table->dropColumn('manufacturer');
            });
        }
    }
};
