"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import { startRegistration } from "@simplewebauthn/browser";

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  remainingRecoveryCodes: number;
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

interface SecurityPolicy {
  requireMfaRoles: string[];
  allowedMethods: string[];
  trustedDeviceDurationDays: number;
  enforceImmediateMfa: boolean;
}

interface AuditLogItem {
  id: string;
  event: string;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
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

  // Active Tab: OVERVIEW, METHODS, DEVICES, POLICY, ACTIVITY
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "METHODS" | "DEVICES" | "POLICY" | "ACTIVITY">("OVERVIEW");

  // Core State
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [devices, setDevices] = useState<TrustedDeviceItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Alerts
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & Action Loaders
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);

  // Setup TOTP Modal
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

  // Emergency Controls
  const [emergencyLoading, setEmergencyLoading] = useState<string | null>(null);

  // Fetch all security modules
  const refreshAll = async () => {
    try {
      setLoading(true);
      const [statusRes, pkRes, devRes, sessRes, polRes, logsRes] = await Promise.all([
        fetch("/api/restaurant/auth/2fa/status"),
        fetch("/api/restaurant/auth/passkeys"),
        fetch("/api/restaurant/auth/devices"),
        fetch("/api/restaurant/auth/sessions"),
        fetch("/api/restaurant/security/policy"),
        fetch("/api/restaurant/security/audit-logs?limit=25"),
      ]);

      if (statusRes.status === 401) {
        router.push(`/restaurant/${subdomain}/login`);
        return;
      }

      if (statusRes.ok) setStatus(await statusRes.json());
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
      if (polRes.ok) {
        const polData = await polRes.json();
        setPolicy(polData.policy || null);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.logs || []);
      }
    } catch (err: any) {
      setError("Failed to load security intelligence layer.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [subdomain]);

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
      const optRes = await fetch("/api/restaurant/auth/passkeys/register-options", {
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

      const verifyRes = await fetch("/api/restaurant/auth/passkeys/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: regResp,
          deviceName: passkeyName.trim() || "Passkey Device",
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Failed to verify passkey");

      setPasskeyModalOpen(false);
      setPasskeyName("");
      setSuccessMsg("Passkey credential registered successfully!");
      refreshAll();
    } catch (err: any) {
      setError(err.message || "Could not register passkey");
    } finally {
      setRegisteringPasskey(false);
    }
  };

  // Remove Passkey
  const handleRemovePasskey = async (id: string) => {
    if (!confirm("Are you sure you want to remove this passkey?")) return;
    try {
      const res = await fetch(`/api/restaurant/auth/passkeys?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove passkey");
      setSuccessMsg("Passkey removed successfully.");
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Revoke Trusted Device
  const handleRevokeDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/restaurant/auth/devices?id=${id}`, { method: "DELETE" });
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
      const res = await fetch(`/api/restaurant/auth/sessions?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke session");
      setSuccessMsg("Session signed out.");
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Sign out all other sessions
  const handleSignOutOtherSessions = async () => {
    try {
      const res = await fetch("/api/restaurant/auth/sessions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign out other sessions");
      setSuccessMsg(data.message || "Signed out of all other sessions.");
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Emergency Actions
  const handleEmergencyAction = async (action: string, confirmPrompt: string) => {
    if (!confirm(confirmPrompt)) return;
    setEmergencyLoading(action);
    setError(null);

    try {
      const res = await fetch("/api/restaurant/security/emergency-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Emergency action failed");
      setSuccessMsg(data.message);
      refreshAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmergencyLoading(null);
    }
  };

  // Start TOTP Setup
  const handleStartTotpSetup = async () => {
    setVerifyError(null);
    setVerificationCode("");
    try {
      const res = await fetch("/api/restaurant/auth/2fa/setup", { method: "POST" });
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
      const res = await fetch("/api/restaurant/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      setGeneratedCodes(data.recoveryCodes || []);
      setSetupModalOpen(false);
      setSuccessMsg("Two-Factor Authentication is now enabled!");
      refreshAll();
    } catch (err: any) {
      setVerifyError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Policy Role Toggle
  const handlePolicyRoleToggle = async (role: string) => {
    if (!policy) return;
    const currentRoles = policy.requireMfaRoles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];

    try {
      const res = await fetch("/api/restaurant/security/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireMfaRoles: newRoles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update policy");
      setPolicy(data.policy);
      setSuccessMsg("Organization MFA policy updated.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const securityScore = calculateSecurityScore();

  return (
    <div className={`min-h-screen font-sans ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"}`}>
      <RestaurantNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
                Identity &bull; Access Management
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Security &amp; Enterprise Auth</h1>
            <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Full identity layer: Passkeys/WebAuthn, trusted devices, session control, and organization MFA policies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/settings/profile`)}
              className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              &larr; Profile Settings
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="cursor-pointer font-bold ml-4">&times;</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="cursor-pointer font-bold ml-4">&times;</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-2 overflow-x-auto">
          {[
            { id: "OVERVIEW", label: "Overview & Score" },
            { id: "METHODS", label: "Authentication Methods" },
            { id: "DEVICES", label: "Devices & Sessions" },
            { id: "POLICY", label: "Organization Policy & Controls" },
            { id: "ACTIVITY", label: "Security Activity" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
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
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            {/* Score Banner */}
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"} shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6`}>
              <div className="space-y-2 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                    Security Posture
                  </span>
                </div>
                <h2 className="text-xl font-bold">Account Security Score</h2>
                <p className={`text-xs max-w-md ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Your score is calculated based on biometric passkeys, two-step verification, trusted device health, and backup recovery codes.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200 dark:text-slate-800"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={securityScore >= 80 ? "text-emerald-500" : securityScore >= 50 ? "text-amber-500" : "text-rose-500"}
                      strokeDasharray={`${securityScore}, 100`}
                      strokeWidth="3"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-xl font-extrabold">{securityScore}</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-semibold">{securityScore >= 80 ? "Enterprise Grade" : "Action Needed"}</div>
                  <div className="text-slate-400">Target: 90 / 100</div>
                </div>
              </div>
            </div>

            {/* Quick Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-5 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Passkeys</span>
                  <span className={passkeys.length > 0 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                    {passkeys.length > 0 ? "✓ Active" : "Not Set"}
                  </span>
                </div>
                <div className="text-lg font-bold">{passkeys.length} Registered</div>
                <p className="text-[11px] text-slate-400 mt-1">Touch ID / Windows Hello</p>
              </div>

              <div className={`p-5 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Authenticator (TOTP)</span>
                  <span className={status?.enabled ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                    {status?.enabled ? "✓ Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="text-lg font-bold">{status?.enabled ? "Active" : "Off"}</div>
                <p className="text-[11px] text-slate-400 mt-1">Google Authenticator / 1Password</p>
              </div>

              <div className={`p-5 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Trusted Devices</span>
                  <span className="text-blue-500 font-bold">{devices.length} Active</span>
                </div>
                <div className="text-lg font-bold">{devices.length} Devices</div>
                <p className="text-[11px] text-slate-400 mt-1">30-day OTP bypass</p>
              </div>

              <div className={`p-5 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Active Sessions</span>
                  <span className="text-emerald-500 font-bold">{sessions.length} Live</span>
                </div>
                <div className="text-lg font-bold">{sessions.length} Signed In</div>
                <p className="text-[11px] text-slate-400 mt-1">Across all browsers &amp; phones</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUTHENTICATION METHODS */}
        {activeTab === "METHODS" && (
          <div className="space-y-6">
            {/* PASSKEYS SECTION */}
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold">Passkeys / WebAuthn</h2>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                      Recommended
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Sign in seamlessly using biometric sensors (Touch ID, Face ID, Windows Hello) or hardware security keys.
                  </p>
                </div>
                <button
                  onClick={() => setPasskeyModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm transition"
                >
                  + Add New Passkey
                </button>
              </div>

              {passkeys.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300 dark:border-slate-800 text-xs text-slate-400">
                  No passkeys registered yet. Click &quot;Add New Passkey&quot; to enable one-touch biometric sign in.
                </div>
              ) : (
                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {passkeys.map((pk) => (
                    <div key={pk.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold flex items-center gap-2">
                          <span>{pk.name || "Passkey Device"}</span>
                          {pk.backedUp && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400">Synced (iCloud / Google)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Added: {new Date(pk.createdAt).toLocaleDateString()} &bull; Last used:{" "}
                          {pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleDateString() : "Never"}
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

            {/* TOTP AUTHENTICATOR SECTION */}
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold">Authenticator Apps (TOTP)</h2>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Use Google Authenticator, Microsoft Authenticator, or 1Password to generate time-based 6-digit codes.
                  </p>
                </div>
                {!status?.enabled ? (
                  <button
                    onClick={handleStartTotpSetup}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm transition"
                  >
                    Enable Authenticator
                  </button>
                ) : (
                  <button
                    onClick={handleStartTotpSetup}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer transition"
                  >
                    Reconfigure App
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs py-2">
                <div>
                  <span className="font-semibold">Status: </span>
                  <span className={status?.enabled ? "text-emerald-500 font-bold" : "text-slate-400"}>
                    {status?.enabled ? "Active and Protecting Account" : "Not configured"}
                  </span>
                </div>
                {status?.verifiedAt && (
                  <span className="text-slate-400">Verified: {new Date(status.verifiedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>

            {/* RECOVERY CODES SECTION */}
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold">Backup Recovery Codes</h2>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Emergency one-time codes for access if your phone or authenticator app is lost or unavailable.
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

        {/* TAB 3: DEVICES & SESSIONS */}
        {activeTab === "DEVICES" && (
          <div className="space-y-6">
            {/* ACTIVE SESSIONS */}
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold">Active Sessions</h2>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Devices and browsers currently authenticated to your restaurant account.
                  </p>
                </div>
                <button
                  onClick={handleSignOutOtherSessions}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 cursor-pointer transition"
                >
                  Sign Out All Other Sessions
                </button>
              </div>

              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {sessions.map((sess) => (
                  <div key={sess.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold flex items-center gap-2">
                        <span>{sess.deviceName}</span>
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

            {/* TRUSTED DEVICES */}
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
                <h2 className="text-base font-bold">Trusted Devices (30-Day OTP Bypass)</h2>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Devices where you checked &quot;Trust this device&quot; during sign in. These skip OTP challenges until expiration.
                </p>
              </div>

              {devices.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-2xl border-slate-300 dark:border-slate-800">
                  No devices currently trusted. You can trust a device on your next sign in challenge.
                </div>
              ) : (
                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {devices.map((dev) => (
                    <div key={dev.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">{dev.deviceName || "Device"}</div>
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

        {/* TAB 4: ORGANIZATION POLICY & CONTROLS */}
        {activeTab === "POLICY" && (
          <div className="space-y-6">
            {/* POLICY ENFORCEMENT */}
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">Organization MFA Policy</h2>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                    Overrides User Preference
                  </span>
                </div>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Require two-step verification for specific restaurant workforce roles. Members cannot disable 2FA if mandated here.
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold">Require Multi-Factor Authentication For:</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {["OWNER", "ADMIN", "MANAGER", "CASHIER", "STAFF"].map((role) => {
                    const isChecked = policy?.requireMfaRoles?.includes(role);
                    return (
                      <label
                        key={role}
                        className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition select-none ${
                          isChecked
                            ? "border-blue-500 bg-blue-500/10 text-blue-500 font-bold"
                            : isDark
                            ? "border-white/[0.08] hover:bg-white/[0.02]"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!isChecked}
                          onChange={() => handlePolicyRoleToggle(role)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* EMERGENCY KILL SWITCHES */}
            <div className={`p-6 rounded-3xl border border-rose-500/30 ${isDark ? "bg-rose-500/[0.03]" : "bg-rose-50/50"}`}>
              <div className="border-b border-rose-500/20 pb-4 mb-4">
                <h2 className="text-base font-bold text-rose-500">Emergency Security Controls</h2>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  High-privilege actions for incident response or suspected compromise across your restaurant.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() =>
                    handleEmergencyAction(
                      "SIGN_OUT_ALL_USERS",
                      "WARNING: This will instantly log out every employee and manager across all devices. Proceed?"
                    )
                  }
                  disabled={emergencyLoading !== null}
                  className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold text-left transition cursor-pointer"
                >
                  <div className="font-bold mb-1">Sign Out All Users</div>
                  <div className="text-[11px] opacity-80">Invalidates all active tokens and sessions immediately.</div>
                </button>

                <button
                  onClick={() =>
                    handleEmergencyAction(
                      "REVOKE_ALL_TRUSTED_DEVICES",
                      "WARNING: This will force all employees to pass OTP again on their next login. Proceed?"
                    )
                  }
                  disabled={emergencyLoading !== null}
                  className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold text-left transition cursor-pointer"
                >
                  <div className="font-bold mb-1">Revoke All Trusted Devices</div>
                  <div className="text-[11px] opacity-80">Clears every 30-day bypass organization-wide.</div>
                </button>

                <button
                  onClick={() =>
                    handleEmergencyAction(
                      "REQUIRE_MFA_IMMEDIATELY",
                      "WARNING: This will immediately enforce MFA for all roles (Owners, Admins, Managers, Cashiers, Staff). Proceed?"
                    )
                  }
                  disabled={emergencyLoading !== null}
                  className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold text-left transition cursor-pointer"
                >
                  <div className="font-bold mb-1">Require MFA Immediately</div>
                  <div className="text-[11px] opacity-80">Mandates 2FA setup on next sign in for everyone.</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SECURITY ACTIVITY */}
        {activeTab === "ACTIVITY" && (
          <div className={`p-6 rounded-3xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
            <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-4 mb-4">
              <h2 className="text-base font-bold">Real-Time Security Audit Log</h2>
              <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Immutable record of logins, passkey events, MFA challenges, and device trust modifications.
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No security audit logs recorded yet.</div>
            ) : (
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400">
                          {log.event}
                        </span>
                        <span>{log.userEmail || "System"}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        IP: {log.ipAddress || "Unknown"}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD PASSKEY MODAL */}
        {passkeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <h3 className="text-base font-bold">Register Passkey</h3>
              <p className="text-xs text-slate-400">
                Give this passkey a recognizable name (e.g., &quot;MacBook Pro&quot;, &quot;Work iPhone&quot;) before scanning your biometric sensor.
              </p>
              <input
                type="text"
                placeholder="Device name (e.g., MacBook Pro Touch ID)"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                className={`w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none focus:border-blue-500 ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200"
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition shadow-sm"
                >
                  {registeringPasskey ? "Awaiting Sensor..." : "Prompt Sensor"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOTP SETUP MODAL */}
        {setupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <h3 className="text-base font-bold">Configure Authenticator App</h3>
              <p className="text-xs text-slate-400">
                Scan this QR code with Google Authenticator, Microsoft Authenticator, or 1Password.
              </p>

              {qrCodeUrl && (
                <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-sm">
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              )}

              {manualKey && (
                <div className="text-center space-y-1">
                  <div className="text-[11px] text-slate-400">Manual Entry Key:</div>
                  <div className="font-mono text-xs font-bold text-blue-500 tracking-widest">{manualKey}</div>
                </div>
              )}

              <form onSubmit={handleVerifyTotp} className="space-y-3">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full text-center font-mono text-xl tracking-[0.4em] font-bold py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                />
                {verifyError && <div className="text-xs text-rose-500 text-center">{verifyError}</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSetupModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifyLoading || verificationCode.length !== 6}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm"
                  >
                    {verifyLoading ? "Verifying..." : "Activate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* RECOVERY CODES PRESENTATION MODAL */}
        {generatedCodes.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
              <h3 className="text-base font-bold text-emerald-500">Save Your Recovery Codes</h3>
              <p className="text-xs text-slate-400">
                These 8 codes can be used once each if you lose access to your authenticator app. Store them safely!
              </p>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-black/20 font-mono text-xs text-center">
                {generatedCodes.map((c, i) => (
                  <div key={i} className="py-1 px-2 rounded bg-white/[0.04] font-semibold">{c}</div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setGeneratedCodes([])}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white cursor-pointer"
                >
                  I Have Saved These Codes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
