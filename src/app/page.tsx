"use client";

import React, { useState } from "react";
import Link from "next/link";
import ThreeScrollScene from "@/components/landing/ThreeScrollScene";
import Card3D from "@/components/landing/Card3D";
import OrderJourneySimulator from "@/components/landing/OrderJourneySimulator";
import LiveDishDepletionDemo from "@/components/landing/LiveDishDepletionDemo";
import ModuleDetailModal, { DetailedModule } from "@/components/landing/ModuleDetailModal";

function ModuleSvgIcon({ id, className = "w-6 h-6" }: { id: string; className?: string }) {
  switch (id) {
    case "pos":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case "catering":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v2m-6 3a6 6 0 0112 0H6zm-3 8h18m-16 0v2a2 2 0 002 2h10a2 2 0 002-2v-2" />
        </svg>
      );
    case "inventory":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 12h12l3-12H3zm9-3v3m-5 9h10" />
        </svg>
      );
    case "purchase":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "shifts":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "attendance":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "leaves":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-7-9c0-3.5 3-7 7-7 4 0 7 3.5 7 7M5 14c0 3.5 3 5 7 5 4 0 7-1.5 7-5" />
        </svg>
      );
    case "payroll":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12v-2m0 0c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "finance":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "vault":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case "operations":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case "analytics":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case "masterdata":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

