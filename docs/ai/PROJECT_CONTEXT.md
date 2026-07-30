# Project Context

This document outlines the high-level concept, access hierarchy, subscription design, and core architectural rules of the multi-tenant modular restaurant operations SaaS.

---

## 1. Correct Application Concept

This is not a food-ordering application. It is a **multi-tenant, modular restaurant management platform (modular-monolith)**. 

* **Multi-tenant**: Every restaurant operates as a separate tenant. Their data, configurations, and users are strictly isolated.
* **Modular**: Features are grouped into distinct business modules (e.g., Inventory, Shifts, HR, Payroll). The platform owner controls module enablement for each restaurant.

### Initial Modules:
1. **Inventory Management** (key: `inventory`): Core items, stock, purchase orders, transfers, and wastage tracking.
2. **Shift Management** (key: `shifts`): Rosters, templates, employee scheduling, shifts swap, availability.
3. **HR Onboarding** (key: `hr_onboarding`): Hiring pipelines, onboarding checklists, digital employee document signing.
4. **Payroll Management** (key: `payroll`): Salary structures, earnings, deductions, automated calculation, payslips.

---

## 2. Access Hierarchy

The system defines three distinct levels of users:

### Level 1: Platform Super Admin
* Managed solely by the platform operators (not restaurants).
* **Duties**:
  * Create, edit, suspend, and deactivate restaurant tenants.
  * Enable/disable specific modules per restaurant.
  * Define subscription plans and physical/entity limits (e.g., maximum outlets, employees).
  * Access platform-level audit logs and support configurations.
* **URL Scope**: Recommended `admin.yourplatform.com`.

### Level 2: Restaurant Administrator
* Created automatically upon Super Admin onboarding of the restaurant.
* **Duties**:
  * Manage restaurant profile, add branches (outlets), and register employees.
  * Control internal memberships and assign specific roles to users.
  * Configure modules that are **enabled** by the Super Admin.
  * Access restaurant-wide reports.
* *Note: A Restaurant Administrator cannot enable modules that the Super Admin has not assigned.*

### Level 3: Restaurant Members
* Employees/Staff created by the Restaurant Administrator.
* Assigned specific roles within specific modules (e.g., an employee can be an "Inventory Manager" in `inventory` and a "Viewer" in `shifts`, but have "No Access" in `payroll`).
* Access can be locked down to specific physical **outlets** or apply restaurant-wide.

---

## 3. Subscription & Limits Model

Super Admins assign subscription plans that dictate the resource limits of each restaurant tenant:

| Metric | Description | Enforced At |
| :--- | :--- | :--- |
| **Outlets Limit** | Maximum physical locations (branches) the restaurant can create. | Branch/Outlet Creation API |
| **Employees Limit** | Maximum active employee records (memberships) in the database. | Employee Onboarding / Invite API |
| **Admin Users Limit** | Maximum users with administrative access. | Membership role assignment |
| **Storage Limit** | Max storage quota (in GB) for documents (HR contracts, invoices). | Document Upload Service |
| **Modules Allowed** | Set of modules the tenant is entitled to run. | Application Routing & API Middleware |

### Branch/Outlet Level Configurations:
* **Timezone**: Set individually per outlet to support multi-region operations under a single restaurant tenant.
* **Currency**: Configured at the individual branch/outlet level to enable international multi-brand outlets.

### Custom Domains & SSL:
* **SSL Termination**: Handled directly at the application service layer rather than delegated to third-party CDN-level middleware. The app service layer reads incoming host headers and maps them to the appropriate tenant.

---

## 4. Tenant Isolation Strategy

Data isolation is a critical security requirement. We enforce isolation via a multi-level check:

1. **Database Schema Isolation**:
   * Every tenant-owned table must contain a non-nullable `restaurant_id` column.
   * Every branch-specific table must contain a nullable or non-nullable `outlet_id` column.
2. **Row-level verification at the Application Tier**:
   * **Rule**: Never trust a `restaurant_id` or `outlet_id` submitted in request payloads (e.g., query params, body).
   * **Mechanism**: Resolve the client's current `restaurant_id` from the secure server session (JWT or session token).
   * Verify that the resolved `restaurant_id` matches the target resource's `restaurant_id` in the database prior to executing reads, updates, or deletes.

---

## 5. Module Dependency Strategy

Modules must be loosely coupled. While they can integrate with each other, they **must not have hard compile-time or database foreign key constraints** that prevent them from running standalone.

```text
Employee Management (Core)
         ↓
  Attendance (Optional)
         ↓
Shift Management (Optional)
         ↓
   Payroll (Optional)
```

### Integration Guidelines:
* **Stand-alone execution**: If a restaurant only purchases the `payroll` module, the payroll system must still function by allowing manual input of shift/attendance hours or external file imports.
* **Feature detection**: If `attendance` or `shifts` is enabled, the `payroll` module UI and API can dynamically show integration options to pull data from those modules.
* **Shared interfaces / API boundaries**: Code in `src/modules/payroll/` should fetch shift data using a clean service boundary, checking `ModuleEntitlementService.isModuleEnabled(restaurantId, 'shifts')` before querying data.
