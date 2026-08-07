# Current State & Development Roadmap

This document captures the current status of the project, including completed works, active database status, and the roadmap for upcoming phases.

---

## 1. Project Phase Summary

* **Current Phase**: Phase 3 (Core Module Operations — HR Onboarding & Inventory Management)
* **Status**: Completed

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
8. **Production Build & Verification**: Passed `npx tsc --noEmit`, ESLint, and `npm run build` compilation with 0 errors.
9. **Phase 3 — HR Onboarding Module**:
   - **Database Entities**: `OnboardingTemplate`, `OnboardingTask`, `EmployeeOnboarding`, `OnboardingTaskProgress`, `EmployeeFileUpload` with enums `OnboardingStatus`, `TaskStatus`, `FileCategory`. Migration: `20260806161738_phase3_hr_inventory`.
   - **Service Module**: `src/modules/hr-onboarding/service.ts` — full template CRUD, onboarding session lifecycle state machine (`PENDING → IN_PROGRESS → PENDING_APPROVAL → APPROVED / REJECTED → IN_PROGRESS`), task progress tracking, and approval/rejection flows.
   - **API Routes**: 8 endpoints under `/api/restaurant/onboarding/` — templates (GET, POST), template [id] (GET, PATCH, DELETE with add/update/delete task sub-actions), sessions (GET, POST), session [id] (GET), tasks (GET, PATCH), submit, approve, reject.
   - **File Upload API**: `/api/restaurant/uploads` — multipart form data upload, 10MB per-file limit, MIME allowlist, per-tenant `storageQuotaGb` enforcement, writes to `public/uploads/<restaurantId>/`.
   - **UI Pages**: `workforce/onboarding/` (session dashboard with stats, status filters, progress bars), `workforce/onboarding/templates/` (two-panel template editor with task management), `workforce/onboarding/[sessionId]/` (task checklist, file upload per task, approval panel).
10. **Phase 3 — Inventory Module**:
    - **Database Entities**: `InventoryCategory` (hierarchical tree with `parentId`), `InventoryItem`, `StockLedger` (immutable journal), `WastageLog` with enums `StockMovementType`, `WastageReason`, `UnitOfMeasure`.
    - **Service Module**: `src/modules/inventory/service.ts` — categories CRUD, items CRUD with stock aggregation from ledger, stock movement recording (transactional), wastage logging (auto-creates negative ledger entry), low-stock alerts (items ≤ reorder point), per-outlet stock views.
    - **API Routes**: 7 endpoints under `/api/restaurant/inventory/` — categories (GET, POST), categories/[id] (PATCH, DELETE), items (GET, POST), items/[id] (GET, PATCH, DELETE), stock (GET, POST), wastage (GET, POST), alerts (GET).
    - **UI Pages**: `inventory/` (dashboard with stat cards, alert banner, nav cards), `inventory/items/` (desktop table + mobile cards, low-stock indicators), `inventory/categories/` (recursive tree with sub-category indentation), `inventory/stock/` (outlet-scoped stock bars, adjust + wastage modals), `inventory/alerts/` (severity bars, deficit + suggested order quantities).
11. **Dashboard Navigation Updated**: Added HR Onboarding card to Workforce section, Inventory section in Operations grid (module-gated).
12. **Phase 3 Security Tests**: `src/core/tests/phase3-security.test.ts` — 10/10 assertions pass covering tenant isolation for all 5 new entity types and cross-tenant operation blocking.
13. **Production Build & Verification**: `npx tsc --noEmit` 0 errors, `npm run build` 0 errors — 74 routes compiled (37 static, 37 dynamic).

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


---

## 2. Multi-Phase Development Roadmap

```text
  Phase 0         Phase 1          Phase 2          Phase 3          Phase 4          Phase 5
+----------+    +----------+     +----------+     +----------+     +----------+     +----------+
|  System  |    | Next.js  |     | Tenant   |     | Inventory|     | Shifts   |     | Audit    |
| Design & | -> | Shell &  |  -> | Auth &   |  -> | & HR     |  -> | & Payroll|  -> | Branding |
| Planning |    | Super    |     | Access   |     | Modules  |     | Modules  |     | & Launch |
| (Done)   |    | Admin    |     | Control  |     | (Done ✅) |     | (Next)   |     | (Prod)   |
+----------+    +----------+     +----------+     +----------+     +----------+     +----------+
```

### Phase 1: Foundations & Platform Administration ✅
* Completed — Next.js workspace, Super Admin auth, restaurant onboarding, module/plan seeding.

### Phase 2: Tenant Access Control & Membership Management ✅
* Completed — Employee directory, roles/permissions, access grants, workforce UI.

### Phase 3: Core Module Operations (HR & Inventory) ✅
* Completed — HR Onboarding state machine + UI, Inventory stock ledger + UI.

### Phase 4: Intermediate Modules & Integrations (Shifts & Payroll)
* **Goals**: Complete scheduling and financial operations.
* **Deliverables**:
  * **Shift Management**: Shift template generator, weekly roster scheduler, shift swap request workflow.
  * **Payroll Management**: Salary structure config, automated monthly run calculation, payslip rendering.
  * **Integration hooks**: Make payroll optional integration with shift schedules (automatically pulling hours worked if enabled, falling back to manual input).

### Phase 5: Audit, Branding & Launch Readiness
* **Goals**: Wrap up enterprise requirements and launch.
* **Deliverables**:
  * Audit logging module recording database changes, IP addresses, and user actions.
  * Tenant-specific white-labeling injection (Logo, Application Title, CSS Theme override).
  * System-wide performance validation and security penetration audits.
