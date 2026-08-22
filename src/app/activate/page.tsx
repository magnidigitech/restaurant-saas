"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function GlobalActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const subdomain = searchParams.get("subdomain") || "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing or invalid invitation token. Please check your invite link.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/restaurant/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to activate account.");
      }

      setSuccess(true);
      setTimeout(() => {
        if (subdomain) {
          router.push(`/restaurant/${subdomain}/login`);
        } else {
          router.push("/login");
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An error occurred during account activation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 bg-[#121622]/90 p-8 sm:p-10 rounded-3xl border border-white/[0.08] shadow-2xl backdrop-blur-xl">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0071E3]/15 text-[#0071E3] font-bold text-xl border border-[#0071E3]/25 mb-1">
          🔐
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Activate Your Account
        </h2>
        {subdomain && (
          <p className="text-xs font-semibold tracking-wider uppercase text-blue-400">
            Workspace: <span className="text-white font-mono lowercase">{subdomain}</span>
          </p>
        )}
        <p className="text-xs text-[#8F95A3]">
          Complete your profile and create a password to access your restaurant dashboard.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-2xl text-center font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3.5 rounded-2xl text-center font-medium flex flex-col items-center gap-1.5 animate-in fade-in zoom-in duration-200">
          <span className="font-bold text-sm">🎉 Account Activated Successfully!</span>
          <span className="text-[11px] text-emerald-300/80">Redirecting to your login workspace...</span>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-[11px] font-semibold text-[#8F95A3] uppercase tracking-wider block mb-1.5">
            Full Name
          </label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-[#090B10] text-white text-xs placeholder:text-[#8F95A3]/50 focus:outline-hidden focus:border-[#0071E3] transition"
            placeholder="e.g. John Doe"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#8F95A3] uppercase tracking-wider block mb-1.5">
            New Password
          </label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-[#090B10] text-white text-xs placeholder:text-[#8F95A3]/50 focus:outline-hidden focus:border-[#0071E3] transition"
            placeholder="•••••••• (minimum 6 characters)"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#8F95A3] uppercase tracking-wider block mb-1.5">
            Confirm Password
          </label>
          <input
            required
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-[#090B10] text-white text-xs placeholder:text-[#8F95A3]/50 focus:outline-hidden focus:border-[#0071E3] transition"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full py-3.5 mt-2 bg-[#0071E3] text-white text-xs font-bold rounded-xl hover:bg-[#0077ED] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-[#0071E3]/20"
        >
          {loading ? "Activating Profile..." : "Activate Account & Continue →"}
        </button>
      </form>

      {subdomain && (
        <div className="text-center pt-2">
          <Link
            href={`/restaurant/${subdomain}/login`}
            className="text-[11px] font-medium text-[#8F95A3] hover:text-white transition"
          >
            Already activated? Go to Login
          </Link>
        </div>
      )}
    </div>
  );
}

export default function GlobalActivatePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090B10] px-4 py-12 text-slate-100 font-sans antialiased">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3 text-xs text-[#8F95A3]">
            <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
            <span>Loading activation workspace...</span>
          </div>
        }
      >
        <GlobalActivateContent />
      </Suspense>
    </main>
  );
}
