-- AlterTable pos_integrations
ALTER TABLE "pos_integrations"
  ADD COLUMN IF NOT EXISTS "webhook_secret_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "sync_cursor" TEXT,
  ADD COLUMN IF NOT EXISTS "backfill_cursor" TEXT,
  ADD COLUMN IF NOT EXISTS "backfill_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_successful_sync_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "active_sync_lock_id" TEXT,
  ADD COLUMN IF NOT EXISTS "active_sync_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stock_posting_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stock_posting_effective_from" TIMESTAMP(3);

-- AlterTable pos_orders
ALTER TABLE "pos_orders"
  ADD COLUMN IF NOT EXISTS "integration_id" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN IF NOT EXISTS "service_charge_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "voided_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "payments_json" JSONB,
  ADD COLUMN IF NOT EXISTS "refunds_json" JSONB,
  ADD COLUMN IF NOT EXISTS "provider_updated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "provider_version" TEXT,
  ADD COLUMN IF NOT EXISTS "sync_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "is_partial_snapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "pos_orders_integration_id_idx" ON "pos_orders"("integration_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_orders_integration_id_fkey'
  ) THEN
    ALTER TABLE "pos_orders"
      ADD CONSTRAINT "pos_orders_integration_id_fkey"
      FOREIGN KEY ("integration_id") REFERENCES "pos_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable pos_order_items
ALTER TABLE "pos_order_items"
  ADD COLUMN IF NOT EXISTS "external_variant_id" TEXT,
  ADD COLUMN IF NOT EXISTS "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refunded_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "depleted_quantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable pos_sync_runs
CREATE TABLE IF NOT EXISTS "pos_sync_runs" (
  "id" TEXT NOT NULL,
  "restaurant_id" TEXT NOT NULL,
  "outlet_id" TEXT NOT NULL,
  "integration_id" TEXT NOT NULL,
  "run_type" TEXT NOT NULL DEFAULT 'INCREMENTAL',
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "range_start" TIMESTAMP(3),
  "range_end" TIMESTAMP(3),
  "cursor_in" TEXT,
  "cursor_out" TEXT,
  "imported_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "error_summary" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "pos_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pos_sync_runs_restaurant_id_integration_id_started_at_idx" ON "pos_sync_runs"("restaurant_id", "integration_id", "started_at");
CREATE INDEX IF NOT EXISTS "pos_sync_runs_outlet_id_idx" ON "pos_sync_runs"("outlet_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_sync_runs_restaurant_id_fkey') THEN
    ALTER TABLE "pos_sync_runs" ADD CONSTRAINT "pos_sync_runs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_sync_runs_outlet_id_fkey') THEN
    ALTER TABLE "pos_sync_runs" ADD CONSTRAINT "pos_sync_runs_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_sync_runs_integration_id_fkey') THEN
    ALTER TABLE "pos_sync_runs" ADD CONSTRAINT "pos_sync_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "pos_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable pos_menu_item_mappings
CREATE TABLE IF NOT EXISTS "pos_menu_item_mappings" (
  "id" TEXT NOT NULL,
  "restaurant_id" TEXT NOT NULL,
  "outlet_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "external_item_id" TEXT NOT NULL,
  "external_item_name" TEXT NOT NULL,
  "external_variant_id" TEXT NOT NULL DEFAULT '',
  "external_variant_name" TEXT,
  "recipe_id" TEXT,
  "modifier_adjustments_json" JSONB,
  "is_ignored" BOOLEAN NOT NULL DEFAULT false,
  "mapped_by_user_id" TEXT,
  "mapped_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pos_menu_item_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_menu_item_mappings_restaurant_id_outlet_id_provider_exte_key" ON "pos_menu_item_mappings"("restaurant_id", "outlet_id", "provider", "external_item_id", "external_variant_id");
CREATE INDEX IF NOT EXISTS "pos_menu_item_mappings_restaurant_id_outlet_id_provider_idx" ON "pos_menu_item_mappings"("restaurant_id", "outlet_id", "provider");
CREATE INDEX IF NOT EXISTS "pos_menu_item_mappings_recipe_id_idx" ON "pos_menu_item_mappings"("recipe_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_menu_item_mappings_restaurant_id_fkey') THEN
    ALTER TABLE "pos_menu_item_mappings" ADD CONSTRAINT "pos_menu_item_mappings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_menu_item_mappings_outlet_id_fkey') THEN
    ALTER TABLE "pos_menu_item_mappings" ADD CONSTRAINT "pos_menu_item_mappings_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_menu_item_mappings_recipe_id_fkey') THEN
    ALTER TABLE "pos_menu_item_mappings" ADD CONSTRAINT "pos_menu_item_mappings_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
