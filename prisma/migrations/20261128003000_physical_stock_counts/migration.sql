-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_RECOUNT', 'APPROVED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable stock_counts
CREATE TABLE IF NOT EXISTS "stock_counts" (
  "id" TEXT NOT NULL,
  "restaurant_id" TEXT NOT NULL,
  "outlet_id" TEXT NOT NULL,
  "count_number" TEXT NOT NULL,
  "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
  "count_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cutoff_at" TIMESTAMP(3) NOT NULL,
  "started_by_user_id" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3),
  "submitted_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_user_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "approved_by_user_id" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_counts_restaurant_id_count_number_key" ON "stock_counts"("restaurant_id", "count_number");
CREATE INDEX IF NOT EXISTS "stock_counts_restaurant_id_outlet_id_status_idx" ON "stock_counts"("restaurant_id", "outlet_id", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_counts_restaurant_id_fkey') THEN
    ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_counts_outlet_id_fkey') THEN
    ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable stock_count_items
CREATE TABLE IF NOT EXISTS "stock_count_items" (
  "id" TEXT NOT NULL,
  "stock_count_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "unit_of_measure" "UnitOfMeasure" NOT NULL,
  "is_counted" BOOLEAN NOT NULL DEFAULT false,
  "counted_base_input" DECIMAL(65,30),
  "counted_packs_json" JSONB,
  "counted_base_qty" DECIMAL(65,30),
  "expected_at_cutoff" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "variance_qty" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "later_movements_qty" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "reviewed_expected_at_cutoff" DECIMAL(65,30),
  "recount_requested" BOOLEAN NOT NULL DEFAULT false,
  "recount_reason" TEXT,
  "adjustment_ledger_id" TEXT,
  "counted_by_user_id" TEXT,
  "counted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_count_items_stock_count_id_item_id_key" ON "stock_count_items"("stock_count_id", "item_id");
CREATE INDEX IF NOT EXISTS "stock_count_items_stock_count_id_idx" ON "stock_count_items"("stock_count_id");
CREATE INDEX IF NOT EXISTS "stock_count_items_item_id_idx" ON "stock_count_items"("item_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_count_items_stock_count_id_fkey') THEN
    ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_count_items_item_id_fkey') THEN
    ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
