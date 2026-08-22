# Current State & Development Roadmap

This document captures the current status of the project, including completed works, active database status, and the roadmap for upcoming phases.

---

## 1. Project Phase Summary

* **Current Phase**: Phase 4 (Intermediate Module Operations — Shift Management & Payroll Management)
* **Status**: Completed ✅

### Work Completed:
1. **Workspace Bootstrap & Production Hardening**: Next.js App Router workspace set up with Tailwind CSS, Zod, TypeScript, ESLint, PgBouncer transaction pooling, tokenVersion session invalidation, and hashed invitation tokens.
2. **Phase 2 Database Entities**: Expanded Prisma schema with 9 new entities (`Department`, `Designation`, `JobGrade`, `CostCenter`, `Employee`, `EmploymentRecord`, `EmployeeOutletAssignment`, `EmployeeEmergencyContact`, `EmployeeDocument`) and enums (`EmploymentStatus`, `WorkerType`, `AssignmentType`, `DocumentType`). Applied migration `20260731072219_phase2_init`.
3. **Master Data Module**: Created `src/modules/master-data/service.ts` owning tenant-isolated CRUD for departments, designations, job grades, and cost centers.
4. **Restaurant Administration APIs**: Built complete REST API suite under `src/app/api/restaurant/` for profile/branding, outlets (with transactional `maxOutlets` limit enforcement), departments, designations, job grades, cost centers, employees (with auto-generated `EMP-00001` codes per restaurant and transactional `maxEmployees` limit check), employment records, outlet assignments, emergency contacts, document metadata, internal user logins (with `maxAdminUsers` limit check), custom roles, system permissions, and module access grants.
5. **Module Add-on Pricing & Unselected Defaults**: Updated `Module` schema with `priceMonthly` Decimal field (migration `20260731094440_add_module_pricing`). Added `/api/platform-admin/modules` APIs and a dedicated **Module Add-on Pricing** settings tab in Platform Admin Dashboard for Super Admins to manage monthly module add-on fees. Removed pre-selected module defaults from restaurant onboarding form (now initialized as empty `[]`). Added real-time total subscription + add-on pricing calculation during tenant onboarding.
6. **Restaurant Admin Mobile-First UI Pages**:
   - `settings/profile` (Profile & Branding, color pickers, limit overview)
   - `settings/outlets` (Physical branches, timezones, currencies, creation modal)
   - `settings/master-data` (Tabbed departments, designations, job grades, cost centers)
   - `workforce/employees` (Directory, search, filters, mobile card view, desktop table view, `EMP-00001` auto-coding)
   - `workforce/employees/[id]` (Detail view with Profile, History, Outlets, Contacts, Documents tabs)
   - `workforce/users` (Internal login generation for existing employees, invite link creation)
   - `settings/roles-permissions` (Custom role builder & permissions matrix)
   - `settings/access-grants` (Module & outlet access grant matrix)
7. **Security & Verification Suite**: Built `src/core/tests/phase2-security.test.ts` verifying all 14 Phase 2 security requirements (tenant isolation, limit enforcement, employee/user separation, disabled module grant rejection, access revocation, tokenVersion invalidation). Both `security.test.ts` and `phase2-security.test.ts` pass 100% (28/28 assertions total).
8. **Phase 3 — HR Onboarding & Inventory Modules**:
   - Database Entities: `OnboardingTemplate`, `OnboardingTask`, `EmployeeOnboarding`, `OnboardingTaskProgress`, `EmployeeFileUpload`, `InventoryCategory`, `InventoryItem`, `StockLedger`, `WastageLog`, `Vendor`, `PurchaseOrder`, `PurchaseOrderItem`, `VendorItem`.
   - Service Modules: `src/modules/hr-onboarding/service.ts`, `src/modules/inventory/service.ts`.
   - UI Pages: Onboarding sessions & templates editor, item master, purchase order manager, wastage & stock adjusting, minimum-stock alerts.
   - Verification: `phase3-security.test.ts` passing 10/10 assertions.
9. **Phase 4 — Shift Management Module**:
   - **Database Entities**: `ShiftTemplate`, `ShiftRoster`, `ShiftAssignment`, `ShiftAvailability`, `ShiftSwapRequest` with enums `RosterStatus`, `ShiftAssignmentStatus`, `SwapRequestStatus`. Migration: `20260816170600_phase4_shifts_payroll`.
   - **Service Module**: `src/modules/shifts/service.ts` — shift template CRUD, weekly/monthly roster creation and publication, shift assignment engine with outlet scoping, recurring employee availability tracking, and shift swap approval state machine (which automatically swaps employee assignments on the roster upon approval).
   - **API Routes**: 8 endpoints under `/api/restaurant/shifts/` — templates (GET, POST), templates/[id] (GET, PATCH, DELETE), rosters (GET, POST), rosters/[id] (GET, PATCH, DELETE), rosters/[id]/publish (POST), assignments (GET, POST, PATCH, DELETE), availability (GET, POST), swaps (GET, POST), swaps/[id] (PATCH).
   - **UI Pages**:
     - `shifts/` (dashboard with active templates, published rosters, scheduled shifts, pending swaps, and upcoming preview)
     - `shifts/templates/` (template manager modal with time picker, break minutes, and color coding)
     - `shifts/rosters/` (interactive 7-day weekly schedule grid by outlet, roster draft/publish controls, and shift assignment modal)
     - `shifts/swaps/` (trade request review cards with one-click approve/reject actions and review notes)
