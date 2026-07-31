# Current State & Development Roadmap

This document captures the current status of the project, including completed works, active database status, and the roadmap for upcoming phases.

---

## 1. Project Phase Summary

* **Current Phase**: Phase 2 (Restaurant Administration & Workforce Foundation)
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
6. **Security & Verification Suite**: Built `src/core/tests/phase2-security.test.ts` verifying all 14 Phase 2 security requirements (tenant isolation, limit enforcement, employee/user separation, disabled module grant rejection, access revocation, tokenVersion invalidation). Both `security.test.ts` and `phase2-security.test.ts` pass 100% (28/28 assertions total).
7. **Production Build & Verification**: Passed `npx tsc --noEmit`, ESLint, and `npm run build` compilation with 0 errors.

### Database Status:
* Relational database schema fully synced to PostgreSQL database `restaurant_saas` at `localhost:5432`.
* Migrations applied using `DIRECT_DATABASE_URL`.
* Runtime queries running through PgBouncer `DATABASE_URL`.
* Seeding executed for default modules, permissions, and subscription plans.


---

## 2. Multi-Phase Development Roadmap

```text
  Phase 0         Phase 1          Phase 2          Phase 3          Phase 4          Phase 5
+----------+    +----------+     +----------+     +----------+     +----------+     +----------+
|  System  |    | Next.js  |     | Tenant   |     | Inventory|     | Shifts   |     | Audit    |
| Design & | -> | Shell &  |  -> | Auth &   |  -> | & HR     |  -> | & Payroll|  -> | Branding |
| Planning |    | Super    |     | Access   |     | Modules  |     | Modules  |     | & Launch |
| (Active) |    | Admin    |     | Control  |     | (Core)   |     | (Advance)|     | (Prod)   |
+----------+    +----------+     +----------+     +----------+     +----------+     +----------+
```

### Phase 1: Foundations & Platform Administration
* **Goals**: Bootstrap the Next.js workspace, database setup, and Platform Admin capability.
* **Deliverables**:
  * Next.js App Router scaffolding with TypeScript, Prisma, and Tailwind CSS.
  * Subdomain routing handler matching the `subdomain` parameter or custom domain headers.
  * Super Admin authentication (`platform_users`) and Super Admin UI dashboard.
  * Restaurant onboarding screens: Create Restaurant, configure subscription limits (Plan, Outlets, Employees), and enable selected modules.
  * Automate seeding script containing initial `modules` and standard system `permissions`.

### Phase 2: Tenant Access Control & Membership Management
* **Goals**: Enable secure authentication and granular permission checks.
* **Deliverables**:
  * User register/login flow for restaurant members.
  * Secure server-side session management (JWT / Iron Session).
  * 3-tier Authorization Middleware verifying tenant module entitlement, user module entitlement, and action permissions.
  * Restaurant Admin Portal: Add outlets/branches, create custom roles, configure role permissions, and issue access grants to users.

### Phase 3: Core Module Operations (HR & Inventory)
* **Goals**: Implement the operational core of the platform.
* **Deliverables**:
  * **HR Onboarding**: Joining forms, file upload/storage hook (Mock S3/local storage), onboarding task status checklist, and onboarding approval state machine.
  * **Inventory Management**: Category master, item definitions, real-time stock ledger, wastage tracking, and simple low-stock alert logic.

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
