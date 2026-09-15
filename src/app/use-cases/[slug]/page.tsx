import { Metadata } from "next";
import { notFound } from "next/navigation";
import { USE_CASES_DATA } from "@/lib/useCasesData";
import UseCaseClient from "@/components/use-cases/UseCaseClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(USE_CASES_DATA).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const useCase = USE_CASES_DATA[slug];
  if (!useCase) {
    return { title: "Use Case Not Found | RestoBird" };
  }
  return {
    title: useCase.seoTitle,
    description: useCase.seoDescription,
    openGraph: {
      title: useCase.seoTitle,
      description: useCase.seoDescription,
      url: `https://restobird.com/use-cases/${slug}`,
    },
  };
}

export default async function UseCasePage({ params }: Props) {
  const { slug } = await params;
  const useCase = USE_CASES_DATA[slug];
  if (!useCase) {
    notFound();
  }
  return <UseCaseClient useCase={useCase} />;
}
