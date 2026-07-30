Implement Phase 2: Restaurant Administration and Employee Foundation.

The Phase 1 and Phase 1.1 foundation is complete.

Do not implement payroll calculations, attendance processing, complete shift scheduling or inventory workflows during this phase.

At task start, read only:

* docs/ai/PROJECT_CONTEXT.md
* docs/ai/PROJECT_MAP.md
* docs/ai/CURRENT_STATE.md
* docs/ai/ACCESS_CONTROL.md
* docs/ai/MODULE_REGISTRY.md
* docs/ai/DECISIONS.md

Do not recursively inspect the repository.

Search for exact Prisma models, routes, components and authorization functions before opening files.

## Objective

Allow a Restaurant Administrator to manage:

* Restaurant profile
* Restaurant branding
* Outlets
* Employees
* Employment records
* Internal user accounts
* Invitations
* Custom roles
* Permissions
* Module access grants
* Outlet-specific access

Only modules enabled by Platform Super Admin may be assigned to restaurant staff.

## Core Modelling Rule

Employee identity and application login identity must remain separate.

An Employee may exist without a User account.

A User may receive access to an Employee record through a RestaurantMembership.

Recommended relationship:

```text
Employee
    ↓ optional relationship
RestaurantMembership
    ↓
User
```

Do not require every employee to have an email address or application login.

## Employee Entities

Create or extend models for:

### Employee

Required fields:

* id
* restaurantId
* employeeCode
* firstName
* lastName
* preferredName
* workEmail
* personalEmail
* phone
* alternatePhone
* dateOfBirth
* joiningDate
* profilePhotoUrl
* employmentStatus
* workerType
* primaryOutletId
* reportingManagerEmployeeId
* createdAt
* updatedAt
* archivedAt

Sensitive or optional employee information should be stored only when needed.

Create a unique constraint for:

```text
restaurantId + employeeCode
```

Do not make employee codes globally unique.

### EmploymentRecord

Support employment history rather than placing all mutable job information directly on Employee.

Fields should include:

* id
* restaurantId
* employeeId
* outletId
* departmentId
* designationId
* employmentType
* effectiveFrom
* effectiveTo
* status
* probationEndDate
* notes
* createdAt
* updatedAt

Only one current primary employment record should be active for an employee unless multi-assignment is explicitly enabled.

### EmployeeOutletAssignment

Support employees working in more than one outlet.

Fields:

* id
* restaurantId
* employeeId
* outletId
* assignmentType
* effectiveFrom
* effectiveTo
* status

### Department

Restaurant-scoped fields:

* id
* restaurantId
* name
* code
* status

### Designation

Restaurant-scoped fields:

* id
* restaurantId
* name
* code
* status

Do not hard-code department or designation lists globally.

## Restaurant Administration

Create Restaurant Admin screens and APIs for:

* Viewing and editing restaurant profile
* Uploading or changing branding details
* Viewing enabled modules
* Viewing subscription and account limits
* Managing outlets
* Activating or deactivating outlets
* Managing departments
* Managing designations
* Managing employees
* Archiving employees

Restaurant Administrators must not be able to:

* Enable an unpurchased module
* Change the platform subscription plan
* Increase platform-defined limits
* Access another restaurant
* Access Platform Super Admin functionality

## Outlet Management

Restaurant Admin must be able to configure:

* Outlet name
* Outlet code
* Address
* Timezone
* Currency
* Contact information
* Status
* Opening date

Enforce Platform Super Admin outlet limits during outlet creation.

Do not rely only on frontend limit checks.

## Employee Workflow

Implement:

```text
Create Employee
    ↓
Assign Primary Outlet
    ↓
Assign Department and Designation
    ↓
Create Employment Record
    ↓
Optionally Create Login Invitation
    ↓
Assign Roles and Module Access
```

Creating an Employee must not automatically create a User account.

## Internal Login Creation

Restaurant Admin may optionally grant an employee application access.

Workflow:

1. Select an existing employee.
2. Enter or confirm the login email.
3. Create a RestaurantMembership.
4. Generate a secure StaffInvitation.
5. Assign one or more AccessGrants.
6. Send or display the activation link through the existing invitation mechanism.
7. Record all actions in the audit log.

Prevent duplicate active memberships for the same User and Restaurant.

