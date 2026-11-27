-- CreateEnum
CREATE TYPE "PricingBasis" AS ENUM ('PER_PACK', 'PER_WEIGHT_UNIT', 'PER_UNIT');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('COD', 'IMMEDIATE', 'NET7', 'NET15', 'NET30', 'NET60');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DateAvailabilityType" AS ENUM ('AVAILABLE', 'NOT_AVAILABLE', 'SPECIFIC_TIME', 'LEAVE');

-- CreateEnum
CREATE TYPE "AvailabilitySubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "RecipeType" AS ENUM ('DISH', 'SUB_RECIPE');

-- CreateEnum
CREATE TYPE "RecipeComponentType" AS ENUM ('INVENTORY_ITEM', 'SUB_RECIPE');

-- CreateEnum
CREATE TYPE "PosOrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PosOrderStatus" AS ENUM ('PENDING', 'PREPARING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PosPaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PosIntegrationProvider" AS ENUM ('TOAST', 'SQUARE', 'CLOVER');

-- CreateEnum
CREATE TYPE "PosIntegrationStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "VaultItemType" AS ENUM ('LOGIN', 'SECURE_NOTE', 'SOFTWARE_LICENSE', 'API_KEY', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "VaultSharePermission" AS ENUM ('READ_ONLY', 'AUTOFILL_ONLY', 'CAN_EDIT', 'FULL_CONTROL');

-- CreateEnum
CREATE TYPE "VaultAuditAction" AS ENUM ('VAULT_UNLOCKED', 'ITEM_CREATED', 'ITEM_VIEWED', 'ITEM_COPIED_PASSWORD', 'ITEM_COPIED_USERNAME', 'ITEM_UPDATED', 'ITEM_SHARED', 'ITEM_SHARE_REVOKED', 'ITEM_ARCHIVED', 'ITEM_DELETED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ON_BREAK', 'EARLY_DEPARTURE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "PunchType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'ANNUAL', 'UNPAID', 'MATERNITY_PATERNITY');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TipDistributionMethod" AS ENUM ('HOURS_WORKED', 'EQUAL_SPLIT', 'ROLE_POINT_SYSTEM');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'REVENUE');

-- CreateEnum
CREATE TYPE "FinancialCategory" AS ENUM ('FOOD_BEVERAGE_SUPPLIERS', 'PACKAGING_CONSUMABLES', 'RENT_PROPERTY_LEASE', 'UTILITIES', 'STAFF_PAYROLL', 'EQUIPMENT_FINANCING_LEASE', 'MAINTENANCE_REPAIRS', 'CLEANING_HYGIENE', 'TAXES_LICENSES', 'SAAS_TECHNOLOGY', 'MARKETING_ADVERTISING', 'INSURANCE', 'BANKING_PAYMENT_PROCESSING', 'DELIVERY_LOGISTICS', 'OTHER_OPERATIONAL_EXPENSES', 'COGS_INVENTORY', 'PAYROLL_LABOR', 'RENT_OCCUPANCY', 'EQUIPMENT_MAINTENANCE', 'SOFTWARE_SUBSCRIPTION', 'WASTAGE', 'MISC_EXPENSE', 'POS_SALES', 'POS_DINE_IN', 'POS_TAKEAWAY', 'POS_DELIVERY', 'CATERING_EVENTS', 'THIRD_PARTY_DELIVERY', 'MERCHANDISE', 'REBATES_CREDITS', 'OTHER_INCOME');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('AUTOMATIC_POS', 'AUTOMATIC_PO', 'AUTOMATIC_PAYROLL', 'AUTOMATIC_WASTAGE', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "BillCategory" AS ENUM ('FOOD_BEVERAGE_SUPPLIERS', 'PACKAGING_CONSUMABLES', 'RENT_PROPERTY_LEASE', 'UTILITIES', 'STAFF_PAYROLL', 'EQUIPMENT_FINANCING_LEASE', 'MAINTENANCE_REPAIRS', 'CLEANING_HYGIENE', 'TAXES_LICENSES', 'SAAS_TECHNOLOGY', 'MARKETING_ADVERTISING', 'INSURANCE', 'BANKING_PAYMENT_PROCESSING', 'DELIVERY_LOGISTICS', 'OTHER_OPERATIONAL_EXPENSES', 'CREDIT_CARD', 'VENDOR_INVOICE', 'RENT_OCCUPANCY', 'UTILITY', 'LOAN_LEASE', 'TAX_GOVERNMENT', 'SUBSCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('UPCOMING', 'DUE_SOON', 'OVERDUE', 'PAID', 'DEFERRED');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('OPENING', 'CLOSING', 'MID_DAY', 'FOOD_SAFETY', 'WEEKLY_MAINTENANCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CateringEventType" AS ENUM ('WEDDING', 'CORPORATE', 'BIRTHDAY', 'PRIVATE_DINING', 'BUFFET', 'PACKED_MEALS', 'OTHER');

-- CreateEnum
CREATE TYPE "CateringOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PREPARATION', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClosingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "CashAdjustmentType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateEnum
CREATE TYPE "AdjustmentApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "EarningType" ADD VALUE 'TIPS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RosterStatus" ADD VALUE 'AVAILABILITY_OPEN';
ALTER TYPE "RosterStatus" ADD VALUE 'AVAILABILITY_LOCKED';
ALTER TYPE "RosterStatus" ADD VALUE 'ASSIGNMENT_IN_PROGRESS';
ALTER TYPE "RosterStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UnitOfMeasure" ADD VALUE 'LB';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'OZ';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'GAL';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'IMP_GAL';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'QT';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'PT';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'CUP';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'FL_OZ';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'TBSP';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'TSP';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'LADLE';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'EACH';
ALTER TYPE "UnitOfMeasure" ADD VALUE 'PORTION';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "kiosk_pin" TEXT,
ADD COLUMN     "weekly_hours_limit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "payroll_payslips" ADD COLUMN     "pooled_tips_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "timesheet_sync_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shift_rosters" ADD COLUMN     "availability_deadline" TIMESTAMP(3),
ADD COLUMN     "departments" JSONB;

-- CreateTable
CREATE TABLE "platform_two_factor_auth" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secret_encrypted" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_two_factor_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_two_factor_recovery_codes" (
    "id" TEXT NOT NULL,
    "platform_two_factor_id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_passkeys" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "device_type" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "platform_passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_trusted_devices" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "device_name" TEXT,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "platform_trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_sessions" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "platform_user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_auth" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secret_encrypted" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_recovery_codes" (
    "id" TEXT NOT NULL,
    "two_factor_auth_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkeys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "device_type" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "device_name" TEXT,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_security_policies" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "require_mfa_roles" TEXT NOT NULL DEFAULT '["OWNER","ADMIN"]',
    "allowed_methods" TEXT NOT NULL DEFAULT '["PASSKEY","TOTP","RECOVERY_CODE"]',
    "trusted_device_duration_days" INTEGER NOT NULL DEFAULT 30,
    "enforce_immediate_mfa" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_security_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "event" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_vendors" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contact_person" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tax_id" TEXT,
    "payment_terms" "PaymentTerms" NOT NULL DEFAULT 'NET30',
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "outlet_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_purchase_orders" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expected_delivery_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "received_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "pack_id" TEXT,
    "pack_label" TEXT,
    "pack_details" TEXT,
    "pack_conversion_factor" DECIMAL(65,30),
    "ordered_pack_count" DECIMAL(65,30),
    "received_pack_count" DECIMAL(65,30) DEFAULT 0,
    "pack_price" DECIMAL(65,30),
    "pricing_basis" "PricingBasis",
    "is_variable_weight" BOOLEAN NOT NULL DEFAULT false,
    "actual_weight_received" DECIMAL(65,30) DEFAULT 0,
    "ordered_quantity" DECIMAL(65,30) NOT NULL,
    "received_quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(65,30) NOT NULL,
    "total_cost" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "inventory_purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_vendor_items" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "pack_id" TEXT,
    "pricing_basis" "PricingBasis" NOT NULL DEFAULT 'PER_UNIT',
    "vendor_sku" TEXT,
    "unit_cost" DECIMAL(65,30),
    "lead_time_days" INTEGER,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_vendor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_purchase_packs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pack_type" TEXT NOT NULL,
    "custom_type_label" TEXT,
    "inner_pack_type" TEXT,
    "inner_custom_type_label" TEXT,
    "inner_pack_count" DECIMAL(65,30),
    "units_per_inner" DECIMAL(65,30),
    "pack_unit" "UnitOfMeasure" NOT NULL,
    "net_quantity_per_pack" DECIMAL(65,30) NOT NULL,
    "conversion_factor" DECIMAL(65,30) NOT NULL,
    "is_variable_weight" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_purchase_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_po_receipts" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "po_item_id" TEXT,
    "item_id" TEXT NOT NULL,
    "packs_received" DECIMAL(65,30),
    "quantity_received" DECIMAL(65,30) NOT NULL,
    "actual_weight_received" DECIMAL(65,30),
    "unit_cost" DECIMAL(65,30) NOT NULL,
    "total_cost" DECIMAL(65,30) NOT NULL,
    "idempotency_key" TEXT,
    "notes" TEXT,
    "received_by" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_po_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_date_availabilities" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "roster_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "DateAvailabilityType" NOT NULL DEFAULT 'AVAILABLE',
    "available_from" TEXT,
    "available_until" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_date_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_employee_submissions" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "roster_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "AvailabilitySubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_employee_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecipeType" NOT NULL DEFAULT 'DISH',
    "description" TEXT,
    "yield_quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "yield_unit" "UnitOfMeasure" NOT NULL DEFAULT 'PIECES',
    "serving_size" TEXT,
    "prep_time_min" INTEGER,
    "selling_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cost_per_unit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "gross_margin_percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "component_type" "RecipeComponentType" NOT NULL DEFAULT 'INVENTORY_ITEM',
    "inventory_item_id" TEXT,
    "sub_recipe_id" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit_of_measure" "UnitOfMeasure" NOT NULL,
    "wastage_percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_integrations" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "provider" "PosIntegrationProvider" NOT NULL,
    "provider_location_id" TEXT,
    "provider_location_name" TEXT,
    "provider_merchant_id" TEXT,
    "status" "PosIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "is_test_mode" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB,
    "credentials_encrypted" TEXT,
    "sync_frequency" TEXT NOT NULL DEFAULT '15_MIN',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "sync_error" TEXT,
    "error_message" TEXT,
    "imported_orders_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_orders" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "table_number" TEXT,
    "order_type" "PosOrderType" NOT NULL DEFAULT 'DINE_IN',
    "status" "PosOrderStatus" NOT NULL DEFAULT 'COMPLETED',
    "total_amount" DECIMAL(65,30) NOT NULL,
    "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tip_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "refund_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(65,30) NOT NULL,
    "payment_status" "PosPaymentStatus" NOT NULL DEFAULT 'PAID',
    "payment_method" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "provider_order_id" TEXT,
    "provider_location_id" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "raw_payload" JSONB,
    "depleted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "pos_menu_item_id" TEXT,
    "provider_item_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "total_price" DECIMAL(65,30) NOT NULL,
    "net_sales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "modifiers" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vault_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "master_salt" TEXT NOT NULL,
    "key_verifier_hash" TEXT NOT NULL,
    "encrypted_master_key" TEXT,
    "public_key_pem" TEXT,
    "encrypted_priv_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_vault_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_folders" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT DEFAULT 'folder',
    "color" TEXT DEFAULT '#0071E3',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_items" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "title" TEXT NOT NULL,
    "item_type" "VaultItemType" NOT NULL DEFAULT 'LOGIN',
    "website_url" TEXT,
    "encrypted_data" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_item_shares" (
    "id" TEXT NOT NULL,
    "vault_item_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "role_id" TEXT,
    "department_id" TEXT,
    "permission" "VaultSharePermission" NOT NULL DEFAULT 'READ_ONLY',
    "encrypted_key_for_recipient" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_item_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_audit_logs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "vault_item_id" TEXT,
    "action" "VaultAuditAction" NOT NULL,
    "details" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "shift_assignment_id" TEXT,
    "work_date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "clock_in_time" TIMESTAMP(3),
    "clock_out_time" TIMESTAMP(3),
    "total_work_minutes" INTEGER NOT NULL DEFAULT 0,
    "total_break_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_exit_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "manager_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_punches" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "attendance_record_id" TEXT,
    "punch_type" "PunchType" NOT NULL,
    "punch_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ip_address" TEXT,
    "device_info" TEXT,
    "photo_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_days" DOUBLE PRECISION NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "manager_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_pool_rules" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Standard Restaurant Pool',
    "foh_percentage" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "boh_percentage" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "distribution_method" "TipDistributionMethod" NOT NULL DEFAULT 'HOURS_WORKED',
    "role_points_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tip_pool_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_pool_runs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "payroll_run_id" TEXT,
    "rule_id" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_collected_tips" DOUBLE PRECISION NOT NULL,
    "foh_pool_amount" DOUBLE PRECISION NOT NULL,
    "boh_pool_amount" DOUBLE PRECISION NOT NULL,
    "distributions_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tip_pool_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "cost_center_id" TEXT,
    "type" "TransactionType" NOT NULL,
    "category" "FinancialCategory" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL_ENTRY',
    "source_reference_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "other_fees_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "other_fee_type" TEXT,
    "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "vendor_or_payer" TEXT,
    "payment_method" TEXT,
    "receipt_url" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upcoming_bills" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "title" TEXT NOT NULL,
    "category" "BillCategory" NOT NULL DEFAULT 'CREDIT_CARD',
    "vendor_or_institution" TEXT NOT NULL,
    "account_last4" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "adjusted_amount" DECIMAL(65,30),
    "due_date" TIMESTAMP(3) NOT NULL,
    "reminder_days_before" INTEGER NOT NULL DEFAULT 5,
    "status" "BillStatus" NOT NULL DEFAULT 'UPCOMING',
    "notes" TEXT,
    "receipt_or_invoice_url" TEXT,
    "auto_convert_to_expense" BOOLEAN NOT NULL DEFAULT true,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_frequency" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_amount" DECIMAL(65,30),
    "payment_method" TEXT,
    "financial_tx_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upcoming_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_checklist_templates" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL DEFAULT 'OPENING',
    "department_id" TEXT,
    "description" TEXT,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 20,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_checklist_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "role_required" TEXT,
    "priority" "ItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "requires_value_input" BOOLEAN NOT NULL DEFAULT false,
    "value_input_label" TEXT,
    "requires_photo" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_checklist_executions" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "shift_assignment_id" TEXT,
    "title" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL DEFAULT 'OPENING',
    "execution_date" TIMESTAMP(3) NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_employee_id" TEXT,
    "verified_by_employee_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_checklist_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_checklist_item_executions" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "template_item_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "role_required" TEXT,
    "priority" "ItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by_employee_id" TEXT,
    "input_value" TEXT,
    "photo_url" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shift_checklist_item_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catering_orders" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "order_number" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT,
    "client_phone" TEXT,
    "event_date" TIMESTAMP(3) NOT NULL,
    "event_time" TEXT,
    "event_type" "CateringEventType" NOT NULL DEFAULT 'BUFFET',
    "guest_count" INTEGER NOT NULL DEFAULT 50,
    "venue_address" TEXT,
    "status" "CateringOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "advance_paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catering_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catering_order_items" (
    "id" TEXT NOT NULL,
    "catering_order_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "item_name" TEXT NOT NULL,
    "category" TEXT DEFAULT 'Main Course',
    "unit_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "total_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catering_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catering_packages" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT DEFAULT 'Buffet',
    "price_per_pax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "suggested_pax" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catering_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catering_package_items" (
    "id" TEXT NOT NULL,
    "catering_package_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "item_name" TEXT NOT NULL,
    "category" TEXT DEFAULT 'Main Course',
    "unit_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "portion_qty_per_pax" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catering_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_cash_closings" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "closing_date" TIMESTAMP(3) NOT NULL,
    "opening_till_cash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cash_sales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cash_in_total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cash_out_total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expected_cash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actual_cash_count" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cash_difference" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tomorrow_opening_cash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "safe_deposit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "receipt_urls" JSONB,
    "status" "ClosingStatus" NOT NULL DEFAULT 'SUBMITTED',
    "closed_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_cash_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_adjustments" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "daily_closing_id" TEXT,
    "adjustment_type" "CashAdjustmentType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "receipt_url" TEXT,
    "entered_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approval_status" "AdjustmentApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "adjustment_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_two_factor_auth_platform_user_id_key" ON "platform_two_factor_auth"("platform_user_id");

-- CreateIndex
CREATE INDEX "platform_two_factor_recovery_codes_platform_user_id_idx" ON "platform_two_factor_recovery_codes"("platform_user_id");

-- CreateIndex
CREATE INDEX "platform_two_factor_recovery_codes_platform_two_factor_id_idx" ON "platform_two_factor_recovery_codes"("platform_two_factor_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_passkeys_credential_id_key" ON "platform_passkeys"("credential_id");

-- CreateIndex
CREATE INDEX "platform_passkeys_platform_user_id_idx" ON "platform_passkeys"("platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_trusted_devices_token_hash_key" ON "platform_trusted_devices"("token_hash");

-- CreateIndex
CREATE INDEX "platform_trusted_devices_platform_user_id_idx" ON "platform_trusted_devices"("platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_sessions_token_hash_key" ON "platform_user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "platform_user_sessions_platform_user_id_idx" ON "platform_user_sessions"("platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_auth_user_id_key" ON "two_factor_auth"("user_id");

-- CreateIndex
CREATE INDEX "two_factor_recovery_codes_user_id_idx" ON "two_factor_recovery_codes"("user_id");

-- CreateIndex
CREATE INDEX "two_factor_recovery_codes_two_factor_auth_id_idx" ON "two_factor_recovery_codes"("two_factor_auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");

-- CreateIndex
CREATE INDEX "passkeys_user_id_idx" ON "passkeys"("user_id");

-- CreateIndex
CREATE INDEX "passkeys_organization_id_idx" ON "passkeys"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");

-- CreateIndex
CREATE INDEX "trusted_devices_user_id_idx" ON "trusted_devices"("user_id");

-- CreateIndex
CREATE INDEX "trusted_devices_organization_id_idx" ON "trusted_devices"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_organization_id_idx" ON "user_sessions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_security_policies_restaurant_id_key" ON "restaurant_security_policies"("restaurant_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_organization_id_idx" ON "security_audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_user_id_idx" ON "security_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_created_at_idx" ON "security_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "inventory_vendors_restaurant_id_idx" ON "inventory_vendors"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_vendors_restaurant_id_name_key" ON "inventory_vendors"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "inventory_purchase_orders_restaurant_id_idx" ON "inventory_purchase_orders"("restaurant_id");

-- CreateIndex
CREATE INDEX "inventory_purchase_orders_outlet_id_idx" ON "inventory_purchase_orders"("outlet_id");

-- CreateIndex
CREATE INDEX "inventory_purchase_orders_vendor_id_idx" ON "inventory_purchase_orders"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_purchase_orders_restaurant_id_po_number_key" ON "inventory_purchase_orders"("restaurant_id", "po_number");

-- CreateIndex
CREATE INDEX "inventory_purchase_order_items_purchase_order_id_idx" ON "inventory_purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "inventory_purchase_order_items_item_id_idx" ON "inventory_purchase_order_items"("item_id");

-- CreateIndex
CREATE INDEX "inventory_purchase_order_items_pack_id_idx" ON "inventory_purchase_order_items"("pack_id");

-- CreateIndex
CREATE INDEX "inventory_vendor_items_restaurant_id_idx" ON "inventory_vendor_items"("restaurant_id");

-- CreateIndex
CREATE INDEX "inventory_vendor_items_vendor_id_idx" ON "inventory_vendor_items"("vendor_id");

-- CreateIndex
CREATE INDEX "inventory_vendor_items_item_id_idx" ON "inventory_vendor_items"("item_id");

-- CreateIndex
CREATE INDEX "inventory_vendor_items_pack_id_idx" ON "inventory_vendor_items"("pack_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_vendor_items_vendor_id_item_id_key" ON "inventory_vendor_items"("vendor_id", "item_id");

-- CreateIndex
CREATE INDEX "item_purchase_packs_restaurant_id_idx" ON "item_purchase_packs"("restaurant_id");

-- CreateIndex
CREATE INDEX "item_purchase_packs_item_id_idx" ON "item_purchase_packs"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_po_receipts_idempotency_key_key" ON "inventory_po_receipts"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_po_receipts_restaurant_id_idx" ON "inventory_po_receipts"("restaurant_id");

-- CreateIndex
CREATE INDEX "inventory_po_receipts_purchase_order_id_idx" ON "inventory_po_receipts"("purchase_order_id");

-- CreateIndex
CREATE INDEX "inventory_po_receipts_item_id_idx" ON "inventory_po_receipts"("item_id");

-- CreateIndex
CREATE INDEX "roster_date_availabilities_restaurant_id_idx" ON "roster_date_availabilities"("restaurant_id");

-- CreateIndex
CREATE INDEX "roster_date_availabilities_roster_id_idx" ON "roster_date_availabilities"("roster_id");

-- CreateIndex
CREATE INDEX "roster_date_availabilities_employee_id_idx" ON "roster_date_availabilities"("employee_id");

-- CreateIndex
CREATE INDEX "roster_date_availabilities_date_idx" ON "roster_date_availabilities"("date");

-- CreateIndex
CREATE UNIQUE INDEX "roster_date_availabilities_roster_id_employee_id_date_key" ON "roster_date_availabilities"("roster_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "roster_employee_submissions_restaurant_id_idx" ON "roster_employee_submissions"("restaurant_id");

-- CreateIndex
CREATE INDEX "roster_employee_submissions_roster_id_idx" ON "roster_employee_submissions"("roster_id");

-- CreateIndex
CREATE INDEX "roster_employee_submissions_employee_id_idx" ON "roster_employee_submissions"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "roster_employee_submissions_roster_id_employee_id_key" ON "roster_employee_submissions"("roster_id", "employee_id");

-- CreateIndex
CREATE INDEX "recipes_restaurant_id_idx" ON "recipes"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_restaurant_id_name_key" ON "recipes"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "recipe_items_recipe_id_idx" ON "recipe_items"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_items_inventory_item_id_idx" ON "recipe_items"("inventory_item_id");

-- CreateIndex
CREATE INDEX "recipe_items_sub_recipe_id_idx" ON "recipe_items"("sub_recipe_id");

-- CreateIndex
CREATE INDEX "pos_integrations_restaurant_id_idx" ON "pos_integrations"("restaurant_id");

-- CreateIndex
CREATE INDEX "pos_integrations_outlet_id_idx" ON "pos_integrations"("outlet_id");

-- CreateIndex
CREATE INDEX "pos_integrations_restaurant_id_provider_provider_location_i_idx" ON "pos_integrations"("restaurant_id", "provider", "provider_location_id");

-- CreateIndex
CREATE INDEX "pos_orders_restaurant_id_provider_provider_order_id_idx" ON "pos_orders"("restaurant_id", "provider", "provider_order_id");

-- CreateIndex
CREATE INDEX "pos_orders_restaurant_id_idx" ON "pos_orders"("restaurant_id");

-- CreateIndex
CREATE INDEX "pos_orders_outlet_id_idx" ON "pos_orders"("outlet_id");

-- CreateIndex
CREATE INDEX "pos_orders_order_number_idx" ON "pos_orders"("order_number");

-- CreateIndex
CREATE INDEX "pos_orders_provider_idx" ON "pos_orders"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_restaurant_id_provider_provider_order_id_key" ON "pos_orders"("restaurant_id", "provider", "provider_order_id");

-- CreateIndex
CREATE INDEX "pos_order_items_order_id_idx" ON "pos_order_items"("order_id");

-- CreateIndex
CREATE INDEX "pos_order_items_recipe_id_idx" ON "pos_order_items"("recipe_id");

-- CreateIndex
CREATE INDEX "pos_order_items_pos_menu_item_id_idx" ON "pos_order_items"("pos_menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_order_items_order_id_provider_item_id_key" ON "pos_order_items"("order_id", "provider_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_vault_profiles_user_id_key" ON "user_vault_profiles"("user_id");

-- CreateIndex
CREATE INDEX "vault_folders_restaurant_id_idx" ON "vault_folders"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "vault_folders_restaurant_id_name_key" ON "vault_folders"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "vault_items_restaurant_id_idx" ON "vault_items"("restaurant_id");

-- CreateIndex
CREATE INDEX "vault_items_author_id_idx" ON "vault_items"("author_id");

-- CreateIndex
CREATE INDEX "vault_items_folder_id_idx" ON "vault_items"("folder_id");

-- CreateIndex
CREATE INDEX "vault_item_shares_vault_item_id_idx" ON "vault_item_shares"("vault_item_id");

-- CreateIndex
CREATE INDEX "vault_item_shares_recipient_id_idx" ON "vault_item_shares"("recipient_id");

-- CreateIndex
CREATE INDEX "vault_item_shares_role_id_idx" ON "vault_item_shares"("role_id");

-- CreateIndex
CREATE INDEX "vault_item_shares_department_id_idx" ON "vault_item_shares"("department_id");

-- CreateIndex
CREATE INDEX "vault_audit_logs_restaurant_id_idx" ON "vault_audit_logs"("restaurant_id");

-- CreateIndex
CREATE INDEX "vault_audit_logs_user_id_idx" ON "vault_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "vault_audit_logs_vault_item_id_idx" ON "vault_audit_logs"("vault_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_shift_assignment_id_key" ON "attendance_records"("shift_assignment_id");

-- CreateIndex
CREATE INDEX "attendance_records_restaurant_id_idx" ON "attendance_records"("restaurant_id");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_idx" ON "attendance_records"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_records_outlet_id_idx" ON "attendance_records"("outlet_id");

-- CreateIndex
CREATE INDEX "attendance_records_work_date_idx" ON "attendance_records"("work_date");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_work_date_key" ON "attendance_records"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "time_punches_restaurant_id_idx" ON "time_punches"("restaurant_id");

-- CreateIndex
CREATE INDEX "time_punches_employee_id_idx" ON "time_punches"("employee_id");

-- CreateIndex
CREATE INDEX "time_punches_outlet_id_idx" ON "time_punches"("outlet_id");

-- CreateIndex
CREATE INDEX "time_punches_attendance_record_id_idx" ON "time_punches"("attendance_record_id");

-- CreateIndex
CREATE INDEX "time_punches_punch_time_idx" ON "time_punches"("punch_time");

-- CreateIndex
CREATE INDEX "leave_requests_restaurant_id_idx" ON "leave_requests"("restaurant_id");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_start_date_idx" ON "leave_requests"("start_date");

-- CreateIndex
CREATE INDEX "tip_pool_rules_restaurant_id_idx" ON "tip_pool_rules"("restaurant_id");

-- CreateIndex
CREATE INDEX "tip_pool_runs_restaurant_id_idx" ON "tip_pool_runs"("restaurant_id");

-- CreateIndex
CREATE INDEX "tip_pool_runs_payroll_run_id_idx" ON "tip_pool_runs"("payroll_run_id");

-- CreateIndex
CREATE INDEX "financial_transactions_restaurant_id_idx" ON "financial_transactions"("restaurant_id");

-- CreateIndex
CREATE INDEX "financial_transactions_outlet_id_idx" ON "financial_transactions"("outlet_id");

-- CreateIndex
CREATE INDEX "financial_transactions_cost_center_id_idx" ON "financial_transactions"("cost_center_id");

-- CreateIndex
CREATE INDEX "financial_transactions_transaction_date_idx" ON "financial_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "financial_transactions_type_idx" ON "financial_transactions"("type");

-- CreateIndex
CREATE INDEX "financial_transactions_category_idx" ON "financial_transactions"("category");

-- CreateIndex
CREATE INDEX "upcoming_bills_restaurant_id_idx" ON "upcoming_bills"("restaurant_id");

-- CreateIndex
CREATE INDEX "upcoming_bills_outlet_id_idx" ON "upcoming_bills"("outlet_id");

-- CreateIndex
CREATE INDEX "upcoming_bills_due_date_idx" ON "upcoming_bills"("due_date");

-- CreateIndex
CREATE INDEX "upcoming_bills_status_idx" ON "upcoming_bills"("status");

-- CreateIndex
CREATE INDEX "upcoming_bills_category_idx" ON "upcoming_bills"("category");

-- CreateIndex
CREATE INDEX "shift_checklist_templates_restaurant_id_idx" ON "shift_checklist_templates"("restaurant_id");

-- CreateIndex
CREATE INDEX "shift_checklist_templates_type_idx" ON "shift_checklist_templates"("type");

-- CreateIndex
CREATE INDEX "shift_checklist_items_template_id_idx" ON "shift_checklist_items"("template_id");

-- CreateIndex
CREATE INDEX "shift_checklist_executions_restaurant_id_idx" ON "shift_checklist_executions"("restaurant_id");

-- CreateIndex
CREATE INDEX "shift_checklist_executions_outlet_id_idx" ON "shift_checklist_executions"("outlet_id");

-- CreateIndex
CREATE INDEX "shift_checklist_executions_execution_date_idx" ON "shift_checklist_executions"("execution_date");

-- CreateIndex
CREATE INDEX "shift_checklist_executions_status_idx" ON "shift_checklist_executions"("status");

-- CreateIndex
CREATE INDEX "shift_checklist_item_executions_execution_id_idx" ON "shift_checklist_item_executions"("execution_id");

-- CreateIndex
CREATE INDEX "catering_orders_restaurant_id_idx" ON "catering_orders"("restaurant_id");

-- CreateIndex
CREATE INDEX "catering_orders_event_date_idx" ON "catering_orders"("event_date");

-- CreateIndex
CREATE UNIQUE INDEX "catering_orders_restaurant_id_order_number_key" ON "catering_orders"("restaurant_id", "order_number");

-- CreateIndex
CREATE INDEX "catering_order_items_catering_order_id_idx" ON "catering_order_items"("catering_order_id");

-- CreateIndex
CREATE INDEX "catering_order_items_recipe_id_idx" ON "catering_order_items"("recipe_id");

-- CreateIndex
CREATE INDEX "catering_packages_restaurant_id_idx" ON "catering_packages"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "catering_packages_restaurant_id_name_key" ON "catering_packages"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "catering_package_items_catering_package_id_idx" ON "catering_package_items"("catering_package_id");

-- CreateIndex
CREATE INDEX "catering_package_items_recipe_id_idx" ON "catering_package_items"("recipe_id");

-- CreateIndex
CREATE INDEX "daily_cash_closings_restaurant_id_idx" ON "daily_cash_closings"("restaurant_id");

-- CreateIndex
CREATE INDEX "daily_cash_closings_outlet_id_idx" ON "daily_cash_closings"("outlet_id");

-- CreateIndex
CREATE INDEX "daily_cash_closings_closing_date_idx" ON "daily_cash_closings"("closing_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_cash_closings_restaurant_id_outlet_id_closing_date_key" ON "daily_cash_closings"("restaurant_id", "outlet_id", "closing_date");

-- CreateIndex
CREATE INDEX "cash_adjustments_restaurant_id_idx" ON "cash_adjustments"("restaurant_id");

-- CreateIndex
CREATE INDEX "cash_adjustments_outlet_id_idx" ON "cash_adjustments"("outlet_id");

-- CreateIndex
CREATE INDEX "cash_adjustments_daily_closing_id_idx" ON "cash_adjustments"("daily_closing_id");

-- CreateIndex
CREATE INDEX "cash_adjustments_adjustment_date_idx" ON "cash_adjustments"("adjustment_date");

-- AddForeignKey
ALTER TABLE "platform_two_factor_auth" ADD CONSTRAINT "platform_two_factor_auth_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_two_factor_recovery_codes" ADD CONSTRAINT "platform_two_factor_recovery_codes_platform_two_factor_id_fkey" FOREIGN KEY ("platform_two_factor_id") REFERENCES "platform_two_factor_auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_two_factor_recovery_codes" ADD CONSTRAINT "platform_two_factor_recovery_codes_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_passkeys" ADD CONSTRAINT "platform_passkeys_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_trusted_devices" ADD CONSTRAINT "platform_trusted_devices_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_sessions" ADD CONSTRAINT "platform_user_sessions_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_two_factor_auth_id_fkey" FOREIGN KEY ("two_factor_auth_id") REFERENCES "two_factor_auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_security_policies" ADD CONSTRAINT "restaurant_security_policies_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_vendors" ADD CONSTRAINT "inventory_vendors_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "inventory_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "inventory_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "item_purchase_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_vendor_items" ADD CONSTRAINT "inventory_vendor_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_vendor_items" ADD CONSTRAINT "inventory_vendor_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "inventory_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_vendor_items" ADD CONSTRAINT "inventory_vendor_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_vendor_items" ADD CONSTRAINT "inventory_vendor_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "item_purchase_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_purchase_packs" ADD CONSTRAINT "item_purchase_packs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_purchase_packs" ADD CONSTRAINT "item_purchase_packs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_po_receipts" ADD CONSTRAINT "inventory_po_receipts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_po_receipts" ADD CONSTRAINT "inventory_po_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "inventory_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_po_receipts" ADD CONSTRAINT "inventory_po_receipts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_date_availabilities" ADD CONSTRAINT "roster_date_availabilities_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_date_availabilities" ADD CONSTRAINT "roster_date_availabilities_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "shift_rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_date_availabilities" ADD CONSTRAINT "roster_date_availabilities_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_employee_submissions" ADD CONSTRAINT "roster_employee_submissions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_employee_submissions" ADD CONSTRAINT "roster_employee_submissions_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "shift_rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_employee_submissions" ADD CONSTRAINT "roster_employee_submissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_sub_recipe_id_fkey" FOREIGN KEY ("sub_recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_integrations" ADD CONSTRAINT "pos_integrations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_integrations" ADD CONSTRAINT "pos_integrations_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vault_profiles" ADD CONSTRAINT "user_vault_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_folders" ADD CONSTRAINT "vault_folders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "vault_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_shares" ADD CONSTRAINT "vault_item_shares_vault_item_id_fkey" FOREIGN KEY ("vault_item_id") REFERENCES "vault_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_shares" ADD CONSTRAINT "vault_item_shares_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_shares" ADD CONSTRAINT "vault_item_shares_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_shares" ADD CONSTRAINT "vault_item_shares_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_logs" ADD CONSTRAINT "vault_audit_logs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_logs" ADD CONSTRAINT "vault_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_logs" ADD CONSTRAINT "vault_audit_logs_vault_item_id_fkey" FOREIGN KEY ("vault_item_id") REFERENCES "vault_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_pool_rules" ADD CONSTRAINT "tip_pool_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_pool_runs" ADD CONSTRAINT "tip_pool_runs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_pool_runs" ADD CONSTRAINT "tip_pool_runs_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_pool_runs" ADD CONSTRAINT "tip_pool_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "tip_pool_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upcoming_bills" ADD CONSTRAINT "upcoming_bills_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upcoming_bills" ADD CONSTRAINT "upcoming_bills_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_templates" ADD CONSTRAINT "shift_checklist_templates_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_templates" ADD CONSTRAINT "shift_checklist_templates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_items" ADD CONSTRAINT "shift_checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "shift_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_executions" ADD CONSTRAINT "shift_checklist_executions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_executions" ADD CONSTRAINT "shift_checklist_executions_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_executions" ADD CONSTRAINT "shift_checklist_executions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "shift_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_executions" ADD CONSTRAINT "shift_checklist_executions_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_executions" ADD CONSTRAINT "shift_checklist_executions_verified_by_employee_id_fkey" FOREIGN KEY ("verified_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_item_executions" ADD CONSTRAINT "shift_checklist_item_executions_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "shift_checklist_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_item_executions" ADD CONSTRAINT "shift_checklist_item_executions_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "shift_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_checklist_item_executions" ADD CONSTRAINT "shift_checklist_item_executions_completed_by_employee_id_fkey" FOREIGN KEY ("completed_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_orders" ADD CONSTRAINT "catering_orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_orders" ADD CONSTRAINT "catering_orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_order_items" ADD CONSTRAINT "catering_order_items_catering_order_id_fkey" FOREIGN KEY ("catering_order_id") REFERENCES "catering_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_order_items" ADD CONSTRAINT "catering_order_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_packages" ADD CONSTRAINT "catering_packages_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_package_items" ADD CONSTRAINT "catering_package_items_catering_package_id_fkey" FOREIGN KEY ("catering_package_id") REFERENCES "catering_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_package_items" ADD CONSTRAINT "catering_package_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_cash_closings" ADD CONSTRAINT "daily_cash_closings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_cash_closings" ADD CONSTRAINT "daily_cash_closings_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_adjustments" ADD CONSTRAINT "cash_adjustments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_adjustments" ADD CONSTRAINT "cash_adjustments_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_adjustments" ADD CONSTRAINT "cash_adjustments_daily_closing_id_fkey" FOREIGN KEY ("daily_closing_id") REFERENCES "daily_cash_closings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

