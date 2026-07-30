import { NextRequest } from "next/server";

export function validateCsrf(req: NextRequest): boolean {
  // Only protect state-changing requests
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");

  if (!host) {
    return false;
  }

  // Extract host domain from origin / referer
  let sourceDomain = "";
  if (origin) {
    sourceDomain = origin.replace(/^https?:\/\//, "");
  } else if (referer) {
    const url = new URL(referer);
    sourceDomain = url.host;
  } else {
    // If no origin or referer is present, check if it's production
    // For local testing in curl, it might be blank, but standard browser requests carry them.
    return process.env.NODE_ENV !== "production";
  }

  // Strip ports for comparison if needed, or check prefix/match
  const cleanHost = host.split(":")[0];
  const cleanSource = sourceDomain.split(":")[0];

  // Must match exact domain (allowing subdomains)
  return cleanSource.endsWith(cleanHost) || cleanHost.endsWith(cleanSource);
}
