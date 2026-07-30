"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ActivateAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

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
      setError("Missing invitation token.");
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
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred during activation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-slate-900/50 p-8 rounded-2xl border border-slate-800 backdrop-blur-md shadow-2xl">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white">Activate Account</h2>
        <p className="mt-2 text-sm text-slate-400">Complete your profile to join your restaurant team</p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-950/50 border border-green-800 text-green-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          Account activated successfully! Redirecting to login...
        </div>
      )}

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4 rounded-md">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Your Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="relative block w-full px-4 py-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
              placeholder="Alex Johnson"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="relative block w-full px-4 py-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
              placeholder="•••••••• (min 6 characters)"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Confirm Password</label>
            <input
              required
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="relative block w-full px-4 py-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Activating Profile..." : "Activate Account"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ActivateAccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <Suspense fallback={<div>Loading activation context...</div>}>
        <ActivateAccountContent />
      </Suspense>
    </main>
  );
}
