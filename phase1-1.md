Implement Phase 1.1: Production Hardening and PgBouncer Integration.

Do not begin HR, Shift Management, Payroll or Inventory functionality during this task.

At the start, read only:

* docs/ai/PROJECT_CONTEXT.md
* docs/ai/PROJECT_MAP.md
* docs/ai/CURRENT_STATE.md
* docs/ai/ACCESS_CONTROL.md
* docs/ai/DECISIONS.md

Do not recursively scan the repository.

First inspect only:

* package.json
* next.config.ts
* src/middleware.ts or src/proxy.ts
* src/core/database/client.ts
* src/core/auth/jwt.ts
* src/core/auth/session.ts
* src/core/permissions/check.ts
* src/core/tests/security.test.ts
* prisma.config.ts
* prisma/schema.prisma
* docker-compose.yml
* .gitignore
* .env.example if it exists

## 1. Next.js Routing Convention

Determine the installed Next.js version from package.json.

If Next.js 16 or newer is installed:

* Rename src/middleware.ts to src/proxy.ts.
* Rename the exported middleware function to proxy where required.
* Preserve hostname-based tenant routing.
* Preserve matcher exclusions.
* Ensure Proxy performs only hostname resolution and optimistic session redirects.
* Do not perform regular database authorization queries in Proxy.

If the installed version does not require this migration, document why no change was made.

## 2. Secure Authorization Layer

Verify that every protected Route Handler and Server Function performs secure authorization close to the database operation.

The secure authorization function must validate:

1. The session signature and expiration.
2. The current user exists and is active.
3. The restaurant membership is active.
4. The restaurant is active.
5. The requested module is currently enabled for the restaurant.
6. The member has an active AccessGrant.
7. The assigned role has the required permission.
8. Outlet access matches when outletId is required.

Do not trust these values from request bodies, query strings or client headers:

* restaurantId
* outletId
* membershipId
* moduleId
* roleId
* permission keys representing granted authority

Resolve tenant context from the verified session, hostname and database records.

Add a sessionVersion or tokenVersion field so existing JWT sessions can be revoked after password changes, user deactivation or forced logout.

## 3. Security Test Completion

Add explicit tests for:

* Restaurant user blocked from Platform Super Admin page.
* Restaurant user blocked from Platform Super Admin API.
* Platform user cannot use a tenant session cookie as a restaurant session.
* Tenant session cannot be used as a platform session.
* Browser-supplied restaurantId cannot override the authenticated restaurant.
* Browser-supplied outletId cannot override authorized outlet scope.
* Cross-subdomain access is rejected.
* Expired invitation is rejected.
* Used invitation cannot be reused.
* Invitation for Restaurant A cannot activate an account for Restaurant B.
* Disabled module access is revoked for an existing logged-in user.
* Suspended membership is rejected.
* Deactivated user is rejected.
* Password or session-version change invalidates old sessions.

Display every assertion independently in the test output.

Do not report a test category as passed unless its explicit assertion was executed.

## 4. PgBouncer Service

Add PgBouncer to the production Coolify Docker Compose configuration.

Use:

* A pinned PgBouncer image version
* Transaction pooling
* Private Docker networking
* Internal port 6432
* No public PgBouncer host-port mapping
* A health check
* SCRAM-SHA-256 authentication when supported by the selected image
* max_prepared_statements greater than zero
* A conservative initial PostgreSQL server connection pool
* Explicit client and query wait limits

Production connection flow:

Application → PgBouncer → PostgreSQL

Use:

DATABASE_URL for application runtime through PgBouncer.

DIRECT_DATABASE_URL for Prisma migrations and administrative operations directly through PostgreSQL.

Do not automatically fall back from PgBouncer to the direct PostgreSQL URL.

Do not expose PostgreSQL port 5432 or PgBouncer port 6432 publicly.

## 5. Prisma 7 and pg Driver Pooling

The project uses Prisma 7 with @prisma/adapter-pg.

Inspect the exact installed versions and official package types before changing configuration.

Configure the runtime adapter with the pooled DATABASE_URL.

Configure the underlying pg pool explicitly with a conservative connection maximum appropriate for PgBouncer.

Do not assume that Prisma's older connection_limit URL parameter controls @prisma/adapter-pg.

Ensure prisma.config.ts uses the direct database URL for:

* migrate deploy
* migrate dev in local development
* db pull
* schema administration

Add scripts such as:

* db:generate
* db:migrate:dev
* db:migrate:deploy
* db:seed
* test:security

Production migrations must use DIRECT_DATABASE_URL and must finish successfully before the new application version serves traffic.

## 6. Database Users

Prepare separate PostgreSQL roles:

* Application runtime user
* Migration user
* PgBouncer administration or statistics user when required

The application user must not receive unnecessary schema-management privileges.

The migration user may receive schema migration permissions but must not be used by normal application traffic.

Document the required SQL or initialization script without committing passwords.

## 7. Secrets and Environment Safety

Ensure:

* .env is ignored by Git.
* .env.example contains names only and no real credentials.
* No postgres:postgres credential remains in production configuration.
* JWT secrets are required and sufficiently long.
* Separate development and production environment values are documented.
* Application startup fails clearly when required environment variables are absent.
* Secrets are read from Coolify environment settings.
* Sensitive environment values are never printed in logs.

Check repository history or tracked files for accidentally committed .env files and report findings without printing secret values.

## 8. Invitation Security

Ensure staff invitation tokens are:

* Generated using a cryptographically secure random source
* Stored as a one-way hash
* Single-use
* Expiring
* Restaurant-bound
* Email-bound
* Invalidated after activation
* Invalidated when replaced
* Rejected for suspended restaurants or inactive memberships

Add appropriate database constraints and indexes.

## 9. Authentication Protections

Add:

* Login rate limiting
* Generic invalid-credentials responses
* Secure, HttpOnly cookies
* SameSite cookie configuration
* Secure cookies in production
* Appropriate cookie paths
* Session expiration
* Logout invalidation
* Origin validation or CSRF protection for state-changing requests
* Password policy validation
* Protection against user enumeration

Do not store passwords, invite tokens or JWTs in audit logs.

## 10. Health Checks

Create:

* GET /api/health/live
* GET /api/health/ready

The liveness endpoint must not query the database.

The readiness endpoint must perform a lightweight database check through PgBouncer in production.

Health responses must not expose:

* Connection strings
* Database usernames
* Internal service names
* Stack traces
* Secret values

Configure the application service to depend on the PgBouncer health check where supported.

## 11. Updated Documentation

Update:

* docs/ai/CURRENT_STATE.md
* docs/ai/PROJECT_MAP.md
* docs/ai/DECISIONS.md
* docs/ai/ACCESS_CONTROL.md

Add or update the PgBouncer ADR to record:

* Transaction pooling
* Runtime pooled URL
* Direct migration URL
* Pool sizing ownership
* Private network requirement
* Failure behaviour
* Monitoring expectations

## Verification

Run:

* Type checking
* ESLint
* Production build
* Security test suite
* Prisma schema validation
* Prisma client generation
* Migration test against a disposable database
* Application query through PgBouncer
* Direct migration connection test
* PgBouncer health check
* Readiness and liveness endpoint tests

Provide the final results with:

* Each individual security assertion
* Files changed
* Database migration names
* Docker services added
* Environment variable names added
* Runtime database path
* Migration database path
* Pool settings
* Known limitations
* Rollback instructions

Do not claim production readiness when any required security or database-path test remains unverified.
