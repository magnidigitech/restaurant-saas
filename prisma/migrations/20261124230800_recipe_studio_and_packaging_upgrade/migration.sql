-- AlterTable
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "instructions" TEXT,
ADD COLUMN IF NOT EXISTS "target_food_cost_percent" DECIMAL(65,30) DEFAULT 28,
ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "published_recipe_id" TEXT,
ADD COLUMN IF NOT EXISTS "source_type" TEXT DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "recipe_items" ADD COLUMN IF NOT EXISTS "pack_id" TEXT,
ADD COLUMN IF NOT EXISTS "pack_quantity" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "original_text" TEXT,
ADD COLUMN IF NOT EXISTS "stated_quantity_raw" TEXT,
ADD COLUMN IF NOT EXISTS "is_unresolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "unresolved_reason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recipes_is_draft_idx" ON "recipes"("is_draft");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recipe_items_pack_id_idx" ON "recipe_items"("pack_id");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recipe_items_pack_id_fkey'
  ) THEN
    ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "item_purchase_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
