"use client";

import React, { useState, useEffect } from "react";
import { startRegistration } from "@simplewebauthn/browser";

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  remainingRecoveryCodes: number;
  passkeysCount: number;
  trustedDevicesCount: number;
  activeSessionsCount: number;
}

interface PasskeyItem {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface TrustedDeviceItem {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

interface SessionItem {
  id: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

interface SecurityTabProps {
  isDark: boolean;
}

export default function SecurityTab({ isDark }: SecurityTabProps) {
  // Navigation within Security Tab: "OVERVIEW" | "PASSKEYS" | "AUTHENTICATOR" | "DEVICES"
  const [subTab, setSubTab] = useState<"OVERVIEW" | "PASSKEYS" | "AUTHENTICATOR" | "DEVICES">("OVERVIEW");

  // Core Data
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [devices, setDevices] = useState<TrustedDeviceItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  // Alerts
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Passkey Modal
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [registeringPasskey, setRegisteringPasskey] = useState(false);

  // TOTP Modal
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Recovery Codes Modal
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Sign out all sessions loader
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const refreshAll = async () => {
    try {
      setLoading(true);
      const [statusRes, pkRes, devRes, sessRes] = await Promise.all([
        fetch("/api/platform-admin/auth/2fa/status"),
        fetch("/api/platform-admin/auth/passkeys"),
        fetch("/api/platform-admin/auth/devices"),
        fetch("/api/platform-admin/auth/sessions"),
      ]);

      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
      if (pkRes.ok) {
        const pkData = await pkRes.json();
        setPasskeys(pkData.passkeys || []);
      }
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevices(devData.devices || []);
      }
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData.sessions || []);
      }
    } catch (err: any) {
      setError("Failed to load super admin security posture.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // Compute Security Score (0 - 100)
  const calculateSecurityScore = (): number => {
    let score = 25; // Base password
    if (status?.enabled) score += 35; // TOTP
    if (passkeys.length > 0) score += 30; // Passkey / WebAuthn
    if (status && status.remainingRecoveryCodes > 4) score += 10;
    return Math.min(score, 100);
  };

  // Register Passkey
  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true);
    setError(null);

    try {
      const optRes = await fetch("/api/platform-admin/auth/passkeys/register-options", {
        method: "POST",
      });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error || "Failed to initiate passkey registration");

      let regResp;
      try {
        regResp = await startRegistration({ optionsJSON: options });
      } catch (authErr: any) {
        if (authErr.name === "NotAllowedError") {
          throw new Error("Passkey creation cancelled or timed out.");
        }
        throw new Error(authErr.message || "Passkey registration failed.");
      }

      const verifyRes = await fetch("/api/platform-admin/auth/passkeys/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: regResp,
          deviceName: passkeyName.trim() || "Super Admin Passkey",
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Failed to verify passkey");

      setPasskeyModalOpen(false);
      setPasskeyName("");
      setSuccessMsg("Super Admin Passkey registered successfully!");
      refreshAll();
    } catch (err: any) {
      setError(err.message || "Could not register passkey");
    } finally {
      setRegisteringPasskey(false);
    }
  };