const MODULES_DATA: DetailedModule[] = [
  {
    id: "pos",
    name: "Point of Sale & Fast Billing",
    category: "FOH",
    badge: "Front of House",
    iconBg: "bg-amber-100 text-amber-900 border-amber-300",
    iconColor: "text-amber-800",
    description: "High-speed table ordering and fast checkout interface for dine-in, takeaway, and multi-outlet table floor layouts.",
    useCase: "Waitstaff punch Biryani and Curry orders on tablets at Table 7; bills calculate taxes automatically and instantly route tickets to kitchen displays.",
    roiMetric: "Cut order dispatch time by 45%",
    highlights: ["Table Occupancy Map", "Split Billing & Discounts", "Offline Ticket Queue", "KDS Dispatch"],
    roles: ["Cashiers", "Floor Waiters", "Restaurant Managers"],
    beforeRestIQ: "Handwritten paper slips lost in peak rush, slow billing queues, and manual bill split disputes.",
    withRestIQ: "Fast digital order taking, automated tax rules, visual table maps, and sub-second dispatch to kitchen stations.",
    demoUrl: "/restaurant/bahubali/pos",
  },
  {
    id: "catering",
    name: "Catering & Banquet Event Studio",
    category: "FOH",
    badge: "Banquets & Events",
    iconBg: "bg-orange-100 text-orange-900 border-orange-300",
    iconColor: "text-orange-800",
    description: "End-to-end banquet proposal builder with live guest Pax headcount scaling, dynamic ingredient cost calculation, and printable invoice proposals.",
    useCase: "Scale the Grand Royal Feast Package from 50 to 500 guests with 1 slider drag to compute raw chicken, rice, and naan demands with live profit margins.",
    roiMetric: "Prevent 22% raw material over-procurement",
    highlights: ["Live Pax Headcount Slider", "Profit Margin Gauge (>65%)", "1-Click Package Loader", "Advance Deposit Tracking"],
    roles: ["Banquet Managers", "Catering Directors", "Executive Chefs"],
    beforeRestIQ: "Hours updating manual spreadsheets for every guest count change, leading to major ingredient over-ordering.",
    withRestIQ: "Instant slider scaling from 20 to 500+ guests with automatic recipe yields, deposit tracking, and PDF proposals.",
    demoUrl: "/restaurant/bahubali/catering",
  },
  {
    id: "inventory",
    name: "Inventory & Recipe Master BOM",
    category: "KITCHEN",
    badge: "Kitchen & Storage",
    iconBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
    iconColor: "text-emerald-800",
    description: "Deep Bill-of-Materials recipe costing engine that automatically burns raw store ingredients upon every POS sale.",
    useCase: "Billing 50 Biryani plates automatically deducts 12.5kg Basmati Rice, 11kg Chicken, and 1.5L Pure Ghee from central store balances.",
    roiMetric: "Reduce food cost variance to <1.5%",
    highlights: ["Recipe Portion Yields", "POS Depletion Engine", "Purchase Order Auto-Gen", "Low Stock Threshold Alerts"],
    roles: ["Executive Chef", "Inventory Storekeeper", "Procurement Officer"],
    beforeRestIQ: "Unexplained kitchen leakage, sudden stockouts during dinner rush, and painful weekend stock counts.",
    withRestIQ: "Every dish billed deducts exact recipe grammages in real time, triggering automatic purchase orders at par levels.",
    demoUrl: "/restaurant/bahubali/inventory",
  },
  {
    id: "purchase",
    name: "Purchase & Vendor Management",
    category: "KITCHEN",
    badge: "Kitchen & Storage",
    iconBg: "bg-amber-100 text-amber-900 border-amber-300",
    iconColor: "text-amber-800",
    description: "Manage raw material vendor directories, supplier price sheets, Purchase Orders (PO), and delivery receiving.",
    useCase: "Generate vendor purchase orders directly from low inventory alerts and receive shipments with weight verification.",
    roiMetric: "Eliminate supplier over-invoicing",
    highlights: ["Vendor Price Books", "Purchase Order Approvals", "Goods Receipt Verification", "Vendor Balance Ledger"],
    roles: ["Purchasing Manager", "Store Manager", "Accountant"],
    beforeRestIQ: "Disorganized paper delivery slips, duplicate supplier payments, and no price comparison history.",
    withRestIQ: "Track every supplier shipment, verify delivery weights, and approve POs with 1 click.",
    demoUrl: "/restaurant/bahubali/inventory/purchase-orders",
  },
  {
    id: "shifts",
    name: "Shift Rostering & Scheduling",
    category: "WORKFORCE",
    badge: "Workforce & HR",
    iconBg: "bg-amber-100 text-amber-900 border-amber-300",
    iconColor: "text-amber-800",
    description: "Visual weekly shift schedule builder with employee availability constraints, labor budget caps, and shift swap requests.",
    useCase: "Store managers build weekly rosters, check labor cost % limits, and publish shifts directly to employee mobile portals.",
    roiMetric: "Save 4+ hours/week on scheduling",
    highlights: ["Visual Roster Builder", "Shift Swap Approvals", "Labor Cost Estimator", "Employee Availability Rules"],
    roles: ["General Managers", "Shift Supervisors", "Floor Staff"],
    beforeRestIQ: "WhatsApp group chat chaos for shift trades, no-shows during peak rush, and labor budget overruns.",
    withRestIQ: "Drag-and-drop weekly calendar builder, automatic labor cost warnings, and automated staff shift swap requests.",
    demoUrl: "/restaurant/bahubali/shifts",
  },
  {
    id: "attendance",
    name: "Attendance & Kitchen PIN Kiosk",
    category: "WORKFORCE",
    badge: "Workforce & HR",
    iconBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
    iconColor: "text-emerald-800",
    description: "Shared kitchen tablet PIN kiosk for fast clock-in/out with live attendance radar and automatic overtime calculations.",
    useCase: "Kitchen cooks and servers punch their 4-digit PIN on the shared kitchen tablet to clock in; hours are matched to scheduled shifts.",
    roiMetric: "Eliminate buddy punching & timesheet leaks",
    highlights: ["4-Digit PIN Clocking", "Live Attendance Board", "Overtime Rule Rules", "Time Punch Rectification"],
    roles: ["Kitchen Cooks", "Waitstaff", "HR Officers"],
    beforeRestIQ: "Paper sign-in sheets prone to buddy punching and time theft.",
    withRestIQ: "Dedicated PIN clock kiosk with real-time manager attendance radar and automated overtime tracking.",
    demoUrl: "/restaurant/bahubali/attendance",
  },
  {
    id: "leaves",
    name: "Leave & Time-Off Management",
    category: "WORKFORCE",
    badge: "Workforce & HR",
    iconBg: "bg-orange-100 text-orange-900 border-orange-300",
    iconColor: "text-orange-800",
    description: "Manage paid, sick, and casual leaves with manager approval workflows and automatic shift roster conflict checks.",
    useCase: "Employees submit leave requests from their portal; approved leaves automatically block shift assignment in the roster builder.",
    roiMetric: "Zero understaffed shift gaps",
    highlights: ["Leave Balance Tracking", "Paid & Sick Leave Policies", "Manager Approvals", "Roster Conflict Warning"],
    roles: ["Employees", "Shift Planners", "HR"],
    beforeRestIQ: "Scheduling staff on days they requested off, leading to emergency understaffed dinner shifts.",
    withRestIQ: "Direct sync between leave approvals and roster calendars preventing scheduling conflicts.",
    demoUrl: "/restaurant/bahubali/leaves",
  },
  {
    id: "payroll",
    name: "Tip Pool Engine & Payroll Runs",
    category: "WORKFORCE",
    badge: "Workforce & HR",
    iconBg: "bg-amber-100 text-amber-900 border-amber-300",
    iconColor: "text-amber-800",
    description: "Automated monthly payroll computation with multi-tier tip pool splitting (FOH Waitstaff 60% / BOH Kitchen 40%) and PDF payslips.",
    useCase: "Run monthly payroll in 1 click; shift hours, hourly rates, tip allocations, and deductions calculate automatically.",
    roiMetric: "100% accurate tip & payroll calculations",
    highlights: ["Tip Pool Rules Engine", "Attendance Sync", "1-Click Monthly Run", "PDF Payslip Generator"],
    roles: ["Accountants", "Franchise Owners", "Store Managers"],
    beforeRestIQ: "Spending entire weekends allocating cash/credit card tips and preparing manual payroll envelopes.",
    withRestIQ: "Transparent tip pool rules engine, automated sync with attendance hours, and 1-click PDF payslips.",
    demoUrl: "/restaurant/bahubali/payroll",
  },
  {
    id: "finance",
    name: "Financial P&L & Bill Due Reminders",
    category: "FINANCE",
    badge: "Finance & Control",
    iconBg: "bg-stone-100 text-stone-900 border-stone-300",
    iconColor: "text-stone-800",
    description: "Real-time Profit & Loss statement aggregating revenue, live recipe food costs, payroll wages, and 15 accounting categories.",
    useCase: "Owners view daily net profit margins and receive automated notifications for upcoming vendor invoice due dates.",
    roiMetric: "Avoid late payment vendor penalties",
    highlights: ["Live Daily P&L", "COGS vs Labor Ratio", "15 Accounting Categories", "Upcoming Bill Reminders"],
    roles: ["Restaurant Owners", "CFOs", "Accountants"],
    beforeRestIQ: "Discovering whether the restaurant made a profit or loss 30 days after the month ends.",
    withRestIQ: "Daily real-time P&L visibility showing gross sales, live recipe food costs, labor ratios, and net margins.",
    demoUrl: "/restaurant/bahubali/finance",
  },
  {
    id: "vault",
    name: "Secrets Vault & 2FA Security",
    category: "FINANCE",
    badge: "Security & Legal",
    iconBg: "bg-amber-100 text-amber-900 border-amber-300",
    iconColor: "text-amber-800",
    description: "AES-256 client-side encrypted safe for liquor licenses, food safety certificates, bank credentials, and Wi-Fi passkeys.",
    useCase: "Store sensitive restaurant documents with role-based access control so only authorized managers can view key credentials.",
    roiMetric: "Bank-grade enterprise security compliance",
    highlights: ["Client-Side AES-256", "Document Expiry Alerts", "Granular Credential Share", "Audit Log Trail"],
    roles: ["Franchise Owners", "General Managers", "Compliance Officers"],
    beforeRestIQ: "Passwords written on sticky notes behind the counter and missed liquor license renewal deadlines.",
    withRestIQ: "Client-side encrypted digital safe with document expiry countdown alerts and granular credential sharing.",
    demoUrl: "/restaurant/bahubali/vault",
  },
  {
    id: "operations",
    name: "Operations & SOP Checklists",
    category: "KITCHEN",
    badge: "Kitchen & Storage",
    iconBg: "bg-orange-100 text-orange-900 border-orange-300",
    iconColor: "text-orange-800",
    description: "Digital opening, closing, kitchen hygiene, and fridge temperature audit checklists with manager sign-offs.",
    useCase: "Shift leaders complete morning opening checklists on mobile; uncompleted tasks trigger alerts to general managers.",
    roiMetric: "Ensure 100% health inspection compliance",
    highlights: ["Opening/Closing SOPs", "Fridge Temperature Logs", "Manager Sign-Off", "Real-Time Compliance Audit"],
    roles: ["Executive Chef", "Shift Supervisors", "Hygiene Inspectors"],
    beforeRestIQ: "Clipboards with unchecked paper sheets and zero accountability for fridge temperature logs.",
    withRestIQ: "Mobile opening/closing checklists with digital timestamp sign-offs and automatic escalation for skipped tasks.",
    demoUrl: "/restaurant/bahubali/operations",
  },
  {
    id: "analytics",
    name: "Menu Engineering Matrix",
    category: "FINANCE",
    badge: "Finance & Control",
    iconBg: "bg-amber-100 text-amber-900 border-amber-300",
    iconColor: "text-amber-800",
    description: "BCG matrix classifying menu dishes into Stars, Plowhorses, Puzzles, and Dogs based on profitability and sales volume.",
    useCase: "Identify high-margin 'Stars' (Dum Biryani) to feature prominently on menus and re-engineer low-margin 'Dogs'.",
    roiMetric: "Increase gross profit by 8-14%",
    highlights: ["Stars & Puzzles Matrix", "Food Cost Variance", "Dish Profitability Map", "Sales Velocity Reports"],
    roles: ["Menu Planners", "Executive Chefs", "Franchise Owners"],
    beforeRestIQ: "Keeping unpopular, money-losing items on the menu because no one has time to cross-reference sales with recipe costs.",
    withRestIQ: "Visual Boston Consulting Group matrix instantly highlighting high-profit Stars and low-margin Dogs for easy menu optimization.",
    demoUrl: "/restaurant/bahubali/analytics",
  },
  {
    id: "masterdata",
    name: "Master Data & Outlet Profiles",
    category: "FINANCE",
    badge: "Finance & Control",
    iconBg: "bg-stone-100 text-stone-900 border-stone-300",
    iconColor: "text-stone-800",
    description: "Centralized configuration for tax rates, currency, outlet profiles, receipt headers, and RBAC role permissions.",
    useCase: "Multi-unit franchise owners push global tax or menu updates across multiple restaurant outlets simultaneously.",
    roiMetric: "Centralized multi-unit control",
    highlights: ["Multi-Outlet Profiles", "Global Tax Rates", "Receipt Header Customizer", "Granular RBAC Engine"],
    roles: ["Franchise Directors", "System Administrators"],
    beforeRestIQ: "Logging into 10 different POS terminals individually just to update sales tax or change receipt branding.",
    withRestIQ: "Single unified master data console to configure tax rules, currencies, receipt templates, and outlet profiles in seconds.",
    demoUrl: "/restaurant/bahubali/settings",
  },
];

