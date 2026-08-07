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

function createCleanRedirectUrl(targetPath: string, req: NextRequest, customHost?: string): URL {
  const cleanUrl = new URL(targetPath, req.url);
  const rawProto = req.headers.get("x-forwarded-proto") || "https";
  cleanUrl.protocol = `${rawProto.split(",")[0].trim()}:`;
  cleanUrl.port = "";
  if (customHost) {
    cleanUrl.hostname = customHost;
  }
  return cleanUrl;
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // 1. Resolve host and subdomain from X-Forwarded-Host or Host header
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
  } else if (domain.endsWith("localhost") || domain.includes("127.0.0.1")) {
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

  // 2. Check for Platform Admin Scope
  if (subdomain === "admin" || path.startsWith("/platform-admin")) {
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

  // 3. Check for Restaurant Subdomain Scope
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

    if (path.startsWith("/images") || path.startsWith("/static") || path.startsWith("/uploads")) {
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

  // 4. Root Base Domain Fallback (e.g. restiq.magnidigitech.com without subdomain)
  // Automatically redirect to Platform Admin Login without internal port 3000
  if (!path.startsWith("/api") && !path.startsWith("/_next") && !path.startsWith("/static")) {
    return NextResponse.redirect(createCleanRedirectUrl("/platform-admin/login", req, `admin.${baseDomain}`));
  }

  return NextResponse.next();
}
