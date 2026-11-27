-- Module 4: Attendance & Tablet Kiosk upgrade
ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "needs_review" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exception_flags" JSONB,
  ADD COLUMN IF NOT EXISTS "scheduled_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "corrected_by" TEXT,
  ADD COLUMN IF NOT EXISTS "corrected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "correction_reason" TEXT;

ALTER TABLE "time_punches"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "is_manual_adjustment" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "adjusted_by" TEXT,
  ADD COLUMN IF NOT EXISTS "adjustment_reason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "time_punches_idempotency_key_key" ON "time_punches"("idempotency_key");
