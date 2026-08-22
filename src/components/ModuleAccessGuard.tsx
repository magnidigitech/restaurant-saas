"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface ModuleAccessGuardProps {
  moduleKey: string;
  moduleName: string;
  activeSection?: string;
  children: React.ReactNode;
}

export default function ModuleAccessGuard({
  moduleKey,
  moduleName,
  activeSection,
  children,
}: ModuleAccessGuardProps) {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkEntitlement() {
      try {
        const res = await fetch("/api/restaurant/modules");
        if (!res.ok) {
          if (isMounted) {
            setHasAccess(false);
            setChecking(false);
          }
          return;
        }

        const data = await res.json();
        const activeKeys: string[] = (data.modules || []).map((m: any) => m.key.toLowerCase());

        const targetKey = moduleKey.toLowerCase();
        const isEntitled =
          activeKeys.includes(targetKey) ||
          (targetKey === "shifts" && activeKeys.includes("shift_management")) ||
          (targetKey === "shift_management" && activeKeys.includes("shifts"));

        if (isMounted) {
          setHasAccess(isEntitled);
          setChecking(false);
        }
      } catch {
        if (isMounted) {
          setHasAccess(false);
          setChecking(false);
        }
      }
    }

    if (subdomain) {
      checkEntitlement();
    }
  }, [subdomain, moduleKey]);

  const handleCopyModuleKey = () => {
    navigator.clipboard.writeText(moduleKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (checking) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased relative overflow-hidden ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
          }`}
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute w-[450px] h-[450px] bg-[#0071E3]/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-[#0071E3]/20 blur-sm -z-10 animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold tracking-wide uppercase opacity-70">
              Security &amp; Entitlements
            </p>
            <p className="text-sm font-medium tracking-tight">Verifying authorization permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-300 flex flex-col relative overflow-hidden ${isDark ? "bg-[#07090E] text-[#E4E7EB]" : "bg-[#F8F9FB] text-[#1D1D1F]"
          }`}
      >
        {/* Ambient Glowing Light Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-rose-500/10 via-amber-500/5 to-purple-500/10 rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse" />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-[#0071E3]/5 rounded-full blur-[90px] pointer-events-none -z-10" />

        <RestaurantNavbar activeSection={activeSection || moduleName} />

        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
          <div
            className={`w-full max-w-lg p-7 sm:p-9 rounded-[32px] border backdrop-blur-xl shadow-2xl relative transition-all duration-300 space-y-7 animate-in fade-in zoom-in-95 duration-500 ${isDark
              ? "bg-[#11141E]/80 border-white/[0.08] shadow-black/60"
              : "bg-white/90 border-slate-200/80 shadow-slate-900/10"
              }`}
          >
            {/* Animated Concentric Glowing Lock Emblem */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-full border border-rose-500/20 animate-ping opacity-25" />
              {/* Middle glowing aura */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-rose-500/20 via-amber-500/10 to-rose-600/20 blur-md animate-pulse" />

              {/* Center Lock Badge */}
              <div
                className={`relative z-10 w-18 h-18 rounded-2xl border flex items-center justify-center shadow-lg transition-transform hover:scale-105 duration-300 ${isDark
                  ? "bg-gradient-to-b from-[#1E1B2E] to-[#14121F] border-rose-500/30 text-rose-400 shadow-rose-950/40"
                  : "bg-gradient-to-b from-rose-50 to-rose-100/60 border-rose-200 text-rose-600 shadow-rose-200/50"
                  }`}
              >
                <svg className="w-8 h-8 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>

            {/* Title & Description */}
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className={isDark ? "text-rose-400" : "text-rose-700"}>
                  Module Not Entitled
                </span>
              </div>

              <h1 className={`text-2xl sm:text-[26px] font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                No Access to {moduleName}
              </h1>

              <p className={`text-xs sm:text-sm leading-relaxed max-w-md mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                This operational module is currently disabled for your restaurant or has not been provisioned by the platform administrator.
              </p>
            </div>

            {/* Diagnostic Information Pill */}
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2.5 ${isDark ? "bg-[#0A0C14]/60 border-white/[0.04]" : "bg-slate-50/80 border-slate-200/60"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Tenant Domain
                </span>
                <span className={`font-mono text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {subdomain}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Module Key
                </span>
                <button
                  type="button"
                  onClick={handleCopyModuleKey}
                  title="Click to copy module identifier"
                  className={`font-mono text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1.5 cursor-pointer transition ${isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-[#64B5FF] hover:bg-white/[0.08]"
                    : "bg-white border-slate-200 text-[#0071E3] hover:bg-blue-50"
                    }`}
                >
                  <span>{moduleKey}</span>
                  <span className="text-[10px] opacity-75">{copiedKey ? "✓ Copied" : "⧉"}</span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Status
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Deactivated
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
                className="flex-1 py-3 px-5 bg-gradient-to-b from-[#0077ED] to-[#0071E3] hover:from-[#0082FB] hover:to-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-2xl cursor-pointer transition shadow-md shadow-[#0071E3]/25 flex items-center justify-center gap-2"
              >
                <span>← Return to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => router.push(`/restaurant/${subdomain}/settings/profile`)}
                className={`py-3 px-4 rounded-2xl text-xs font-medium border transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${isDark
                  ? "bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 border-white/[0.08]"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                  }`}
              >
                <span>Subscriptions</span>
                <span className="opacity-60">↗</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

