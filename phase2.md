# Phase 2 — Restaurant Administration & Workforce Foundation

## Context

Phase 1 (Platform Foundation) and Phase 1.1 (Production Hardening & PgBouncer Integration) are complete.

The platform is running on:

* Next.js 16 App Router
* PostgreSQL
* Prisma 7
* PgBouncer
* Multi-tenant architecture
* Platform Super Admin
* Restaurant Admin
* JWT Authentication
* Proxy-based tenant routing
* Module entitlement
* Access Grants
* Security verification suite

Read ONLY these files before implementation:

* docs/ai/PROJECT_CONTEXT.md
* docs/ai/PROJECT_MAP.md
* docs/ai/CURRENT_STATE.md
* docs/ai/ACCESS_CONTROL.md
* docs/ai/MODULE_REGISTRY.md
* docs/ai/DECISIONS.md

Do NOT recursively inspect the repository.

Search only for the exact Prisma models, routes, components and authorization utilities required before opening files.

---

# Objective

Build the complete Restaurant Administration and Workforce Foundation.

Do NOT implement:

* Payroll calculations
* Attendance processing
* Shift scheduling engine
* Inventory workflows
* Purchasing
* Kitchen production

This phase builds the organization layer that every future module depends on.

---

# Architecture Rules

## Employee and Login must remain separate

Never merge employee identity with authentication.

Relationship:

```text
Employee
        │
        ├── Employment Records
        ├── Emergency Contacts
        ├── Documents
        ├── Outlet Assignments
        └── Restaurant Membership (optional)
                        │
                        ▼
                      User Login
```

An Employee may exist forever without a login.

Creating an Employee must NEVER automatically create a User.

---

## Organization Structure

Support:

```text
Restaurant
        │
        ├── Region (optional)
        │
        ├── Outlets
        │
        ├── Departments
        │
        ├── Designations
        │
        ├── Job Grades
        │
        ├── Cost Centers
        │
        └── Employees
```

Region is optional but the architecture must support it.

Departments and Designations belong to the Restaurant, not an Outlet.

---

# Master Data Module

Create a dedicated module:

```
src/modules/master-data/
```

It owns:

* Departments
* Designations
* Job Grades
* Cost Centers
* Employment Types
* Worker Types
* Future Leave Types

HR, Payroll and Shift Management must reuse this master data instead of maintaining duplicate configuration.

---

# Database Models

## Employee

Identity only.

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
* gender
* dateOfBirth
* joiningDate
* profilePhotoUrl
* employmentStatus
* workerType
* createdAt
* updatedAt
* archivedAt

Unique constraint:

restaurantId + employeeCode

Employee codes are restaurant scoped.

Employee code generator:

```
EMP-00001
EMP-00002
EMP-00003
```

per restaurant.

---

## EmploymentRecord

Contains mutable employment history.

Fields:

* id
* restaurantId
* employeeId
* departmentId
* designationId
* primaryOutletId
* employmentType
* effectiveFrom
* effectiveTo
* probationEndDate
* confirmationDate
* noticePeriod
* reportingManagerEmployeeId
* salaryStructureId (nullable for future)
* status
* notes
* createdAt
* updatedAt

Only one active EmploymentRecord may exist unless multi-assignment is enabled.

---

## EmployeeOutletAssignment

Fields:

* id
* restaurantId
* employeeId
* outletId
* isPrimary
* assignmentType
* effectiveFrom
* effectiveTo
* status

Supports:

Primary outlet

Temporary outlet

Training outlet

Multiple outlet assignments.

---

## Department

Restaurant scoped.

Fields:

* id
* restaurantId
* name
* code
* status
* archivedAt

---

## Designation

Restaurant scoped.

Fields:

* id
* restaurantId
* name
* code
* status
* archivedAt

---

## JobGrade

Restaurant scoped.

---

## CostCenter

Restaurant scoped.

---

## EmployeeEmergencyContact

Separate relational table.

Fields:

* employeeId
* relationship
* name
* phone
* address

Do NOT store emergency contacts as JSON.

---

## EmployeeDocument

Fields:

* employeeId
* type
* fileUrl
* documentNumber
* issueDate
* expiryDate
* verifiedBy
* verifiedAt

Document types include:

* Aadhaar
* Passport
* Visa
* Contract
* Resume
* Certificate
* Medical
* Food License

Do NOT upload actual files during this phase.

Only implement metadata.

---

# Enumerations

Employment Status:

* ACTIVE
* PROBATION
* ON_LEAVE
* NOTICE
* SUSPENDED
* TERMINATED
* RESIGNED

Worker Type:

* FULL_TIME
* PART_TIME
* CONTRACT
* INTERN
* CONSULTANT
* TEMPORARY

Login Provider:

* LOCAL
* GOOGLE
* MICROSOFT
* APPLE

Only LOCAL is implemented now.

---

# Restaurant Administration

Create Restaurant Admin screens for:

Restaurant Profile

Restaurant Branding

Subscription View

Enabled Modules

Outlets

Departments

Designations

Employees

Users

Roles

Permissions

Invitations

Access Grants

