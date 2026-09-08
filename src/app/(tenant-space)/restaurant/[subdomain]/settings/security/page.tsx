"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  remainingRecoveryCodes: number;
}

export default function SecuritySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) || "";

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = localStorage.getItem("platform_admin_theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);
  const isDark = theme === "dark";

  // State
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Setup Modal State
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showManualKey, setShowManualKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Recovery Codes Modal State (shown right after activation)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [codesSavedConfirmed, setCodesSavedConfirmed] = useState(false);

  // Disable Modal State
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableOtp, setDisableOtp] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Fetch 2FA Status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurant/auth/2fa/status");
      if (res.status === 401) {
        router.push(`/restaurant/${subdomain}/login`);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      } else {
        setError(data.error || "Failed to load security status");
      }
    } catch {
      setError("Network error loading security settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [subdomain]);

  // Start 2FA Setup
  const handleStartSetup = async () => {
    setSetupLoading(true);
    setVerifyError(null);
    setVerificationCode("");
    setShowManualKey(false);
    setCopiedKey(false);

    try {
      const res = await fetch("/api/restaurant/auth/2fa/setup", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate setup");
      }

      setQrCodeUrl(data.qrCode);
      setManualKey(data.manualKey);
      setSetupModalOpen(true);
    } catch (err: any) {
      setError(err.message || "Failed to initialize 2FA");
    } finally {
      setSetupLoading(false);
    }
  };

  // Verify and Activate 2FA
  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      setVerifyError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);

    try {
      const res = await fetch("/api/restaurant/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      // Success: Save recovery codes and show recovery codes screen
      setGeneratedCodes(data.recoveryCodes || []);
      setSetupModalOpen(false);
      setSuccessMsg("Two-Factor Authentication is now active!");
      fetchStatus();
    } catch (err: any) {
      setVerifyError(err.message || "Invalid authentication code");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword && !disableOtp) {
      setDisableError("Please enter your current password or a 6-digit code.");
      return;
    }

    setDisableLoading(true);
    setDisableError(null);

    try {
      const res = await fetch("/api/restaurant/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: disablePassword || undefined,
          token: disableOtp || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to disable 2FA");
      }

      setDisableModalOpen(false);
      setDisablePassword("");
      setDisableOtp("");
      setSuccessMsg("Two-factor authentication has been disabled.");
      fetchStatus();
    } catch (err: any) {
      setDisableError(err.message || "Failed to disable 2FA");
    } finally {
      setDisableLoading(false);
    }
  };

  // Copy Manual Key
  const handleCopyKey = () => {
    if (manualKey) {
      navigator.clipboard.writeText(manualKey.replace(/\s+/g, ""));
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  // Copy Recovery Codes
  const handleCopyCodes = () => {
    if (generatedCodes.length) {
      const text = `RESTO BIRD — BACKUP RECOVERY CODES\nAccount Subdomain: ${subdomain}\nGenerated: ${new Date().toLocaleString()}\n\n${generatedCodes.join(
        "\n"
      )}\n\n* Each recovery code can only be used once. Keep these strictly confidential.`;
      navigator.clipboard.writeText(text);
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2500);
    }
  };

  // Download Recovery Codes File
  const handleDownloadCodes = () => {
    if (!generatedCodes.length) return;
    const text = `RESTO BIRD — BACKUP RECOVERY CODES\nAccount Subdomain: ${subdomain}\nGenerated: ${new Date().toLocaleString()}\n\n${generatedCodes.join(
      "\n"
    )}\n\n* Each recovery code can only be used once. Keep these strictly confidential.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resto-bird-recovery-codes-${subdomain}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen font-sans ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"}`}>
      <RestaurantNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
                Administration &bull; Settings
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Security &amp; Multi-Factor Auth</h1>
            <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Manage restaurant administrative multi-factor authentication, TOTP credentials, and recovery codes.
            </p>
          </div>

          <button
            onClick={() => router.push(`/restaurant/${subdomain}/settings/profile`)}
            className={`self-start sm:self-auto px-3.5 py-2 text-xs font-medium rounded-xl border transition cursor-pointer ${
              isDark
                ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            &larr; Restaurant Profile
          </button>
        </div>

        {/* Global Notifications */}
        {error && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium border flex items-center justify-between animate-in fade-in duration-200 ${
              isDark ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-3 font-bold opacity-60 hover:opacity-100">
              &times;
            </button>
          </div>
        )}

        {successMsg && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium border flex items-center justify-between animate-in fade-in duration-200 ${
              isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="ml-3 font-bold opacity-60 hover:opacity-100">
              &times;
            </button>
          </div>
        )}

        {/* 2FA Main Hero Card */}
        <section
          className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden backdrop-blur-xl transition-all ${
            isDark ? "bg-[#121622]/90 border-white/[0.08] shadow-black/40" : "bg-white border-slate-200 shadow-slate-900/5"
          }`}
        >
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <span className="w-6 h-6 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
              <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Loading security configuration...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      status?.enabled
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold">Two-Factor Authentication (TOTP)</h2>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          status?.enabled
                            ? isDark
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : isDark
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${status?.enabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
                        />
                        {status?.enabled ? "Active & Enforced" : "Not Enabled"}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 max-w-xl leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Protect your Resto Bird administrator workspace from unauthorized access. When active, signing in requires your
                      password plus a 6-digit rolling code generated by your authenticator app.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {status?.enabled ? (
                    <button
                      onClick={() => {
                        setDisableError(null);
                        setDisablePassword("");
                        setDisableOtp("");
                        setDisableModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition cursor-pointer"
                    >
                      Disable 2FA
                    </button>
                  ) : (
                    <button
                      onClick={handleStartSetup}
                      disabled={setupLoading}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {setupLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Generating Keys...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Enable Authenticator 2FA</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Status Details when Enabled */}
              {status?.enabled && (
                <div
                  className={`grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t ${
                    isDark ? "border-white/[0.06]" : "border-slate-100"
                  }`}
                >
                  <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Protection Standard
                    </span>
                    <p className="text-xs font-semibold mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      RFC 6238 Standard TOTP (30s)
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Activated On
                    </span>
                    <p className="text-xs font-semibold mt-1">
                      {status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Active"}
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Remaining Recovery Codes
                    </span>
                    <p className="text-xs font-semibold mt-1 flex items-center gap-1.5">
                      <span className="font-mono text-sm text-[#0071E3] font-bold">{status.remainingRecoveryCodes}</span>
                      <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>unused backup codes</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Informational Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className={`p-6 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            } space-y-3`}
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              📱
            </div>
            <h3 className="text-sm font-semibold">Supported Authenticator Apps</h3>
            <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
              Resto Bird TOTP is compatible with all standard authenticator applications including:
            </p>
            <ul className={`text-xs space-y-1.5 pl-4 list-disc ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
              <li>Google Authenticator (iOS &amp; Android)</li>
              <li>Apple Passwords &amp; Keychain (iOS &amp; macOS)</li>
              <li>Microsoft Authenticator</li>
              <li>1Password, Bitwarden, and Authy</li>
            </ul>
          </div>

          <div
            className={`p-6 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            } space-y-3`}
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
              🛡️
            </div>
            <h3 className="text-sm font-semibold">Enterprise Protection Architecture</h3>
            <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
              Our restaurant MFA incorporates bank-grade defense parameters:
            </p>
            <ul className={`text-xs space-y-1.5 pl-4 list-disc ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
              <li>Field-level AES-256-GCM encrypted database credentials</li>
              <li>Single-use cryptographic SHA-256 hashed recovery codes</li>
              <li>Strict 5-attempt rate limits to prevent brute-force attacks</li>
              <li>Immutable security audit logging for all MFA events</li>
            </ul>
          </div>
        </div>

        {/* MODAL 1: 2FA Setup Flow */}
        {setupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className={`max-w-md w-full p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Set Up Authenticator App</h3>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Step 1 of 2: Scan QR Code</p>
                </div>
                <button
                  onClick={() => setSetupModalOpen(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                    isDark ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  &times;
                </button>
              </div>

              {/* Instructions */}
              <div className="space-y-2 text-xs">
                <p className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                  1. Open your authenticator app (Google Authenticator, Apple Passwords, etc.).
                </p>
                <p className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                  2. Tap the <strong>+</strong> button and scan this QR code:
                </p>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-52 h-52 object-contain" />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-400">Generating QR...</div>
                  )}
                </div>

                {/* Manual Code Option */}
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShowManualKey(!showManualKey)}
                    className="text-[11px] text-[#0071E3] hover:underline font-medium cursor-pointer"
                  >
                    {showManualKey ? "Hide manual setup key" : "Can't scan? Enter code manually"}
                  </button>

                  {showManualKey && manualKey && (
                    <div
                      className={`mt-2 p-3 rounded-xl border text-left space-y-1.5 ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Account Key (Manual Setup)
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-mono font-bold tracking-wider select-all break-all">{manualKey}</code>
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition shrink-0 cursor-pointer ${
                            copiedKey
                              ? "bg-emerald-500 text-white"
                              : isDark
                              ? "bg-white/[0.08] hover:bg-white/[0.15] text-white"
                              : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                          }`}
                        >
                          {copiedKey ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 Verification */}
              <form onSubmit={handleVerifySetup} className="space-y-4 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div>
                  <label htmlFor="verify-code" className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Enter 6-Digit Code from App
                  </label>
                  <input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`w-full rounded-xl px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] font-bold border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.1] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                {verifyError && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border text-center ${
                      isDark ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    {verifyError}
                  </div>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSetupModalOpen(false)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isDark ? "border-white/[0.08] hover:bg-white/[0.04] text-white" : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifyLoading || verificationCode.length !== 6}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {verifyLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      "Verify & Enable"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Backup Recovery Codes Display (shown upon activation) */}
        {generatedCodes.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className={`max-w-lg w-full p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold">Save Your Backup Recovery Codes</h3>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    If you lose your phone or authenticator access, each code below will allow you to sign in to Resto Bird once.
                    Store these in a safe place.
                  </p>
                </div>
              </div>

              {/* Codes Grid */}
              <div
                className={`p-4 rounded-2xl border font-mono text-xs ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="grid grid-cols-2 gap-2.5 text-center">
                  {generatedCodes.map((c) => (
                    <div
                      key={c}
                      className={`p-2 rounded-lg font-bold select-all tracking-wider ${
                        isDark ? "bg-white/[0.04] text-blue-300" : "bg-white border border-slate-200 text-blue-700 shadow-xs"
                      }`}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyCodes}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    copiedCodes
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : isDark
                      ? "border-white/[0.1] hover:bg-white/[0.06] text-white"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{copiedCodes ? "Codes Copied!" : "Copy All Codes"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCodes}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    isDark ? "border-white/[0.1] hover:bg-white/[0.06] text-white" : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Download .txt</span>
                </button>
              </div>

              {/* Confirmation Checkbox */}
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-3">
                <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={codesSavedConfirmed}
                    onChange={(e) => setCodesSavedConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-[#0071E3] focus:ring-0 cursor-pointer"
                  />
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                    I have saved these recovery codes in a secure place. I understand they will not be shown again.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!codesSavedConfirmed}
                  onClick={() => setGeneratedCodes([])}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white transition shadow-sm disabled:opacity-40 cursor-pointer"
                >
                  Complete Setup &amp; Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: Disable 2FA */}
        {disableModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className={`max-w-md w-full p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-5 ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-rose-500">Disable Two-Factor Authentication</h3>
                <button
                  onClick={() => setDisableModalOpen(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                    isDark ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  &times;
                </button>
              </div>

              <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                Disabling 2FA reduces account security. To proceed, please confirm your current login password or provide a valid
                6-digit authenticator code.
              </p>

              <form onSubmit={handleDisable2FA} className="space-y-4">
                <div>
                  <label htmlFor="disable-pw" className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Your Password
                  </label>
                  <input
                    id="disable-pw"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition focus:outline-none focus:border-rose-500 border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="grow border-t border-black/[0.06] dark:border-white/[0.06]" />
                  <span className={`shrink mx-3 text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-[#5E6573]" : "text-slate-400"}`}>
                    Or
                  </span>
                  <div className="grow border-t border-black/[0.06] dark:border-white/[0.06]" />
                </div>

                <div>
                  <label htmlFor="disable-otp" className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Current 6-Digit Authenticator Code
                  </label>
                  <input
                    id="disable-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={disableOtp}
                    onChange={(e) => setDisableOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-center font-mono text-sm tracking-widest transition focus:outline-none focus:border-rose-500 border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                {disableError && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border text-center ${
                      isDark ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    {disableError}
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisableModalOpen(false)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isDark ? "border-white/[0.08] hover:bg-white/[0.04] text-white" : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    Keep 2FA Active
                  </button>
                  <button
                    type="submit"
                    disabled={disableLoading || (!disablePassword && disableOtp.length !== 6)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {disableLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Disabling...</span>
                      </>
                    ) : (
                      "Confirm Disable"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
