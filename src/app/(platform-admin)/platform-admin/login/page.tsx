"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.962 8.962 0 013.682-.763c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18"
        />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
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
  const [mfaMethod, setMfaMethod] = useState<"TOTP" | "PASSKEY" | "EMAIL" | "RECOVERY">("TOTP");
  const [challengeToken, setChallengeToken] = useState("");
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const [hasTotp, setHasTotp] = useState(true);
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [verifying2fa, setVerifying2fa] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentInfo, setEmailSentInfo] = useState<string | null>(null);

  const handleSendEmailCode = async () => {
    setError("");
    setEmailSending(true);
    try {
      const res = await fetch("/api/platform-admin/auth/2fa/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email verification code");
      setEmailSentInfo(data.message || "Verification code sent to your email!");
      setMfaMethod("EMAIL");
    } catch (err: any) {
      setError(err.message || "Failed to send email code");
    } finally {
      setEmailSending(false);
    }
  };

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
        setEmailSentInfo(null);
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
    const isEmail = mfaMethod === "EMAIL";
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
          isEmailCode: isEmail,
          method: mfaMethod,
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-2xl backdrop-blur-xl mb-1">
            <img
              src="/resto-bird-logo.png"
              alt="Resto Bird Platform"
              className="h-10 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Platform Super Admin</h1>
          <p className="text-xs text-slate-400">Enterprise Tenant & Security Management Console</p>
        </div>

        {/* Card */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[#0e131f]/90 border border-white/[0.1] shadow-2xl backdrop-blur-2xl">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-300 text-center animate-shake">
              {error}
            </div>
          )}

          {/* STEP 1: LOGIN CREDENTIALS */}
          {step === "CREDENTIALS" && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Admin Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="admin@restobird.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    WebkitBoxShadow: "0 0 0 1000px #090d15 inset",
                    WebkitTextFillColor: "#ffffff",
                  }}
                  className="w-full rounded-xl px-4 py-3 text-xs font-medium border border-white/[0.1] bg-[#090d15] text-white focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-slate-600"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      WebkitBoxShadow: "0 0 0 1000px #090d15 inset",
                      WebkitTextFillColor: "#ffffff",
                    }}
                    className="w-full rounded-xl px-4 py-3 pr-11 text-xs font-medium border border-white/[0.1] bg-[#090d15] text-white focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-slate-600"
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
                {loading ? "Authenticating..." : "Sign In to Platform Admin"}
              </button>
            </form>
          )}

          {/* STEP 2: 2FA CHALLENGE */}
          {step === "2FA" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#090d15] border border-white/[0.08] text-[11px]">
                {hasPasskeys && (
                  <button
                    type="button"
                    onClick={() => { setMfaMethod("PASSKEY"); setError(""); }}
                    className={`py-2 px-1 rounded-lg font-medium transition cursor-pointer text-center ${
                      mfaMethod === "PASSKEY"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Passkey
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMfaMethod("TOTP"); setError(""); }}
                  className={`py-2 px-1 rounded-lg font-medium transition cursor-pointer text-center ${
                    mfaMethod === "TOTP"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  App OTP
                </button>
                <button
                  type="button"
                  onClick={() => { setMfaMethod("EMAIL"); setError(""); }}
                  className={`py-2 px-1 rounded-lg font-medium transition cursor-pointer text-center ${
                    mfaMethod === "EMAIL"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setMfaMethod("RECOVERY"); setError(""); }}
                  className={`py-2 px-1 rounded-lg font-medium transition cursor-pointer text-center ${
                    mfaMethod === "RECOVERY"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Backup
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

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleSendEmailCode}
                      disabled={emailSending}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                    >
                      {emailSending ? "Sending Code to Email..." : "Try another way: Send code to Email"}
                    </button>
                  </div>
                </form>
              )}

              {mfaMethod === "EMAIL" && (
                <div className="space-y-4">
                  {emailSentInfo ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300 text-center">
                      {emailSentInfo}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 text-center">
                      Click below to send a 6-digit single-use login code to your registered email address.
                    </div>
                  )}

                  {!emailSentInfo ? (
                    <button
                      type="button"
                      onClick={handleSendEmailCode}
                      disabled={emailSending}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {emailSending ? "Sending Email Code..." : "Send Verification Code to Email"}
                    </button>
                  ) : (
                    <form className="space-y-4" onSubmit={handle2FASubmit}>
                      <div>
                        <label htmlFor="email-otp" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
                          6-Digit Email Verification Code
                        </label>
                        <input
                          id="email-otp"
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
                        {verifying2fa ? "Verifying Email Code..." : "Verify & Complete Sign In"}
                      </button>

                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={handleSendEmailCode}
                          disabled={emailSending}
                          className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                        >
                          {emailSending ? "Resending..." : "Resend Code to Email"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
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
        </div>

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
