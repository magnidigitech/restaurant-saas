# Architectural Decisions Log (ADR)

This document tracks major technical and architectural decisions, the alternatives considered, and the rationale behind each choice.

---

## ADR 01: Modular Monolith vs. Microservices

### Context:
The SaaS platform is composed of several business modules (Inventory, Shift Management, HR, Payroll). While each module represents a distinct operational subdomain, they share critical resources such as users, restaurant tenants, outlet definitions, subscription rules, and audit logs.

### Decision:
Implement a **Modular Monolith** architecture within a single shared Next.js codebase.

### Alternatives Considered:
1. **Microservices (one service per module)**:
   * *Cons*: Significantly higher operational overhead (Docker, Kubernetes, API Gateways, service communication latency, complex distributed transactions).
   * *Cons*: Duplication of user profiles or complex inter-service synchronization.

### Rationale:
* **Cost & Speed**: Solves hosting cost overhead for early-stage SaaS deployment.
* **Maintainability**: Unified code deployments, common CI/CD, and single shared database.
* **Loose Coupling**: Modules are placed in isolated folder paths (`src/modules/`) and share core databases/utilities cleanly via `src/core/`.

---

## ADR 02: Logical Multi-Tenancy (Shared Database)

### Context:
We must secure and segregate data between different restaurant tenants (restaurants).

### Decision:
Use **Logical Multi-Tenancy** where all tenants share the same PostgreSQL database, and table records are partitioned using `restaurant_id` and `outlet_id` columns.

### Alternatives Considered:
1. **Database-per-tenant (Physical Isolation)**:
   * *Cons*: Difficult to manage schema migrations across hundreds of databases. Expensive database hosting.
2. **Schema-per-tenant (PostgreSQL Schema Isolation)**:
   * *Cons*: Adds complexity to database connection pooling and reporting across tenants.

### Rationale:
* Easy and fast to configure using standard ORM (Prisma).
* Database migrations run once on a single target database.
* Low memory and resource footprint, scaling to thousands of tenants efficiently.
* **Security Enforcement**: A strict application-level check resolves the tenant context from the verified user session token, never relying on browser-passed parameters.

---

## ADR 03: Granular Module-Level Access Control (Access Grants)

### Context:
Restaurant staff require varied permissions. An employee may manage inventory for Outlet A, but only view rosters for the whole restaurant.

### Decision:
Implement **Module-level Access Grants** mapped through a unified `access_grants` table that connects `membership_id`, `module_id`, `role_id`, and an optional `outlet_id`.

### Alternatives Considered:
1. **Flat RBAC (global user roles like 'Admin', 'Manager')**:
   * *Cons*: Does not support modular entitlement restrictions or outlet-level restrictions.
2. **Postgres Row Level Security (RLS)**:
   * *Cons*: Ties business access logic to database configurations, making local debugging and migration paths more difficult.

### Rationale:
* Maximum flexibility: Supports custom tenant-defined roles and permission structures.
* Enables granular permissions per outlet (e.g. access is only granted where `outlet_id` matches, or restaurant-wide if `outlet_id` is null).
* Keeps module access evaluation independent of database dialect.

---

## ADR 04: Next.js Subdomain-Based Tenant Routing

### Context:
Each restaurant has a dedicated workspace (e.g. `coyote.yourplatform.com` or custom domain `coyotegrill.com`).

### Decision:
Handle routing dynamically using Next.js Middleware and Next.js App Router subdirectories.

### Rationale:
* Next.js Middleware intercepts the hostname from headers (`host` or `x-forwarded-host`).
* Renders the tenant layout dynamically: reads the subdomain, checks cache/DB for branding details, and sets theme tokens.
* Supports custom domains by matching the domain name to the tenant record's `customDomain` field.

---

## ADR 05: Branch/Outlet Level Timezone and Currency Configuration

### Context:
Restaurants may expand globally across different regions, needing localized currencies for inventory/payroll and accurate local timezones for scheduling rosters.

### Decision:
Support `timezone` and `currency` configurations at the individual branch/outlet level (`RestaurantOutlet`) instead of globally at the restaurant tenant level.

### Alternatives Considered:
1. **Tenant-Level Configuration (Globally set per restaurant)**:
   * *Cons*: Prevents a tenant from expanding to multi-national branches or handling localized calculations per outlet.

### Rationale:
* Allows full flexibility for multi-region operations (e.g. Coyote Group operating coyote.co.uk with GBP/BST and coyote.co.in with INR/IST under a single SaaS membership).
* Ensures accurate scheduling boundaries and transaction valuation.

---

## ADR 06: App Service Layer Custom Domain SSL Termination

### Context:
When tenants configure custom domains (e.g. `grill.com` mapping to `grill.yourplatform.com`), SSL certificates and proxy routing must be validated.

### Decision:
Manage SSL certificate routing and request termination directly at the App Service layer.

