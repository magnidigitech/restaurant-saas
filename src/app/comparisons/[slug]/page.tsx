import { Metadata } from "next";
import { notFound } from "next/navigation";
import { COMPARISONS_DATA } from "@/lib/comparisonsData";
import ComparisonClient from "@/components/comparisons/ComparisonClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(COMPARISONS_DATA).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const comparison = COMPARISONS_DATA[slug];
  if (!comparison) {
    return { title: "Comparison Not Found | RestoBird" };
  }
  return {
    title: comparison.seoTitle,
    description: comparison.seoDescription,
    openGraph: {
      title: comparison.seoTitle,
      description: comparison.seoDescription,
      url: `https://restobird.com/comparisons/${slug}`,
    },
  };
}

export default async function ComparisonPage({ params }: Props) {
  const { slug } = await params;
  const comparison = COMPARISONS_DATA[slug];
  if (!comparison) {
    notFound();
  }
  return <ComparisonClient comparison={comparison} />;
}
