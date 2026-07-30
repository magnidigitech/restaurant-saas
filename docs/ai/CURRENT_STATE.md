# Current State & Development Roadmap

This document captures the current status of the project, including completed works, active database status, and the roadmap for upcoming phases.

---

## 1. Project Phase Summary

* **Current Phase**: Phase 1.1 (Production Hardening and PgBouncer Integration)
* **Status**: Completed

### Work Completed:
1. **Workspace Bootstrap**: Next.js App Router workspace set up with Tailwind CSS, Zod, TypeScript, and ESLint.
2. **Next.js 16 Proxy Migration**: Migrated deprecated middleware.ts to `src/proxy.ts` using Next.js 16 proxy routing convention, isolating database accesses from edge request routes.
3. **Database Engine**: Configured Prisma 7 schema mapped with all 17 tables, proper indexes for `restaurant_id` / `outlet_id`, and transaction/migration connection options.
4. **Session Versioning**: Implemented User `tokenVersion` DB tracking. The authorization engine validates user sessions against this version on every request, allowing instantaneous global logout/revocation.
5. **Cryptographic Invitation Hashing**: Staff invitation UUIDs are hashed with `SHA-256` before storing, keeping plaintext credentials out of the database tables.
6. **Authentication Protections**: Configured CSRF origin/referer validation and built-in in-memory rate limiting to block brute force dictionary logins.
7. **PgBouncer Orchestration**: Designed PgBouncer transaction pooling container config (`pgbouncer.ini`, `userlist.txt`) and added it to private `saas-network` services in `docker-compose.yml`.
8. **Prisma Connection Pooling**: Pinned client runtime database connections to explicit pool limits matching PgBouncer limits in `src/core/database/client.ts`.
9. **Health Check APIs**: Built lightweight liveness check (`GET /api/health/live`) and ready check (`GET /api/health/ready` performing `SELECT 1` DB ping).
10. **CLI Scripts**: Added NPM script commands for migrations, client generation, database seed execution, and security tests execution.
11. **Verification Suite**: Expanded `src/core/tests/security.test.ts` to assert all 14 tenant-isolation, cross-subdomain, invitation-lifecycle, session-revocation, and outlet-scope constraints.

### Database Status:
* Relational database tables pushed and synced to PostgreSQL database `restaurant_saas` at `localhost:5432` using `postgres:postgres` credentials.
* Database client singleton fully configured with PG driver adapter wrapper and custom pool capacity constraints.
* Seeding executed successfully.


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
