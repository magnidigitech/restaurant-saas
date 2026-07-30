## Correct application concept

This is not mainly a food-ordering application. It is a **multi-tenant, modular restaurant management platform**.

Each restaurant is a separate tenant. Your company controls which modules each restaurant can access.

Example modules:

* Inventory Management
* Shift Management
* HR Onboarding
* Payroll Management
* Attendance and Leave
* Employee Documents
* Vendor Management
* Purchase Management
* Expense Management
* Reports and Analytics

A restaurant may receive:

* Only Inventory Management
* Inventory + Shift Management
* HR Onboarding + Payroll
* Every available module

## Access hierarchy

### 1. Platform Super Admin

Only your company team has Super Admin access.

Your Super Admin can:

* Create a restaurant account
* Edit or deactivate a restaurant
* Create the initial restaurant login
* Enable or disable modules
* Set subscription plans
* Set user, outlet or employee limits
* Reset restaurant administrator access
* View platform-level reports
* Provide support access
* Suspend a restaurant
* View audit logs

Restaurants cannot access the Super Admin portal.

Recommended URL:

```text
admin.yourplatform.com
```

---

### 2. Restaurant Administrator

After your Super Admin creates the restaurant, the restaurant receives an administrator login.

The Restaurant Administrator can:

* Update restaurant information
* Add branches or outlets
* Add employees
* Create internal logins
* Assign roles
* Assign module access
* Configure enabled modules
* Manage restaurant settings
* View restaurant reports

The restaurant administrator can only use modules enabled by your Super Admin.

For example, when Inventory Management is not enabled, its menu, pages, API routes and reports must remain inaccessible.

---

### 3. Restaurant Members

The Restaurant Administrator creates internal accounts for staff.

Examples:

* HR Manager
* Payroll Manager
* Inventory Manager
* Store Manager
* Shift Manager
* Branch Manager
* Accountant
* Employee

Each member may access one or multiple modules.

Example access:

| Employee          | Inventory | Shifts | HR Onboarding | Payroll |
| ----------------- | --------: | -----: | ------------: | ------: |
| Restaurant Owner  |      Full |   Full |          Full |    Full |
| HR Manager        |        No |   View |          Full |    Full |
| Inventory Manager |      Full |     No |            No |      No |
| Shift Manager     |        No |   Full |          View |      No |
| Accountant        |      View |     No |          View |    Full |

## Three levels of access control

Your application needs three separate checks.

### Level 1: Restaurant module access

Does the restaurant have access to the module?

```text
Restaurant A:
Inventory = Enabled
Shift Management = Enabled
Payroll = Disabled
```

### Level 2: Member module access

Does the logged-in member have access to that enabled module?

```text
Inventory Manager:
Inventory = Enabled
Shift Management = Disabled
```

### Level 3: Action permissions

What can the member do inside the module?

```text
Inventory:
View Items
Create Items
Edit Items
Delete Items
Approve Purchases
View Reports
```

Every request should pass all three checks:

```text
Restaurant has module
        ↓
User has module access
        ↓
User has required permission
        ↓
Allow request
```

## Recommended database design

### Platform and restaurant tables

```text
platform_users
restaurants
restaurant_settings
restaurant_outlets
subscriptions
subscription_plans
audit_logs
```

### Module-management tables

```text
modules
restaurant_modules
module_features
restaurant_feature_settings
```

Example `modules` records:

```text
inventory
shift_management
hr_onboarding
payroll
attendance
leave_management
vendor_management
purchase_management
```

### Restaurant module access

```text
restaurant_modules
- id
- restaurant_id
- module_id
- status
- enabled_at
- expires_at
- enabled_by
- configuration_json
```

This table controls which products the restaurant purchased or was assigned.

Example:

```text
restaurant_id: REST-001
module_id: inventory
status: active
```

## User and permission tables

```text
users
restaurant_memberships
roles
permissions
role_permissions
access_grants
```

### Restaurant memberships

```text
restaurant_memberships
- id
- restaurant_id
- user_id
- employee_id
- status
- joined_at
```

### Access grants

A flexible access table is important because one person may have different roles in different modules.

```text
access_grants
- id
- membership_id
- module_id
- role_id
- outlet_id
- access_level
- status
```

Example:

```text
User: Ravi
Inventory Module: Inventory Manager
Shift Module: Shift Viewer
Payroll Module: No Access
Outlet: Guntur Branch
```

`outlet_id` can be nullable when the role applies to the entire restaurant.

## Module structure

Each module should be independent inside the same application.

```text
src/modules/
├── inventory/
│   ├── components/
│   ├── services/
│   ├── permissions/
│   ├── validation/
│   └── routes/
├── shifts/
├── hr-onboarding/
├── payroll/
├── attendance/
└── leave-management/
```

