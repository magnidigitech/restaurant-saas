import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./core/auth/jwt";

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (unless it's custom tenant/admin APIs we want to gate)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

const PLATFORM_SESSION_COOKIE = "platform_admin_session";
const TENANT_SESSION_COOKIE = "tenant_session";

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // 1. Resolve host and subdomain
  const host = req.headers.get("host") || "";
  
  // We assume host looks like: admin.localhost:3000, coyote.localhost:3000, localhost:3000
  const hostParts = host.split(":");
  const domain = hostParts[0];
  const domainParts = domain.split(".");

  let subdomain = "";
  if (domainParts.length > 1 && domainParts[domainParts.length - 2] !== "localhost") {
    // e.g. subdomain.domain.com
    subdomain = domainParts[0];
  } else if (domainParts.length === 2 && domainParts[1] === "localhost") {
    // e.g. subdomain.localhost
    subdomain = domainParts[0];
  }

  // 2. Check for Platform Admin Scope
  if (subdomain === "admin") {
    // Gate platform-admin pathing
    if (path.startsWith("/api/platform-admin") && path !== "/api/platform-admin/auth/login") {
      const token = req.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;
      if (!session || session.role !== "PLATFORM_ADMIN") {
        return new NextResponse(JSON.stringify({ error: "Unauthorized Super Admin access" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return NextResponse.next();
    }

    if (path.startsWith("/api")) {
      return NextResponse.next();
    }

    if (path === "/" || path === "/platform-admin") {
      return NextResponse.redirect(new URL("/platform-admin/dashboard", req.url));
    }

    if (path.startsWith("/platform-admin")) {
      if (path === "/platform-admin/login") {
        return NextResponse.next();
      }

      // Check auth cookie
      const token = req.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;

      if (!session || session.role !== "PLATFORM_ADMIN") {
        return NextResponse.redirect(new URL("/platform-admin/login", req.url));
      }

      return NextResponse.next();
    }

    // Rewrite any other path to admin space
    url.pathname = `/platform-admin${path}`;
    return NextResponse.rewrite(url);
  }

  // 3. Check for Restaurant Subdomain Scope
  if (subdomain && subdomain !== "www") {
    // Don't intercept global api folders except tenant APIs
    if (path.startsWith("/api")) {
      if (path.startsWith("/api/restaurant")) {
        const isPublicTenantApi = 
          path === "/api/restaurant/auth/login" || 
          path === "/api/restaurant/activate" || 
          path.endsWith("/branding");

        if (!isPublicTenantApi) {
          const token = req.cookies.get(TENANT_SESSION_COOKIE)?.value;
          const session = token ? await verifyToken(token) : null;

          if (!session || session.activeRestaurantSubdomain !== subdomain) {
            return new NextResponse(JSON.stringify({ error: "Unauthorized Tenant Session" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
      return NextResponse.next();
    }

    // Don't intercept system assets
    if (path.startsWith("/images") || path.startsWith("/static")) {
      return NextResponse.next();
    }

    // Inside dynamic path rewrite.
    // If the path does not already start with /restaurant/[subdomain]
    const tenantPathPrefix = `/restaurant/${subdomain}`;
    if (!path.startsWith(tenantPathPrefix)) {
      if (path === "/login" || path === "/activate" || path.startsWith("/login/") || path.startsWith("/activate/")) {
        // Allow public pages inside the subfolder rewrite
        url.pathname = `/restaurant/${subdomain}${path}`;
        return NextResponse.rewrite(url);
      }

      // Verification check for protected page routes
      const token = req.cookies.get(TENANT_SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;

      if (!session || session.activeRestaurantSubdomain !== subdomain) {
        return NextResponse.redirect(new URL("/login", req.url));
      }

      // Rewrite home page to dashboard
      const targetPath = path === "/" ? "/dashboard" : path;
      url.pathname = `/restaurant/${subdomain}${targetPath}`;
      return NextResponse.rewrite(url);
    }
  }

  // Fallback for main landing domain (e.g. localhost:3000)
  if (path === "/") {
    // Render landing page or redirect to admin login if no subdomain
    return NextResponse.next();
  }

  return NextResponse.next();
}