10. **Phase 4 — Payroll Management Module**:
    - **Database Entities**: `SalaryStructure`, `PayrollRun`, `Payslip`, `PayrollEarning`, `PayrollDeduction`, `PayrollPayment` with enums `PayFrequency`, `PayrollRunStatus`, `PayslipStatus`, `EarningType`, `DeductionType`, `PaymentMethod`, `PaymentStatus`.
    - **Service Module**: `src/modules/payroll/service.ts` — employee salary structure definitions (base rate, pay frequency, allowances JSON, deduction withholding JSON), monthly/bi-weekly calculation run engine, payslip generation, and payment settlement.
    - **Loose Shift Integration**: The calculation engine automatically checks if the `shifts` module is active for the tenant; if enabled, aggregates scheduled hours worked in the period to compute hourly wages, with immediate fallback to base monthly pay or manual inputs.
    - **API Routes**: 7 endpoints under `/api/restaurant/payroll/` — salary-structures (GET, POST), salary-structures/[employeeId] (GET), runs (GET, POST), runs/[id] (GET, DELETE), runs/[id]/calculate (POST), runs/[id]/approve (POST), runs/[id]/pay (POST), payslips (GET), payslips/[id] (GET).
    - **UI Pages**:
      - `payroll/` (dashboard with YTD spend, latest run net, pending runs, and historical run list)
      - `payroll/salary-structures/` (employee compensation directory and structure configuration drawer)
      - `payroll/runs/` (pay cycles table & initiate new pay cycle wizard)
      - `payroll/runs/[id]/` (calculation engine runner, KPI cards, employee breakdown, approve and mark paid controls)
      - `payroll/payslips/[id]/` (itemized official printable salary payslip)
11. **Phase 4 Security & Verification**:
    - `src/core/tests/phase4-security.test.ts` — 21/21 assertions pass verifying strict multi-tenant isolation across all shift and payroll entities, cross-restaurant blocking, shift swap state transition, and loose integration calculation accuracy.
    - Total test assertions across all suites: 59 passed, 0 failed.
12. **Production Build & Verification**:
    - `npx tsc --noEmit` passed with 0 errors.
    - `npm run build` compiled 113 routes with 0 errors.

### Database Status:
* Relational database schema fully synced to PostgreSQL database `restaurant_saas` at `localhost:5432`.
* Migrations applied using `DIRECT_DATABASE_URL`.
* Runtime queries running through PgBouncer `DATABASE_URL`.
* Seeding executed for default modules, permissions, and subscription plans.
* Migration history:
  - `20260730112853_init` — Phase 1 foundation
  - `20260731072219_phase2_init` — Phase 2 workforce entities
  - `20260731094440_add_module_pricing` — Module pricing field
  - `20260731124545_add_master_data_descriptions` — Master data descriptions
  - `20260806161738_phase3_hr_inventory` — Phase 3 HR Onboarding + Inventory entities
  - `20260806164548_phase3_advanced_onboarding` — Advanced onboarding fields
  - `20260816170600_phase4_shifts_payroll` — Phase 4 Shift & Payroll entities

---

## 2. Multi-Phase Development Roadmap

```text
  Phase 0         Phase 1          Phase 2          Phase 3          Phase 4          Phase 5
+----------+    +----------+     +----------+     +----------+     +----------+     +----------+
|  System  |    | Next.js  |     | Tenant   |     | Inventory|     | Shifts   |     | Audit    |
| Design & | -> | Shell &  |  -> | Auth &   |  -> | & HR     |  -> | & Payroll|  -> | Branding |
| Planning |    | Super    |     | Access   |     | Modules  |     | Modules  |     | & Launch |
| (Done)   |    | Admin    |     | Control  |     | (Done ✅) |     | (Done ✅) |     | (Next)   |
+----------+    +----------+     +----------+     +----------+     +----------+     +----------+
```

### Phase 1: Foundations & Platform Administration ✅
* Completed — Next.js workspace, Super Admin auth, restaurant onboarding, module/plan seeding.

### Phase 2: Tenant Access Control & Membership Management ✅
* Completed — Employee directory, roles/permissions, access grants, workforce UI.

### Phase 3: Core Module Operations (HR & Inventory) ✅
* Completed — HR Onboarding state machine + UI, Inventory stock ledger, purchase orders + UI.

### Phase 4: Intermediate Modules & Integrations (Shifts & Payroll) ✅
* Completed — Shift templates, weekly visual roster scheduler, swap approval workflow, salary structures, payroll calculation engine (with auto shift aggregation), payslip generation & printing.

### Phase 5: Audit, Branding & Launch Readiness (Next)
* **Goals**: Enterprise white-labeling, audit logging, and production readiness.
* **Deliverables**:
  * Centralized audit logging middleware recording IP addresses, browser agents, previous/new value diffs.
  * Restaurant white-labeling injection (Logo, custom CSS theme, dynamic favicon and application branding).
  * Production hardening and deployment verification.
