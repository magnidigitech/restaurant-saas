"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState("");

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

  // Passkey Login Flow
  const handlePasskeySignIn = async () => {
    setError("");
    setPasskeyLoading(true);

    try {
      const optRes = await fetch("/api/platform-admin/auth/passkeys/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });

      const options = await optRes.json();
      if (!optRes.ok) {
        throw new Error(options.error || "Could not initialize passkey sign in");
      }

      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: options });
      } catch (authErr: any) {
        if (authErr.name === "NotAllowedError") {
          throw new Error("Passkey prompt was cancelled or timed out.");
        }
        throw new Error(authErr.message || "Passkey authentication was not completed.");
      }

      const verifyRes = await fetch("/api/platform-admin/auth/passkeys/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: asseResp,
          expectedChallenge: options.challenge,
          trustDevice,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Passkey verification failed");
      }

      router.push("/platform-admin/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Passkey authentication error");
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Password Login Flow
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/platform-admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

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

      router.push("/platform-admin/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // 2FA Verification Flow
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const isRecovery = mfaMethod === "RECOVERY";
    const codeToVerify = isRecovery ? recoveryCode.trim().toUpperCase() : otpCode.trim();
    if (!codeToVerify) {
      setError(isRecovery ? "Please enter backup recovery code" : "Please enter the 6-digit code");
      return;
    }

    setVerifying2fa(true);
    try {
      const res = await fetch("/api/platform-admin/auth/2fa/challenge", {
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

      router.push("/platform-admin/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setVerifying2fa(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#07090e] px-3 sm:px-4 py-8 sm:py-12 text-slate-100 overflow-hidden font-sans selection:bg-amber-500 selection:text-black">
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[480px] bg-gradient-to-b from-amber-500/10 via-amber-600/5 to-transparent rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-[500px] h-[400px] bg-blue-600/[0.04] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      {/* Main Card Container */}
      <div className="relative w-full max-w-[440px] rounded-3xl bg-[#0d121c]/90 backdrop-blur-2xl border border-white/[0.08] p-5 sm:p-9 shadow-[0_30px_80px_rgba(0,0,0,0.8),0_0_50px_rgba(245,158,11,0.06)]">
        {/* Subtle Top Border Glow Accent */}
        <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        {/* Header with Resto Bird Logo */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-7">
          <div className="relative mb-3 flex items-center justify-center">
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-600/20 rounded-2xl blur-xl" />
            <img
              src="/resto-bird-logo.png"
              alt="Resto Bird"
              className="relative h-10 sm:h-12 w-auto object-contain drop-shadow-md"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-wider mb-2 sm:mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Super Admin Console
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {step === "2FA" ? "Security Verification" : "Super Admin Portal"}
          </h1>
          <p className="mt-1 text-xs text-slate-400 max-w-[290px]">
            {step === "2FA"
              ? "Multi-factor authentication required for privileged infrastructure access"
              : "Resto Bird Platform Infrastructure & Tenant Operations"}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs px-4 py-3 rounded-xl font-medium mb-6 animate-in fade-in duration-200">
            <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="flex-1 text-left">{error}</span>
          </div>
        )}

        {/* STEP 1: CREDENTIALS */}
        {step === "CREDENTIALS" && (
          <div className="space-y-4 sm:space-y-5">
            {/* Instant Passkey Login */}
            <button
              type="button"
              onClick={handlePasskeySignIn}
              disabled={passkeyLoading}
              className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl text-xs font-semibold bg-gradient-to-b from-white/[0.07] to-white/[0.03] hover:from-white/[0.11] hover:to-white/[0.05] border border-white/[0.11] hover:border-amber-400/40 text-white transition-all flex items-center justify-between gap-2 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] group disabled:opacity-50"
            >
              {passkeyLoading ? (
                <div className="w-full flex items-center justify-center gap-2 py-0.5">
                  <span className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin shrink-0" />
                  <span className="text-amber-200 text-xs truncate">Awaiting Sensor Response...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <span className="font-medium text-slate-100 text-xs whitespace-nowrap">
                      Sign in with Passkey
                    </span>
                  </div>
                  <span className="text-[9.5px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300/90 font-mono whitespace-nowrap shrink-0">
                    Touch ID / Key
                  </span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex items-center my-4">
              <div className="flex-grow border-t border-white/[0.08]" />
              <span className="flex-shrink mx-3 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                or password
              </span>
              <div className="flex-grow border-t border-white/[0.08]" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email-address" className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      WebkitBoxShadow: "0 0 0 1000px #090d15 inset",
                      WebkitTextFillColor: "#ffffff",
                    }}
                    className="block w-full px-4 py-2.5 rounded-xl border border-white/[0.1] bg-[#090d15] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 text-xs transition-all font-sans"
                    placeholder="admin@restobird.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      WebkitBoxShadow: "0 0 0 1000px #090d15 inset",
                      WebkitTextFillColor: "#ffffff",
                    }}
                    className="block w-full px-4 py-2.5 pr-11 rounded-xl border border-white/[0.1] bg-[#090d15] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 text-xs transition-all font-sans"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_6px_25px_rgba(245,158,11,0.35)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Sign In with Password</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: 2FA CHALLENGE */}
        {step === "2FA" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#090d15] border border-white/[0.08] text-xs">
              {hasPasskeys && (
                <button
                  type="button"
                  onClick={() => { setMfaMethod("PASSKEY"); setError(""); }}
                  className={`py-2 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                    mfaMethod === "PASSKEY"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Passkey
                </button>
              )}
              <button
                type="button"
                onClick={() => { setMfaMethod("TOTP"); setError(""); }}
                className={`py-2 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  mfaMethod === "TOTP"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Authenticator
              </button>
              <button
                type="button"
                onClick={() => { setMfaMethod("RECOVERY"); setError(""); }}
                className={`py-2 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  mfaMethod === "RECOVERY"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Recovery
              </button>
            </div>

            {mfaMethod === "PASSKEY" && (
              <div className="space-y-3 py-2 text-center">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                  Scan Touch ID, Face ID, or insert your hardware security key.
                </div>
                <button
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={passkeyLoading}
                  className="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] cursor-pointer"
                >
                  {passkeyLoading ? "Prompting Sensor..." : "Verify with Passkey"}
                </button>
              </div>
            )}

            {mfaMethod === "TOTP" && (
              <form className="space-y-4" onSubmit={handle2FASubmit}>
                <div>
                  <label htmlFor="otp" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
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
                    style={{
                      WebkitBoxShadow: "0 0 0 1000px #090d15 inset",
                      WebkitTextFillColor: "#ffffff",
                    }}
                    className="w-full rounded-xl px-4 py-3 text-center font-mono text-xl tracking-[0.4em] font-bold border border-white/[0.1] bg-[#090d15] text-white focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none text-slate-300">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-[#090d15] text-amber-500 focus:ring-amber-500/40 accent-amber-500"
                  />
                  <span className="text-slate-400 text-[11.5px]">Trust this device for 30 days (bypass OTP)</span>
                </label>

                <button
                  type="submit"
                  disabled={verifying2fa || otpCode.length !== 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying2fa ? "Verifying Code..." : "Verify & Complete Sign In"}
                </button>
              </form>
            )}

            {mfaMethod === "RECOVERY" && (
              <form className="space-y-4" onSubmit={handle2FASubmit}>
                <div>
                  <label htmlFor="recovery-code" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
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
                    style={{
                      WebkitBoxShadow: "0 0 0 1000px #090d15 inset",
                      WebkitTextFillColor: "#ffffff",
                    }}
                    className="w-full rounded-xl px-4 py-2.5 text-center font-mono text-xs tracking-widest font-bold border border-white/[0.1] bg-[#090d15] text-amber-300 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none text-slate-300">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-[#090d15] text-amber-500 focus:ring-amber-500/40 accent-amber-500"
                  />
                  <span className="text-slate-400 text-[11.5px]">Trust this device for 30 days (bypass OTP)</span>
                </label>

                <button
                  type="submit"
                  disabled={verifying2fa || !recoveryCode.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying2fa ? "Verifying..." : "Submit Recovery Code"}
                </button>
              </form>
            )}

            <div className="pt-2 text-center border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setStep("CREDENTIALS");
                  setError("");
                }}
                className="text-[11px] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                &larr; Back to password sign in
              </button>
            </div>
          </div>
        )}

        {/* Footer Security Badge */}
        <div className="pt-5 mt-6 border-t border-white/[0.06] flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
          <svg className="w-3.5 h-3.5 text-amber-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Resto Bird Enterprise Multi-Tenant Security</span>
        </div>
      </div>
    </main>
  );
}
