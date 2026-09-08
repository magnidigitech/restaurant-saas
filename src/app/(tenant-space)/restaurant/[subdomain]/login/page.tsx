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
    <svg className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

  // Theme check from local storage (default: light)
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("platform_admin_theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const isDark = theme === "dark";

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
        throw new Error(options.error || "Could not initialize passkey sign in");
      }

      // 2. Prompt user biometrics via WebAuthn API
      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: options });
      } catch (authErr: any) {
        if (authErr.name === "NotAllowedError") {
          throw new Error("Passkey prompt was cancelled or timed out.");
        }
        throw new Error(authErr.message || "Passkey authentication was not completed.");
      }

      // 3. Verify assertion with server
      const verifyRes = await fetch("/api/restaurant/auth/passkeys/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: asseResp,
          expectedChallenge: options.challenge,
          subdomain,
          trustDevice,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Passkey verification failed");
      }

      router.push(`/restaurant/${subdomain}/dashboard`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Passkey authentication error");
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Password Submit Flow
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
        throw new Error(data.error || "Invalid credentials. Please verify your email and password.");
      }

      // Check if account requires 2FA challenge
      if (data.requiresTwoFactor && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setHasPasskeys(!!data.hasPasskeys);
        setHasTotp(!!data.hasTotp);
        setStep("2FA");
        setOtpCode("");
        setRecoveryCode("");
        setMfaMethod(data.hasPasskeys ? "PASSKEY" : "TOTP");
        return;
      }

      router.push(`/restaurant/${subdomain}/dashboard`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // 2FA Verification Submit Flow
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const isRecovery = mfaMethod === "RECOVERY";
    const codeToVerify = isRecovery ? recoveryCode.trim().toUpperCase() : otpCode.trim();
    if (!codeToVerify) {
      setError(isRecovery ? "Please enter your backup recovery code" : "Please enter the 6-digit code");
      return;
    }

    setVerifying2fa(true);
    try {
      const res = await fetch("/api/restaurant/auth/2fa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          code: codeToVerify,
          isRecoveryCode: isRecovery,
          trustDevice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed. Please check your code.");
      }

      router.push(`/restaurant/${subdomain}/dashboard`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Verification code failed");
    } finally {
      setVerifying2fa(false);
    }
  };

  const handleBackToLogin = () => {
    setStep("CREDENTIALS");
    setChallengeToken("");
    setOtpCode("");
    setRecoveryCode("");
    setMfaMethod("TOTP");
    setError("");
  };

  if (pageLoading) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center font-sans ${
          isDark ? "bg-[#090B10] text-[#8F95A3]" : "bg-[#F5F5F7] text-slate-500"
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-[#0071E3] animate-pulse" />
          <span>Loading workspace...</span>
        </div>
      </main>
    );
  }

  if (branding && branding.status !== "ACTIVE") {
    return (
      <main
        className={`flex min-h-screen items-center justify-center px-4 font-sans ${
          isDark ? "bg-[#090B10]" : "bg-[#F5F5F7]"
        }`}
      >
        <div
          className={`max-w-md w-full p-8 rounded-3xl border shadow-2xl text-center space-y-4 ${
            isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            Workspace Inactive
          </h2>
          <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
            Access to <span className="font-semibold">{branding.name}</span> has been {branding.status.toLowerCase()}.
          </p>
          <p className="text-[11px] text-slate-400">
            Please contact your system administrator for assistance.
          </p>
        </div>
      </main>
    );
  }

  const buttonBgColor =
    branding?.primaryColor &&
    branding.primaryColor !== "#ffffff" &&
    branding.primaryColor !== "#fff" &&
    branding.primaryColor !== "rgb(255, 255, 255)"
      ? branding.primaryColor
      : "#0071E3";

  return (
    <main
      className={`min-h-screen flex flex-col justify-center items-center px-4 py-12 font-sans antialiased selection:bg-blue-500 selection:text-white transition-colors duration-200 ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <div className="w-full max-w-[420px] space-y-6">
        {/* Card */}
        <div
          className={`p-8 rounded-3xl border shadow-2xl space-y-6 backdrop-blur-xl transition-all ${
            isDark
              ? "bg-[#121622]/90 border-white/[0.08] shadow-black/80"
              : "bg-white/95 border-black/[0.06] shadow-slate-900/5"
          }`}
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              {step === "2FA" ? (
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-sm bg-blue-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              ) : branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain" />
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-sm"
                  style={{ backgroundColor: buttonBgColor }}
                >
                  {branding?.name ? branding.name.charAt(0).toUpperCase() : "R"}
                </div>
              )}
            </div>

            <h1 className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {step === "2FA" ? "Choose Verification Method" : branding?.name || "Restaurant Workspace"}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              {step === "2FA"
                ? "Protecting your restaurant identity and management access"
                : `${subdomain}.restobird.com`}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className={`p-3 rounded-2xl text-xs font-medium border text-center animate-in fade-in duration-200 ${
                isDark
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {error}
            </div>
          )}

          {/* STEP 1: Passkey or Password Form */}
          {step === "CREDENTIALS" && (
            <div className="space-y-4">
              {/* Primary Passkey Action */}
              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className={`w-full py-3 px-4 rounded-2xl text-xs font-semibold border transition flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] ${
                  isDark
                    ? "bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.12] text-white"
                    : "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-900"
                }`}
              >
                {passkeyLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Passkey...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>Continue with Passkey</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-normal">Fast</span>
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className={`flex-grow border-t ${isDark ? "border-white/[0.08]" : "border-slate-200"}`}></div>
                <span className={`flex-shrink mx-3 text-[11px] uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  or password
                </span>
                <div className={`flex-grow border-t ${isDark ? "border-white/[0.08]" : "border-slate-200"}`}></div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="email"
                    className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}
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
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition focus:outline-none focus:border-[#0071E3] border ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}
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
                      className={`w-full rounded-xl px-3.5 py-2.5 pr-10 text-xs transition focus:outline-none focus:border-[#0071E3] border ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                          : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 p-0.5 cursor-pointer"
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
                  style={{ backgroundColor: buttonBgColor }}
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    "Continue with Password"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Enterprise Multi-Factor Selector */}
          {step === "2FA" && (
            <div className="space-y-4">
              {/* Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-200/50 dark:bg-white/[0.06] text-xs">
                {hasPasskeys && (
                  <button
                    type="button"
                    onClick={() => {
                      setMfaMethod("PASSKEY");
                      setError("");
                    }}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                      mfaMethod === "PASSKEY"
                        ? "bg-white dark:bg-[#1E2433] shadow-sm text-blue-600 dark:text-blue-400"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
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
                      ? "bg-white dark:bg-[#1E2433] shadow-sm text-blue-600 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
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
                      ? "bg-white dark:bg-[#1E2433] shadow-sm text-blue-600 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Recovery
                </button>
              </div>

              {/* Passkey Verification Option */}
              {mfaMethod === "PASSKEY" && (
                <div className="space-y-3 py-2 text-center">
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                    Use Face ID, Touch ID, Windows Hello, or your hardware security key to complete verification.
                  </div>
                  <button
                    type="button"
                    onClick={handlePasskeySignIn}
                    disabled={passkeyLoading}
                    className="w-full py-3 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {passkeyLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                      className={`block text-xs font-medium mb-1.5 text-center ${
                        isDark ? "text-[#8F95A3]" : "text-slate-600"
                      }`}
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
                      className={`w-full rounded-xl px-4 py-3 text-center font-mono text-xl tracking-[0.4em] font-bold border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.1] text-white"
                          : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Trusted Device Checkbox */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(e) => setTrustDevice(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={isDark ? "text-slate-300" : "text-slate-700"}>
                      Trust this device for 30 days
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={verifying2fa || otpCode.length !== 6}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2 bg-[#0071E3]"
                  >
                    {verifying2fa ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                      className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}
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
                      className={`w-full rounded-xl px-3.5 py-2.5 text-center font-mono text-sm tracking-wider font-bold border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.1] text-white placeholder-[#5E6573]"
                          : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                  </div>

                  {/* Trusted Device Checkbox */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(e) => setTrustDevice(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={isDark ? "text-slate-300" : "text-slate-700"}>
                      Trust this device for 30 days
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={verifying2fa || !recoveryCode.trim()}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2 bg-[#0071E3]"
                  >
                    {verifying2fa ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying Recovery Code...</span>
                      </>
                    ) : (
                      "Submit Recovery Code"
                    )}
                  </button>
                </form>
              )}

              <div className="pt-3 text-center border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className={`text-[11px] hover:underline cursor-pointer ${
                    isDark ? "text-[#8F95A3]" : "text-slate-500"
                  }`}
                >
                  &larr; Back to password sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