Invitation tokens must continue using the Phase 1.1 hashed-token design.

## Roles and Permissions

Support:

* Platform-defined default roles
* Restaurant-defined custom roles
* Module-specific roles
* Outlet-specific access
* Restaurant-wide access when outletId is null

Default restaurant roles may include:

* Restaurant Owner
* Restaurant Administrator
* HR Manager
* Shift Manager
* Payroll Manager
* Inventory Manager
* Outlet Manager
* Viewer

Restaurant-defined roles must be scoped by restaurantId.

Restaurant users must never modify platform-level permissions.

## Access Grants

Use the existing AccessGrant design.

Each access grant must connect:

* restaurant membership
* enabled module
* role
* optional outlet

Validation requirements:

1. The restaurant owns the membership.
2. The module is enabled for the restaurant.
3. The role belongs to the restaurant or is an approved platform default.
4. The outlet belongs to the restaurant.
5. The user creating the grant has permission to assign access.
6. Account user limits have not been exceeded.

When Platform Super Admin disables a module, all related grants must become unusable immediately without requiring their deletion.

## Account Limits

Enforce limits for:

* Outlets
* Employees
* Internal users
* Active invitations where relevant

Limits must be checked transactionally during creation.

Return clear errors without revealing internal plan implementation details.

## UI Requirements

Create mobile-first Restaurant Admin pages for:

* Restaurant settings
* Outlets
* Employees
* Employee details
* Departments
* Designations
* Users and invitations
* Roles
* Access grants

Use responsive tables on desktop and card/list views on mobile.

Show disabled modules as unavailable only where useful for administrators. Do not show disabled module navigation to ordinary users.

## Security Requirements

Every query and mutation must be scoped by the authenticated restaurant context.

Never trust these client-provided values as authorization:

* restaurantId
* membershipId
* employeeId ownership
* outlet ownership
* module entitlement
* role ownership

Identifiers may be received as resource references, but ownership must be resolved and verified in the database.

Add tests proving:

* Restaurant A cannot view or update Restaurant B employees.
* Restaurant A cannot assign Restaurant B outlets.
* Restaurant Admin cannot exceed employee limits.
* Restaurant Admin cannot exceed internal user limits.
* Employee creation does not automatically create login access.
* A disabled module cannot be assigned.
* A role from another restaurant cannot be assigned.
* An outlet from another restaurant cannot be assigned.
* An archived employee cannot receive a new login without reactivation.
* Duplicate active membership creation is rejected.
* Invitation tokens remain single-use and restaurant-bound.
* Removing an AccessGrant revokes access immediately.
* Disabling a user invalidates existing sessions.
* Outlet-scoped access cannot retrieve another outlet's employee data.

## Audit Events

Record:

* Restaurant profile updated
* Branding updated
* Outlet created
* Outlet updated
* Outlet deactivated
* Department created or updated
* Designation created or updated
* Employee created
* Employee updated
* Employee archived
* Employment record changed
* Login invitation created
* Invitation revoked
* Membership activated or suspended
* Role created
* Permission assignment changed
* Access grant created
* Access grant removed

Do not log passwords, session tokens, invitation tokens or sensitive document contents.

## Database and Migration Requirements

Create versioned Prisma migrations.

Do not use force-reset outside disposable local development.

Verify migrations using DIRECT_DATABASE_URL.

Runtime queries must continue using DATABASE_URL through PgBouncer.

Update seed data only for platform defaults. Do not seed fake production restaurants or employees.

## Completion Requirements

Run:

* Prisma validation
* Prisma generation
* Migration on a disposable test database
* Type checking
* ESLint
* Production build
* Existing 14 Phase 1.1 security tests
* New Phase 2 security tests
* PgBouncer runtime query test

Update:

* docs/ai/CURRENT_STATE.md
* docs/ai/PROJECT_MAP.md
* docs/ai/ACCESS_CONTROL.md
* docs/ai/DECISIONS.md only for lasting architectural changes

Final report must contain:

* Features completed
* Files changed
* Migration names
* New entities
* APIs created
* UI pages created
* Security assertions and results
* Known limitations
* Items deferred to Phase 3

Do not implement complete HR onboarding workflows, payroll calculations, attendance calculations, shift roster generation or inventory transactions during this phase.