Do not create separate applications for Inventory, Payroll and HR.

Use one application with independent modules. This gives you:

* One login
* One employee database
* One restaurant database
* Shared permissions
* Shared audit logs
* Easier maintenance
* Lower hosting costs
* Easier addition of future modules

## Suggested module responsibilities

### Inventory Management

* Item master
* Categories
* Stock receiving
* Stock transfers
* Stock adjustments
* Wastage
* Minimum-stock alerts
* Vendor management
* Purchase orders
* Branch-level inventory
* Inventory reports

### Shift Management

* Shift templates
* Employee scheduling
* Weekly rosters
* Shift assignments
* Shift swaps
* Availability
* Overtime tracking
* Late arrival records
* Branch-level scheduling

### HR Onboarding

* Employee profiles
* Joining forms
* Document upload
* Offer letters
* Employee agreements
* Bank details
* Emergency contacts
* Onboarding checklist
* Approval workflow

### Payroll Management

* Salary structures
* Earnings
* Deductions
* Overtime
* Attendance integration
* Leave deductions
* Payroll processing
* Payslips
* Payment status
* Payroll reports

## Important dependency structure

Some modules can work independently, while others can integrate.

Example:

```text
Employee Management
        ↓
Attendance
        ↓
Shift Management
        ↓
Payroll
```

However, a restaurant purchasing only Payroll should still be able to enter payroll information manually.

This means module integrations should be optional.

Example:

```text
Payroll source:
- Manual attendance
- Imported attendance
- Attendance module integration
- Shift module integration
```

Do not make every module depend on every other module.

## Restaurant creation flow

The Super Admin workflow should be:

```text
Create Restaurant
        ↓
Enter Restaurant Details
        ↓
Select Enabled Modules
        ↓
Select Plan and Limits
        ↓
Create Primary Administrator
        ↓
Send Login Invitation
        ↓
Restaurant Completes Setup
```

Restaurant configuration example:

```text
Restaurant: ABC Restaurant

Modules:
Inventory Management: Enabled
Shift Management: Enabled
HR Onboarding: Enabled
Payroll: Disabled

Limits:
Outlets: 3
Employees: 100
Admin Users: 5
Storage: 10 GB
```

## Restaurant administrator workflow

```text
Restaurant Admin Login
        ↓
Complete Restaurant Profile
        ↓
Add Outlets
        ↓
Add Employees
        ↓
Create Internal Logins
        ↓
Assign Module Roles
        ↓
Configure Enabled Modules
```

## White-label structure

White-label settings should remain restaurant-specific:

```text
restaurant_branding
- restaurant_id
- application_name
- logo_url
- favicon_url
- primary_color
- secondary_color
- login_background
- email_sender_name
- support_phone
- support_email
- custom_domain
```

Example:

```text
abc.yourplatform.com
```

The system identifies the restaurant through the subdomain and loads:

* Restaurant branding
* Enabled modules
* Restaurant settings
* User permissions

## Security rules

Every module-owned table must contain:

```text
restaurant_id
```

Branch-specific data must also contain:

```text
outlet_id
```

Example:

```text
inventory_items
- id
- restaurant_id
- outlet_id
- item_name
- quantity
```

Never accept the active restaurant directly from the browser.

Incorrect:

```ts
const restaurantId = request.body.restaurantId;
```

Correct:

```ts
const restaurantId = session.activeRestaurantId;
```

The backend must verify:

```text
Authenticated user
Restaurant membership
Restaurant module entitlement
User module access
Required action permission
Outlet access
```

## Recommended Antigravity memory files

Use this smaller documentation structure:

```text
docs/ai/
├── PROJECT_CONTEXT.md
├── MODULE_REGISTRY.md
├── ACCESS_CONTROL.md
├── PROJECT_MAP.md
├── CURRENT_STATE.md
└── DECISIONS.md
```

### `PROJECT_CONTEXT.md`

```markdown
# Project Context

This is a multi-tenant modular restaurant operations SaaS.

The platform is managed by our company's Super Admin team.

Super Admin creates restaurants, creates their initial administrator accounts,
enables modules, defines subscription limits and can suspend access.

Restaurants cannot self-register unless that feature is added later.

Each restaurant can have access to one or multiple modules.

Initial modules:

- Inventory Management
- Shift Management
- HR Onboarding
- Payroll Management

Restaurant administrators can create internal users and assign module-specific
roles and permissions.

Every restaurant-owned record must be isolated using restaurant_id.

Branch-specific records must also use outlet_id.

The application uses one shared codebase and modular-monolith architecture.
```

### `MODULE_REGISTRY.md`

