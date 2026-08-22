import React from "react";
import Link from "next/link";

export default function RootLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans">
      
      {/* Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                RestIQ
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 block -mt-1">
                Enterprise SaaS
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="https://admin.restiq.magnidigitech.com"
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors border border-slate-800 rounded-xl hover:border-slate-700"
            >
              Super Admin Portal
            </a>
            <Link
              href="/restaurant/bahubali/login"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              Restaurant Login &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 max-w-7xl mx-auto px-6 text-center lg:text-left grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>Next-Generation Restaurant Intelligence Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-none">
            Empower Your <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Restaurant Enterprise
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl font-normal leading-relaxed">
            All-in-one cloud platform combining Multi-Outlet POS, Smart Catering & Package Builder, Real-time Inventory Depletion, AI Recipe Costing, and Workforce Roster Scheduling.
          </p>

          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
            <Link
              href="/restaurant/bahubali/login"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-indigo-600/25 transition-all text-center"
            >
              Launch Restaurant Portal
            </Link>
            <a
              href="https://admin.restiq.magnidigitech.com"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-sm rounded-2xl border border-slate-800 transition-all text-center"
            >
              Platform Administration
            </a>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3 shadow-lg">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-max">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-bold text-white text-base">Smart Catering Studio</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Interactive dish catalog, live Pax headcount scaling, real-time food cost margin engine, and printable proposals.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3 shadow-lg">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-max">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-white text-base">Multi-Outlet POS</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fast order entry, instant KDS kitchen dispatching, payment split, and real-time inventory deduction.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3 shadow-lg">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-max">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="font-bold text-white text-base">Recipe & Stock Matrix</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Exploded raw ingredient yields, vendor Purchase Orders, low-stock alerts, and food variance tracking.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3 shadow-lg">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-max">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-white text-base">Workforce & Payroll</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Shift scheduling rosters, PIN kiosk timecard attendance, automatic tip pool distribution, and payslips.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} RestIQ SaaS. All rights reserved.</p>
          <div className="flex items-center space-x-6 mt-4 sm:mt-0">
            <Link href="/restaurant/bahubali/login" className="hover:text-slate-300">
              Tenant Login
            </Link>
            <a href="https://admin.restiq.magnidigitech.com" className="hover:text-slate-300">
              Admin Platform
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
