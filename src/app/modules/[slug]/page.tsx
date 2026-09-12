import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RESTO_BIRD_MODULES, ModuleData } from "@/lib/modulesData";
import ModuleInteractiveSimulator from "@/components/modules/ModuleInteractiveSimulator";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Check,
  XCircle,
  Sparkles,
  ChevronRight,
  Shield,
  Zap,
  HelpCircle,
  Flame,
  WifiOff,
  LayoutGrid,
  CreditCard,
  AlertTriangle,
  MonitorSmartphone,
  Scale,
  ShoppingCart,
  Boxes,
  TrendingDown,
  Layers,
  ShieldAlert,
  Calculator,
  BadgeDollarSign,
  FileText,
  Clock,
  Armchair,
  Calendar,
  Repeat,
  ShieldCheck,
  LineChart,
  UserCheck,
  Bell,
  Tablet,
  Users,
  Coffee,
  MapPin,
  Coins,
  FileSpreadsheet,
  Landmark,
  Receipt,
  Banknote,
  FileCheck,
  TrendingUp,
  Wallet,
  ReceiptText,
  AlertCircle,
  Gauge,
  DollarSign,
  Lock,
  KeyRound,
  Copy,
  History,
  Wifi,
  Grid2x2,
  Award,
  Compass,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(RESTO_BIRD_MODULES).map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const module = RESTO_BIRD_MODULES[slug];

  if (!module) {
    return {
      title: "Module Not Found | Resto Bird",
    };
  }

  const titleText = module.seoTitle || module.name;

  return {
    title: titleText,
    description: module.description,
    alternates: {
      canonical: `/${module.slug}`,
    },
    openGraph: {
      title: `${titleText} | Resto Bird`,
      description: module.tagline,
      url: `/${module.slug}`,
    },
  };
}

// Dynamic Icon Resolver
function FeatureIcon({ name }: { name: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    WifiOff: <WifiOff className="w-5 h-5 text-amber-600" />,
    Flame: <Flame className="w-5 h-5 text-amber-600" />,
    LayoutGrid: <LayoutGrid className="w-5 h-5 text-amber-600" />,
    CreditCard: <CreditCard className="w-5 h-5 text-amber-600" />,
    AlertTriangle: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    MonitorSmartphone: <MonitorSmartphone className="w-5 h-5 text-amber-600" />,
    Scale: <Scale className="w-5 h-5 text-emerald-600" />,
    ShoppingCart: <ShoppingCart className="w-5 h-5 text-emerald-600" />,
    Boxes: <Boxes className="w-5 h-5 text-emerald-600" />,
    TrendingDown: <TrendingDown className="w-5 h-5 text-emerald-600" />,
    Layers: <Layers className="w-5 h-5 text-emerald-600" />,
    ShieldAlert: <ShieldAlert className="w-5 h-5 text-rose-600" />,
    Sparkles: <Sparkles className="w-5 h-5 text-sky-600" />,
    Calculator: <Calculator className="w-5 h-5 text-sky-600" />,
    BadgeDollarSign: <BadgeDollarSign className="w-5 h-5 text-sky-600" />,
    FileText: <FileText className="w-5 h-5 text-sky-600" />,
    Clock: <Clock className="w-5 h-5 text-purple-600" />,
    Armchair: <Armchair className="w-5 h-5 text-sky-600" />,
    Calendar: <Calendar className="w-5 h-5 text-indigo-600" />,
    Repeat: <Repeat className="w-5 h-5 text-indigo-600" />,
    ShieldCheck: <ShieldCheck className="w-5 h-5 text-indigo-600" />,
    LineChart: <LineChart className="w-5 h-5 text-indigo-600" />,
    UserCheck: <UserCheck className="w-5 h-5 text-indigo-600" />,
    Bell: <Bell className="w-5 h-5 text-indigo-600" />,
    Tablet: <Tablet className="w-5 h-5 text-purple-600" />,
    Shield: <Shield className="w-5 h-5 text-purple-600" />,
    Users: <Users className="w-5 h-5 text-purple-600" />,
    Coffee: <Coffee className="w-5 h-5 text-purple-600" />,
    MapPin: <MapPin className="w-5 h-5 text-purple-600" />,
    CheckCircle2: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    Coins: <Coins className="w-5 h-5 text-rose-600" />,
    FileSpreadsheet: <FileSpreadsheet className="w-5 h-5 text-rose-600" />,
    Landmark: <Landmark className="w-5 h-5 text-rose-600" />,
    Receipt: <Receipt className="w-5 h-5 text-rose-600" />,
    Banknote: <Banknote className="w-5 h-5 text-rose-600" />,
    FileCheck: <FileCheck className="w-5 h-5 text-rose-600" />,
    TrendingUp: <TrendingUp className="w-5 h-5 text-amber-600" />,
    Wallet: <Wallet className="w-5 h-5 text-amber-600" />,
    ReceiptText: <ReceiptText className="w-5 h-5 text-amber-600" />,
    AlertCircle: <AlertCircle className="w-5 h-5 text-amber-600" />,
    Gauge: <Gauge className="w-5 h-5 text-amber-600" />,
    DollarSign: <DollarSign className="w-5 h-5 text-amber-600" />,
    Lock: <Lock className="w-5 h-5 text-teal-600" />,
    KeyRound: <KeyRound className="w-5 h-5 text-teal-600" />,
    Copy: <Copy className="w-5 h-5 text-teal-600" />,
    History: <History className="w-5 h-5 text-teal-600" />,
    Wifi: <Wifi className="w-5 h-5 text-teal-600" />,
    Grid2X2: <Grid2x2 className="w-5 h-5 text-amber-600" />,
    Award: <Award className="w-5 h-5 text-amber-600" />,
    Compass: <Compass className="w-5 h-5 text-amber-600" />,
  };

  return iconMap[name] || <Zap className="w-5 h-5 text-amber-600" />;
}

