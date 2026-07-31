-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'PROBATION', 'ON_LEAVE', 'NOTICE', 'SUSPENDED', 'TERMINATED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PRIMARY', 'TEMPORARY', 'TRAINING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'PASSPORT', 'VISA', 'CONTRACT', 'RESUME', 'CERTIFICATE', 'MEDICAL', 'FOOD_LICENSE');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designations" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_grades" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "personal_email" TEXT,
    "phone" TEXT,
    "alternate_phone" TEXT,
    "gender" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "joining_date" TIMESTAMP(3) NOT NULL,
    "profile_photo_url" TEXT,
    "worker_type" "WorkerType" NOT NULL DEFAULT 'FULL_TIME',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_records" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "department_id" TEXT,
    "designation_id" TEXT,
    "primary_outlet_id" TEXT,
    "employment_type" "WorkerType",
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "probation_end_date" TIMESTAMP(3),
    "confirmation_date" TIMESTAMP(3),
    "notice_period" INTEGER,
    "reporting_manager_employee_id" TEXT,
    "salary_structure_id" TEXT,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_outlet_assignments" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assignment_type" "AssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_outlet_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_emergency_contacts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_url" TEXT,
    "document_number" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_restaurant_id_idx" ON "departments"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_restaurant_id_code_key" ON "departments"("restaurant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_restaurant_id_name_key" ON "departments"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "designations_restaurant_id_idx" ON "designations"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "designations_restaurant_id_code_key" ON "designations"("restaurant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "designations_restaurant_id_name_key" ON "designations"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "job_grades_restaurant_id_idx" ON "job_grades"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_grades_restaurant_id_code_key" ON "job_grades"("restaurant_id", "code");

-- CreateIndex
CREATE INDEX "cost_centers_restaurant_id_idx" ON "cost_centers"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_restaurant_id_code_key" ON "cost_centers"("restaurant_id", "code");

-- CreateIndex
CREATE INDEX "employees_restaurant_id_idx" ON "employees"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_restaurant_id_employee_code_key" ON "employees"("restaurant_id", "employee_code");

-- CreateIndex
CREATE INDEX "employment_records_restaurant_id_idx" ON "employment_records"("restaurant_id");

-- CreateIndex
CREATE INDEX "employment_records_employee_id_idx" ON "employment_records"("employee_id");

-- CreateIndex
CREATE INDEX "employee_outlet_assignments_restaurant_id_idx" ON "employee_outlet_assignments"("restaurant_id");

-- CreateIndex
CREATE INDEX "employee_outlet_assignments_employee_id_idx" ON "employee_outlet_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_outlet_assignments_employee_id_outlet_id_key" ON "employee_outlet_assignments"("employee_id", "outlet_id");

-- CreateIndex
CREATE INDEX "employee_emergency_contacts_employee_id_idx" ON "employee_emergency_contacts"("employee_id");

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");

-- CreateIndex
CREATE INDEX "restaurant_memberships_employee_id_idx" ON "restaurant_memberships"("employee_id");

-- AddForeignKey
ALTER TABLE "restaurant_memberships" ADD CONSTRAINT "restaurant_memberships_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_grades" ADD CONSTRAINT "job_grades_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_primary_outlet_id_fkey" FOREIGN KEY ("primary_outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_reporting_manager_employee_id_fkey" FOREIGN KEY ("reporting_manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_outlet_assignments" ADD CONSTRAINT "employee_outlet_assignments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_outlet_assignments" ADD CONSTRAINT "employee_outlet_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_outlet_assignments" ADD CONSTRAINT "employee_outlet_assignments_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_emergency_contacts" ADD CONSTRAINT "employee_emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
