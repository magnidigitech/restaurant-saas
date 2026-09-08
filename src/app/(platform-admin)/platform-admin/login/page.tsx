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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="w-full max-w-md space-y-8 bg-slate-900/50 p-8 rounded-2xl border border-slate-800 backdrop-blur-md shadow-2xl">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
            🛡️
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            {step === "2FA" ? "Super Admin Verification" : "Super Admin Portal"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {step === "2FA"
              ? "Provide second-factor authentication to continue"
              : "Resto Bird Platform Infrastructure & Tenant Management"}
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 text-xs px-4 py-3 rounded-xl text-center font-medium animate-in fade-in">
            {error}
          </div>
        )}

        {/* STEP 1: CREDENTIALS */}
        {step === "CREDENTIALS" && (
          <div className="space-y-5">
            {/* Instant Passkey Login */}
            <button
              type="button"
              onClick={handlePasskeySignIn}
              disabled={passkeyLoading}
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/20 text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              {passkeyLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Prompting Sensor...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>Continue with Passkey</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-normal">Touch ID / Security Key</span>
                </>
              )}
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-slate-500">
                or password
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email-address" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Email Address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all"
                  placeholder="admin@platform.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? "Verifying..." : "Sign In with Password"}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: 2FA CHALLENGE */}
        {step === "2FA" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {hasPasskeys && (
                <button
                  type="button"
                  onClick={() => { setMfaMethod("PASSKEY"); setError(""); }}
                  className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                    mfaMethod === "PASSKEY" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Passkey
                </button>
              )}
              <button
                type="button"
                onClick={() => { setMfaMethod("TOTP"); setError(""); }}
                className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  mfaMethod === "TOTP" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Authenticator
              </button>
              <button
                type="button"
                onClick={() => { setMfaMethod("RECOVERY"); setError(""); }}
                className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  mfaMethod === "RECOVERY" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Recovery
              </button>
            </div>

            {mfaMethod === "PASSKEY" && (
              <div className="space-y-3 py-2 text-center">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                  Scan Touch ID, Face ID, or your hardware security key.
                </div>
                <button
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={passkeyLoading}
                  className="w-full py-3 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer"
                >
                  {passkeyLoading ? "Prompting Sensor..." : "Verify with Passkey"}
                </button>
              </div>
            )}

            {mfaMethod === "TOTP" && (
              <form className="space-y-4" onSubmit={handle2FASubmit}>
                <div>
                  <label htmlFor="otp" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
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
                    className="w-full rounded-xl px-4 py-3 text-center font-mono text-xl tracking-[0.4em] font-bold border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-slate-300">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Trust this device for 30 days (bypass OTP)</span>
                </label>

                <button
                  type="submit"
                  disabled={verifying2fa || otpCode.length !== 6}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {verifying2fa ? "Verifying Code..." : "Verify & Complete Sign In"}
                </button>
              </form>
            )}

            {mfaMethod === "RECOVERY" && (
              <form className="space-y-4" onSubmit={handle2FASubmit}>
                <div>
                  <label htmlFor="recovery-code" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                    className="w-full rounded-xl px-4 py-2.5 text-center font-mono text-xs tracking-widest font-bold border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-slate-300">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Trust this device for 30 days (bypass OTP)</span>
                </label>

                <button
                  type="submit"
                  disabled={verifying2fa || !recoveryCode.trim()}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {verifying2fa ? "Verifying..." : "Submit Recovery Code"}
                </button>
              </form>
            )}

            <div className="pt-2 text-center border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setStep("CREDENTIALS");
                  setError("");
                }}
                className="text-[11px] text-slate-400 hover:underline cursor-pointer"
              >
                &larr; Back to password sign in
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
