"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

export default function GenericModulePage({
  params,
}: {
  params: Promise<{ subdomain: string; moduleKey: string }>;
}) {
  const router = useRouter();
  const { subdomain, moduleKey } = use(params);
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleName, setModuleName] = useState(moduleKey);

  useEffect(() => {
    if (moduleKey.toLowerCase() === "catering") {
      router.replace(`/restaurant/${subdomain}/catering`);
      return;
    }

    async function checkAccess() {
      try {
        const res = await fetch("/api/restaurant/modules");
        const data = await res.json();
        if (res.ok && data.modules) {
          const mod = data.modules.find((m: any) => m.key.toLowerCase() === moduleKey.toLowerCase());
          if (mod) {
            setModuleName(mod.name);
          } else {
            setError(`Module '${moduleKey}' is not enabled for this restaurant.`);
          }
        } else {
          setError(data.error || "Failed to verify module status");
        }
      } catch {
        setError("Network error loading module status");
      } finally {
        setLoading(false);
      }
    }
    checkAccess();
  }, [moduleKey, subdomain, router]);

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Verifying Module Access...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection={moduleName} />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
              className={`text-xs font-medium transition cursor-pointer ${
                isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              ← Back to Dashboard
            </button>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {moduleName}
            </h1>
            <p className={`text-xs font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Key: {moduleKey}
            </p>
          </div>
        </div>

        {error ? (
          <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-3xl text-center space-y-2">
            <p className="font-semibold text-sm">Access Restricted</p>
            <p>{error}</p>
          </div>
        ) : (
          <div
            className={`p-12 rounded-3xl border text-center space-y-3 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/15 text-[#58A6FF] flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {moduleName} Module Active
            </h2>
            <p className={`text-xs max-w-md mx-auto leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              This enterprise feature is provisioned for this tenant and scheduled for upcoming operational workflow expansion.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