  // Remove Passkey
  const handleRemovePasskey = async (id: string) => {
    if (!confirm("Are you sure you want to remove this passkey credential?")) return;
    try {
      const res = await fetch(`/api/platform-admin/auth/passkeys?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove passkey");
      setSuccessMsg("Passkey removed successfully.");
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Start TOTP Setup
  const handleStartTotpSetup = async () => {
    setVerifyError(null);
    setVerificationCode("");
    try {
      const res = await fetch("/api/platform-admin/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate setup");
      setQrCodeUrl(data.qrCode);
      setManualKey(data.manualKey);
      setSetupModalOpen(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Verify TOTP
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyError(null);

    try {
      const res = await fetch("/api/platform-admin/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      setGeneratedCodes(data.recoveryCodes || []);
      setSetupModalOpen(false);
      setSuccessMsg("Two-Factor Authentication is now enabled for Super Admin!");
      refreshAll();
    } catch (err: any) {
      setVerifyError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Revoke Trusted Device
  const handleRevokeDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/platform-admin/auth/devices?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke device");
      setSuccessMsg("Device trust revoked.");
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Revoke Session
  const handleRevokeSession = async (id: string) => {
    try {
      const res = await fetch(`/api/platform-admin/auth/sessions?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke session");
      setSuccessMsg("Session signed out.");
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Sign out all other sessions
  const handleSignOutOtherSessions = async () => {
    if (!confirm("Are you sure you want to terminate all other active super admin sessions?")) return;
    setSigningOutOthers(true);
    try {
      const res = await fetch("/api/platform-admin/auth/sessions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign out other sessions");
      setSuccessMsg(data.message || "Signed out of all other sessions.");
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSigningOutOthers(false);
    }
  };

  const securityScore = calculateSecurityScore();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
              Super Admin Security Layer
            </span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            Super Admin Authentication &amp; Hardware Keys
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
            Fortify platform root access with Passkeys (WebAuthn), TOTP Authenticator, 30-Day Trusted Devices, and Active Session Controls.
          </p>
        </div>

        <button
          onClick={refreshAll}
          disabled={loading}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
            isDark
              ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white"
              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
          }`}
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer font-bold ml-4 text-base leading-none">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="cursor-pointer font-bold ml-4 text-base leading-none">&times;</button>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-2 overflow-x-auto">
        {[
          { id: "OVERVIEW", label: "Security Posture" },
          { id: "PASSKEYS", label: `Passkeys (${passkeys.length})` },
          { id: "AUTHENTICATOR", label: "Authenticator & Recovery" },
          { id: "DEVICES", label: `Sessions & Devices (${sessions.length}/${devices.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              subTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : isDark
                ? "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {subTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Security Score Banner */}
          <div
            className={`p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                  Platform Root Protection
                </span>
              </div>
              <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Super Admin Security Score
              </h3>
              <p className={`text-xs max-w-md ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Calculated dynamically from biometric passkey availability, TOTP authenticator status, unspent emergency recovery keys, and active session health.
              </p>
            </div>

            <div className="flex items-center gap-5">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="3.2"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={
                      securityScore >= 80 ? "text-emerald-500" : securityScore >= 50 ? "text-amber-500" : "text-rose-500"
                    }
                    strokeDasharray={`${securityScore}, 100`}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className={`absolute text-2xl font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {securityScore}
                </span>
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-sm">
                  {securityScore >= 80 ? (
                    <span className="text-emerald-500">Enterprise Grade</span>
                  ) : securityScore >= 50 ? (
                    <span className="text-amber-500">Standard Security</span>
                  ) : (
                    <span className="text-rose-500">Critical Setup Needed</span>
                  )}
                </div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Target: 90+ / 100
                </div>
                <div className="text-[11px] text-blue-500 font-medium">
                  {passkeys.length === 0 ? "Add Passkey for +30 pts" : !status?.enabled ? "Add TOTP for +35 pts" : "Fully Protected"}
                </div>
              </div>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Passkeys */}
            <div
              onClick={() => setSubTab("PASSKEYS")}
              className={`p-5 rounded-2xl border cursor-pointer transition hover:border-blue-500/50 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium">Passkeys (WebAuthn)</span>
                <span className={passkeys.length > 0 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                  {passkeys.length > 0 ? "Active" : "Not Set"}
                </span>
              </div>
              <div className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                {passkeys.length} Registered
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Touch ID / Face ID / Windows Hello</p>
            </div>

            {/* Card 2: Authenticator */}
            <div
              onClick={() => setSubTab("AUTHENTICATOR")}
              className={`p-5 rounded-2xl border cursor-pointer transition hover:border-blue-500/50 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium">Authenticator (TOTP)</span>
                <span className={status?.enabled ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                  {status?.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                {status?.enabled ? "Protected" : "Off"}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Google Auth / 1Password 6-digit codes</p>
            </div>

            {/* Card 3: Trusted Devices */}
            <div
              onClick={() => setSubTab("DEVICES")}
              className={`p-5 rounded-2xl border cursor-pointer transition hover:border-blue-500/50 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium">Trusted Devices</span>
                <span className="text-blue-500 font-bold">{devices.length} Active</span>
              </div>
              <div className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                {devices.length} Trusted
              </div>
              <p className="text-[11px] text-slate-400 mt-1">30-day OTP bypass records</p>
            </div>

            {/* Card 4: Active Sessions */}
            <div
              onClick={() => setSubTab("DEVICES")}
              className={`p-5 rounded-2xl border cursor-pointer transition hover:border-blue-500/50 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium">Active Sessions</span>
                <span className="text-emerald-500 font-bold">{sessions.length} Live</span>
              </div>
              <div className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                {sessions.length} Signed In
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Simultaneous portal logins</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PASSKEYS */}
      {subTab === "PASSKEYS" && (
        <div className="space-y-6">
          <div
            className={`p-6 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Super Admin Passkeys (FIDO2 / WebAuthn)
                  </h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                    Highest Security
                  </span>
                </div>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Log into the super admin console instantaneously using Touch ID, Face ID, Windows Hello, or hardware security keys without typing a password.
                </p>
              </div>
              <button
                onClick={() => setPasskeyModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Super Admin Passkey</span>
              </button>
            </div>

            {passkeys.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300 dark:border-slate-800 text-xs text-slate-400 space-y-2">
                <div className="text-sm font-semibold">No Passkeys Registered</div>
                <p>Register a passkey from your laptop or phone for instant biometric authentication.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {passkeys.map((pk) => (
                  <div key={pk.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold flex items-center gap-2">
                        <span className={isDark ? "text-white" : "text-slate-900"}>{pk.name || "Super Admin Device"}</span>
                        {pk.backedUp && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-medium">
                            Synced Keychain (iCloud / Google)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Enrolled: {new Date(pk.createdAt).toLocaleDateString()} &bull; Last used:{" "}
                        {pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleString() : "Never"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePasskey(pk.id)}
                      className="px-3 py-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 font-medium cursor-pointer transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUTHENTICATOR & RECOVERY */}
      {subTab === "AUTHENTICATOR" && (
        <div className="space-y-6">
          {/* TOTP Config Card */}
          <div
            className={`p-6 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
              <div>
                <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Time-Based One-Time Password (TOTP)
                </h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Generate rotating 6-digit codes with Google Authenticator, Microsoft Authenticator, or 1Password.
                </p>
              </div>

              {!status?.enabled ? (
                <button
                  onClick={handleStartTotpSetup}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm transition"
                >
                  Enable 2FA Authenticator
                </button>
              ) : (
                <button
                  onClick={handleStartTotpSetup}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    isDark
                      ? "border-slate-700 hover:bg-white/[0.06] text-white"
                      : "border-slate-300 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  Reconfigure Authenticator App
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs py-2">
              <div>
                <span className="font-semibold">Current Status: </span>
                <span className={status?.enabled ? "text-emerald-500 font-bold" : "text-slate-400"}>
                  {status?.enabled ? "Active & Enforced" : "Not Configured"}
                </span>
              </div>
              {status?.verifiedAt && (
                <span className="text-slate-400">
                  Verified: {new Date(status.verifiedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Backup Recovery Codes Card */}
          <div
            className={`p-6 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Super Admin Backup Recovery Codes
                </h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  8 single-use emergency codes generated when 2FA is activated. Keep these secure in case you lose your mobile device.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06]">
                  {status?.remainingRecoveryCodes ?? 0} codes remaining
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SESSIONS & DEVICES */}
      {subTab === "DEVICES" && (
        <div className="space-y-6">
          {/* Active Sessions */}
          <div
            className={`p-6 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
              <div>
                <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Active Super Admin Sessions
                </h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  All browser sessions currently signed into the super admin platform.
                </p>
              </div>

              <button
                onClick={handleSignOutOtherSessions}
                disabled={signingOutOthers || sessions.length <= 1}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                {signingOutOthers ? "Signing out..." : "Sign Out All Other Sessions"}
              </button>
            </div>

            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {sessions.map((sess) => (
                <div key={sess.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <span className={isDark ? "text-white" : "text-slate-900"}>{sess.deviceName}</span>
                      {sess.isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold">
                          This Device (Active Now)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      IP: {sess.ipAddress} &bull; Last active: {new Date(sess.lastActiveAt).toLocaleString()}
                    </div>
                  </div>
                  {!sess.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-3 py-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 font-medium cursor-pointer transition"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Trusted Devices (30-Day Bypass) */}
          <div
            className={`p-6 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
              <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Trusted Devices (30-Day OTP Bypass)
              </h3>
              <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Browsers where you checked &quot;Trust this device for 30 days&quot; during sign in. These bypass 2FA until expiration.
              </p>
            </div>

            {devices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-2xl border-slate-300 dark:border-slate-800">
                No devices currently trusted. You can trust a device on your next 2FA sign in.
              </div>
            ) : (
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {devices.map((dev) => (
                  <div key={dev.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {dev.deviceName || "Trusted Browser"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        IP: {dev.ipAddress || "Unknown"} &bull; Expires: {new Date(dev.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeDevice(dev.id)}
                      className="px-3 py-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 font-medium cursor-pointer transition"
                    >
                      Revoke Trust
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD PASSKEY MODAL */}
      {passkeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div
            className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Register Super Admin Passkey
            </h3>
            <p className="text-xs text-slate-400">
              Provide a nickname for this device before touching your fingerprint sensor, Face ID camera, or security key.
            </p>

            <input
              type="text"
              placeholder="e.g. MacBook Pro Touch ID, Office YubiKey"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none focus:border-blue-500 ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasskeyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegisterPasskey}
                disabled={registeringPasskey}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition shadow-sm flex items-center gap-1.5"
              >
                {registeringPasskey ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Awaiting Sensor...</span>
                  </>
                ) : (
                  <span>Prompt Sensor</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOTP SETUP MODAL */}
      {setupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div
            className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Configure Super Admin Authenticator
            </h3>
            <p className="text-xs text-slate-400">
              Scan this QR code with Google Authenticator, Microsoft Authenticator, or 1Password.
            </p>

            {qrCodeUrl && (
              <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-sm">
                <img src={qrCodeUrl} alt="Super Admin 2FA QR Code" className="w-48 h-48" />
              </div>
            )}

            {manualKey && (
              <div className="text-center space-y-1">
                <div className="text-[11px] text-slate-400">Manual Entry Key:</div>
                <div className="font-mono text-xs font-bold text-blue-500 tracking-widest select-all">
                  {manualKey}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(manualKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  {copiedKey ? "Copied to clipboard!" : "Copy Key"}
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyTotp} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`w-full text-center font-mono text-xl tracking-[0.4em] font-bold py-2.5 rounded-xl border focus:outline-none focus:border-emerald-500 ${
                  isDark ? "border-slate-700 bg-black/30 text-white" : "border-slate-300 bg-white text-slate-900"
                }`}
              />
              {verifyError && <div className="text-xs text-rose-500 text-center font-medium">{verifyError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSetupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyLoading || verificationCode.length !== 6}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {verifyLoading ? "Verifying..." : "Activate Super Admin 2FA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECOVERY CODES PRESENTATION MODAL */}
      {generatedCodes.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div
            className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <h3 className="text-base font-bold text-emerald-500">
              Save Your Super Admin Recovery Codes
            </h3>
            <p className="text-xs text-slate-400">
              Store these 8 emergency one-time codes in a password manager. They grant root access if your phone or authenticator app is lost!
            </p>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-black/20 font-mono text-xs text-center border border-white/[0.04]">
              {generatedCodes.map((c, i) => (
                <div key={i} className={`py-1.5 px-2 rounded font-semibold ${isDark ? "bg-white/[0.04] text-white" : "bg-slate-100 text-slate-900"}`}>
                  {c}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCodes.join("\n"));
                  setCopiedCodes(true);
                  setTimeout(() => setCopiedCodes(false), 2000);
                }}
                className="text-xs text-blue-500 hover:underline cursor-pointer font-medium"
              >
                {copiedCodes ? "Codes Copied!" : "Copy All Codes"}
              </button>
              <button
                type="button"
                onClick={() => setGeneratedCodes([])}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm"
              >
                I Have Saved These Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
