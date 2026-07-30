# Access Control Model

This document explains the security architecture, authorization engine, role models, and user workflow diagrams.

---

## 1. The Three-Level Authorization Model

For every inbound API request or page load, the system runs a sequential 3-tier gate check:

```text
               +-----------------------------------------+
               |         Incoming Request / Page         |
               +-----------------------------------------+
                                    |
                                    v
     Level 1 Check:        Is the requested module
  [Tenant Entitlement]  --> entitled/enabled for the  --> [NO] --> 403 Forbidden
                           restaurant tenant?
                                    | [YES]
                                    v
     Level 2 Check:        Does the authenticated user
   [User Module Access] --> have access to this module  --> [NO] --> 403 Forbidden
                           via an access grant?
                                    | [YES]
                                    v
     Level 3 Check:        Does the user's role have
   [Action Permission]  --> the required permission     --> [NO] --> 403 Forbidden
                           (e.g., 'create_items')?
                                    | [YES]
                                    v
                           +------------------+
                           |  Allow Request   |
                           +------------------+
```

### Level 1: Tenant Entitlement
Checked via `restaurant_modules` table. If a module is inactive or expired, no member of that restaurant can access its assets.

### Level 2: User Module Access
Checked via `access_grants` table. It matches the user's membership to the module. If a user is not granted access to `payroll`, they cannot access payroll APIs.

### Level 3: Action-Level Permissions
Permissions are assigned to roles, and roles are tied to users via `access_grants`. A granular permission check (e.g. `inventory:create_item`) decides if the action is allowed.

---

## 2. Platform Super Admin vs. Restaurant Access

Security scopes are strictly divided. Platform Super Admin rights are disjoint from restaurant membership.

### Platform Super Admin
* Authenticates against `platform_users` table.
* Access is managed outside restaurant space (completely separate schemas/sessions).
* Super Admin roles are static and non-customizable by tenants.

### Restaurant Role Management
* Tenants can define custom roles (`roles`) and custom permission sets (`role_permissions`).
* Default system roles are provided out of the box (e.g., "Restaurant Owner", "Branch Manager", "HR Specialist").
* Roles are assigned to users on a module-by-module basis.
* **Scope Isolation**: A membership can have the role "Store Manager" for `inventory` (scoped to `outlet_id: 123`), and "Viewer" for `shifts` (scoped restaurant-wide).

---

## 3. Workflow Diagrams

### Restaurant Creation Workflow (Super Admin)
```text
  1. Super Admin logs in to admin.yourplatform.com
  2. Submits Form: Restaurant Details (Name, Subdomain, Contact)
  3. Configures Subscription: Selects Plan, Sets Limits (Outlets, Employees)
  4. Selects Enabled Modules: (e.g. Inventory, Shifts)
  5. Submits Primary Admin Details (Name, Email)
  6. Database Transaction:
     - Create `restaurants` record
     - Create `restaurant_branding` record
     - Create `restaurant_modules` entries
     - Create primary `users` record
     - Create `restaurant_memberships` record linking user to restaurant
     - Create `access_grants` assigning "Restaurant Owner" role across all enabled modules
  7. System sends activation email with setup link to Primary Admin
```

### Restaurant Staff Login and Onboarding Workflow
```text
  1. Restaurant Admin creates an Employee record in HR Onboarding / Staff section
  2. Admin invites employee to join by entering their email address
  3. Database creates `users` (pending verification) and `restaurant_memberships`
  4. Admin configures Module Access:
     - Assigns specific role (e.g., "Inventory Manager")
     - Sets Module (e.g., "inventory")
     - Restricts to specific outlet (e.g., "Outlet-B")
     - Record is written to `access_grants`
  5. Employee receives invitation email with registration link
  6. Employee sets password, completes verification, and logs in
  7. Session resolves `activeRestaurantId` and active permissions per outlet
```

---

## 4. Security Risks & Mitigations

### 1. ID Or Tenant Spoofing (Broken Object Level Authorization)
* **Risk**: A malicious user sends API requests modifying payload identifiers (e.g. POST `/api/inventory/items` with `{ restaurantId: "REST-002" }` while being a member of `REST-001`).
* **Mitigation**:
  * The backend ignores `restaurant_id` fields in request bodies.
  * The authenticated server-side session context is the sole source of truth for `restaurant_id`.
  * Middleware checks all database queries: `where: { id: itemId, restaurantId: session.activeRestaurantId }`.

### 2. Module Access Escalation
* **Risk**: A Restaurant Admin attempts to bypass billing by calling endpoints of a disabled module (e.g., calling Payroll APIs when the restaurant has only purchased Inventory).
* **Mitigation**:
  * Global Next.js middleware or route-level wrappers intercept all requests under `/api/modules/[moduleKey]/`.
  * Resolves `restaurantId` from session and queries the cache or DB (`restaurant_modules`) to check if the module is `active`.

### 3. Cross-Outlet Data Leaks
* **Risk**: A user assigned as "Store Manager" only for "Outlet-A" modifies inventory items in "Outlet-B".
* **Mitigation**:
  * The permission-check system resolves user's access grants.
  * If the resolved `access_grant` is bound to a specific `outlet_id`, any data-modifying operation must match: `where: { id: itemId, outletId: grant.outletId }`.

---

## 5. Production Hardening & Session Revocation

### 1. Token Version Control
Every User record has a `tokenVersion` stored in the database. When a user logs in, their current `tokenVersion` is embedded inside the JWT. The granular access authorization engine (`verifyAccess`) checks on every database access that the token's version matches the user's version in the database. This enables immediate global session revocation upon password modifications, user deactivation, or forced logout.

### 2. Cryptographically Secure Invitation Tokens
Staff invitation links utilize high-entropy UUID tokens which are never stored in plaintext within the database. The database stores only the one-way `SHA-256` hash of the invitation token (`tokenHash`). During account activation, the incoming token is hashed and queried, protecting the tokens from database leak exploits.

### 3. API Route Safety (CSRF & Rate Limiting)
All sensitive write endpoints perform:
* **CSRF Origin Validation:** Checking request Origin/Referer headers against the host domain to prevent cross-site request forgery.
* **Brute-Force Rate Limiting:** Tracking login attempts on a per-IP/email basis using an in-memory sliding-window counter to block dictionary attacks.

