"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface TokenDetails {
  valid: boolean;
  email?: string;
  restaurantName?: string;
  subdomain?: string;
  alreadyActivated?: boolean;
  error?: string;
}

function GlobalActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const paramSubdomain = searchParams.get("subdomain") || "";
  const paramEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(paramEmail);
  const [restaurantName, setRestaurantName] = useState("");
  const [subdomain, setSubdomain] = useState(paramSubdomain);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [verifying, setVerifying] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [alreadyActivated, setAlreadyActivated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  // 1. Verify token on mount and fetch bound email & restaurant details
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenError("Missing invitation token. Please use the activation link provided in your email.");
      return;
    }

    let isMounted = true;

    async function verifyToken() {
      try {
        const res = await fetch(`/api/restaurant/activate?token=${encodeURIComponent(token)}`);
        const data: TokenDetails = await res.json();

        if (!isMounted) return;

        if (!res.ok || !data.valid) {
          if (data.alreadyActivated) {
            setAlreadyActivated(true);
            if (data.subdomain) setSubdomain(data.subdomain);
          }
          setTokenError(data.error || "This invitation link is invalid or has expired.");
          return;
        }

        if (data.email) setEmail(data.email);
        if (data.restaurantName) setRestaurantName(data.restaurantName);
        if (data.subdomain) setSubdomain(data.subdomain);
      } catch {
        if (!isMounted) return;
        // Fallback: If network error, still allow user to submit with params
        if (paramEmail) setEmail(paramEmail);
        if (paramSubdomain) setSubdomain(paramSubdomain);
      } finally {
        if (isMounted) setVerifying(false);
      }
    }

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token, paramEmail, paramSubdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!token) {
      setFormError("Missing or invalid invitation token. Please check your invite link.");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/restaurant/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
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
      }, 2200);
    } catch (err: any) {
      setFormError(err.message || "An error occurred during account activation.");
    } finally {
      setLoading(false);
    }
  };

  const isLengthValid = password.length >= 6;
  const isMatchValid = confirmPassword.length > 0 && password === confirmPassword;

  // --- TOKEN VERIFICATION LOADING STATE ---
  if (verifying) {
    return (
      <div className="relative w-full max-w-[420px] rounded-3xl bg-[#0D121D]/90 backdrop-blur-2xl border border-white/[0.08] p-8 shadow-2xl text-center space-y-4">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">Verifying Activation Credentials</p>
          <p className="text-xs text-slate-400">Validating single-use security token...</p>
        </div>
      </div>
    );
  }

  // --- TOKEN ERROR / ALREADY ACTIVATED STATE ---
  if (tokenError) {
    return (
      <div className="relative w-full max-w-[440px] rounded-3xl bg-[#0D121D]/90 backdrop-blur-2xl border border-white/[0.08] p-7 sm:p-9 shadow-2xl space-y-6 text-center">
        <div className="flex justify-center mb-1">
          <div className="relative">
            <div className="absolute -inset-2 bg-amber-500/10 rounded-2xl blur-lg" />
            <img src="/resto-bird-logo.png" alt="Resto Bird" className="relative h-10 w-auto object-contain" />
          </div>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xl font-bold">
          {alreadyActivated ? "✓" : "⚠️"}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-white">
            {alreadyActivated ? "Account Already Activated" : "Invalid Activation Link"}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">{tokenError}</p>
        </div>

        <div className="pt-2">
          {subdomain ? (
            <Link
              href={`/restaurant/${subdomain}/login`}
              className="inline-flex items-center justify-center w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/15 transition cursor-pointer"
            >
              Proceed to Workspace Login →
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 px-4 bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-xs rounded-xl border border-white/[0.1] transition cursor-pointer"
            >
              Go to Login
            </Link>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN ACTIVATION FORM ---
  return (
    <div className="relative w-full max-w-[440px] rounded-3xl bg-[#0D121D]/90 backdrop-blur-2xl border border-white/[0.09] p-6 sm:p-9 shadow-[0_30px_90px_rgba(0,0,0,0.85),0_0_50px_rgba(245,158,11,0.06)] relative overflow-hidden">
      {/* Subtle Top Amber Glow Accent Line */}
      <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative mb-3.5 flex items-center justify-center">
          <div className="absolute -inset-3 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-600/20 rounded-2xl blur-xl pointer-events-none" />
          <img
            src="/resto-bird-logo.png"
            alt="Resto Bird"
            className="relative h-11 sm:h-12 w-auto object-contain drop-shadow-md"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-wider mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Workspace Activation
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Activate Your Account</h1>
        <p className="mt-1 text-xs text-slate-400 max-w-[310px] leading-relaxed">
          Establish your master password to access your restaurant operating console.
        </p>
      </div>

      {/* Target Workspace & Restaurant Pill */}
      {subdomain && (
        <div className="mb-5 p-3 rounded-2xl bg-[#080B12] border border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold shrink-0">
              🏪
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate text-xs">
                {restaurantName || `${subdomain.toUpperCase()} Restaurant`}
              </p>
              <p className="text-[11px] font-mono text-amber-400 truncate">
                {subdomain}.restobird.com
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 text-[10px] font-mono shrink-0 ml-2">
            Tenant Space
          </span>
        </div>
      )}

      {/* Error Banner */}
      {formError && (
        <div className="mb-5 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs px-4 py-3 rounded-2xl text-center font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="flex-1 text-left">{formError}</span>
        </div>
      )}

      {/* Success Notification */}
      {success && (
        <div className="mb-5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs px-4 py-3.5 rounded-2xl text-center font-medium flex flex-col items-center gap-1.5 animate-in fade-in zoom-in duration-200">
          <span className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
            <span>🎉</span> Account Activated Successfully!
          </span>
          <span className="text-[11px] text-emerald-300/80">Launching your workspace console...</span>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Hidden username input for browser password managers (autofill compliance) */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email || ""}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />

        {/* Bound Account Email Display */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Administrator Email
          </label>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#070A10] text-slate-300 text-xs">
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate flex-1 font-mono text-white text-xs select-all">
              {email || "Invited Administrator"}
            </span>
            <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              Verified Invitee
            </span>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            New Master Password
          </label>
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-4 pr-11 py-3 rounded-xl border border-white/[0.08] bg-[#080B12] text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 transition font-sans"
              placeholder="•••••••• (minimum 6 characters)"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Confirm Master Password
          </label>
          <div className="relative">
            <input
              required
              type={showConfirmPassword ? "text" : "password"}
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-4 pr-11 py-3 rounded-xl border border-white/[0.08] bg-[#080B12] text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 transition font-sans"
              placeholder="•••••••• (re-enter password)"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
              title={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Real-time Checklist */}
        <div className="pt-1 flex items-center gap-4 text-[11px]">
          <div className={`flex items-center gap-1.5 transition ${isLengthValid ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
            <span>{isLengthValid ? "✓" : "○"}</span>
            <span>6+ characters</span>
          </div>
          <div className={`flex items-center gap-1.5 transition ${isMatchValid ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
            <span>{isMatchValid ? "✓" : "○"}</span>
            <span>Passwords match</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || success || !isLengthValid || !isMatchValid}
          className="w-full py-3.5 mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
              <span>Activating Credentials...</span>
            </>
          ) : (
            <span>Activate Account & Enter Workspace →</span>
          )}
        </button>
      </form>

      {/* Footer Navigation & Security */}
      <div className="mt-6 pt-5 border-t border-white/[0.06] text-center space-y-2">
        {subdomain && (
          <Link
            href={`/restaurant/${subdomain}/login`}
            className="text-[11px] font-medium text-slate-400 hover:text-amber-400 transition block"
          >
            Already activated? Sign In to Console →
          </Link>
        )}
        <p className="text-[10px] text-slate-500 font-mono">
          🔒 256-Bit TLS Secured • Resto Bird Cloud OS
        </p>
      </div>
    </div>
  );
}

export default function GlobalActivatePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#07090E] px-4 py-12 text-slate-100 font-sans antialiased overflow-hidden selection:bg-amber-500/20 selection:text-amber-300">
      {/* Minute Subtle Background Animation Mesh & Floating Ambient Lights */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Floating Ambient Glow 1: Warm Amber Light (slow drift) */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[580px] h-[400px] bg-gradient-to-b from-amber-500/12 via-amber-600/6 to-transparent rounded-full blur-[120px] pointer-events-none animate-ambient-drift" />

      {/* Floating Ambient Glow 2: Deep Blue Accent (reverse drift) */}
      <div className="absolute -bottom-32 right-1/4 w-[480px] h-[360px] bg-blue-600/[0.05] rounded-full blur-[130px] pointer-events-none animate-ambient-drift-reverse" />

      {/* Floating Ambient Glow 3: Subtle Gold Accent */}
      <div className="absolute top-1/3 -left-28 w-[380px] h-[380px] bg-amber-500/[0.04] rounded-full blur-[110px] pointer-events-none animate-ambient-drift" />

      <Suspense
        fallback={
          <div className="relative w-full max-w-[420px] rounded-3xl bg-[#0D121D]/90 backdrop-blur-2xl border border-white/[0.08] p-8 shadow-2xl text-center space-y-4">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading activation workspace...</p>
          </div>
        }
      >
        <GlobalActivateContent />
      </Suspense>
    </main>
  );
}
