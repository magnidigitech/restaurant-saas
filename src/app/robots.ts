import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://restobird.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/platform-admin/", "/activate/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
