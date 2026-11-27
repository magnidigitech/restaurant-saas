-- Shift Scheduling & Roster Engine Upgrade
-- Adds outlet workweek & cap policies, roster optimistic versioning & draft revisions,
-- assignment role label, and peer swap acceptance / stale snapshot tracking.

ALTER TABLE "restaurant_outlets"
  ADD COLUMN IF NOT EXISTS "workweek_start_day" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "hard_weekly_hours_cap" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "allow_overtime_override" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "shift_rosters"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "draft_revision_json" JSONB,
  ADD COLUMN IF NOT EXISTS "last_notified_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "shift_assignments"
  ADD COLUMN IF NOT EXISTS "role_name" TEXT;

ALTER TABLE "shift_swap_requests"
  ADD COLUMN IF NOT EXISTS "peer_status" TEXT NOT NULL DEFAULT 'PENDING_PEER',
  ADD COLUMN IF NOT EXISTS "target_accepted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requester_snapshot_updated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "target_snapshot_updated_at" TIMESTAMP(3);