const FAQS = [
  {
    q: "What POS hardware tablets and receipt printers does RestIQ support?",
    a: "RestIQ is 100% web-native and hardware-agnostic. It runs on iPads, Android tablets, touchscreen POS terminals, Windows PCs, and MacBooks. For printing, it supports standard ESC/POS thermal receipt and kitchen ticket printers via network LAN, Wi-Fi, or USB.",
  },
  {
    q: "What happens if our restaurant internet connection drops during dinner rush?",
    a: "RestIQ includes an intelligent offline ticket queue. Waitstaff can continue taking orders and punching bills on the floor. When internet connectivity is restored, the system automatically synchronizes tickets, burns recipe inventory, and posts ledger entries seamlessly.",
  },
  {
    q: "How does the automatic recipe stock depletion handle trimming waste?",
    a: "RestIQ supports gross vs net recipe yields. For example, if a dish requires 200g of trimmed tender meat, you can define a 15% preparation trimming yield so that the inventory depletion engine automatically deducts 235g of raw meat from your bulk cold-storage stock.",
  },
  {
    q: "Can we manage multiple restaurant outlets from a single master dashboard?",
    a: "Yes. RestIQ Master Data enables multi-outlet franchise architectures. You can define global core recipes and pricing centrally while allowing individual branch managers localized adjustments for regional tax rates, supplier costs, and station layouts.",
  },
  {
    q: "How does the Tip Pool engine split tips between Waitstaff and Kitchen line cooks?",
    a: "You can configure custom tip pool rules (e.g. 60% Front-of-House waitstaff and 40% Back-of-House kitchen cooks). RestIQ attributes tips based on actual hours clocked in via the PIN kiosk, ensuring 100% transparent and dispute-free payroll runs.",
  },
];