### Alternatives Considered:
1. **Delegated CDN Edge Proxy (e.g. Cloudflare Enterprise SSL / Vercel custom domains)**:
   * *Cons*: Imposes dependency on specific third-party provider platforms and APIs.

### Rationale:
* Keeps platform architecture provider-agnostic, running directly inside standard cloud hosting setups.
* Host headers are resolved and validated dynamically at the application tier.

---

## ADR 07: PWA Support and Responsive Mobile-First Design

### Context:
Restaurant staff (waiters, inventory clerks, shift managers) operate on the move using smartphones and tablets, while administrators require dense desktop layouts for reporting and scheduling.

### Decision:
1. Implement a **mobile-first responsive design** using Tailwind CSS grid/flex patterns, drawer layouts for mobile, and collapsible sidebars for desktop.
2. Build **Progressive Web App (PWA)** support using `@ducanh2912/next-pwa` for service worker management, asset caching, installability prompt, and offline-fallback pages.

### Rationale:
* PWA support allows staff to add the dashboard to their home screen as a standalone app, bypassing app stores.
* Mobile-first responsive grids ensure optimal UX for small screens without maintaining separate codebases.

---

## ADR 08: Hostinger VPS & Coolify Optimization (Resource Guarding)

### Context:
Hostinger VPS has limited RAM/CPU resources. Next.js SSR processes can exhaust memory and trigger server crashes ("hanging") if not optimized.

### Decision:
1. **Docker Standalone Builds**: Build Next.js in `standalone` output mode in the Dockerfile.
2. **Encrypted Cookie Sessions**: Use encrypted cookies (`iron-session`) instead of database-backed session lookups on every request.

### Rationale:
* Standalone Next.js builds remove unnecessary framework and dependency files from the production image. Actual runtime memory must be measured and constrained through container resource limits; no fixed memory threshold is assumed.
* Encrypted cookie sessions avoid a database-backed session lookup on every authenticated request. Tenant membership, module entitlement, suspension and permission-sensitive operations must still be validated through the database or a short-lived authorization cache so access revocation takes effect safely.

---

## ADR 09: PgBouncer Connection Multiplexing

### Context:
The platform may serve many restaurant tenants, outlets and staff members through one shared PostgreSQL database.

Each deployed Next.js application instance maintains its own database connections. As application usage or the number of application containers increases, direct Prisma-to-PostgreSQL connections could exhaust PostgreSQL's connection limit and consume excessive memory.

The platform therefore requires connection multiplexing between application containers and PostgreSQL.

### Decision:
Deploy **PgBouncer as a private internal service in Coolify** between the Next.js application and PostgreSQL.

The production connection path will be:

```text
Next.js / Prisma
        ↓
PgBouncer
        ↓
PostgreSQL
```

PgBouncer will use **transaction pooling mode**.

Runtime application queries will use a pooled database connection URL pointing to PgBouncer.

Database migrations, schema introspection and administrative operations will use a separate direct PostgreSQL connection URL that bypasses PgBouncer.

### Connection URLs:

```text
DATABASE_URL
Application runtime → PgBouncer
```

```text
DIRECT_DATABASE_URL
Prisma migrations and administrative operations → PostgreSQL
```

Example:

```env
DATABASE_URL="postgresql://app_user:password@pgbouncer:6432/restaurant_saas?connection_limit=5&pool_timeout=10"

DIRECT_DATABASE_URL="postgresql://migration_user:password@postgres:5432/restaurant_saas"
```

The actual hostnames must use the private Coolify or Docker network service names.

Neither PostgreSQL nor PgBouncer should be publicly exposed unless temporary restricted administrative access is explicitly required.

### Initial PgBouncer Configuration:

```ini
[databases]
restaurant_saas = host=postgres port=5432 dbname=restaurant_saas

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432

pool_mode = transaction

max_client_conn = 500
default_pool_size = 15
reserve_pool_size = 5
reserve_pool_timeout = 3

max_db_connections = 20

server_idle_timeout = 60
server_lifetime = 3600
query_wait_timeout = 30

auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

admin_users = pgbouncer_admin
stats_users = pgbouncer_stats

max_prepared_statements = 200
```

These values are starting limits and must be adjusted using production metrics. They are not permanent capacity guarantees.

The total PostgreSQL connection budget must reserve connections for:

* PgBouncer
* Prisma migrations
* Coolify health checks
* Database administration
* Backup operations
* Monitoring
* Emergency access

### Prisma Requirements:

Prisma Client runtime traffic must use `DATABASE_URL`.

Prisma migration commands must use `DIRECT_DATABASE_URL`.

Examples include:

```bash
npx prisma migrate deploy
npx prisma db execute
```

The migration process must never depend exclusively on the transaction-pooled PgBouncer URL.

For PgBouncer 1.21 or later, the legacy `pgbouncer=true` query parameter should not be added unless required by the exact Prisma and PgBouncer versions being deployed.

The PgBouncer container version must be pinned rather than using an unversioned `latest` tag.

### Coolify Deployment Rules:

