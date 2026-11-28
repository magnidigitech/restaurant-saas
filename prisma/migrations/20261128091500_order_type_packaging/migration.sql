-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "PosOrderType" ADD VALUE IF NOT EXISTS 'UNKNOWN';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable recipe_items
ALTER TABLE "recipe_items"
  ADD COLUMN IF NOT EXISTS "is_packaging" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "applicable_order_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable pos_orders
ALTER TABLE "pos_orders"
  ADD COLUMN IF NOT EXISTS "packaging_review_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "packaging_review_reason" TEXT;

-- AlterTable pos_menu_item_mappings
ALTER TABLE "pos_menu_item_mappings"
  ADD COLUMN IF NOT EXISTS "effective_from" TIMESTAMP(3);
