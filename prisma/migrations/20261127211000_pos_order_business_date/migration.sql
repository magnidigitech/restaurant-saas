ALTER TABLE "pos_orders"
  ADD COLUMN IF NOT EXISTS "business_date" TEXT;

CREATE INDEX IF NOT EXISTS "pos_orders_restaurant_id_outlet_id_business_date_idx"
  ON "pos_orders"("restaurant_id", "outlet_id", "business_date");
