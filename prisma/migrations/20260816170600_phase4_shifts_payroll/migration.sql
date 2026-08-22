-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShiftAssignmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('MONTHLY', 'BI_WEEKLY', 'WEEKLY', 'HOURLY');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'GENERATED', 'PAID');

-- CreateEnum
CREATE TYPE "EarningType" AS ENUM ('BASE', 'OVERTIME', 'BONUS', 'ALLOWANCE', 'COMMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('TAX', 'RETIREMENT', 'HEALTH', 'UNPAID_LEAVE', 'LOAN', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHECK', 'CASH', 'DIRECT_DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "shift_templates" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_rosters" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "RosterStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "roster_id" TEXT,
    "template_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ShiftAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_availabilities" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "preferred_start_time" TEXT,
    "preferred_end_time" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_swap_requests" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "requester_employee_id" TEXT NOT NULL,
    "target_employee_id" TEXT,
    "target_assignment_id" TEXT,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "review_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_salary_structures" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "pay_frequency" "PayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "base_salary" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "hourly_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "allowances_json" TEXT,
    "deductions_json" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "title" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "total_gross" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_allowances" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "processed_by" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payslips" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "hours_worked" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "base_pay" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_allowances" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_earnings" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" "EarningType" NOT NULL DEFAULT 'BASE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_deductions" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" "DeductionType" NOT NULL DEFAULT 'TAX',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payments" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "transaction_reference" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_templates_restaurant_id_idx" ON "shift_templates"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_restaurant_id_name_key" ON "shift_templates"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "shift_rosters_restaurant_id_idx" ON "shift_rosters"("restaurant_id");

-- CreateIndex
CREATE INDEX "shift_rosters_outlet_id_idx" ON "shift_rosters"("outlet_id");

-- CreateIndex
CREATE INDEX "shift_assignments_restaurant_id_idx" ON "shift_assignments"("restaurant_id");

-- CreateIndex
CREATE INDEX "shift_assignments_roster_id_idx" ON "shift_assignments"("roster_id");

-- CreateIndex
CREATE INDEX "shift_assignments_employee_id_idx" ON "shift_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "shift_assignments_outlet_id_idx" ON "shift_assignments"("outlet_id");

-- CreateIndex
CREATE INDEX "shift_assignments_shift_date_idx" ON "shift_assignments"("shift_date");

-- CreateIndex
CREATE INDEX "shift_availabilities_restaurant_id_idx" ON "shift_availabilities"("restaurant_id");

-- CreateIndex
CREATE INDEX "shift_availabilities_employee_id_idx" ON "shift_availabilities"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_availabilities_employee_id_day_of_week_key" ON "shift_availabilities"("employee_id", "day_of_week");

-- CreateIndex
CREATE INDEX "shift_swap_requests_restaurant_id_idx" ON "shift_swap_requests"("restaurant_id");

-- CreateIndex
CREATE INDEX "shift_swap_requests_assignment_id_idx" ON "shift_swap_requests"("assignment_id");

-- CreateIndex
CREATE INDEX "shift_swap_requests_requester_employee_id_idx" ON "shift_swap_requests"("requester_employee_id");

-- CreateIndex
CREATE INDEX "shift_swap_requests_target_employee_id_idx" ON "shift_swap_requests"("target_employee_id");

-- CreateIndex
CREATE INDEX "payroll_salary_structures_restaurant_id_idx" ON "payroll_salary_structures"("restaurant_id");

-- CreateIndex
CREATE INDEX "payroll_salary_structures_employee_id_idx" ON "payroll_salary_structures"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_runs_restaurant_id_idx" ON "payroll_runs"("restaurant_id");

-- CreateIndex
CREATE INDEX "payroll_runs_outlet_id_idx" ON "payroll_runs"("outlet_id");

-- CreateIndex
CREATE INDEX "payroll_payslips_restaurant_id_idx" ON "payroll_payslips"("restaurant_id");

-- CreateIndex
CREATE INDEX "payroll_payslips_payroll_run_id_idx" ON "payroll_payslips"("payroll_run_id");

-- CreateIndex
CREATE INDEX "payroll_payslips_employee_id_idx" ON "payroll_payslips"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payslips_payroll_run_id_employee_id_key" ON "payroll_payslips"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_earnings_payslip_id_idx" ON "payroll_earnings"("payslip_id");

-- CreateIndex
CREATE INDEX "payroll_deductions_payslip_id_idx" ON "payroll_deductions"("payslip_id");

-- CreateIndex
CREATE INDEX "payroll_payments_payslip_id_idx" ON "payroll_payments"("payslip_id");

-- AddForeignKey
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "shift_rosters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_availabilities" ADD CONSTRAINT "shift_availabilities_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_availabilities" ADD CONSTRAINT "shift_availabilities_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "shift_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_assignment_id_fkey" FOREIGN KEY ("target_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requester_employee_id_fkey" FOREIGN KEY ("requester_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_employee_id_fkey" FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_salary_structures" ADD CONSTRAINT "payroll_salary_structures_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_salary_structures" ADD CONSTRAINT "payroll_salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payslips" ADD CONSTRAINT "payroll_payslips_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payslips" ADD CONSTRAINT "payroll_payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payslips" ADD CONSTRAINT "payroll_payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_earnings" ADD CONSTRAINT "payroll_earnings_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

