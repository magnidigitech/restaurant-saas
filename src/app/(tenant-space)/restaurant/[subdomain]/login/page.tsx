"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

interface Branding {
  name: string;
  applicationName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4 text-slate-400 hover:text-white transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-slate-400 hover:text-white transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function AppleTenantLoginPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";

  const [branding, setBranding] = useState<Branding | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  // 2FA Challenge State
  const [step, setStep] = useState<"CREDENTIALS" | "2FA">("CREDENTIALS");
  const [mfaMethod, setMfaMethod] = useState<"TOTP" | "PASSKEY" | "RECOVERY">("TOTP");
  const [challengeToken, setChallengeToken] = useState("");
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const [hasTotp, setHasTotp] = useState(true);
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [verifying2fa, setVerifying2fa] = useState(false);

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
      } catch {
        setError("Error loading workspace");
      } finally {
        setPageLoading(false);
      }
    };

    if (subdomain) {
      fetchBranding();
    }
  }, [subdomain]);

  // Passkey Instant Sign-in Flow
  const handlePasskeySignIn = async () => {
    setError("");
    setPasskeyLoading(true);

    try {
      // 1. Get auth options from server
      const optRes = await fetch("/api/restaurant/auth/passkeys/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });

      const options = await optRes.json();
      if (!optRes.ok) {
        throw new Error(options.error || "Failed to initiate passkey sign-in");
      }

      // 2. Prompt biometric / hardware key with browser WebAuthn API
      let assertion;
      try {
        assertion = await startAuthentication(options);
      } catch (authErr: any) {
        if (authErr.name === "NotAllowedError") {
          throw new Error("Passkey sign-in was canceled or timed out.");
        }
        throw new Error(authErr.message || "Biometric sensor authentication failed");
      }

      // 3. Verify assertion with backend
      const verRes = await fetch("/api/restaurant/auth/passkeys/verify-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain,
          assertion,
        }),
      });

      const verData = await verRes.json();
      if (!verRes.ok) {
        throw new Error(verData.error || "Passkey verification failed");
      }

      // 4. Success -> redirect cleanly to dashboard
      navigateToDashboard();
    } catch (err: any) {
      setError(err.message || "Passkey authentication failed");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const navigateToDashboard = () => {
    const isSubdomain = typeof window !== "undefined" && (
      window.location.host.startsWith(`${subdomain}.`) ||
      (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin."))
    );
    router.push(isSubdomain ? "/dashboard" : `/restaurant/${subdomain}/dashboard`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/restaurant/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.requires2FA) {
          setChallengeToken(data.challengeToken);
          setHasPasskeys(Boolean(data.hasPasskeys));
          setHasTotp(Boolean(data.hasTotp));
          setMfaMethod(data.hasPasskeys ? "PASSKEY" : "TOTP");
          setStep("2FA");
          setLoading(false);
          return;
        }

        navigateToDashboard();
      } else {
        setError(data.error || "Invalid email or password");
        setLoading(false);
      }
    } catch {
      setError("An unexpected network error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerifying2fa(true);

    try {
      const payload: any = {
        subdomain,
        challengeToken,
        method: mfaMethod,
        trustDevice,
      };

      if (mfaMethod === "TOTP") {
        if (otpCode.length !== 6) {
          throw new Error("Please enter a 6-digit authentication code.");
        }
        payload.otpCode = otpCode;
      } else if (mfaMethod === "RECOVERY") {
        if (!recoveryCode.trim()) {
          throw new Error("Please enter your backup recovery code.");
        }
        payload.recoveryCode = recoveryCode.trim();
      }

      const res = await fetch("/api/restaurant/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "2FA verification failed");
      }

      navigateToDashboard();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setVerifying2fa(false);
    }
  };

  const handleBackToLogin = () => {
    setStep("CREDENTIALS");
    setError("");
    setOtpCode("");
    setRecoveryCode("");
  };

  if (pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090E] px-4 font-sans text-slate-100 antialiased">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Connecting to Resto Bird Workspace...</p>
        </div>
      </main>
    );
  }

  if (branding && branding.status !== "ACTIVE") {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#07090E] px-4 font-sans text-slate-100 antialiased overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <img
            src="/resto-bird-flaticon.png"
            alt=""
            aria-hidden="true"
            className="w-[500px] h-[500px] object-contain opacity-[0.03] filter drop-shadow-2xl animate-ambient-drift"
          />
        </div>
        <div className="relative max-w-md w-full p-8 rounded-3xl border border-white/[0.08] bg-[#0D121D]/90 backdrop-blur-2xl shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-white">Workspace Inactive</h2>
          <p className="text-xs text-slate-400">
            Access to <span className="font-semibold text-white">{branding.name}</span> has been {branding.status.toLowerCase()}.
          </p>
          <p className="text-[11px] text-slate-500">
            Please contact your system administrator or Resto Bird support for assistance.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col justify-center items-center px-4 py-12 font-sans antialiased bg-[#07090E] text-slate-100 overflow-hidden selection:bg-amber-500/20 selection:text-amber-300">
      {/* 1. Subtle, Elegant Light Watermark of Resto Bird Emblem in Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <img
          src="/resto-bird-flaticon.png"
          alt=""
          aria-hidden="true"
          className="w-[540px] h-[540px] sm:w-[740px] sm:h-[740px] object-contain opacity-[0.04] filter drop-shadow-2xl animate-ambient-drift pointer-events-none select-none"
        />
      </div>

      {/* 2. Geometric Dot Matrix with Radial Fade */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* 3. Ambient Floating Radial Glow Lights */}
      <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[600px] h-[420px] bg-gradient-to-b from-amber-500/12 via-amber-600/5 to-transparent rounded-full blur-[130px] pointer-events-none animate-ambient-drift" />
      <div className="absolute -bottom-36 right-1/4 w-[500px] h-[380px] bg-blue-600/[0.04] rounded-full blur-[140px] pointer-events-none animate-ambient-drift-reverse" />
      <div className="absolute top-1/3 -left-32 w-[380px] h-[380px] bg-amber-500/[0.03] rounded-full blur-[120px] pointer-events-none animate-ambient-drift" />

      {/* 4. Main Login Container */}
      <div className="relative w-full max-w-[430px]">
        <div className="relative rounded-3xl bg-[#0D121D]/90 backdrop-blur-2xl border border-white/[0.09] p-7 sm:p-9 shadow-[0_30px_90px_rgba(0,0,0,0.85),0_0_50px_rgba(245,158,11,0.06)] relative overflow-hidden">
          {/* Subtle Top Amber Glow Line Accent */}
          <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          {/* Header & Identity */}
          <div className="flex flex-col items-center text-center mb-6">
            {/* Resto Bird Workspace Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-wider mb-3.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Resto Bird Workspace
            </div>

            {/* Restaurant Avatar / Logo */}
            <div className="relative mb-3 flex items-center justify-center">
              {step === "2FA" ? (
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 border border-amber-400/30">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              ) : branding?.logoUrl ? (
                <div className="relative p-2.5 rounded-2xl bg-[#080B12] border border-white/[0.08] shadow-md">
                  <img src={branding.logoUrl} alt={branding.name} className="h-12 w-auto max-w-[140px] object-contain rounded-lg" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg border border-white/[0.1] bg-gradient-to-br from-[#1E2638] to-[#121724]">
                  <span className="text-amber-400 font-extrabold">{branding?.name ? branding.name.charAt(0).toUpperCase() : "R"}</span>
                </div>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {step === "2FA" ? "Security Verification" : branding?.name || "Restaurant Workspace"}
            </h1>
            <p className="mt-1 text-xs font-mono text-amber-400/90">
              {step === "2FA" ? "Enter your 2FA security credentials" : `${subdomain}.restobird.com`}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 rounded-2xl text-xs font-medium border text-center animate-in fade-in duration-200 bg-rose-500/10 border-rose-500/20 text-rose-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="flex-1 text-left">{error}</span>
            </div>
          )}

          {/* STEP 1: Passkey or Password Form */}
          {step === "CREDENTIALS" && (
            <div className="space-y-4">
              {/* Primary Passkey Action (Touch ID / Face ID / Passkey) */}
              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] hover:border-amber-500/40 text-white transition flex items-center justify-center gap-2.5 cursor-pointer shadow-sm hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50"
              >
                {passkeyLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Prompting Sensor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>Continue with Passkey</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono">Fast</span>
                  </>
                )}
              </button>

              {/* Elegant Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/[0.08]"></div>
                <span className="flex-shrink mx-3 text-[10.5px] uppercase tracking-wider text-slate-500 font-mono">
                  or password
                </span>
                <div className="flex-grow border-t border-white/[0.08]"></div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
                  >
                    Work Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="owner@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-xs border border-white/[0.09] bg-[#080B12] text-white placeholder:text-slate-500 transition focus:outline-hidden focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 pr-11 text-xs border border-white/[0.09] bg-[#080B12] text-white placeholder:text-slate-500 transition focus:outline-hidden focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/20 hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    "Continue with Password →"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Enterprise Multi-Factor Selector */}
          {step === "2FA" && (
            <div className="space-y-4">
              {/* Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.06] text-xs">
                {hasPasskeys && (
                  <button
                    type="button"
                    onClick={() => {
                      setMfaMethod("PASSKEY");
                      setError("");
                    }}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                      mfaMethod === "PASSKEY"
                        ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Passkey
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMfaMethod("TOTP");
                    setError("");
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                    mfaMethod === "TOTP"
                      ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Authenticator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaMethod("RECOVERY");
                    setError("");
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                    mfaMethod === "RECOVERY"
                      ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Recovery
                </button>
              </div>

              {/* Passkey Verification Option */}
              {mfaMethod === "PASSKEY" && (
                <div className="space-y-3 py-2 text-center">
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                    Use Face ID, Touch ID, Windows Hello, or your hardware key to complete verification.
                  </div>
                  <button
                    type="button"
                    onClick={handlePasskeySignIn}
                    disabled={passkeyLoading}
                    className="w-full py-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {passkeyLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                        <span>Prompting Sensor...</span>
                      </>
                    ) : (
                      "Authenticate with Passkey"
                    )}
                  </button>
                </div>
              )}

              {/* TOTP 6-digit Form */}
              {mfaMethod === "TOTP" && (
                <form className="space-y-4" onSubmit={handle2FASubmit}>
                  <div>
                    <label
                      htmlFor="otp"
                      className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-center"
                    >
                      6-Digit Authenticator Code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full rounded-xl px-4 py-3 text-center font-mono text-xl tracking-[0.4em] font-bold border border-white/[0.09] bg-[#080B12] text-white transition focus:outline-hidden focus:border-amber-500/60"
                    />
                  </div>

                  {/* Trusted Device Checkbox */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-slate-300">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(e) => setTrustDevice(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-[#080B12] text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span>Trust this device for 30 days</span>
                  </label>

                  <button
                    type="submit"
                    disabled={verifying2fa || otpCode.length !== 6}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
                  >
                    {verifying2fa ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      "Verify & Sign In"
                    )}
                  </button>
                </form>
              )}

              {/* Recovery Code Form */}
              {mfaMethod === "RECOVERY" && (
                <form className="space-y-4" onSubmit={handle2FASubmit}>
                  <div>
                    <label
                      htmlFor="recovery-code"
                      className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
                    >
                      Backup Recovery Code
                    </label>
                    <input
                      id="recovery-code"
                      type="text"
                      autoFocus
                      required
                      placeholder="RB-XXXX-XXXX"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      className="w-full rounded-xl px-3.5 py-2.5 text-center font-mono text-sm tracking-wider font-bold border border-white/[0.09] bg-[#080B12] text-white placeholder-slate-500 transition focus:outline-hidden focus:border-amber-500/60"
                    />
                  </div>

                  {/* Trusted Device Checkbox */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-slate-300">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(e) => setTrustDevice(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-[#080B12] text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span>Trust this device for 30 days</span>
                  </label>

                  <button
                    type="submit"
                    disabled={verifying2fa || !recoveryCode.trim()}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
                  >
                    {verifying2fa ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                        <span>Verifying Recovery Code...</span>
                      </>
                    ) : (
                      "Submit Recovery Code"
                    )}
                  </button>
                </form>
              )}

              <div className="pt-3 text-center border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-[11px] text-slate-400 hover:text-amber-400 hover:underline cursor-pointer transition"
                >
                  &larr; Back to password sign in
                </button>
              </div>
            </div>
          )}

          {/* Footer Security Notice */}
          <div className="mt-6 pt-5 border-t border-white/[0.06] text-center space-y-2">
            <p className="text-[10px] text-slate-500 font-mono">
              🔒 256-Bit TLS Secured • Resto Bird Cloud OS
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
