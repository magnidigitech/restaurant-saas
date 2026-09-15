import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CALCULATORS_DATA } from "@/lib/calculatorsData";
import FoodCostCalculatorClient from "@/components/resources/FoodCostCalculatorClient";
import VarianceCalculatorClient from "@/components/resources/VarianceCalculatorClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(CALCULATORS_DATA).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const calc = CALCULATORS_DATA[slug];
  if (!calc) {
    return { title: "Calculator Not Found | RestoBird" };
  }
  return {
    title: calc.seoTitle,
    description: calc.seoDescription,
    openGraph: {
      title: calc.seoTitle,
      description: calc.seoDescription,
      url: `https://restobird.com/resources/calculators/${slug}`,
    },
  };
}

export default async function CalculatorPage({ params }: Props) {
  const { slug } = await params;
  const calc = CALCULATORS_DATA[slug];
  if (!calc) {
    notFound();
  }

  if (slug === "food-cost-calculator" || slug === "reorder-point-calculator") {
    return <FoodCostCalculatorClient />;
  }

  if (slug === "inventory-variance-calculator") {
    return <VarianceCalculatorClient />;
  }

  notFound();
}
