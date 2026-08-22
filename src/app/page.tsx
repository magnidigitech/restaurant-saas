"use client";

import React, { useState } from "react";
import Link from "next/link";
import WebGLCanvas from "@/components/WebGLCanvas";

interface ModuleInfo {
  id: string;
  name: string;
  category: "FOH" | "KITCHEN" | "WORKFORCE" | "FINANCE";
  badge: string;
  iconBg: string;
  iconColor: string;
  description: string;
  useCase: string;
  roiMetric: string;
  highlights: string[];
}

const MODULES_LIST: ModuleInfo[] = [
  {
    id: "pos",
    name: "Multi-Outlet POS & Billing",
    category: "FOH",
    badge: "Front of House",
    iconBg: "bg-blue-50 text-blue-600 border-blue-100",
    iconColor: "text-blue-600",
    description: "High-speed point of sale interface engineered for dine-in, takeaway, and multi-outlet table layouts.",
    useCase: "Waitstaff take orders on tablets; bills automatically split taxes and instantly route tickets to kitchen displays.",
    roiMetric: "Cut order dispatch time by 45%",
    highlights: ["Table Layout Map", "Split Billing & Discounts", "Offline Ticket Queue", "KDS Dispatch"],
  },
  {
    id: "catering",
    name: "Smart Catering & Package Studio",
    category: "FOH",
    badge: "Event & Banquet",
    iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100",
    iconColor: "text-indigo-600",
    description: "Visual dish cards catalog, live Pax headcount scaling slider, and real-time food cost margin calculation.",
    useCase: "Caterers drag a live Pax slider from 50 to 500 guests to dynamically compute ingredient costs, gross margin %, and 1-click client proposals.",
    roiMetric: "Prevent 22% raw material over-procurement",
    highlights: ["Live Pax Headcount Slider", "Profit Margin Meter (>65%)", "1-Click Package Loader", "Printable Proposal Invoice"],
  },
  {
    id: "inventory",
    name: "Recipe Master & Automatic Stock Depletion",
    category: "KITCHEN",
    badge: "Kitchen & Inventory",
    iconBg: "bg-amber-50 text-amber-600 border-amber-100",
    iconColor: "text-amber-600",
    description: "Deep bill-of-materials recipe costing that automatically deducts raw inventory ingredients upon every POS sale.",
    useCase: "Selling 100 Biryani plates automatically deducts 25kg Basmati Rice, 15kg Chicken, and 2L Ghee from live stock balances.",
    roiMetric: "Reduce food cost variance to <2%",
    highlights: ["Raw Material Yields", "POS Depletion Engine", "Purchase Order Auto-Gen", "Low Stock Threshold Alerts"],
  },
  {
    id: "kds",
    name: "Kitchen Display System (KDS)",
    category: "KITCHEN",
    badge: "Kitchen & Inventory",
    iconBg: "bg-rose-50 text-rose-600 border-rose-100",
    iconColor: "text-rose-600",
    description: "Real-time kitchen order tickets (KOT) organized by station (Grill, Fryer, Salad, Dessert) with color-coded timers.",
    useCase: "Chefs bump completed items on touchscreens; management tracks average preparation time per dish in real time.",
    roiMetric: "Eliminate paper ticket loss & prep delays",
    highlights: ["Station Filter Views", "Bump Ticket Timers", "Order Prep Analytics", "Multi-Kitchen Routing"],
  },
  {
    id: "shifts",
    name: "Shift Rostering & Roster Scheduling",
    category: "WORKFORCE",
    badge: "Workforce",
    iconBg: "bg-purple-50 text-purple-600 border-purple-100",
    iconColor: "text-purple-600",
    description: "Visual drag-and-drop shift calendar builder with shift swap requests and staff availability tracking.",
    useCase: "Managers build weekly shift rosters, check labor cost % limits, and publish shifts directly to employee portals.",
    roiMetric: "Save 4+ hours/week on scheduling",
    highlights: ["Visual Roster Builder", "Shift Swap Approval", "Labor Cost Estimator", "Employee Availability"],
  },
  {
    id: "attendance",
    name: "Timecard Attendance & PIN Kiosk",
    category: "WORKFORCE",
    badge: "Workforce",
    iconBg: "bg-teal-50 text-teal-600 border-teal-100",
    iconColor: "text-teal-600",
    description: "Tablet-friendly PIN clock-in/clock-out kiosk with live attendance tracking and overtime calculations.",
    useCase: "Employees enter 4-digit PIN on kitchen tablet to clock in; hours are auto-verified against scheduled shift rosters.",
    roiMetric: "Eliminate buddy punching & time errors",
    highlights: ["PIN & Photo Kiosk", "Live Attendance Board", "Overtime Rules", "Leave Request Approval"],
  },
  {
    id: "payroll",
    name: "Tip Pool Distribution & Payroll Engine",
    category: "WORKFORCE",
    badge: "Workforce",
    iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
    iconColor: "text-emerald-600",
    description: "Automated salary structure computation with multi-tier tip pool splitting (FOH 60% / BOH 40%) and PDF payslips.",
    useCase: "Run monthly payroll in 1 click; shift hours, hourly rates, tip allocations, and tax deductions calculate automatically.",
    roiMetric: "100% accurate tip & payroll calculations",
    highlights: ["Tip Pool Rules Engine", "Attendance Sync", "1-Click Payroll Run", "PDF Payslip Generator"],
  },
  {
    id: "finance",
    name: "Financial P&L & Bill Due Reminders",
    category: "FINANCE",
    badge: "Finance & Security",
    iconBg: "bg-sky-50 text-sky-600 border-sky-100",
    iconColor: "text-sky-600",
    description: "Real-time Profit & Loss dashboard breaking down COGS, labor cost, and overhead with vendor bill reminders.",
    useCase: "Owners view daily net profit margins and receive automated notifications for upcoming vendor invoice due dates.",
    roiMetric: "Avoid late payment vendor penalties",
    highlights: ["Live P&L Breakdown", "COGS vs Labor Ratio", "Vendor Bill Reminders", "Automated Accounting Sync"],
  },
  {
    id: "vault",
    name: "Zero-Knowledge Password & Document Vault",
    category: "FINANCE",
    badge: "Finance & Security",
    iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100",
    iconColor: "text-indigo-600",
    description: "AES-256 client-side encrypted vault for storing liquor licenses, food safety certificates, vendor credentials, and Wi-Fi codes.",
    useCase: "Store sensitive restaurant documents with role-based access control so only authorized managers can view key credentials.",
    roiMetric: "Bank-grade enterprise security compliance",
    highlights: ["Client-side Encryption", "Document Expiry Alerts", "Granular Access Share", "Audit Log Trail"],
  },
  {
    id: "operations",
    name: "Operations & SOP Audit Checklists",
    category: "KITCHEN",
    badge: "Kitchen & Inventory",
    iconBg: "bg-orange-50 text-orange-600 border-orange-100",
    iconColor: "text-orange-600",
    description: "Digital opening, closing, and hygiene temperature audit checklists with manager sign-offs.",
    useCase: "Shift leaders complete morning opening checklists on mobile; uncompleted tasks trigger alerts to general managers.",
    roiMetric: "Ensure 100% health inspection compliance",
    highlights: ["Opening/Closing SOPs", "Temperature Logging", "Manager Sign-off", "Real-time Compliance Audit"],
  },
  {
    id: "analytics",
    name: "Menu Engineering & Variance Analytics",
    category: "FINANCE",
    badge: "Finance & Security",
    iconBg: "bg-violet-50 text-violet-600 border-violet-100",
    iconColor: "text-violet-600",
    description: "BCG matrix classifying menu dishes into Stars, Horses, Puzzles, and Dogs based on profitability and sales volume.",
    useCase: "Identify high-margin 'Stars' to feature prominently on digital menus and re-engineer low-margin 'Dogs'.",
    roiMetric: "Increase gross profit by 8-14%",
    highlights: ["Stars & Puzzles Matrix", "Food Cost Variance", "Dish Profitability Map", "Sales Velocity Reports"],
  },
  {
    id: "masterdata",
    name: "Master Data & Multi-Outlet Settings",
    category: "FINANCE",
    badge: "Finance & Security",
    iconBg: "bg-slate-100 text-slate-700 border-slate-200",
    iconColor: "text-slate-700",
    description: "Centralized configuration for tax rates, currency, outlet profiles, receipt headers, and system audit logs.",
    useCase: "Multi-unit franchise owners push global tax or menu updates across 10+ restaurant outlets simultaneously.",
    roiMetric: "Centralized multi-unit control",
    highlights: ["Multi-Outlet Profiles", "Global Tax Rates", "Receipt Header Customizer", "Global Audit Logs"],
  },
  {
    id: "rbac",
    name: "Role-Based Access Controls (RBAC)",
    category: "FINANCE",
    badge: "Finance & Security",
    iconBg: "bg-cyan-50 text-cyan-600 border-cyan-100",
    iconColor: "text-cyan-600",
    description: "Granular security permission engine allowing custom role definitions (Cashier, Chef, Manager, Accountant).",
    useCase: "Restrict cashiers from voiding bills without manager approval and lock financial P&L access to owners only.",
    roiMetric: "Zero unauthorized operational actions",
    highlights: ["Granular Permission Keys", "Custom Role Creator", "Security Audit Trail", "Session Invalidation"],
  },
];

