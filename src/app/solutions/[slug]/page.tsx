import { Metadata } from "next";
import { notFound } from "next/navigation";
import { SOLUTIONS_DATA } from "@/lib/solutionsData";
import SolutionClient from "@/components/solutions/SolutionClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(SOLUTIONS_DATA).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const solution = SOLUTIONS_DATA[slug];
  if (!solution) {
    return { title: "Solution Not Found | RestoBird" };
  }
  return {
    title: solution.seoTitle,
    description: solution.seoDescription,
    openGraph: {
      title: solution.seoTitle,
      description: solution.seoDescription,
      url: `https://restobird.com/solutions/${slug}`,
    },
  };
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const solution = SOLUTIONS_DATA[slug];
  if (!solution) {
    notFound();
  }
  return <SolutionClient solution={solution} />;
}
