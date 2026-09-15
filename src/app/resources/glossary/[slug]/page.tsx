import { Metadata } from "next";
import { notFound } from "next/navigation";
import { GLOSSARY_DATA } from "@/lib/glossaryData";
import GlossaryTermClient from "@/components/resources/GlossaryTermClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(GLOSSARY_DATA).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const term = GLOSSARY_DATA[slug];
  if (!term) {
    return { title: "Term Not Found | RestoBird Glossary" };
  }
  return {
    title: term.seoTitle,
    description: term.seoDescription,
    openGraph: {
      title: term.seoTitle,
      description: term.seoDescription,
      url: `https://restobird.com/resources/glossary/${slug}`,
    },
  };
}

export default async function GlossaryPage({ params }: Props) {
  const { slug } = await params;
  const term = GLOSSARY_DATA[slug];
  if (!term) {
    notFound();
  }
  return <GlossaryTermClient term={term} />;
}
