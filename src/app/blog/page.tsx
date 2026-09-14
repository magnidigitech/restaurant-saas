import { Metadata } from "next";
import BlogHubClient from "@/components/blog/BlogHubClient";

export const metadata: Metadata = {
  title: "Restaurant Management Blog & Operating Guides | Resto Bird (@getrestobird)",
  description:
    "Expert hospitality guides, POS integration strategies, ingredient recipe depletion techniques, and menu engineering tips for multi-outlet restaurants by Resto Bird.",
  keywords: [
    "Resto Bird blog",
    "getrestobird insights",
    "restaurant management blog",
    "POS integration guide",
    "recipe depletion tips",
    "menu engineering matrix",
    "restaurant cost control",
    "hospitality operating guides",
  ],
  openGraph: {
    title: "Restaurant Management Blog & Operating Guides | Resto Bird",
    description:
      "Expert hospitality guides and industry insights for modern multi-outlet restaurant operators.",
    url: "https://restobird.com/blog",
    siteName: "Resto Bird",
    images: [{ url: "/resto-bird-logo.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@getrestobird",
    creator: "@getrestobird",
    title: "Restaurant Management Blog | Resto Bird (@getrestobird)",
    description:
      "Expert hospitality guides, recipe depletion, and POS integration playbooks by Resto Bird.",
    images: ["/resto-bird-logo.png"],
  },
};

export default function BlogPage() {
  return <BlogHubClient />;
}