1. PgBouncer must run as an internal Docker service.
2. PgBouncer must communicate with PostgreSQL over a private Docker network.
3. The application must communicate with PgBouncer using its internal service hostname.
4. Port `6432` must not be mapped publicly.
5. PostgreSQL port `5432` must not be publicly exposed for normal application traffic.
6. PgBouncer must include a health check.
7. Application deployment must wait until PgBouncer is healthy.
8. PostgreSQL migrations must run using the direct database connection before the new application version begins serving traffic.
9. PgBouncer configuration and authentication files must not contain committed plaintext credentials.
10. Database and pooler credentials must be stored through Coolify environment secrets.

### Monitoring Requirements:

Monitor at minimum:

* Active PgBouncer clients
* Waiting PgBouncer clients
* Active PostgreSQL server connections
* Idle PostgreSQL server connections
* Average client wait time
* Maximum wait time
* Pool saturation
* Rejected client connections
* PostgreSQL connection utilization
* Long-running transactions
* Application database timeouts

Useful PgBouncer administration queries include:

```sql
SHOW POOLS;
SHOW CLIENTS;
SHOW SERVERS;
SHOW STATS;
SHOW DATABASES;
SHOW CONFIG;
```

An alert should be raised when clients regularly wait for a server connection, when the reserve pool is repeatedly used or when PostgreSQL approaches its reserved connection budget.

### Failure Behaviour:

If PgBouncer becomes unavailable, the application must fail database health checks and return a controlled temporary service error.

The application must not automatically switch to the direct PostgreSQL URL because doing so could cause all application instances to open direct database connections simultaneously.

Migration and emergency administration credentials must remain separate from normal application credentials.

### Alternatives Considered:

#### 1. Direct Prisma-to-PostgreSQL Connections

**Rejected because:**
* Each application container creates its own connection pool.
* Horizontal scaling multiplies the total number of PostgreSQL connections.
* PostgreSQL connections consume more server resources than lightweight PgBouncer client connections.
* A temporary increase in application instances could exhaust PostgreSQL connections.

#### 2. Prisma-managed Pooling Only

**Rejected as the sole production safeguard because:**
* Prisma's local pool exists separately inside every running application process.
* It does not multiplex connections across multiple containers.
* Total connection usage still increases as application instances increase.

#### 3. Session Pooling

**Rejected for normal application traffic because:**
* A PostgreSQL server connection remains assigned to a client for the entire client session.
* It provides less effective multiplexing for short web transactions.

#### 4. Statement Pooling

**Rejected because:**
* It is more restrictive.
* It does not support normal multi-statement transaction behaviour required by the application and ORM.

### Rationale:
Transaction pooling allows many application-side connections to share a controlled number of PostgreSQL server connections.
This protects the database from connection exhaustion while allowing the platform to scale application traffic and add application replicas.
Maintaining a separate direct URL ensures schema migrations and administrative operations are not affected by transaction-pooling restrictions.

### Consequences:

#### Positive:
* Lower PostgreSQL connection overhead
* Better protection against connection exhaustion
* Safer horizontal application scaling
* Centralized connection limits
* Improved observability of connection demand
* Reduced risk of database unavailability during traffic spikes

#### Negative:
* Introduces an additional infrastructure component
* Requires separate runtime and migration URLs
* Requires transaction-pooling compatibility
* Requires pool monitoring and capacity tuning
* PgBouncer becomes part of the application's critical database path

### Status:
Accepted.

---

## Coolify Implementation Structure

When using Docker Compose in Coolify, services within the stack can communicate through their service names on the internal network. Coolify creates an isolated network for Compose services, so the application can use `pgbouncer` as the host and PgBouncer can use `postgres` as the database host.

```yaml
services:
  app:
    build:
      context: .
    environment:
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_DATABASE_URL: ${DIRECT_DATABASE_URL}
    depends_on:
      pgbouncer:
        condition: service_healthy

  pgbouncer:
    image: ghcr.io/cloudnative-pg/pgbouncer:1.25.2
    command:
      - /usr/bin/pgbouncer
      - /etc/pgbouncer/pgbouncer.ini
    expose:
      - "6432"
    volumes:
      - ./infra/pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
      - ./infra/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro
    healthcheck:
      test:
        - CMD-SHELL
        - pg_isready -h 127.0.0.1 -p 6432 -U pgbouncer_stats
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    expose:
      - "5432"
    restart: unless-stopped

volumes:
  postgres-data:
```

A current PgBouncer release should be version-pinned. PgBouncer 1.25.2 is available as a maintained CloudNativePG container build.

---

## Prisma Configuration

Prisma officially recommends using a pooled URL for Prisma Client and a direct PostgreSQL URL for CLI operations such as migrations and introspection. Prisma Migrate should not run exclusively through PgBouncer transaction pooling.

For **Prisma 6**, this commonly looks like:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

For **Prisma 7**, direct CLI connection configuration has moved toward `prisma.config.ts`, so Antigravity must first inspect the installed Prisma version before modifying the datasource configuration.