```markdown
# Module Registry

## Inventory Management

Module key: inventory

Main entities:
- Items
- Categories
- Vendors
- Purchase Orders
- Stock Transactions
- Stock Transfers
- Wastage Records

## Shift Management

Module key: shifts

Main entities:
- Shift Templates
- Rosters
- Shift Assignments
- Availability
- Shift Swaps
- Overtime

## HR Onboarding

Module key: hr_onboarding

Main entities:
- Employees
- Employee Documents
- Joining Forms
- Onboarding Tasks
- Approvals

## Payroll

Module key: payroll

Main entities:
- Salary Structures
- Payroll Runs
- Earnings
- Deductions
- Payslips
- Payment Records
```

### `ACCESS_CONTROL.md`

```markdown
# Access-Control Model

Every protected request must validate:

1. The user is authenticated.
2. The user belongs to the restaurant.
3. The restaurant has the requested module enabled.
4. The user has access to the requested module.
5. The user's role contains the required permission.
6. The user has access to the requested outlet.

Super Admin permissions and restaurant permissions must be completely separate.

Restaurant administrators cannot enable paid modules.

Only Platform Super Admin can enable or disable restaurant modules.
```

## Updated Antigravity project prompt

Build a production-ready multi-tenant modular restaurant operations SaaS platform.

This is not primarily a restaurant ordering application.

The platform will provide independent operational modules such as:

* Inventory Management
* Shift Management
* HR Onboarding
* Payroll Management
* Attendance Management
* Leave Management
* Vendor Management
* Purchase Management

One restaurant may have access to only one module or multiple modules.

Platform administration:

Only our company will have Platform Super Admin access.

Platform Super Admin must be able to:

* Create restaurants
* Edit, activate, suspend or deactivate restaurants
* Create the restaurant's initial administrator login
* Enable or disable modules for each restaurant
* Assign subscription plans
* Configure employee, user, outlet and storage limits
* Reset administrator access
* View platform audit logs
* Access platform-level reports

Restaurants must not have access to Platform Super Admin functionality.

Restaurant administration:

The Restaurant Administrator must be able to:

* Update restaurant details
* Configure enabled modules
* Add outlets
* Add employees
* Create internal user logins
* Create restaurant roles
* Assign module-specific roles and permissions
* Assign outlet-specific access
* View restaurant-level reports

The Restaurant Administrator cannot independently enable modules that were not assigned by Platform Super Admin.

Access control must contain three levels:

1. Restaurant module entitlement
2. User module access
3. Action-level permissions

A user may have different roles in different modules.

Example:

* Inventory Manager in Inventory
* Viewer in Shift Management
* No access to Payroll

Use a modular-monolith architecture with Next.js, TypeScript, PostgreSQL, Prisma and Tailwind CSS.

Use one shared codebase for all restaurants and modules.

Every restaurant-owned database record must contain restaurant_id.

Every outlet-specific record must contain outlet_id.

Never trust restaurant_id or outlet_id received from the frontend. Resolve them through the authenticated server session, restaurant membership and access grants.

Create these access-control entities:

* users
* restaurants
* restaurant_outlets
* restaurant_memberships
* modules
* restaurant_modules
* roles
* permissions
* role_permissions
* access_grants
* subscriptions
* subscription_plans
* audit_logs

Use access_grants to assign a role to a restaurant member for a specific module and optional outlet.

Keep module integrations optional. Payroll should be able to use attendance and shift data when those modules are enabled, but it must also support manual input when they are unavailable.

Create the project in phases.

Phase 0 must produce:

* Architecture plan
* Folder structure
* Database entity plan
* Module entitlement design
* Role and permission model
* Restaurant creation workflow
* Staff-login workflow
* Tenant isolation strategy
* Module dependency strategy
* Subscription and limits model
* Security risks
* Development roadmap

Create these Antigravity memory files:

* docs/ai/PROJECT_CONTEXT.md
* docs/ai/MODULE_REGISTRY.md
* docs/ai/ACCESS_CONTROL.md
* docs/ai/PROJECT_MAP.md
* docs/ai/CURRENT_STATE.md
* docs/ai/DECISIONS.md

At the beginning of each task, read only:

* PROJECT_CONTEXT.md
* PROJECT_MAP.md
* CURRENT_STATE.md

Read MODULE_REGISTRY.md only when the task concerns a business module.

Read ACCESS_CONTROL.md only when the task concerns authentication, users, permissions, outlets or tenant security.

Do not recursively scan the repository.

Search for the relevant module, route, component, service or database model before opening files.

Inspect only the minimum files required for the task.

At the end of every task, update CURRENT_STATE.md with:

* Work completed
* Files changed
* Database migrations
* Tests performed
* Remaining work

Do not create microservices, queues, Redis dependencies or unnecessary abstractions during the initial phases.

The key architecture term for this project is:

> **Multi-tenant, module-entitlement-based restaurant operations SaaS with module-level RBAC.**
