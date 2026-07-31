# Project Map & Database Entity Plan

This document details the folder structure guidelines for the modular monolith, followed by the complete database entity design defined in a Prisma Schema format.

---

## 1. Directory Structure

To maintain a clean modular monolith architecture, we separate business modules in `src/modules/` while sharing core components, auth/database services in `src/core/`.

```text
src/
├── app/                           # Next.js App Router
│   ├── (platform-admin)/          # Platform Super Admin routes (subdomain admin.*)
│   │   └── platform-admin/
│   │       ├── login/
│   │       └── dashboard/
│   ├── (tenant-space)/            # Restaurant Tenant space
│   │   └── restaurant/[subdomain]/
│   │       ├── login/
│   │       ├── activate/
│   │       ├── dashboard/
│   │       ├── settings/          # profile, outlets, master-data, roles-permissions, access-grants
│   │       ├── workforce/         # employees, employees/[id], users
│   │       └── modules/[moduleKey]/
│   └── api/                       # API Handlers
│       ├── platform-admin/
│       │   ├── auth/              # login, logout
│       │   ├── restaurants/       # create, update, list, modules, status, resend-invite
│       │   └── audit-logs/        # audit records list
│       └── restaurant/
│           ├── auth/              # member login, logout
│           ├── activate/          # invitation activation handler
│           ├── profile/           # profile & branding
│           ├── outlets/           # physical branches management
│           ├── departments/       # department master data
│           ├── designations/      # designation master data
│           ├── job-grades/        # job grade master data
│           ├── cost-centers/      # cost center master data
│           ├── employees/         # employee onboarding, detail, history, assignments, docs
│           ├── users/             # internal login creation & invites
│           ├── roles/             # custom roles builder
│           ├── permissions/       # system permissions list
│           ├── access-grants/     # module access grants matrix
│           └── modules/           # list entitled modules and verify actions
├── core/                          # Shared codebase infrastructure
│   ├── auth/                      # JWT validation and session cookies
│   ├── database/                  # Prisma client singleton instance
│   ├── permissions/               # check access rights engine
│   ├── audit/                     # AuditLogger database writer
│   └── tests/                     # Security verification test suites
├── infra/                         # Production docker infrastructure config
│   └── pgbouncer/                 # PgBouncer configurations (ini, userlist)
├── proxy.ts                       # Next.js 16 subdomain rewriter & proxy routing
└── modules/                       # Business modules
    ├── master-data/               # Centralized master data service
    ├── inventory/
    ├── shifts/
    ├── attendance/
    ├── payroll/
    └── hr-onboarding/
```

---

## 2. Database Entity Plan (Prisma Schema Model)

Below is the conceptual relational schema layout representing the 13 core platform tables. All tenant-scoped records carry `restaurant_id` (and `outlet_id` where applicable).

