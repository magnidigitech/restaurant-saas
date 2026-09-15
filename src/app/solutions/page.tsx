import { Metadata } from "next";
import Link from "next/link";
import { SOLUTIONS_DATA } from "@/lib/solutionsData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { ArrowRight, Sparkles, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Restaurant Management Solutions by Business Concept | RestoBird",
  description: "Tailored restaurant operations software for full-service dining, cafes, QSRs, ghost kitchens, bars, franchises, and multi-location chains.",
};

export default function SolutionsIndexPage() {
  const solutions = Object.values(SOLUTIONS_DATA);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <SiteHeader />

      <main className="flex-grow">
        <section className="bg-slate-900 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tailored Hospitality Solutions</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Software Built for Your Restaurant Model
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
              Whether you run a single fine-dining restaurant, a bustling cafe, a QSR drive-thru, or a 50-location franchise network, RestoBird adapts to your operational workflow.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.map((item) => (
              <Link
                key={item.slug}
                href={`/solutions/${item.slug}`}
                className="group bg-white rounded-3xl p-6 border border-slate-200 hover:border-amber-300 shadow-xs hover:shadow-lg transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold">
                    {item.heroBadge}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-xs text-slate-600 line-clamp-3">
                    {item.subtitle}
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-600">
                  <span>Explore Solution</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
