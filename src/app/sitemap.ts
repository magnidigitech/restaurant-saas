import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blogData";
import { SOLUTIONS_DATA } from "@/lib/solutionsData";
import { USE_CASES_DATA } from "@/lib/useCasesData";
import { COMPARISONS_DATA } from "@/lib/comparisonsData";
import { CALCULATORS_DATA } from "@/lib/calculatorsData";
import { GLOSSARY_DATA } from "@/lib/glossaryData";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://restobird.com";
  const releaseDate = new Date("2026-09-15T00:00:00.000Z");

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

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: releaseDate,
  }));

  const solutionEntries: MetadataRoute.Sitemap = Object.keys(SOLUTIONS_DATA).map((slug) => ({
    url: `${baseUrl}/solutions/${slug}`,
    lastModified: releaseDate,
  }));

  const useCaseEntries: MetadataRoute.Sitemap = Object.keys(USE_CASES_DATA).map((slug) => ({
    url: `${baseUrl}/use-cases/${slug}`,
    lastModified: releaseDate,
  }));

  const comparisonEntries: MetadataRoute.Sitemap = Object.keys(COMPARISONS_DATA).map((slug) => ({
    url: `${baseUrl}/comparisons/${slug}`,
    lastModified: releaseDate,
  }));

  const calculatorEntries: MetadataRoute.Sitemap = Object.keys(CALCULATORS_DATA).map((slug) => ({
    url: `${baseUrl}/resources/calculators/${slug}`,
    lastModified: releaseDate,
  }));

  const glossaryEntries: MetadataRoute.Sitemap = Object.keys(GLOSSARY_DATA).map((slug) => ({
    url: `${baseUrl}/resources/glossary/${slug}`,
    lastModified: releaseDate,
  }));

  return [
    { url: baseUrl, lastModified: releaseDate },
    { url: `${baseUrl}/pricing`, lastModified: releaseDate },
    { url: `${baseUrl}/about`, lastModified: releaseDate },
    { url: `${baseUrl}/blog`, lastModified: releaseDate },
    { url: `${baseUrl}/solutions`, lastModified: releaseDate },
    { url: `${baseUrl}/use-cases`, lastModified: releaseDate },
    { url: `${baseUrl}/comparisons`, lastModified: releaseDate },
    ...moduleEntries,
    ...blogEntries,
    ...solutionEntries,
    ...useCaseEntries,
    ...comparisonEntries,
    ...calculatorEntries,
    ...glossaryEntries,
  ];
}
