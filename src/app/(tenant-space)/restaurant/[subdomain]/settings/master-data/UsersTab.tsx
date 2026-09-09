"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/core/theme/ThemeContext";
import {
  UserPlus,
  Shield,
  KeyRound,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  Mail,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react";

interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions?: any[];
}

interface Outlet {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  personalEmail: string | null;
  archivedAt: string | null;
}

interface UsersTabProps {
  subdomain: string;
  searchQuery?: string;
  showGrantModal?: boolean;
  onCloseGrantModal?: () => void;
  onUsersCountChange?: (count: number) => void;
}

export default function UsersTab({
  subdomain,
  searchQuery = "",
  showGrantModal = false,
  onCloseGrantModal,
  onUsersCountChange,
}: UsersTabProps) {
  const { isDark } = useTheme();

  const [memberships, setMemberships] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Grant Portal Access Modal State
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [createdInviteUrl, setCreatedInviteUrl] = useState("");
  const [createdEmailSent, setCreatedEmailSent] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: "",
    email: "",
    roleId: "",
    outletId: "",
  });

  // Link Staff Profile Modal State
  const [linkingTarget, setLinkingTarget] = useState<{
    membershipId: string;
    userEmail: string;
    currentEmployeeId: string | null;
  } | null>(null);
  const [selectedLinkEmployeeId, setSelectedLinkEmployeeId] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  // Remove Access Confirmation Modal State
  const [confirmRemoveTarget, setConfirmRemoveTarget] = useState<{
    membershipId: string;
    email: string;
  } | null>(null);

  // Reset 2FA Modal State
  const [confirmReset2faTarget, setConfirmReset2faTarget] = useState<{
    membershipId: string;
    email: string;
  } | null>(null);
  const [resetting2fa, setResetting2fa] = useState(false);

  // Edit User & Multiple Roles Modal State
  const [editRolesTarget, setEditRolesTarget] = useState<{
    membershipId: string;
    userEmail: string;
    employeeId: string;
    selectedRoleIds: string[];
    outletId: string;
  } | null>(null);
  const [editRolesSaving, setEditRolesSaving] = useState(false);
  const [editRolesError, setEditRolesError] = useState("");

  // Sync external grant modal trigger
  useEffect(() => {
    if (showGrantModal) {
      setError("");
      setCreatedInviteUrl("");
      setIsGrantModalOpen(true);
    }
  }, [showGrantModal]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resEmps, resRoles, resOutlets] = await Promise.all([
        fetch("/api/restaurant/users"),
        fetch("/api/restaurant/employees"),
        fetch("/api/restaurant/roles"),
        fetch("/api/restaurant/outlets"),
      ]);

      const dataUsers = await resUsers.json();
      const dataEmps = await resEmps.json();
      const dataRoles = await resRoles.json();
      const dataOutlets = await resOutlets.json();

      if (resUsers.ok) {
        const userMemberships = dataUsers.memberships || [];
        setMemberships(userMemberships);
        setPendingInvitations(dataUsers.pendingInvitations || []);
        if (dataUsers.currentUserId) setCurrentUserId(dataUsers.currentUserId);
        if (onUsersCountChange) {
          onUsersCountChange(userMemberships.length);
        }
      }
      if (resEmps.ok) setEmployees(dataEmps.employees || []);
      if (resRoles.ok) setRoles(dataRoles.roles || []);
      if (resOutlets.ok) setOutlets(dataOutlets.outlets || []);
    } catch {
      setError("Network error loading user data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEmployeeSelect = (empId: string) => {
    const selected = employees.find((e) => e.id === empId);
    setFormData((prev) => ({
      ...prev,
      employeeId: empId,
      email: selected?.personalEmail || prev.email,
    }));
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setModalError("");
    setSuccessMsg("");
    setCreatedInviteUrl("");

    try {
      const res = await fetch("/api/restaurant/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invitation");

      const protocol = window.location.protocol;
      const host = window.location.host;
      const url = `${protocol}//${host}/restaurant/${subdomain}/activate?token=${data.inviteToken}`;
      setCreatedInviteUrl(url);
      setCreatedEmailSent(!!data.emailSent);

      if (data.emailSent) {
        setSuccessMsg(`Invitation created & access email sent to ${formData.email}`);
      } else {
        setSuccessMsg("Invitation created. Copy the link below to share with staff.");
      }

      fetchData();
    } catch (err: any) {
      setModalError(err.message || "Error creating invitation");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setActionLoadingId(`cancel-${invitationId}`);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/users?invitationId=${invitationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel invitation");
      setSuccessMsg("Staff invitation cancelled successfully");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to cancel invitation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendInvite = async (invitationId: string, email: string) => {
    setActionLoadingId(`resend-${invitationId}`);
    setError("");
    try {
      const res = await fetch("/api/restaurant/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend invitation email");
      setSuccessMsg(`Access invitation email resent to ${email}`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to resend invitation email");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMembership = async (membershipId: string, email: string) => {
    setActionLoadingId(`remove-${membershipId}`);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/users?membershipId=${membershipId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove user membership");
      setSuccessMsg(`User access removed for ${email}`);
      setConfirmRemoveTarget(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to remove user membership");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyLink = () => {
    if (createdInviteUrl) {
      navigator.clipboard.writeText(createdInviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    }
  };

  const handleSaveStaffLink = async (employeeId: string | null) => {
    if (!linkingTarget) return;
    setLinkSaving(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: linkingTarget.membershipId,
          employeeId: employeeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff profile link");
      setSuccessMsg(data.message || "Staff profile link updated successfully");
      setLinkingTarget(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to update link");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleOpenEditRoles = (m: any) => {
    const currentRoleIds = Array.from(
      new Set(
        (m.accessGrants || [])
          .filter((g: any) => g.status === "ACTIVE" && g.role)
          .map((g: any) => g.role.id)
      )
    );
    setEditRolesTarget({
      membershipId: m.id,
      userEmail: m.user.email,
      employeeId: m.employeeId || "",
      selectedRoleIds: currentRoleIds as string[],
      outletId: m.accessGrants?.[0]?.outletId || "",
    });
    setEditRolesError("");
  };

  const handleSaveRolesAndProfile = async () => {
    if (!editRolesTarget) return;
    setEditRolesSaving(true);
    setEditRolesError("");
    try {
      const res = await fetch("/api/restaurant/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: editRolesTarget.membershipId,
          employeeId: editRolesTarget.employeeId || null,
          roleIds: editRolesTarget.selectedRoleIds,
          outletId: editRolesTarget.outletId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile and roles");
      setSuccessMsg(data.message || "Profile and assigned roles updated successfully");
      setEditRolesTarget(null);
      fetchData();
    } catch (err: any) {
      setEditRolesError(err.message || "Failed to update profile and roles");
    } finally {
      setEditRolesSaving(false);
    }
  };

  const handleConfirmReset2fa = async () => {
    if (!confirmReset2faTarget) return;
    setResetting2fa(true);
    try {
      const res = await fetch("/api/restaurant/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: confirmReset2faTarget.membershipId,
          action: "RESET_2FA",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset 2FA");
      setSuccessMsg(data.message || `Two-factor authentication reset for ${confirmReset2faTarget.email}`);
      setConfirmReset2faTarget(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to reset 2FA");
    } finally {
      setResetting2fa(false);
    }
  };

  // Filter memberships by search query
  const filteredMemberships = memberships.filter((m) => {
    const q = searchQuery.toLowerCase();
    const emailMatch = m.user.email.toLowerCase().includes(q);
    const empNameMatch = m.employee
      ? `${m.employee.firstName} ${m.employee.lastName}`.toLowerCase().includes(q)
      : false;
    const empCodeMatch = m.employee?.employeeCode?.toLowerCase().includes(q) || false;
    const roleMatch = (m.accessGrants || []).some((g: any) =>
      g.role?.name?.toLowerCase().includes(q)
    );
    return emailMatch || empNameMatch || empCodeMatch || roleMatch;
  });

  const filteredInvitations = pendingInvitations.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      inv.email.toLowerCase().includes(q) ||
      inv.role?.name?.toLowerCase().includes(q) ||
      inv.outlet?.name?.toLowerCase().includes(q)
    );
  });

  if (loading && memberships.length === 0) {
    return (
      <div
        className={`p-12 text-center text-xs flex flex-col items-center justify-center ${
          isDark ? "text-[#8F95A3]" : "text-slate-400"
        }`}
      >
        <RefreshCw className="w-5 h-5 animate-spin mb-2 text-[#0071E3]" />
        <span>Loading user accounts & credentials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {successMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
            isDark
              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
              : "bg-emerald-50 border-emerald-200 text-emerald-950 font-medium"
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
            isDark
              ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
              : "bg-rose-50 border-rose-200 text-rose-950 font-medium"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Active Staff Memberships Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
            Active Staff Memberships ({filteredMemberships.length})
          </h2>
        </div>

        {filteredMemberships.length === 0 ? (
          <div
            className={`p-8 text-center text-xs rounded-2xl sm:rounded-3xl border ${
              isDark ? "bg-[#121622]/40 border-white/[0.04] text-[#8F95A3]" : "bg-white border-slate-200/60 text-slate-400"
            }`}
          >
            No staff accounts found matching query.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMemberships.map((m) => {
              const isCurrentUser = m.user.id === currentUserId;
              const activeRoles = Array.from(
                new Map<string, string>(
                  (m.accessGrants || [])
                    .filter((g: any) => g.status === "ACTIVE" && g.role)
                    .map((g: any): [string, string] => [String(g.role.id), String(g.role.name)])
                ).entries()
              );

              return (
                <div
                  key={m.id}
                  className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition flex flex-col justify-between space-y-3.5 ${
                    isDark
                      ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                      : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
                  }`}
                >
                  {/* Top row: User Info & Badges */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border font-bold text-xs sm:text-sm ${
                          isDark
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {m.user.email.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className={`text-xs sm:text-sm font-bold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                            {m.user.email}
                          </h3>
                          {isCurrentUser && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                              isDark ? "bg-white/5 text-slate-400 border-white/10" : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}>
                              You
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] sm:text-[11px] block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Member since {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "Active"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m.user.twoFactorAuth?.enabled && (
                        <span
                          title="Two-Factor Authentication Active"
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            isDark
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          2FA
                        </span>
                      )}

                      {/* Active Status: Green Dot */}
                      <span
                        title={m.status === "ACTIVE" ? "Active Account" : `Status: ${m.status}`}
                        className="relative flex h-2.5 w-2.5 mx-0.5"
                      >
                        {m.status === "ACTIVE" ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        )}
                      </span>

                      {/* Edit Roles Pencil Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditRoles(m)}
                        title="Edit Roles & Access"
                        className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                          isDark
                            ? "text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30"
                            : "text-[#0071E3] bg-blue-50 hover:bg-blue-100 border-blue-200 shadow-2xs"
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Reset 2FA if enabled */}
                      {m.user.twoFactorAuth?.enabled && (
                        <button
                          type="button"
                          onClick={() => setConfirmReset2faTarget({ membershipId: m.id, email: m.user.email })}
                          title="Reset 2FA"
                          className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                            isDark
                              ? "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30"
                              : "text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200"
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Remove Access if not current user */}
                      {!isCurrentUser && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveTarget({ membershipId: m.id, email: m.user.email })}
                          title="Revoke Staff Access"
                          className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                            isDark
                              ? "text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30"
                              : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Middle row: Linked Profile & Roles Info Box */}
                  <div className={`p-3 rounded-xl border text-xs grid grid-cols-1 gap-2.5 ${
                    isDark ? "bg-[#0A0C12]/50 border-white/[0.04]" : "bg-slate-50/70 border-slate-200/60"
                  }`}>
                    {/* Linked Staff Profile */}
                    <div className="space-y-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                        Linked Staff Profile
                      </span>
                      {m.employee ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-xs ${isDark ? "text-white" : "text-slate-800"}`}>
                            {m.employee.firstName} {m.employee.lastName}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                            isDark ? "bg-white/10 text-slate-200 border-white/10" : "bg-white text-slate-700 border-slate-200"
                          }`}>
                            {m.employee.employeeCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingTarget({
                                membershipId: m.id,
                                userEmail: m.user.email,
                                currentEmployeeId: m.employee.id,
                              });
                              setSelectedLinkEmployeeId(m.employee.id);
                            }}
                            className="text-[11px] text-[#0071E3] hover:underline cursor-pointer font-medium ml-1"
                          >
                            Change
                          </button>
                        </div>
                      ) : m.user.id === currentUserId ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
                            isDark ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : "bg-sky-50 text-sky-800 border-sky-300"
                          }`}>
                            Tenant Owner (Admin)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingTarget({
                                membershipId: m.id,
                                userEmail: m.user.email,
                                currentEmployeeId: null,
                              });
                              setSelectedLinkEmployeeId("");
                            }}
                            className="text-[11px] text-[#0071E3] hover:underline cursor-pointer font-medium whitespace-nowrap"
                          >
                            + Link Profile
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}>
                            Unlinked Account
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingTarget({
                                membershipId: m.id,
                                userEmail: m.user.email,
                                currentEmployeeId: null,
                              });
                              setSelectedLinkEmployeeId("");
                            }}
                            className="text-[11px] text-[#0071E3] hover:underline cursor-pointer font-medium"
                          >
                            Link Profile
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Assigned Roles */}
                    <div className="space-y-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                        Assigned Roles
                      </span>
                      {activeRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {activeRoles.map(([id, name]) => (
                            <span
                              key={id}
                              className={`px-2 py-0.5 rounded-lg font-medium text-[11px] border ${
                                isDark
                                  ? "bg-white/[0.06] text-white border-white/[0.08]"
                                  : "bg-white text-slate-800 border-slate-200 shadow-2xs"
                              }`}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No roles assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Staff Invitations Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
            Pending Staff Invitations ({filteredInvitations.length})
          </h2>
        </div>

        {filteredInvitations.length === 0 ? (
          <div
            className={`p-6 text-center text-xs rounded-2xl sm:rounded-3xl border ${
              isDark ? "bg-[#121622]/40 border-white/[0.04] text-[#8F95A3]" : "bg-white border-slate-200/60 text-slate-400"
            }`}
          >
            No pending staff invitations awaiting activation.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInvitations.map((inv) => (
              <div
                key={inv.id}
                className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition flex flex-col justify-between space-y-3 ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                    : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border ${
                        isDark
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs sm:text-sm font-bold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                        {inv.email}
                      </h4>
                      <span className={`text-[10px] sm:text-[11px] block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] border whitespace-nowrap ${
                      isDark ? "bg-white/[0.06] text-slate-200 border-white/[0.08]" : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}>
                      {inv.role?.name || "General Access"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] border whitespace-nowrap ${
                      isDark ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                      {inv.outlet?.name || "All Outlets"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                  <button
                    onClick={() => handleResendInvite(inv.id, inv.email)}
                    disabled={actionLoadingId === `resend-${inv.id}`}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer disabled:opacity-50 ${
                      isDark
                        ? "bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border-white/10"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                    }`}
                  >
                    {actionLoadingId === `resend-${inv.id}` ? "Sending..." : "Resend"}
                  </button>
                  <button
                    onClick={() => handleCancelInvitation(inv.id)}
                    disabled={actionLoadingId === `cancel-${inv.id}`}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 border ${
                      isDark
                        ? "text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30"
                        : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                    }`}
                  >
                    {actionLoadingId === `cancel-${inv.id}` ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GRANT PORTAL ACCESS MODAL */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 transition ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#0071E3] block">
                  Access Provisioning
                </span>
                <h2 className="text-base font-bold tracking-tight mt-0.5">
                  {createdInviteUrl ? "Invitation Ready" : "Grant Portal Access"}
                </h2>
                <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {createdInviteUrl
                    ? "Invitation has been created and is ready to share."
                    : "Invite a team member to access this restaurant operating console."}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsGrantModalOpen(false);
                  setCreatedInviteUrl("");
                  if (onCloseGrantModal) onCloseGrantModal();
                }}
                className={`p-1.5 rounded-lg transition text-base cursor-pointer ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                ✕
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="space-y-4 pt-1">
                <div
                  className={`p-4 rounded-2xl border ${
                    isDark ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-100" : "bg-emerald-50 border-emerald-200 text-emerald-950"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold">
                        {createdEmailSent ? "Invitation Email Sent!" : "Invitation Link Created"}
                      </h4>
                      <p className="text-[11px] opacity-80">
                        {createdEmailSent
                          ? `An activation email was delivered to ${formData.email}.`
                          : "Email delivery not configured. Copy and share the activation URL below."}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Activation Link:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdInviteUrl}
                      className={`flex-1 px-3 py-2 text-xs font-mono rounded-xl border ${
                        isDark ? "bg-black/40 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedInvite ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setIsGrantModalOpen(false);
                      setCreatedInviteUrl("");
                      if (onCloseGrantModal) onCloseGrantModal();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0071E3] text-white cursor-pointer hover:bg-[#0077ED]"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4 pt-1">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                    {modalError}
                  </div>
                )}

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Link to Staff Profile (Optional)
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="">-- No staff profile (independent login) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    User Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. chef@restaurant.com"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      Initial Security Role *
                    </label>
                    <select
                      required
                      value={formData.roleId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, roleId: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">Select a role...</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      Branch Outlet
                    </label>
                    <select
                      value={formData.outletId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, outletId: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">All Outlets (Default)</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGrantModalOpen(false);
                      if (onCloseGrantModal) onCloseGrantModal();
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Generating..." : "Generate Invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LINK STAFF PROFILE MODAL */}
      {linkingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div>
              <h3 className="text-base font-bold">Link Staff Profile</h3>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Connect login account <span className="font-semibold text-[#0071E3]">{linkingTarget.userEmail}</span> to an HR staff profile.
              </p>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Select Employee Profile
              </label>
              <select
                value={selectedLinkEmployeeId}
                onChange={(e) => setSelectedLinkEmployeeId(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                }`}
              >
                <option value="">-- Remove link (Unlinked account) --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setLinkingTarget(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={linkSaving}
                onClick={() => handleSaveStaffLink(selectedLinkEmployeeId || null)}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {linkSaving ? "Saving..." : "Save Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ROLES & PROFILE MODAL */}
      {editRolesTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div>
              <h3 className="text-base font-bold">Edit User Roles & Access</h3>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Configure assigned security roles for <span className="font-semibold text-[#0071E3]">{editRolesTarget.userEmail}</span>
              </p>
            </div>

            {editRolesError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                {editRolesError}
              </div>
            )}

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Assign Security Roles
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {roles.map((r) => {
                  const checked = editRolesTarget.selectedRoleIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                        checked
                          ? isDark
                            ? "bg-[#0071E3]/15 border-[#0071E3]/30 text-white"
                            : "bg-blue-50 border-blue-200 text-blue-900 font-semibold"
                          : isDark
                          ? "bg-transparent border-white/[0.04] text-[#8F95A3] hover:border-white/[0.08]"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = editRolesTarget.selectedRoleIds;
                          setEditRolesTarget({
                            ...editRolesTarget,
                            selectedRoleIds: checked
                              ? current.filter((id) => id !== r.id)
                              : [...current, r.id],
                          });
                        }}
                        className="accent-[#0071E3]"
                      />
                      <span>{r.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setEditRolesTarget(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editRolesSaving}
                onClick={handleSaveRolesAndProfile}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {editRolesSaving ? "Saving..." : "Update Roles"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET 2FA MODAL */}
      {confirmReset2faTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold">Reset Two-Factor Authentication</h3>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Are you sure you want to reset 2FA credentials for <span className="font-semibold text-white">{confirmReset2faTarget.email}</span>? They will be prompted to re-register upon next login.
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setConfirmReset2faTarget(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting2fa}
                onClick={handleConfirmReset2fa}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {resetting2fa ? "Resetting..." : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE ACCESS CONFIRMATION MODAL */}
      {confirmRemoveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold text-rose-500">Revoke User Access</h3>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Are you sure you want to remove user access for <span className="font-semibold text-white">{confirmRemoveTarget.email}</span>? They will immediately lose login privileges to this restaurant console.
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setConfirmRemoveTarget(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoadingId === `remove-${confirmRemoveTarget.membershipId}`}
                onClick={() => handleRemoveMembership(confirmRemoveTarget.membershipId, confirmRemoveTarget.email)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === `remove-${confirmRemoveTarget.membershipId}` ? "Removing..." : "Revoke Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
