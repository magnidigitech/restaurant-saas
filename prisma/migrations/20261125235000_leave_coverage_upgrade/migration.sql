-- Module 5: Leave, Time-Off & Shift Coverage upgrade
ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "outlet_id" TEXT,
  ADD COLUMN IF NOT EXISTS "is_partial_day" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "start_time" TEXT,
  ADD COLUMN IF NOT EXISTS "end_time" TEXT,
  ADD COLUMN IF NOT EXISTS "hours_requested" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "attachment_url" TEXT,
  ADD COLUMN IF NOT EXISTS "attachment_name" TEXT;
