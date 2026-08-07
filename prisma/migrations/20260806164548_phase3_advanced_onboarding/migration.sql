-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CHECKBOX', 'DOCUMENT', 'FORM_INPUT', 'SIGNATURE', 'DATE');

-- AlterTable
ALTER TABLE "employee_onboardings" ADD COLUMN     "access_token" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "onboarding_task_progress" ADD COLUMN     "response_value" TEXT;

-- AlterTable
ALTER TABLE "onboarding_tasks" ADD COLUMN     "field_config" TEXT,
ADD COLUMN     "task_type" "TaskType" NOT NULL DEFAULT 'CHECKBOX';

-- CreateIndex
CREATE INDEX "employee_onboardings_access_token_idx" ON "employee_onboardings"("access_token");