export default async function ModuleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const module = RESTO_BIRD_MODULES[slug];

  if (!module) {
    notFound();
  }

  // Find next module for seamless sequential exploration
  const moduleKeys = Object.keys(RESTO_BIRD_MODULES);
  const currentIndex = moduleKeys.indexOf(slug);
  const nextSlug = moduleKeys[(currentIndex + 1) % moduleKeys.length];
  const nextModule = RESTO_BIRD_MODULES[nextSlug];

  return (
    <div className="pb-24">
      {/* 1. BREADCRUMB & MODULE HERO HEADER */}
      <section className="pt-8 pb-14 sm:pt-12 sm:pb-20 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Resto Bird
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-900 font-semibold">
              {module.slug === "pos" ? "KDS" : module.shortName}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            {/* Left Content */}
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>{module.heroBadge}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.08]">
                {module.name}
              </h1>

              <p className="text-base sm:text-lg font-medium text-amber-800 italic">
                &ldquo;{module.tagline}&rdquo;
              </p>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl font-normal">
                {module.description}
              </p>

              {/* Action CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/restaurant/bahubali/login"
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full transition-all shadow-md active:scale-95"
                >
                  Launch Interactive Demo →
                </Link>
                <a
                  href="#simulator"
                  className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-full transition-all"
                >
                  Try Live Simulator ↓
                </a>
              </div>
            </div>

            {/* Right Stat Cards */}
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 font-mono">
                <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {module.primaryStat}
                </div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                  {module.primaryStatLabel}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 font-mono">
                <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {module.secondaryStat}
                </div>
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  {module.secondaryStatLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE LIVE SIMULATOR SECTION */}
      <section id="simulator" className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-700 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Interactive Product Simulation</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Experience the {module.shortName} workflow.
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Pure Light UI • Zero Mock Data Delay
            </span>
          </div>

          {/* Render the interactive simulator */}
          <ModuleInteractiveSimulator moduleSlug={module.slug} />
        </div>
      </section>

      {/* 3. SIX DEEP OPERATIONAL CAPABILITIES */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24">
        <div className="space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Engineered for peak rush hospitality.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Built to withstand grease, steam, dropped connections, and relentless Friday dinner volume.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {module.features.map((feature, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center">
                      <FeatureIcon name={feature.iconName} />
                    </div>
                    {feature.badge && (
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{feature.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. MID-SHIFT REALITY: BEFORE VS AFTER */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24">
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">
              Operational Contrast
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              What happens in the heat of dinner rush?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              See how Resto Bird compares to legacy restaurant management workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Before Column */}
            <div className="p-5 rounded-2xl bg-rose-50/40 border border-rose-200/80 space-y-3 text-xs">
              <div className="flex items-center space-x-2 font-bold text-rose-800 text-sm">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Without Resto Bird (Legacy / Paper)</span>
              </div>
              <ul className="space-y-2.5 text-slate-700">
                {module.beforeRestoBird.map((point, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <span className="text-rose-500 font-bold mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After Column */}
            <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3 text-xs">
              <div className="flex items-center space-x-2 font-bold text-emerald-800 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>With Resto Bird {module.shortName}</span>
              </div>
              <ul className="space-y-2.5 text-slate-700">
                {module.withRestoBird.map((point, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="font-medium text-slate-900">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HARDWARE & TECHNICAL SPECIFICATIONS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24">
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">
              Enterprise Specifications
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Technical standards & hardware specs.
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {module.techSpecs.map((spec, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-600">{spec.label}</span>
                  <span className="font-mono text-slate-900 font-bold text-right ml-4">
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. OPERATOR IMPACT QUOTE */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-20">
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white space-y-4 shadow-xl">
          <div className="text-amber-400 text-3xl font-serif leading-none">&ldquo;</div>
          <p className="text-base sm:text-xl font-medium leading-relaxed">
            {module.quote.text}
          </p>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-white">{module.quote.author}</div>
              <div className="text-stone-400 text-[11px]">
                {module.quote.role} • {module.quote.restaurant}
              </div>
            </div>
            <div className="inline-flex items-center space-x-1 text-amber-400 font-mono text-[10px] uppercase">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified Operator</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">
            Operator Questions
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {module.faqs.map((faq, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2"
            >
              <h3 className="font-bold text-slate-900 text-sm flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{faq.question}</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-6">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 8. NEXT MODULE RUNWAY BANNER */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20">
        <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
              NEXT SYSTEM MODULE →
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {nextModule.name}
            </h3>
            <p className="text-xs text-stone-300 max-w-lg leading-relaxed">
              {nextModule.tagline}
            </p>
          </div>

          <Link
            href={`/${nextModule.slug}`}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-full transition-all shadow-md shrink-0 flex items-center space-x-2 active:scale-95"
          >
            <span>Explore {nextModule.shortName}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
