-- Module 3: Digital Onboarding upgrade
ALTER TABLE "onboarding_templates"
  ADD COLUMN IF NOT EXISTS "role_name" TEXT;

ALTER TABLE "employee_onboardings"
  ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "intended_outlet_id" TEXT,
  ADD COLUMN IF NOT EXISTS "intended_department_id" TEXT,
  ADD COLUMN IF NOT EXISTS "intended_designation_id" TEXT,
  ADD COLUMN IF NOT EXISTS "intended_start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "intended_employment_status" "EmploymentStatus" DEFAULT 'PROBATION',
  ADD COLUMN IF NOT EXISTS "intended_worker_type" "WorkerType" DEFAULT 'FULL_TIME',
  ADD COLUMN IF NOT EXISTS "provision_app_access" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "app_role_id" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_employee_id" TEXT;

ALTER TABLE "onboarding_task_progress"
  ADD COLUMN IF NOT EXISTS "task_title" TEXT,
  ADD COLUMN IF NOT EXISTS "task_description" TEXT,
  ADD COLUMN IF NOT EXISTS "task_type" "TaskType",
  ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "requires_doc" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER,
  ADD COLUMN IF NOT EXISTS "field_config" TEXT,
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "submission_history" JSONB;
