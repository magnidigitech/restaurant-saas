"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Branding {
  name: string;
  applicationName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
}

export default function TenantLoginPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";

  const [branding, setBranding] = useState<Branding | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch(`/api/restaurant/${subdomain}/branding`);
        const data = await res.json();
        if (res.ok) {
          setBranding(data);
        } else {
          setError(data.error || "Failed to load restaurant workspace");
        }
      } catch (e) {
        setError("Error loading workspace");
      } finally {
        setPageLoading(false);
      }
    };

    if (subdomain) {
      fetchBranding();
    }
  }, [subdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/restaurant/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, subdomain }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-semibold">
        Loading workspace...
      </main>
    );
  }

  if (branding && branding.status !== "ACTIVE") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center">
        <div className="max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-4 shadow-2xl">
          <h2 className="text-2xl font-bold text-red-500 uppercase tracking-wide">Workspace Closed</h2>
          <p className="text-slate-300 text-sm">
            Access to <span className="font-semibold text-white">{branding.name}</span> has been {branding.status.toLowerCase()}.
          </p>
          <p className="text-xs text-slate-500">
            Please contact the platform administrator for billing and support questions.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-8 bg-slate-900/50 p-8 rounded-2xl border border-slate-800 backdrop-blur-md shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="h-12 w-auto" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg"
                style={{ backgroundColor: branding?.primaryColor || "#3b82f6" }}
              >
                {branding?.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            {branding?.applicationName || "Restaurant Portal"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Workspace: <span className="font-semibold text-blue-400">{subdomain}.yourplatform.com</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email-address" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Email Address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full px-4 py-3 rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                placeholder="staff@restaurant.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full px-4 py-3 rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: branding?.primaryColor || "#3b82f6" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
