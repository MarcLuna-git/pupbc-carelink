<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('medicine_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('medicine_id')->constrained('medicines')->onDelete('cascade');
            $table->string('lot_number', 100);
            if (DB::connection()->getDriverName() === 'pgsql') {
                $table->bigInteger('quantity')->default(0);
            } else {
                $table->unsignedInteger('quantity')->default(0);
            }
            $table->date('expiry_date')->nullable();
            $table->date('received_at')->nullable();
            $table->string('supplier', 150)->nullable();
            $table->string('reference', 150)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['medicine_id', 'lot_number']);
            $table->index(['expiry_date', 'quantity']);
        });

        Schema::create('medicine_stock_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('medicine_id')->constrained('medicines')->onDelete('cascade');
            $table->foreignUuid('medicine_batch_id')->nullable()->constrained('medicine_batches')->onDelete('set null');
            $table->string('movement_type', 30);
            if (DB::connection()->getDriverName() === 'pgsql') {
                $table->bigInteger('quantity');
            } else {
                $table->unsignedInteger('quantity');
            }
            $table->string('reason', 500)->nullable();
            $table->foreignUuid('performed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->index(['medicine_id', 'created_at']);
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE medicine_batches ADD CONSTRAINT medicine_batches_quantity_unsigned
                CHECK (quantity BETWEEN 0 AND 4294967295)');
            DB::statement('ALTER TABLE medicine_stock_movements ADD CONSTRAINT medicine_movements_quantity_unsigned
                CHECK (quantity BETWEEN 0 AND 4294967295)');
        }
    }

    public function down()
    {
        Schema::dropIfExists('medicine_stock_movements');
        Schema::dropIfExists('medicine_batches');
    }
};