```prisma
// datasource db {
//   provider = "postgresql"
//   url      = env("DATABASE_URL")
// }

// generator client {
//   provider = "prisma-client-js"
// }

// ----------------------------------------------------
// 1. Platform & Tenant Entities
// ----------------------------------------------------

model PlatformUser {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@map("platform_users")
}

model Restaurant {
  id          String              @id @default(uuid())
  name        String
  subdomain   String              @unique // e.g. "cafedelights" -> cafedelights.platform.com
  status      TenantStatus        @default(ACTIVE)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  
  // Relations
  branding    RestaurantBranding?
  outlets     RestaurantOutlet[]
  memberships Membership[]
  modules     RestaurantModule[]
  subscriptions Subscription[]
  auditLogs   AuditLog[]

  @@map("restaurants")
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

model RestaurantBranding {
  id              String     @id @default(uuid())
  restaurantId    String     @unique @map("restaurant_id")
  applicationName String     @map("application_name")
  logoUrl         String?    @map("logo_url")
  faviconUrl      String?    @map("favicon_url")
  primaryColor    String     @default("#0f172a") @map("primary_color")
  secondaryColor  String     @default("#3b82f6") @map("secondary_color")
  loginBackground String?    @map("login_background")
  supportEmail    String?    @map("support_email")
  supportPhone    String?    @map("support_phone")
  customDomain    String?    @unique @map("custom_domain")

  // Relations
  restaurant      Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  @@map("restaurant_branding")
}

model RestaurantOutlet {
  id           String        @id @default(uuid())
  restaurantId String        @map("restaurant_id")
  name         String
  address      String?
  timezone     String        @default("UTC")
  currency     String        @default("USD")
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  // Relations
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  accessGrants AccessGrant[]

  @@map("restaurant_outlets")
}

// ----------------------------------------------------
// 2. User & Membership Entities
// ----------------------------------------------------

model User {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  name         String
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  // Relations
  memberships  Membership[]

  @@map("users")
}

model Membership {
  id           String        @id @default(uuid())
  restaurantId String        @map("restaurant_id")
  userId       String        @map("user_id")
  employeeId   String?       @map("employee_id") // Reference to HR employee profiles
  status       MemberStatus  @default(ACTIVE)
  joinedAt     DateTime      @default(now())

  // Relations
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessGrants AccessGrant[]

  @@unique([restaurantId, userId])
  @@map("restaurant_memberships")
}

enum MemberStatus {
  ACTIVE
  INACTIVE
  PENDING_INVITE
}

// ----------------------------------------------------
// 3. Module & Entitlement Entities
// ----------------------------------------------------

model Module {
  id          String             @id // e.g. "inventory", "shifts", "payroll", "hr_onboarding"
  name        String
  description String?
  
  // Relations
  restaurants RestaurantModule[]
  permissions Permission[]
  accessGrants AccessGrant[]

  @@map("modules")
}

model RestaurantModule {
  id            String       @id @default(uuid())
  restaurantId  String       @map("restaurant_id")
  moduleId      String       @map("module_id")
  status        ModuleStatus @default(ACTIVE)
  enabledAt     DateTime     @default(now()) @map("enabled_at")
  expiresAt     DateTime?    @map("expires_at")
  enabledBy     String?      @map("enabled_by") // Platform user ID

  // Relations
  restaurant    Restaurant   @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  module        Module       @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@unique([restaurantId, moduleId])
  @@map("restaurant_modules")
}

enum ModuleStatus {
  ACTIVE
  INACTIVE
  EXPIRED
}

// ----------------------------------------------------
// 4. Role & Access Control Entities
// ----------------------------------------------------

model Role {
  id           String           @id @default(uuid())
  restaurantId String           @map("restaurant_id")
  name         String           // e.g. "Store Manager", "Accountant"
  description  String?
  createdAt    DateTime         @default(now())

  // Relations
  permissions  RolePermission[]
  accessGrants AccessGrant[]

  @@unique([restaurantId, name])
  @@map("roles")
}

model Permission {
  id          String           @id // e.g. "inventory:create_item", "payroll:approve_run"
  moduleId    String           @map("module_id")
  name        String
  description String?

  // Relations
  module      Module           @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  roles       RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       String     @map("role_id")
  permissionId String     @map("permission_id")

  // Relations
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model AccessGrant {
  id           String            @id @default(uuid())
  membershipId String            @map("membership_id")
  moduleId     String            @map("module_id")
  roleId       String            @map("role_id")
  outletId     String?           @map("outlet_id") // Nullable if grant spans entire tenant
  status       GrantStatus       @default(ACTIVE)

  // Relations
  membership   Membership        @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  module       Module            @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  role         Role              @relation(fields: [roleId], references: [id], onDelete: Cascade)
  outlet       RestaurantOutlet? @relation(fields: [outletId], references: [id], onDelete: SetNull)

  @@map("access_grants")
}

enum GrantStatus {
  ACTIVE
  REVOKED
}

// ----------------------------------------------------
// 5. Subscription & Audit Log Entities
// ----------------------------------------------------

model SubscriptionPlan {
  id            String         @id @default(uuid())
  name          String         // e.g. "Growth", "Enterprise"
  maxOutlets    Int            @map("max_outlets")
  maxEmployees  Int            @map("max_employees")
  maxAdminUsers Int            @map("max_admin_users")
  storageQuotaGb Int           @map("storage_quota_gb")
  priceMonthly  Decimal        @map("price_monthly")
  
  // Relations
  subscriptions Subscription[]

  @@map("subscription_plans")
}

model Subscription {
  id             String           @id @default(uuid())
  restaurantId   String           @map("restaurant_id")
  planId         String           @map("plan_id")
  status         SubStatus        @default(ACTIVE)
  billingPeriod  BillingPeriod    @default(MONTHLY)
  startDate      DateTime         @default(now()) @map("start_date")
  endDate        DateTime?        @map("end_date")

  // Relations
  restaurant     Restaurant       @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  plan           SubscriptionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}

enum SubStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
}

enum BillingPeriod {
  MONTHLY
  ANNUALLY
}

model AuditLog {
  id           String     @id @default(uuid())
  restaurantId String?    @map("restaurant_id") // Can be null if Platform-level event
  userId       String     @map("user_id")
  userEmail    String     @map("user_email")
  action       String     // e.g. "inventory_item_deleted"
  details      String     // JSON text payload containing before/after snapshots
  ipAddress    String?    @map("ip_address")
  createdAt    DateTime   @default(now()) @map("created_at")

  // Relations
  restaurant   Restaurant? @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  @@map("audit_logs")
}
```
