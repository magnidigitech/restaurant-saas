"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ModuleMockPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) || "";
  const moduleKey = (params?.moduleKey as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleName, setModuleName] = useState("");

  useEffect(() => {
    const verifyModuleAccess = async () => {
      try {
        // Fetch active modules for this tenant to verify Level 1 (tenant entitlement)
        const res = await fetch("/api/restaurant/modules");
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "Access Denied");
          return;
        }

        const activeModules: any[] = data.modules || [];
        const currentMod = activeModules.find((m) => m.key === moduleKey);

        if (!currentMod) {
          setError(`Module '${moduleKey}' is not enabled or entitled for this restaurant.`);
        } else {
          setModuleName(currentMod.name);
        }
      } catch (e) {
        setError("Error validating module permissions.");
      } finally {
        setLoading(false);
      }
    };

    if (subdomain && moduleKey) {
      verifyModuleAccess();
    }
  }, [subdomain, moduleKey]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-semibold">
        Loading operational module...
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <div className="max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-4 shadow-2xl">
          <h2 className="text-2xl font-bold text-red-500 uppercase tracking-wide">Access Blocked</h2>
          <p className="text-slate-300 text-sm">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white">{moduleName}</h1>
            <p className="text-xs text-slate-400 font-mono mt-1">Module Key: {moduleKey}</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-sm font-semibold cursor-pointer"
          >
            Dashboard
          </button>
        </div>

        <div className="bg-slate-900/10 border border-slate-900 p-12 rounded-2xl text-center text-slate-500 font-medium">
          Mock operational workflow interface for module: <span className="text-slate-300 font-semibold">{moduleName}</span>.
          <p className="text-xs text-slate-600 mt-2">
            During Phase 1, business logic pages are represented by functional wrappers to focus on foundation checks.
          </p>
        </div>
      </div>
    </main>
  );
}
