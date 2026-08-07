-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'WAIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('DOCUMENT', 'PHOTO', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'CONSUMPTION', 'WASTAGE', 'RETURN');

-- CreateEnum
CREATE TYPE "WastageReason" AS ENUM ('EXPIRED', 'DAMAGED', 'SPILLAGE', 'THEFT', 'OVERPRODUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('KG', 'G', 'L', 'ML', 'PIECES', 'DOZEN', 'BOX', 'PACKET');

-- CreateTable
CREATE TABLE "onboarding_templates" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "requires_doc" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboardings" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_task_progress" (
    "id" TEXT NOT NULL,
    "onboarding_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "file_upload_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_task_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_file_uploads" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "onboarding_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "category" "FileCategory" NOT NULL DEFAULT 'DOCUMENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "unit_of_measure" "UnitOfMeasure" NOT NULL DEFAULT 'PIECES',
    "reorder_point" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "par_level" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cost_per_unit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledger" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "reference_id" TEXT,
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wastage_logs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "reason" "WastageReason" NOT NULL,
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wastage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_templates_restaurant_id_idx" ON "onboarding_templates"("restaurant_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_template_id_idx" ON "onboarding_tasks"("template_id");

-- CreateIndex
CREATE INDEX "employee_onboardings_restaurant_id_idx" ON "employee_onboardings"("restaurant_id");

-- CreateIndex
CREATE INDEX "employee_onboardings_employee_id_idx" ON "employee_onboardings"("employee_id");

-- CreateIndex
CREATE INDEX "onboarding_task_progress_onboarding_id_idx" ON "onboarding_task_progress"("onboarding_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_task_progress_onboarding_id_task_id_key" ON "onboarding_task_progress"("onboarding_id", "task_id");

-- CreateIndex
CREATE INDEX "employee_file_uploads_restaurant_id_idx" ON "employee_file_uploads"("restaurant_id");

-- CreateIndex
CREATE INDEX "employee_file_uploads_onboarding_id_idx" ON "employee_file_uploads"("onboarding_id");

-- CreateIndex
CREATE INDEX "inventory_categories_restaurant_id_idx" ON "inventory_categories"("restaurant_id");

-- CreateIndex
CREATE INDEX "inventory_categories_parent_id_idx" ON "inventory_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_restaurant_id_name_key" ON "inventory_categories"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "inventory_items_restaurant_id_idx" ON "inventory_items"("restaurant_id");

-- CreateIndex
CREATE INDEX "inventory_items_category_id_idx" ON "inventory_items"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_restaurant_id_name_key" ON "inventory_items"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "stock_ledger_restaurant_id_idx" ON "stock_ledger"("restaurant_id");

-- CreateIndex
CREATE INDEX "stock_ledger_outlet_id_idx" ON "stock_ledger"("outlet_id");

-- CreateIndex
CREATE INDEX "stock_ledger_item_id_idx" ON "stock_ledger"("item_id");

-- CreateIndex
CREATE INDEX "stock_ledger_occurred_at_idx" ON "stock_ledger"("occurred_at");

-- CreateIndex
CREATE INDEX "wastage_logs_restaurant_id_idx" ON "wastage_logs"("restaurant_id");

-- CreateIndex
CREATE INDEX "wastage_logs_outlet_id_idx" ON "wastage_logs"("outlet_id");

-- CreateIndex
CREATE INDEX "wastage_logs_item_id_idx" ON "wastage_logs"("item_id");

-- AddForeignKey
ALTER TABLE "onboarding_templates" ADD CONSTRAINT "onboarding_templates_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task_progress" ADD CONSTRAINT "onboarding_task_progress_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "employee_onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task_progress" ADD CONSTRAINT "onboarding_task_progress_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "onboarding_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task_progress" ADD CONSTRAINT "onboarding_task_progress_file_upload_id_fkey" FOREIGN KEY ("file_upload_id") REFERENCES "employee_file_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_file_uploads" ADD CONSTRAINT "employee_file_uploads_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_file_uploads" ADD CONSTRAINT "employee_file_uploads_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "employee_onboardings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage_logs" ADD CONSTRAINT "wastage_logs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage_logs" ADD CONSTRAINT "wastage_logs_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage_logs" ADD CONSTRAINT "wastage_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
