Implement Phase 1 of the multi-tenant modular restaurant operations SaaS.

Read only:

* docs/ai/PROJECT_CONTEXT.md
* docs/ai/PROJECT_MAP.md
* docs/ai/CURRENT_STATE.md
* docs/ai/DECISIONS.md

Do not recursively inspect the repository.

## Phase 1 Objective

Build the shared platform foundation required before implementing Inventory, Shift Management, HR Onboarding or Payroll.

Do not implement complete business modules during this phase.

## Required Technology

* Next.js App Router
* TypeScript
* PostgreSQL
* Prisma
* Tailwind CSS
* Secure server-side authentication
* Docker-ready application structure
* Modular monolith architecture

Inspect the installed Prisma and Next.js versions before choosing version-specific configuration.

## Required Project Structure

Create or confirm the following architecture:

```text
src/
├── app/
│   ├── platform-admin/
│   ├── restaurant/
│   └── api/
├── core/
│   ├── auth/
│   ├── database/
│   ├── tenancy/
│   ├── permissions/
│   ├── modules/
│   ├── audit/
│   └── validation/
├── modules/
│   ├── hr-onboarding/
│   ├── shifts/
│   ├── attendance/
│   ├── payroll/
│   └── inventory/
└── components/
```

Business module folders may contain placeholders only during Phase 1.

## Database Entities

Implement the initial database schema for:

* User
* PlatformUser
* Restaurant
* RestaurantBranding
* RestaurantDomain
* RestaurantOutlet
* RestaurantMembership
* Module
* RestaurantModule
* Role
* Permission
* RolePermission
* AccessGrant
* SubscriptionPlan
* RestaurantSubscription
* AuditLog
* StaffInvitation

Every restaurant-owned record must contain `restaurantId`.

Every outlet-specific record must contain `outletId`.

Use appropriate indexes and compound unique constraints.

## Platform Super Admin

Create a separate Platform Super Admin area.

Platform Super Admin must be able to:

* Log in securely
* View restaurants
* Create a restaurant
* Edit restaurant details
* Activate a restaurant
* Suspend a restaurant
* Deactivate a restaurant
* Create the primary Restaurant Administrator
* Enable or disable modules for a restaurant
* Set outlet limits
* Set employee limits
* Set internal user limits
* View restaurant subscription information
* View platform audit logs

Restaurant users must never access Platform Super Admin routes or APIs.

## Restaurant Creation Workflow

Implement:

1. Super Admin enters restaurant information.
2. Super Admin selects enabled modules.
3. Super Admin sets account limits.
4. Super Admin creates the primary Restaurant Administrator.
5. The system creates the restaurant membership.
6. The system assigns the Restaurant Owner or Restaurant Admin role.
7. The system sends or prepares a secure account activation invitation.
8. Every step is recorded in the audit log.

Restaurant self-signup is not required.

## Initial Module Registry

Seed the following modules:

* `hr_onboarding`
* `shift_management`
* `attendance`
* `leave_management`
* `payroll`
* `inventory`
* `vendor_management`
* `purchase_management`

Each module must contain:

* Internal key
* Display name
* Description
* Status
* Sort order
* Dependency metadata
* Availability status

Do not hard-code module access only in the frontend.

## Access-Control Requirements

Every protected request must verify:

1. User authentication
2. Restaurant membership
3. Restaurant status
4. Restaurant module entitlement
5. User module access
6. Required action permission
7. Outlet access when applicable

Never trust `restaurantId`, `outletId`, role or permission values supplied by the browser.

Resolve the active restaurant from the authenticated server context.

Platform Super Admin authorization and Restaurant User authorization must remain completely separate.

## Module Entitlement Behaviour

When a module is disabled for a restaurant:

* It must not appear in navigation.
* Its pages must be inaccessible.
* Its API routes must reject requests.
* Direct URL access must fail.
* The user must not receive module data.
* Restaurant administrators must not be able to enable it.

Only Platform Super Admin may enable or disable restaurant modules.

## Audit Logging

Record important actions including:

* Restaurant created
* Restaurant updated
* Restaurant activated
* Restaurant suspended
* Restaurant administrator created
* Module enabled
* Module disabled
* Account limit changed
* User invited
* Role assigned
* Permission changed

Audit records should include:

* Actor
* Restaurant
* Action
* Entity type
* Entity identifier
* Previous values when appropriate
* New values when appropriate
* Timestamp
* Request metadata where safely available

## Database Connections

Prepare environment-variable support for:

```env
DATABASE_URL=
DIRECT_DATABASE_URL=
```

Runtime queries will eventually use PgBouncer through `DATABASE_URL`.

Prisma migrations and administrative operations will use `DIRECT_DATABASE_URL`.

Do not deploy PgBouncer until the initial application and PostgreSQL services are functional, but ensure the database configuration supports adding it without code restructuring.

## Security Tests

Add tests proving:

* Restaurant A cannot access Restaurant B.
* Restaurant users cannot access Platform Super Admin.
* A restaurant cannot access a disabled module.
* A user without a permission cannot perform that action.
* An outlet-limited user cannot access another outlet.
* A suspended restaurant cannot use protected restaurant functionality.
* Browser-supplied restaurant identifiers cannot override server tenant context.

## Deliverables

Before implementation, provide:

* Files to create
* Files to modify
* Database impact
* Authentication impact
* Tenant-security impact
* Permission impact

After implementation, provide:

* Completed functionality
* Files changed
* Prisma migrations created
* Seed data created
* Tests performed
* Known limitations
* Recommended Phase 2 tasks

Update:

* docs/ai/CURRENT_STATE.md
* docs/ai/PROJECT_MAP.md
* docs/ai/DECISIONS.md only when a new lasting decision is made

Do not scan unrelated files.

Do not implement complete Inventory, Payroll, Shift or HR workflows during this phase.

Do not introduce microservices, Redis, queues or unnecessary infrastructure.