export default function RestIQLandingPage() {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("catering");

  // ROI Calculator state
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(60000);
  const [foodCostPercent, setFoodCostPercent] = useState<number>(32);

  // Live Catering Interactive Pax Slider on Landing Page
  const [demoPax, setDemoPax] = useState<number>(150);

  // Calculations for ROI Calculator
  const estimatedSavings = Math.round((monthlyRevenue * 12 * (foodCostPercent * 0.08)) / 100);
  const estimatedTimeSavedHours = Math.round(16 * 52);

  const filteredModules = MODULES_LIST.filter((m) => {
    if (activeCategory === "ALL") return true;
    return m.category === activeCategory;
  });

  const selectedModule = MODULES_LIST.find((m) => m.id === selectedModuleId) || MODULES_LIST[1];

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-slate-900 selection:bg-blue-500 selection:text-white font-sans relative overflow-x-hidden">
      {/* Apple-style Soft Ambient Light WebGL Mesh Background */}
      <WebGLCanvas />

      {/* Header Bar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                RestIQ
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block -mt-1 font-semibold">
                Restaurant OS
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold text-slate-600">
            <a href="#modules" className="hover:text-slate-900 transition-colors">
              All 13 Modules
            </a>
            <a href="#catering-studio" className="hover:text-blue-600 transition-colors">
              Smart Catering Studio
            </a>
            <a href="#roi-calculator" className="hover:text-slate-900 transition-colors">
              ROI Calculator
            </a>
            <a href="#security" className="hover:text-slate-900 transition-colors">
              Security Vault
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <a
              href="https://admin.restiq.magnidigitech.com"
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors border border-slate-200/80 rounded-full hover:bg-slate-100 bg-white shadow-2xs"
            >
              Super Admin Portal
            </a>
            <Link
              href="/restaurant/bahubali/login"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-full shadow-xs transition-all flex items-center space-x-1.5"
            >
              <span>Tenant Login</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION - APPLE STYLE LIGHT UI */}
      <section className="relative z-10 pt-16 pb-20 max-w-7xl mx-auto px-6 text-center lg:text-left grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-semibold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>RestIQ Enterprise Operating System</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
            RestIQ. <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Powerful restaurant intelligence.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl font-normal leading-relaxed">
            The unified cloud platform designed for modern multi-outlet restaurants, smart catering banquets, automatic recipe stock depletion, and workforce payroll.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
            <Link
              href="/restaurant/bahubali/catering"
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-full shadow-md hover:shadow-lg transition-all text-center flex items-center justify-center space-x-2 group"
            >
              <span>Explore Smart Catering Studio</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              href="/restaurant/bahubali/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-full transition-all text-center flex items-center justify-center space-x-2 border border-slate-200/80"
            >
              <span>Demo Tenant Space</span>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-8 border-t border-slate-200/80 grid grid-cols-3 gap-6 text-left">
            <div>
              <span className="text-3xl font-extrabold text-slate-900 block font-mono">13</span>
              <span className="text-xs text-slate-500 font-medium">Integrated Modules</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-blue-600 block font-mono">&gt;65%</span>
              <span className="text-xs text-slate-500 font-medium">Target Catering Margin</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-slate-900 block font-mono">100%</span>
              <span className="text-xs text-slate-500 font-medium">Real-time Stock Depletion</span>
            </div>
          </div>
        </div>

        {/* APPLE MACOS MOCKUP WINDOW FRAME */}
        <div className="lg:col-span-5 relative">
          <div className="relative p-6 bg-white/90 backdrop-blur-2xl rounded-3xl border border-slate-200/90 shadow-[0_16px_48px_rgba(0,0,0,0.06)] space-y-6 text-left">
            
            {/* macOS Window Title Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-semibold text-slate-500 pl-2">RestIQ Engine &bull; bahubali</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/80">
                System Active
              </span>
            </div>

            {/* Live Interactive Catering Pax Scaler */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800">Live Catering Pax Headcount</span>
                <span className="px-3 py-1 bg-blue-600 text-white font-mono text-xs font-bold rounded-lg shadow-2xs">
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
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Scaled Basmati Rice</span>
                  <span className="font-bold text-slate-900 font-mono">{(demoPax * 0.25).toFixed(1)} KG</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Est. Event Revenue</span>
                  <span className="font-bold text-emerald-600 font-mono">${(demoPax * 32).toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Operational Status Badges */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-slate-700 font-medium">Automatic POS Stock Depletion</span>
                <span className="text-blue-600 font-bold font-mono">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-slate-700 font-medium">AES-256 Vault Security</span>
                <span className="text-emerald-600 font-bold font-mono">ENCRYPTED</span>
              </div>
            </div>

            <Link
              href="/restaurant/bahubali/catering"
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl text-center shadow-xs transition-colors"
            >
              Open Interactive Catering Studio &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURE SPOTLIGHT: SMART CATERING & PACKAGE STUDIO */}
      <section id="catering-studio" className="relative z-10 py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="px-3.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold uppercase tracking-wider">
              Flagship Innovation
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              Smart Catering & Package Studio
            </h2>
            <p className="text-slate-600 text-base">
              Say goodbye to tedious manual spreadsheet calculations. Scale headcount, compute recipe food costs, monitor gross profit margins, and load pre-set package templates in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-[#fbfbfd] rounded-3xl border border-slate-200/80 space-y-4 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Course Dish Catalog Cards</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Filter dishes by course (Starters, Main Course, Breads/Rice, Desserts, Beverages). Add any dish to your catering menu with 1 click.
              </p>
            </div>

            <div className="p-8 bg-[#fbfbfd] rounded-3xl border border-slate-200/80 space-y-4 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Real-time Profitability Meter</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Visual progress bar calculating food cost per pax vs selling price per pax. Color-coded alerts ensure your profit margin stays above 65%.
              </p>
            </div>

            <div className="p-8 bg-[#fbfbfd] rounded-3xl border border-slate-200/80 space-y-4 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">1-Click Purchase Order & Invoices</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generate printable client proposals with advance deposit tracking, and explode recipe demands into kitchen raw material purchase orders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ALL 13 MODULES INTERACTIVE EXPLORER */}
      <section id="modules" className="relative z-10 py-24 max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-slate-200/80 text-slate-700 text-xs font-bold uppercase tracking-wider">
            Comprehensive Suite
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Explore All 13 Enterprise Modules
          </h2>
          <p className="text-slate-600 text-base">
            Every operational, kitchen, financial, and workforce workflow standard built directly into a unified cloud environment.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { id: "ALL", label: "All 13 Modules" },
            { id: "FOH", label: "Front of House & Catering" },
            { id: "KITCHEN", label: "Kitchen & Inventory" },
            { id: "WORKFORCE", label: "Workforce & Payroll" },
            { id: "FINANCE", label: "Finance & Security" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? "bg-slate-900 text-white shadow-md scale-105"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80 shadow-2xs"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Modules Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              onClick={() => setSelectedModuleId(mod.id)}
              className={`p-7 rounded-3xl border transition-all duration-300 cursor-pointer space-y-4 ${
                selectedModuleId === mod.id
                  ? "bg-white border-blue-500 shadow-xl ring-2 ring-blue-500/20"
                  : "bg-white/90 border-slate-200/80 hover:border-slate-300 hover:shadow-lg shadow-[0_4px_24px_rgba(0,0,0,0.03)]"
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${mod.iconBg}`}>
                  {mod.badge}
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                  {mod.roiMetric}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-lg">{mod.name}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{mod.description}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-[11px] space-y-1">
                <span className="font-bold text-slate-800 block">Operational Use Case:</span>
                <p className="text-slate-600 italic">&quot;{mod.useCase}&quot;</p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {mod.highlights.map((h, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200/60">
                    • {h}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ROI & COST SAVINGS CALCULATOR */}
      <section id="roi-calculator" className="relative z-10 py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-5xl mx-auto px-6 space-y-8">
          <div className="text-center space-y-3">
            <span className="px-3.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold uppercase tracking-wider">
              Financial Impact
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              Calculate Your Restaurant&apos;s Annual ROI
            </h2>
            <p className="text-slate-600 text-sm">
              See how much your restaurant saves annually through automated recipe stock depletion, catering headcount scaling, and tip pool accuracy.
            </p>
          </div>

          <div className="p-8 bg-[#fbfbfd] rounded-3xl border border-slate-200/90 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-800">Monthly Restaurant Sales Revenue</label>
                  <span className="font-mono text-blue-600 font-extrabold text-sm">${monthlyRevenue.toLocaleString()} / mo</span>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={250000}
                  step={5000}
                  value={monthlyRevenue}
                  onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-800">Current Raw Food Cost Percentage</label>
                  <span className="font-mono text-amber-600 font-extrabold text-sm">{foodCostPercent}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={50}
                  step={1}
                  value={foodCostPercent}
                  onChange={(e) => setFoodCostPercent(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1 shadow-2xs">
                <span className="font-bold text-slate-900 block">Where do these savings come from?</span>
                <p>• 8% reduction in raw ingredient wastage via automatic POS depletion</p>
                <p>• 16 hours saved per week on shift scheduling, tip calculations & food audits</p>
              </div>
            </div>

            <div className="md:col-span-5 p-8 bg-blue-600 rounded-3xl text-white text-center space-y-4 shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100 block">
                Projected Annual Cost Savings
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                ${estimatedSavings.toLocaleString()}
              </div>
              <div className="pt-2 border-t border-blue-500">
                <span className="text-xs text-blue-100 block">Estimated Time Saved Yearly</span>
                <span className="text-lg font-bold font-mono">{estimatedTimeSavedHours} Hours / Year</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY & ARCHITECTURE */}
      <section id="security" className="relative z-10 py-20 max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-slate-200/80 text-slate-700 text-xs font-bold uppercase tracking-wider">
            Bank-Grade Foundation
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Enterprise Multi-Tenant Security Architecture
          </h2>
          <p className="text-slate-600 text-sm">
            Built from the ground up to protect your restaurant data with tenant isolation, client-side zero-knowledge encryption, and high availability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-7 bg-white rounded-3xl border border-slate-200/80 space-y-3 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-base">Multi-Tenant Isolation</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Strict database boundary enforcement ensures each restaurant outlet&apos;s data is strictly partitioned and isolated.
            </p>
          </div>

          <div className="p-7 bg-white rounded-3xl border border-slate-200/80 space-y-3 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-base">AES-256 Client Encryption</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Documents and passwords stored in the Vault are encrypted on the client before being sent to the server.
            </p>
          </div>

          <div className="p-7 bg-white rounded-3xl border border-slate-200/80 space-y-3 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-base">Granular Security RBAC</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Define precise operational capabilities for Cashiers, Chefs, Accountants, Managers, and Franchise Owners.
            </p>
          </div>

          <div className="p-7 bg-white rounded-3xl border border-slate-200/80 space-y-3 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-base">Audit Trail Logging</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every bill void, payroll run, recipe modification, and document access is permanently recorded in security logs.
            </p>
          </div>
        </div>
      </section>

      {/* APPLE-STYLE CTA FOOTER BANNER */}
      <section className="relative z-10 py-16 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Ready to Transform Your Restaurant Operations?
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Launch your tenant space in seconds or log in to explore the live interactive Catering Studio and POS system.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-2">
            <Link
              href="/restaurant/bahubali/catering"
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-full shadow-lg transition-all"
            >
              Open Smart Catering Studio
            </Link>
            <Link
              href="/restaurant/bahubali/login"
              className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-full border border-slate-700 transition-all"
            >
              Tenant Login Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 py-10 bg-[#fbfbfd]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              R
            </div>
            <span className="font-bold text-slate-800">RestIQ SaaS Platform</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/restaurant/bahubali/login" className="hover:text-slate-900 transition-colors">
              Tenant Login
            </Link>
            <a href="https://admin.restiq.magnidigitech.com" className="hover:text-slate-900 transition-colors">
              Super Admin Portal
            </a>
            <Link href="/activate" className="hover:text-slate-900 transition-colors">
              Account Activation
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
