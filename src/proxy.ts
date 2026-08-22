import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./core/auth/jwt";

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

const PLATFORM_SESSION_COOKIE = "platform_admin_session";
const TENANT_SESSION_COOKIE = "tenant_session";

function isLocalHost(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.includes("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    host.endsWith(".local")
  );
}

function createCleanRedirectUrl(targetPath: string, req: NextRequest, customHost?: string): URL {
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = rawHost.split(",")[0].trim().split(":")[0].toLowerCase();
  const rawPort = rawHost.includes(":") ? rawHost.split(":")[1] : "";

  const baseDomain = (process.env.ROOT_DOMAIN || "restiq.magnidigitech.com").toLowerCase();

  // If local development on localhost, keep localhost URL and port
  if (isLocalHost(host)) {
    const port = rawPort || "3000";
    return new URL(`http://localhost:${port}${targetPath}`);
  }

  let effectiveHost = customHost;
  if (!effectiveHost) {
    if (host && host !== "0.0.0.0" && host !== "127.0.0.1") {
      effectiveHost = host;
    } else {
      effectiveHost = baseDomain;
    }
  }

  const rawProto = req.headers.get("x-forwarded-proto") || "https";
  const proto = rawProto.split(",")[0].trim();

  const cleanUrl = new URL(`https://${effectiveHost}${targetPath}`);
  cleanUrl.protocol = `${proto}:`;
  cleanUrl.port = "";
  return cleanUrl;
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // 1. Static assets and internal next routes
  if (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/images") ||
    path.startsWith("/uploads") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Resolve host and subdomain from X-Forwarded-Host or Host header
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = rawHost.split(",")[0].trim();
  const domain = host.split(":")[0].toLowerCase();

  const baseDomain = (process.env.ROOT_DOMAIN || "restiq.magnidigitech.com").toLowerCase();

  let subdomain = "";

  if (domain.endsWith(".sslip.io")) {
    const sslipParts = domain.replace(".sslip.io", "").split(".");
    if (sslipParts.length > 5) {
      subdomain = sslipParts[0];
    }
  } else if (isLocalHost(domain)) {
    const domainParts = domain.split(".");
    if (domainParts.length > 1 && domainParts[0] !== "localhost") {
      subdomain = domainParts[0];
    }
  } else if (domain.endsWith(baseDomain)) {
    if (domain !== baseDomain) {
      subdomain = domain.replace(`.${baseDomain}`, "");
    }
  } else {
    const domainParts = domain.split(".");
    if (domainParts.length > 2) {
      subdomain = domainParts[0];
    }
  }

  // 3. Direct /restaurant/[subdomain] path routing (local testing or subpath navigation)
  if (path.startsWith("/restaurant/")) {
    const pathParts = path.split("/");
    const pathSubdomain = pathParts[2];

    if (pathSubdomain) {
      const isPublicPath =
        path === `/restaurant/${pathSubdomain}/login` ||
        path === `/restaurant/${pathSubdomain}/activate` ||
        path.startsWith(`/restaurant/${pathSubdomain}/activate/`);

      if (isPublicPath) {
        return NextResponse.next();
      }

      // Check tenant session authentication
      const token = req.cookies.get(TENANT_SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;

      if (!session || session.activeRestaurantSubdomain !== pathSubdomain) {
        return NextResponse.redirect(
          createCleanRedirectUrl(`/restaurant/${pathSubdomain}/login`, req)
        );
      }

      return NextResponse.next();
    }
  }

  // 4. Check for Platform Super Admin Scope (admin.domain, /platform-admin, or /api/platform-admin)
  if (subdomain === "admin" || path.startsWith("/platform-admin") || path.startsWith("/api/platform-admin")) {
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
      const token = req.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;
      if (!session || session.role !== "PLATFORM_ADMIN") {
        return NextResponse.redirect(createCleanRedirectUrl("/platform-admin/login", req));
      }
      return NextResponse.redirect(createCleanRedirectUrl("/platform-admin/dashboard", req));
    }

    if (path.startsWith("/platform-admin")) {
      if (path === "/platform-admin/login") {
        return NextResponse.next();
      }

      const token = req.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;

      if (!session || session.role !== "PLATFORM_ADMIN") {
        return NextResponse.redirect(createCleanRedirectUrl("/platform-admin/login", req));
      }

      return NextResponse.next();
    }

    url.pathname = `/platform-admin${path}`;
    return NextResponse.rewrite(url);
  }

  // 5. Check for Subdomain-based Restaurant Scope (e.g. magni.restiq.magnidigitech.com)
  if (subdomain && subdomain !== "www") {
    if (path.startsWith("/onboarding/portal")) {
      return NextResponse.next();
    }

    if (path.startsWith("/api")) {
      if (path.startsWith("/api/restaurant")) {
        const isPublicTenantApi =
          path === "/api/restaurant/auth/login" ||
          path === "/api/restaurant/activate" ||
          path.endsWith("/branding") ||
          path.startsWith("/api/restaurant/onboarding/portal");

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

    const tenantPathPrefix = `/restaurant/${subdomain}`;
    if (!path.startsWith(tenantPathPrefix)) {
      if (path === "/login" || path === "/activate" || path.startsWith("/login/") || path.startsWith("/activate/")) {
        url.pathname = `/restaurant/${subdomain}${path}`;
        return NextResponse.rewrite(url);
      }

      const token = req.cookies.get(TENANT_SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;

      if (!session || session.activeRestaurantSubdomain !== subdomain) {
        return NextResponse.redirect(createCleanRedirectUrl("/login", req));
      }

      const targetPath = path === "/" ? "/dashboard" : path;
      url.pathname = `/restaurant/${subdomain}${targetPath}`;
      return NextResponse.rewrite(url);
    }
  }

  // 6. Public APIs & Activation Token route
  if (path.startsWith("/api") || path.startsWith("/activate") || path.startsWith("/onboarding")) {
    return NextResponse.next();
  }

  // 7. Fallback Root Path
  if (isLocalHost(domain)) {
    return NextResponse.redirect(createCleanRedirectUrl("/platform-admin/login", req));
  } else {
    return NextResponse.redirect(createCleanRedirectUrl("/platform-admin/login", req, `admin.${baseDomain}`));
  }
}
