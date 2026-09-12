import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://restobird.com";
  // Meaningful content update timestamp for indexable pages
  const releaseDate = new Date("2026-09-12T00:00:00.000Z");

  const moduleSlugs = [
    "pos",
    "inventory",
    "catering",
    "shifts",
    "attendance",
    "payroll",
    "finance",
    "vault",
    "analytics",
  ];

  const moduleEntries: MetadataRoute.Sitemap = moduleSlugs.map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified: releaseDate,
  }));

  return [
    {
      url: baseUrl,
      lastModified: releaseDate,
    },
    ...moduleEntries,
  ];
}