Restaurant Admin must NOT:

* enable modules
* upgrade plans
* change limits
* access Platform Super Admin
* access another restaurant

---

# Outlet Management

Support:

* name
* code
* address
* timezone
* currency
* contact details
* opening date
* active status

Validate outlet limits transactionally.

---

# Employee Workflow

Workflow:

```
Create Employee

↓

Assign Department

↓

Assign Designation

↓

Assign Outlet

↓

Create Employment Record

↓

Save Employee

↓

(Optional)

Create Login

↓

Generate Invitation

↓

Assign Roles

↓

Assign Module Access

↓

Send Activation Link
```

---

# Internal User Workflow

Restaurant Admin chooses an existing Employee.

System creates:

RestaurantMembership

↓

User

↓

Invitation

↓

Activation

↓

Access Grants

Invitation continues using the hashed token architecture implemented in Phase 1.1.

---

# Roles

Support:

Platform Roles

Restaurant Roles

Module Roles

Outlet Roles

Restaurant-wide Roles

Default roles:

Restaurant Owner

Restaurant Administrator

HR Manager

Shift Manager

Payroll Manager

Inventory Manager

Outlet Manager

Viewer

Restaurant roles belong to restaurantId.

---

# Permissions

Permissions remain action based.

Examples:

Inventory

View

Create

Update

Delete

Approve

HR

Employee View

Employee Create

Employee Update

Employee Archive

Payroll

Generate

Approve

Export

Restaurant Admin may create custom roles from permissions.

---

# Access Grants

Each grant connects:

Restaurant Membership

↓

Module

↓

Role

↓

Optional Outlet

Validate:

Restaurant owns membership

Module enabled

Role belongs to restaurant

Outlet belongs to restaurant

Creator has permission

User limits not exceeded

Disabled modules immediately invalidate grants.

---

# Account Limits

Enforce:

Outlets

Employees

Internal Users

Invitations

Validation must occur server-side inside database transactions.

---

# API Structure

Organize APIs by feature.

```
restaurant/

profile

branding

outlets

employees

employment-records

departments

designations

job-grades

cost-centers

users

roles

permissions

access-grants

invitations
```

Avoid giant route handlers.

---

# UI Requirements

Mobile-first responsive design.

Desktop:

Responsive tables.

Mobile:

Cards

Bottom actions

Drawers

Dialogs

No desktop-only layouts.

---

# Security

Never trust:

restaurantId

employeeId ownership

membershipId

module entitlement

role ownership

outlet ownership

Resolve ownership server-side.

Continue using:

verifyAccess()

database authorization

tokenVersion

module entitlement

restaurant validation

PgBouncer runtime

---

# Audit Logging

Log:

Restaurant updated

Branding updated

Outlet created

Outlet updated

Outlet archived

Department created

Department updated

Designation created

Designation updated

Employee created

Employee updated

Employee archived

Employment record updated

Invitation created

Invitation revoked

Membership activated

Membership suspended

Role created

Permission modified

Access Grant created

Access Grant removed

Include:

actor

ip

device

browser

oldValue

newValue

reason

timestamp

Never log:

passwords

JWTs

invitation tokens

document contents

---

# Security Tests

Add tests proving:

Restaurant A cannot view Restaurant B employees

Restaurant A cannot edit Restaurant B employees

Restaurant A cannot assign Restaurant B outlets

Restaurant Admin cannot exceed employee limits

Restaurant Admin cannot exceed user limits

Employee creation does not create login

Disabled modules cannot be assigned

Cross-restaurant roles rejected

Cross-restaurant outlets rejected

Archived employee cannot receive login

Duplicate memberships rejected

Invitation reuse rejected

Invitation is restaurant-bound

AccessGrant removal immediately revokes access

User deactivation invalidates sessions

Outlet scoped users cannot access another outlet

All existing Phase 1.1 security tests must continue passing.

---

# Database

Create versioned Prisma migrations.

Never use force-reset outside disposable local development.

Runtime:

DATABASE_URL

through PgBouncer.

Migration:

DIRECT_DATABASE_URL

Seed only:

Platform Roles

Platform Permissions

Master Data defaults where appropriate.

Do NOT seed fake restaurants.

---

# Verification

Run:

Prisma Validate

Prisma Generate

Migration Test

Type Check

ESLint

Production Build

Security Test Suite

PgBouncer Runtime Test

Health Check

---

# Documentation

Update:

docs/ai/CURRENT_STATE.md

docs/ai/PROJECT_MAP.md

docs/ai/ACCESS_CONTROL.md

docs/ai/DECISIONS.md

Only record permanent architectural decisions.

---

# Deliverables

Return:

Completed Features

Files Created

Files Modified

Prisma Migrations

New Models

New APIs

New UI Pages

Security Test Results

PgBouncer Verification

Known Limitations

Deferred Work

---

# Explicitly Deferred to Phase 3

Do NOT implement:

HR onboarding workflow

Document verification workflow

Attendance engine

Shift scheduling

Payroll calculations

Inventory transactions

Purchase orders

Kitchen production

Reporting

Only build the organizational foundation required for those future modules.
