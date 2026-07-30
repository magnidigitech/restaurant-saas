"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Module {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
}

interface Branding {
  name: string;
  applicationName: string;
  primaryColor: string;
  logoUrl: string | null;
}

export default function TenantDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";

  const [modules, setModules] = useState<Module[]>([]);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [resBranding, resModules] = await Promise.all([
        fetch(`/api/restaurant/${subdomain}/branding`),
        fetch("/api/restaurant/modules"),
      ]);

      const dataBranding = await resBranding.json();
      const dataModules = await resModules.json();

      if (resBranding.ok) setBranding(dataBranding);
      if (resModules.ok) setModules(dataModules.modules || []);
      else setError(dataModules.error || "Failed to load dashboard data");
    } catch (e) {
      setError("Network error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subdomain) {
      fetchData();
    }
  }, [subdomain]);

  const handleLogout = async () => {
    await fetch("/api/restaurant/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-semibold">
        Loading restaurant dashboard...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Dynamic Subdomain Branding Header */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto" />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-lg"
              style={{ backgroundColor: branding?.primaryColor || "#3b82f6" }}
            >
              {branding?.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-white">
            {branding?.applicationName || "Restaurant Console"}
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-2 py-1 rounded bg-slate-900 border border-slate-800">
            {subdomain} workspace
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="bg-slate-900/10 border border-slate-900 p-8 rounded-2xl space-y-3">
          <h2 className="text-3xl font-extrabold text-white">Welcome back!</h2>
          <p className="text-slate-400 text-sm max-w-xl">
            Access your active modules, manage restaurant operations, and monitor outlets below.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        {/* Modules navigation grid */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold tracking-tight uppercase text-slate-400">Entitled Modules</h3>
          {modules.length === 0 ? (
            <div className="text-slate-500 py-12 text-center border border-dashed border-slate-800 rounded-xl">
              No operational modules are enabled for this restaurant. Contact the platform administrator to allocate modules.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => (
                <div
                  key={mod.key}
                  className="bg-slate-900/30 border border-slate-900 p-6 rounded-2xl hover:border-slate-800 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: branding?.primaryColor || "#3b82f6" }}
                      />
                      <h4 className="text-lg font-bold text-white">{mod.name}</h4>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-3">{mod.description}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/modules/${mod.key}`)}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold tracking-wider uppercase text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    Open Module
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
