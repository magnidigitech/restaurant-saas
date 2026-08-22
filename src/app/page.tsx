"use client";

import React, { useState } from "react";
import Link from "next/link";
import WebGLCanvas from "@/components/WebGLCanvas";

interface ModuleInfo {
  id: string;
  name: string;
  category: "FOH" | "KITCHEN" | "WORKFORCE" | "FINANCE";
  badge: string;
  iconColor: string;
  bgColor: string;
  description: string;
  useCase: string;
  roiMetric: string;
  highlights: string[];
}

const MODULES_LIST: ModuleInfo[] = [
  {
    id: "pos",
    name: "Multi-Outlet POS & Billing Station",
    category: "FOH",
    badge: "Front-of-House",
    iconColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
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
    iconColor: "text-indigo-400",
    bgColor: "bg-indigo-500/10 border-indigo-500/30",
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
    iconColor: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
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
    iconColor: "text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/30",
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
    iconColor: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
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
    iconColor: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/30",
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
    iconColor: "text-teal-400",
    bgColor: "bg-teal-500/10 border-teal-500/30",
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
    iconColor: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
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
    iconColor: "text-indigo-400",
    bgColor: "bg-indigo-500/10 border-indigo-500/30",
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
    iconColor: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/30",
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
    iconColor: "text-pink-400",
    bgColor: "bg-pink-500/10 border-pink-500/30",
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
    iconColor: "text-sky-400",
    bgColor: "bg-sky-500/10 border-sky-500/30",
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
    iconColor: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/30",
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
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(50000);
  const [foodCostPercent, setFoodCostPercent] = useState<number>(32);

  // Live Catering Interactive Pax Slider on Landing Page
  const [demoPax, setDemoPax] = useState<number>(120);

  // Calculations for ROI Calculator
  const estimatedSavings = Math.round((monthlyRevenue * 12 * (foodCostPercent * 0.08)) / 100);
  const estimatedTimeSavedHours = Math.round(15 * 52);

  const filteredModules = MODULES_LIST.filter((m) => {
    if (activeCategory === "ALL") return true;
    return m.category === activeCategory;
  });

  const selectedModule = MODULES_LIST.find((m) => m.id === selectedModuleId) || MODULES_LIST[1];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans relative overflow-x-hidden">
      {/* 3D WebGL Background Canvas */}
      <WebGLCanvas />

      {/* Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                RestIQ
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 block -mt-1 font-bold">
                Restaurant Operating System
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold text-slate-400">
            <a href="#modules" className="hover:text-white transition-colors">
              All 13 Modules
            </a>
            <a href="#catering-studio" className="hover:text-indigo-400 transition-colors">
              Smart Catering Studio
            </a>
            <a href="#roi-calculator" className="hover:text-white transition-colors">
              ROI Calculator
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Vault & Security
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <a
              href="https://admin.restiq.magnidigitech.com"
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors border border-slate-800 rounded-xl hover:border-slate-700 bg-slate-900/50"
            >
              Super Admin Portal
            </a>
            <Link
              href="/restaurant/bahubali/login"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 flex items-center space-x-2"
            >
              <span>Tenant Login</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-24 max-w-7xl mx-auto px-6 text-center lg:text-left grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <span>Enterprise Multi-Tenant SaaS Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            The Complete <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
              Operating System
            </span>{" "}
            for Restaurants
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
            Unify your entire restaurant operations — from Multi-Outlet POS and Smart Catering Package Studios to Automatic Recipe Inventory Depletion, PIN Timecards, Tip Pooling, and Zero-Knowledge Vault Security.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
            <Link
              href="/restaurant/bahubali/catering"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all text-center flex items-center justify-center space-x-2 group"
            >
              <span>Explore Smart Catering Studio</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              href="/restaurant/bahubali/login"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold text-sm rounded-2xl border border-slate-800 transition-all text-center flex items-center justify-center space-x-2"
            >
              <span>Demo Tenant Space</span>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-8 border-t border-slate-800/80 grid grid-cols-3 gap-6 text-left">
            <div>
              <span className="text-2xl sm:text-3xl font-black text-white block">13</span>
              <span className="text-xs text-slate-400 font-medium">Integrated Modules</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">&gt;65%</span>
              <span className="text-xs text-slate-400 font-medium">Target Catering Margin</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-indigo-400 block">100%</span>
              <span className="text-xs text-slate-400 font-medium">Real-time Stock Depletion</span>
            </div>
          </div>
        </div>

        {/* Floating 3D Interactive Feature Preview Card */}
        <div className="lg:col-span-5 relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
          <div className="relative p-6 bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-slate-800 shadow-2xl space-y-6 text-left">
            
            {/* Card Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Live System Engine</h4>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>All Systems Operational</span>
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
                Tenant: bahubali
              </span>
            </div>

            {/* Quick Live Interactive Pax Scaler Card */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Live Catering Pax Headcount</span>
                <span className="px-2.5 py-0.5 bg-indigo-600 text-white font-mono text-xs font-bold rounded-md">
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
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Scaled Basmati Rice</span>
                  <span className="font-bold text-indigo-400 font-mono">{(demoPax * 0.25).toFixed(1)} KG</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Estimated Event Revenue</span>
                  <span className="font-bold text-emerald-400 font-mono">${(demoPax * 32).toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Live Security & Depletion Status */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                <span className="text-slate-300 font-medium">Automatic POS Stock Depletion</span>
                <span className="text-emerald-400 font-bold font-mono">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                <span className="text-slate-300 font-medium">AES-256 Vault Encryption</span>
                <span className="text-indigo-400 font-bold font-mono">ENCRYPTED</span>
              </div>
            </div>

            <Link
              href="/restaurant/bahubali/catering"
              className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl text-center shadow-lg transition-colors"
            >
              Open Interactive Catering Studio &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURE SPOTLIGHT: SMART CATERING & PACKAGE STUDIO */}
      <section id="catering-studio" className="relative z-10 py-20 bg-slate-900/70 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="px-3.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
              Flagship Innovation
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white">
              Smart Catering & Package Studio
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Say goodbye to tedious manual spreadsheet calculations. Scale headcount, compute recipe food costs, monitor gross profit margins, and load pre-set package templates in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-950/80 rounded-3xl border border-slate-800 space-y-4 hover:border-indigo-500/50 transition-all">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl w-max">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Course Dish Catalog Cards</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Filter dishes by course (Starters, Main Course, Breads/Rice, Desserts, Beverages). Add any dish to your catering menu with 1 click.
              </p>
            </div>

            <div className="p-6 bg-slate-950/80 rounded-3xl border border-slate-800 space-y-4 hover:border-indigo-500/50 transition-all">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl w-max">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Real-time Profitability Meter</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Visual progress bar calculating food cost per pax vs selling price per pax. Color-coded alerts ensure your profit margin stays above 65%.
              </p>
            </div>

            <div className="p-6 bg-slate-950/80 rounded-3xl border border-slate-800 space-y-4 hover:border-indigo-500/50 transition-all">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl w-max">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">1-Click Purchase Order & Invoices</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate printable client proposals with advance deposit tracking, and explode recipe demands into kitchen raw material purchase orders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ALL 13 MODULES INTERACTIVE EXPLORER */}
      <section id="modules" className="relative z-10 py-24 max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
            Comprehensive Suite
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white">
            Explore All 13 Enterprise Modules
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
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
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              onClick={() => setSelectedModuleId(mod.id)}
              className={`p-6 rounded-3xl border transition-all cursor-pointer space-y-4 ${
                selectedModuleId === mod.id
                  ? "bg-slate-900 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${mod.bgColor} ${mod.iconColor}`}>
                  {mod.badge}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800">
                  {mod.roiMetric}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-white text-lg">{mod.name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{mod.description}</p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-[11px] space-y-1">
                <span className="font-bold text-slate-300 block">Real-World Operational Use Case:</span>
                <p className="text-slate-400 italic">&quot;{mod.useCase}&quot;</p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {mod.highlights.map((h, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-medium">
                    • {h}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ROI & COST SAVINGS CALCULATOR */}
      <section id="roi-calculator" className="relative z-10 py-20 bg-slate-900/80 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-6 space-y-8">
          <div className="text-center space-y-3">
            <span className="px-3.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-bold uppercase tracking-wider">
              Financial Impact
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Calculate Your Restaurant&apos;s Annual ROI
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              See how much your restaurant saves annually through automated recipe stock depletion, catering headcount scaling, and tip pool accuracy.
            </p>
          </div>

          <div className="p-8 bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-300">Monthly Restaurant Sales Revenue</label>
                  <span className="font-mono text-indigo-400 font-extrabold text-sm">${monthlyRevenue.toLocaleString()} / mo</span>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={250000}
                  step={5000}
                  value={monthlyRevenue}
                  onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-300">Current Raw Food Cost Percentage</label>
                  <span className="font-mono text-amber-400 font-extrabold text-sm">{foodCostPercent}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={50}
                  step={1}
                  value={foodCostPercent}
                  onChange={(e) => setFoodCostPercent(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <span className="font-bold text-slate-200 block">Where do these savings come from?</span>
                <p>• 8% reduction in raw ingredient wastage via automatic POS depletion</p>
                <p>• 15 hours saved per week on shift scheduling, tip calculations & food audits</p>
              </div>
            </div>

            <div className="md:col-span-5 p-6 bg-gradient-to-br from-indigo-950/60 to-purple-950/60 rounded-2xl border border-indigo-500/30 text-center space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 block">
                Projected Annual Cost Savings
              </span>
              <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight">
                ${estimatedSavings.toLocaleString()}
              </div>
              <div className="pt-2 border-t border-indigo-900/50">
                <span className="text-xs text-slate-400 block">Estimated Time Saved Yearly</span>
                <span className="text-lg font-bold text-white font-mono">{estimatedTimeSavedHours} Hours / Year</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY & ARCHITECTURE */}
      <section id="security" className="relative z-10 py-20 max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold uppercase tracking-wider">
            Bank-Grade Foundation
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Enterprise Multi-Tenant Security Architecture
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Built from the ground up to protect your restaurant data with tenant isolation, client-side zero-knowledge encryption, and high availability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-base">Multi-Tenant Isolation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict database boundary enforcement ensures each restaurant outlet&apos;s data is strictly partitioned and isolated.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-base">AES-256 Client Encryption</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Documents and passwords stored in the Vault are encrypted on the client before being sent to the server.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-base">Granular Security RBAC</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Define precise operational capabilities for Cashiers, Chefs, Accountants, Managers, and Franchise Owners.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-base">Audit Trail Logging</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every bill void, payroll run, recipe modification, and document access is permanently recorded in security logs.
            </p>
          </div>
        </div>
      </section>

      {/* CTA FOOTER BANNER */}
      <section className="relative z-10 py-16 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black text-white">
            Ready to Transform Your Restaurant Operations?
          </h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto">
            Launch your tenant space in seconds or log in to explore the live interactive Catering Studio and POS system.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-2">
            <Link
              href="/restaurant/bahubali/catering"
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all"
            >
              Open Smart Catering Studio
            </Link>
            <Link
              href="/restaurant/bahubali/login"
              className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm rounded-2xl border border-slate-800 transition-all"
            >
              Tenant Login Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 py-10 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              R
            </div>
            <span className="font-bold text-slate-300">RestIQ SaaS Platform</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/restaurant/bahubali/login" className="hover:text-slate-300 transition-colors">
              Tenant Login
            </Link>
            <a href="https://admin.restiq.magnidigitech.com" className="hover:text-slate-300 transition-colors">
              Super Admin Portal
            </a>
            <Link href="/activate" className="hover:text-slate-300 transition-colors">
              Account Activation
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