export default function RestIQLandingPage() {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [selectedModalModule, setSelectedModalModule] = useState<DetailedModule | null>(null);

  // ROI Calculator state
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(65000);
  const [foodCostPercent, setFoodCostPercent] = useState<number>(32);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Live Catering Interactive Pax Slider on Landing Page
  const [demoPax, setDemoPax] = useState<number>(150);

  // Calculations for ROI Calculator
  const estimatedSavings = Math.round((monthlyRevenue * 12 * (foodCostPercent * 0.08)) / 100);
  const estimatedTimeSavedHours = Math.round(16 * 52);

  const filteredModules = MODULES_DATA.filter((m) => {
    if (activeCategory === "ALL") return true;
    return m.category === activeCategory;
  });

  return (
    <div className="min-h-screen bg-[#FCF9F5] text-[#1a120b] selection:bg-amber-600 selection:text-white font-sans relative overflow-x-hidden">
      {/* 3D WebGL Scroll Canvas Scene (Warm Restaurant Palette) */}
      <ThreeScrollScene />

      {/* Header Bar */}
      <header className="border-b border-[#E8DFC8] bg-[#FCF9F5]/90 backdrop-blur-xl sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 sm:h-18 flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center space-x-3 shrink-0 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-700 via-orange-600 to-amber-500 flex items-center justify-center text-white font-bold shadow-sm group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-[#1a120b] leading-tight">
                  RestIQ
                </span>
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Bahubali OS</span>
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-stone-500 block font-semibold">
                Unified Restaurant Suite
              </span>
            </div>
          </Link>

          {/* Navigation Links - Single line, responsive spacing */}
          <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6 text-[11px] xl:text-xs font-bold text-stone-700 shrink-0">
            <a href="#modules" className="whitespace-nowrap hover:text-amber-700 transition-colors">
              13 Modules
            </a>
            <a href="#pipeline" className="whitespace-nowrap hover:text-amber-700 transition-colors">
              Pipeline
            </a>
            <a href="#depletion-engine" className="whitespace-nowrap hover:text-amber-700 transition-colors">
              Recipe BOM
            </a>
            <a href="#catering-studio" className="whitespace-nowrap hover:text-amber-700 transition-colors">
              Catering
            </a>
            <a href="#roi-calculator" className="whitespace-nowrap hover:text-amber-700 transition-colors">
              ROI Savings
            </a>
            <a href="#security" className="whitespace-nowrap hover:text-amber-700 transition-colors">
              Security
            </a>
            <a href="#faq" className="whitespace-nowrap hover:text-amber-700 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
            <a
              href="https://admin.restiq.magnidigitech.com"
              className="hidden sm:inline-flex items-center px-3.5 py-2 text-xs font-bold text-stone-700 hover:text-[#1a120b] transition-colors border border-[#E8DFC8] rounded-full hover:bg-stone-50 bg-white shadow-2xs whitespace-nowrap"
            >
              Super Admin
            </a>
            <Link
              href="/restaurant/bahubali/login"
              className="px-4.5 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs rounded-full shadow-sm hover:shadow-md transition-all flex items-center space-x-1.5 whitespace-nowrap"
            >
              <span>Bahubali Login</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION WITH WARM CULINARY GLOW */}
      <section className="relative z-10 pt-16 pb-24 max-w-7xl mx-auto px-6 text-center lg:text-left grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-100/90 border border-amber-200 text-amber-950 text-xs font-bold shadow-2xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
            <span>Bahubali Restaurant Enterprise Operating System</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-[#1a120b] leading-[1.04]">
            Every recipe accounted for. <br />
            <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-800 bg-clip-text text-transparent">
              Every table reconciled.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-stone-600 max-w-2xl font-normal leading-relaxed">
            Eliminate ingredient shrinkage, automate raw inventory burns upon every POS ticket, scale catering banquets, and automate tip pool distributions across your restaurant locations.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
            <a
              href="#pipeline"
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-sm rounded-full shadow-lg hover:shadow-xl transition-all text-center flex items-center justify-center space-x-2 group"
            >
              <span>Explore Order Pipeline</span>
              <svg className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>

            <Link
              href="/restaurant/bahubali/catering"
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-stone-50 text-stone-800 font-bold text-sm rounded-full transition-all text-center flex items-center justify-center space-x-2 border border-[#E8DFC8] shadow-2xs backdrop-blur-md"
            >
              <span>Smart Catering Studio</span>
              <span className="text-amber-600">&rarr;</span>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-8 border-t border-[#E8DFC8] grid grid-cols-3 gap-6 text-left">
            <div>
              <span className="text-3xl sm:text-4xl font-black text-[#1a120b] block font-mono">13</span>
              <span className="text-xs text-stone-500 font-medium">Integrated Modules</span>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-black text-amber-700 block font-mono">&gt;65%</span>
              <span className="text-xs text-stone-500 font-medium">Catering Margin Target</span>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-black text-emerald-700 block font-mono">100%</span>
              <span className="text-xs text-stone-500 font-medium">Real-Time Recipe Depletion</span>
            </div>
          </div>
        </div>

        {/* 3D PERSPECTIVE CULINARY WINDOW */}
        <div className="lg:col-span-5 relative">
          <Card3D maxTilt={9} scale={1.03}>
            <div className="relative p-6 sm:p-7 bg-white rounded-3xl border border-[#E8DFC8] shadow-[0_24px_60px_rgba(38,28,20,0.09)] space-y-6 text-left">
              {/* macOS Window Header */}
              <div className="flex justify-between items-center border-b border-stone-100 pb-3.5">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-orange-600" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-600" />
                  <span className="text-xs font-semibold text-stone-600 pl-2">
                    Bahubali Restaurant OS &bull; Live Telemetry
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                  SYSTEM ACTIVE
                </span>
              </div>

              {/* Grand Royal Feast Package Preview */}
              <div className="p-4 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-[#1a120b] block">
                      Grand Royal Feast Headcount
                    </span>
                    <span className="text-[10px] text-stone-500">
                      $42.00 / Pax Package Price
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-amber-600 text-white font-mono text-xs font-bold rounded-lg shadow-2xs">
                    {demoPax} Guests
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={500}
                  step={10}
                  value={demoPax}
                  onChange={(e) => setDemoPax(Number(e.target.value))}
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-[#EFE7DC]">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">
                      Aged Basmati Rice Required
                    </span>
                    <span className="font-bold text-[#1a120b] font-mono">
                      {(demoPax * 0.25).toFixed(1)} KG
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">
                      Event Proposal Value
                    </span>
                    <span className="font-bold text-emerald-700 font-mono">
                      ${(demoPax * 42).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Status Badges */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center p-3 rounded-xl bg-[#FCF9F5] border border-[#EFE7DC] shadow-2xs">
                  <span className="text-stone-800 font-sans font-medium">Automatic POS Recipe Depletion</span>
                  <span className="text-amber-700 font-bold">ACTIVE (0ms lag)</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-[#FCF9F5] border border-[#EFE7DC] shadow-2xs">
                  <span className="text-stone-800 font-sans font-medium">Secrets Vault & 2FA</span>
                  <span className="text-emerald-700 font-bold">AES-256 ENCRYPTED</span>
                </div>
              </div>

              <Link
                href="/restaurant/bahubali/catering"
                className="block w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs rounded-xl text-center shadow-xs transition-colors"
              >
                Launch Catering Studio Demo &rarr;
              </Link>
            </div>
          </Card3D>
        </div>
      </section>

      {/* INTERACTIVE 5-STEP ORDER PIPELINE */}
      <div id="pipeline">
        <OrderJourneySimulator />
      </div>

      {/* LIVE RECIPE STOCK DEPLETION DEMO */}
      <div id="depletion-engine">
        <LiveDishDepletionDemo />
      </div>

      {/* FLAGSHIP INNOVATION: SMART CATERING & PACKAGE STUDIO */}
      <section id="catering-studio" className="relative z-10 py-24 bg-[#FAF6F0] border-y border-[#E8DFC8]">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider">
              Native Flagship Module
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#1a120b] tracking-tight">
              Smart Catering & Package Studio
            </h2>
            <p className="text-stone-600 text-base leading-relaxed">
              Never lose money on banquet proposals again. Scale headcounts from 20 to 500 guests with real-time gross margin tracking, instant recipe cost calculation, and 1-click printable client proposals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card3D maxTilt={6} scale={1.02}>
              <div className="p-8 bg-white rounded-3xl border border-[#E8DFC8] space-y-4 h-full shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#1a120b]">Grand Royal Feast Packages</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Browse dishes sorted by course: Mint Lassi Coolers, Chicken 65, Dum Biryani, Butter Naan, and Gulab Jamun. Load pre-costed packages with 1 click.
                </p>
              </div>
            </Card3D>

            <Card3D maxTilt={6} scale={1.02}>
              <div className="p-8 bg-white rounded-3xl border border-[#E8DFC8] space-y-4 h-full shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#1a120b]">Real-Time Profit Margin Meter</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Visual progress bar computing food cost per pax vs selling price per pax. Color-coded thresholds ensure event margins stay reliably above 65%.
                </p>
              </div>
            </Card3D>

            <Card3D maxTilt={6} scale={1.02}>
              <div className="p-8 bg-white rounded-3xl border border-[#E8DFC8] space-y-4 h-full shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-800 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#1a120b]">1-Click Vendor POs & Client Invoices</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Explode catering guest demands into raw material purchase orders for chicken, basmati rice, and ghee suppliers, and generate printable PDF proposals with advance deposits.
                </p>
              </div>
            </Card3D>
          </div>
        </div>
      </section>

      {/* ALL 13 NATIVE MODULES BENTO GRID */}
      <section id="modules" className="relative z-10 py-24 max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider">
            Enterprise Modular Architecture
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#1a120b] tracking-tight">
            Explore All 13 Native Bahubali Modules
          </h2>
          <p className="text-stone-600 text-base leading-relaxed">
            Every front-of-house, kitchen, workforce, and financial module built into a unified cloud workspace. Click any module to view deep-dive details and launch its workspace page.
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { id: "ALL", label: "All 13 Modules" },
            { id: "FOH", label: "Front of House & Catering" },
            { id: "KITCHEN", label: "Kitchen & Storage" },
            { id: "WORKFORCE", label: "Workforce & HR" },
            { id: "FINANCE", label: "Finance & Control" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                activeCategory === cat.id
                  ? "bg-[#1a120b] text-amber-300 shadow-md scale-105"
                  : "bg-white text-stone-700 hover:bg-stone-50 border border-[#E8DFC8] shadow-2xs"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Modules Clean & Spacious Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => (
            <Card3D key={mod.id} maxTilt={6} scale={1.02}>
              <div
                onClick={() => setSelectedModalModule(mod)}
                className="group p-6 sm:p-7 rounded-3xl bg-white border border-[#E8DFC8] hover:border-amber-500 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between h-full"
              >
                <div className="space-y-4">
                  {/* Top Row: Vector SVG Icon Tile + Category Badge */}
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-800 shadow-2xs group-hover:scale-110 transition-transform">
                      <ModuleSvgIcon id={mod.id} className="w-6 h-6 text-amber-800" />
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                      {mod.badge}
                    </span>
                  </div>

                  {/* Title & Concise Description */}
                  <div>
                    <h3 className="font-black text-[#1a120b] text-lg group-hover:text-amber-700 transition-colors tracking-tight">
                      {mod.name}
                    </h3>
                    <p className="text-xs text-stone-600 mt-2 leading-relaxed line-clamp-2">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Clean Bottom Footer: ROI Metric + Inspect Action (Never overlaps) */}
                <div className="pt-4 mt-auto border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                    {mod.roiMetric}
                  </span>
                  <span className="text-amber-700 font-bold text-xs flex items-center space-x-1 shrink-0 ml-auto group-hover:translate-x-1 transition-transform">
                    <span>Inspect</span>
                    <span>&rarr;</span>
                  </span>
                </div>
              </div>
            </Card3D>
          ))}
        </div>
      </section>

      {/* ROI & COST SAVINGS CALCULATOR */}
      <section id="roi-calculator" className="relative z-10 py-24 bg-[#FAF6F0] border-y border-[#E8DFC8]">
        <div className="max-w-5xl mx-auto px-6 space-y-10">
          <div className="text-center space-y-3">
            <span className="px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider">
              Financial Impact
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#1a120b] tracking-tight">
              Calculate Your Annual Cost Savings
            </h2>
            <p className="text-stone-600 text-sm max-w-2xl mx-auto">
              See the measurable bottom-line impact of replacing manual kitchen guesswork with automatic recipe stock burns and tip pool accuracy.
            </p>
          </div>

          <Card3D maxTilt={5} scale={1.01}>
            <div className="p-8 sm:p-10 bg-white rounded-3xl border border-[#E8DFC8] shadow-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-7 space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-[#1a120b]">Monthly Restaurant Sales Revenue</label>
                    <span className="font-mono text-amber-700 font-black text-base">${monthlyRevenue.toLocaleString()} / mo</span>
                  </div>
                  <input
                    type="range"
                    min={10000}
                    max={250000}
                    step={5000}
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                    className="w-full h-2.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                    <span>$10,000</span>
                    <span>$125,000</span>
                    <span>$250,000+</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-[#1a120b]">Current Food Cost Percentage</label>
                    <span className="font-mono text-orange-700 font-black text-base">{foodCostPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={50}
                    step={1}
                    value={foodCostPercent}
                    onChange={(e) => setFoodCostPercent(Number(e.target.value))}
                    className="w-full h-2.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                    <span>20% (Optimal)</span>
                    <span>32% (Average)</span>
                    <span>50% (High Leakage)</span>
                  </div>
                </div>

                <div className="p-4 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] text-xs text-stone-600 space-y-1.5 shadow-2xs">
                  <span className="font-bold text-[#1a120b] block">Identified Profit Drivers:</span>
                  <p>• <strong>8% reduction</strong> in raw food leakage through automatic POS recipe depletion.</p>
                  <p>• <strong>16 hours saved per week</strong> on roster scheduling, tip pool math, and payroll runs.</p>
                  <p>• <strong>Zero lost revenue</strong> from banquet over-procurement and unbilled guest counts.</p>
                </div>
              </div>

              <div className="md:col-span-5 p-8 bg-gradient-to-br from-amber-700 via-orange-600 to-amber-800 rounded-3xl text-white text-center space-y-5 shadow-xl">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-200 block">
                  Projected Annual Cost Savings
                </span>
                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                  ${estimatedSavings.toLocaleString()}
                </div>
                <div className="pt-3 border-t border-amber-500/80 space-y-1">
                  <span className="text-xs text-amber-200 block">Management Hours Reclaimed</span>
                  <span className="text-xl font-bold font-mono">{estimatedTimeSavedHours} Hours / Year</span>
                </div>
                <Link
                  href="/restaurant/bahubali/login"
                  className="block w-full py-3 bg-white hover:bg-stone-50 text-amber-900 font-black text-xs rounded-xl transition-all shadow-xs"
                >
                  Start Saving in Bahubali Demo
                </Link>
              </div>
            </div>
          </Card3D>
        </div>
      </section>

      {/* SECRETS VAULT & MULTI-TENANT ARCHITECTURE */}
      <section id="security" className="relative z-10 py-24 max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider">
            Bank-Grade Security
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#1a120b] tracking-tight">
            Enterprise Multi-Tenant Security
          </h2>
          <p className="text-stone-600 text-base leading-relaxed">
            Multi-tenant architecture engineered to guarantee strict schema isolation, client-side zero-knowledge encryption, and tamper-proof operational audit trails.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Tenant Schema Isolation",
              desc: "Strict PostgreSQL multi-tenant partition logic ensures each restaurant's sales, recipes, and payroll records remain completely isolated.",
              svg: (
                <svg className="w-6 h-6 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
            },
            {
              title: "AES-256 Vault Encryption",
              desc: "Liquor licenses, food safety certificates, and manager credentials in the Vault are encrypted on client before transmission.",
              svg: (
                <svg className="w-6 h-6 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ),
            },
            {
              title: "Granular Security RBAC",
              desc: "Configure exact permissions: Cashiers cannot void bills without supervisor approval; financial P&Ls remain locked to owners.",
              svg: (
                <svg className="w-6 h-6 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ),
            },
            {
              title: "Permanent Audit Trail",
              desc: "Every bill void, discount, payroll disbursement, and recipe yield adjustment is logged with timestamp, user ID, and IP.",
              svg: (
                <svg className="w-6 h-6 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
            },
          ].map((item, idx) => (
            <Card3D key={idx} maxTilt={8} scale={1.02}>
              <div className="p-7 bg-white rounded-3xl border border-[#E8DFC8] space-y-4 shadow-2xs h-full">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shadow-2xs">
                  {item.svg}
                </div>
                <div>
                  <h4 className="font-bold text-[#1a120b] text-base">{item.title}</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </Card3D>
          ))}
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS ACCORDION */}
      <section id="faq" className="relative z-10 py-20 bg-white border-y border-[#E8DFC8]">
        <div className="max-w-4xl mx-auto px-6 space-y-10">
          <div className="text-center space-y-3">
            <span className="px-3.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold uppercase tracking-wider">
              Answers & Clarifications
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#1a120b] tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-stone-600 text-sm">
              Common questions answered about RestIQ&apos;s deployment, compatibility, and day-to-day operations.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#E8DFC8] bg-[#FCF9F5] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex justify-between items-center gap-4 font-bold text-[#1a120b] text-sm sm:text-base hover:bg-[#FAF4EC] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="text-lg font-mono text-amber-700">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-[#EFE7DC]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION BANNER (Dark Roasted Espresso) */}
      <section className="relative z-10 py-20 bg-[#1a120b] text-white">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#261c14] text-amber-300 text-xs font-bold border border-[#3e2723]">
            <span>Operational Excellence for Multi-Outlet Restaurants</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-amber-50">
            Ready to Upgrade Your Restaurant Operations?
          </h2>

          <p className="text-stone-400 text-base max-w-xl mx-auto leading-relaxed">
            Experience the difference of a unified system. Log into the Bahubali demo tenant space to test POS billing, Smart Catering, KDS kitchen screens, and employee tip pooling right now.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
            <Link
              href="/restaurant/bahubali/login"
              className="w-full sm:w-auto px-9 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-sm rounded-full shadow-xl transition-all"
            >
              Enter Bahubali Workspace &rarr;
            </Link>
            <Link
              href="/restaurant/bahubali/catering"
              className="w-full sm:w-auto px-8 py-4 bg-[#261c14] hover:bg-[#342419] text-amber-200 font-bold text-sm rounded-full border border-[#3e2723] transition-all"
            >
              Launch Smart Catering Studio
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-[#E8DFC8] py-12 bg-[#FCF9F5]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-stone-500 gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              R
            </div>
            <div>
              <span className="font-black text-[#1a120b] text-sm block">RestIQ SaaS Platform</span>
              <span>&copy; {new Date().getFullYear()} Bahubali Restaurant Cloud Operating System.</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-bold text-stone-700">
            <a href="#pipeline" className="hover:text-amber-700 transition-colors">
              Order Pipeline
            </a>
            <a href="#depletion-engine" className="hover:text-amber-700 transition-colors">
              Recipe Depletion
            </a>
            <a href="#catering-studio" className="hover:text-amber-700 transition-colors">
              Catering Studio
            </a>
            <a href="#modules" className="hover:text-amber-700 transition-colors">
              All 13 Modules
            </a>
            <Link href="/restaurant/bahubali/login" className="hover:text-amber-700 transition-colors">
              Bahubali Login
            </Link>
            <a href="https://admin.restiq.magnidigitech.com" className="hover:text-amber-700 transition-colors">
              Super Admin
            </a>
          </div>
        </div>
      </footer>

      {/* Module Detail Modal Dialog */}
      <ModuleDetailModal
        module={selectedModalModule}
        onClose={() => setSelectedModalModule(null)}
      />
    </div>
  );
}
