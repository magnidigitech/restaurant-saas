"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

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

export default function InternalUsersPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
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
  const [showModal, setShowModal] = useState(false);
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
        setMemberships(dataUsers.memberships || []);
        setPendingInvitations(dataUsers.pendingInvitations || []);
        if (dataUsers.currentUserId) setCurrentUserId(dataUsers.currentUserId);
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
        setSuccessMsg(`Invitation created & user access email sent to ${formData.email}`);
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
    if (
      !window.confirm(
        `Are you sure you want to remove user access for ${email}? They will no longer be able to log in to this restaurant.`
      )
    ) {
      return;
    }
    setActionLoadingId(`remove-${membershipId}`);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/users?membershipId=${membershipId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove user membership");
      setSuccessMsg(`User access removed for ${email}`);
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

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading User Accounts...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="User Accounts" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Dashboard
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Administration
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              User Accounts & Staff Logins
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Grant application login credentials and manage access memberships for staff members.
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setCreatedInviteUrl("");
              setShowModal(true);
            }}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            + Grant App Access
          </button>
        </div>

        {successMsg && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs animate-in fade-in transition ${
              isDark
                ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-950 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
                ✓
              </span>
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg("")}
              className={`font-bold ml-4 p-1 rounded-md transition cursor-pointer ${
                isDark ? "text-emerald-400/70 hover:text-emerald-300" : "text-emerald-800/70 hover:text-emerald-950"
              }`}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs animate-in fade-in transition ${
              isDark
                ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                : "bg-rose-50 border-rose-200 text-rose-950 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[11px] font-bold">
                !
              </span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError("")}
              className={`font-bold ml-4 p-1 rounded-md transition cursor-pointer ${
                isDark ? "text-rose-400/70 hover:text-rose-300" : "text-rose-800/70 hover:text-rose-950"
              }`}
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Memberships Table */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex justify-between items-center">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Active App Memberships ({memberships.length})
            </h2>
          </div>

          {memberships.length === 0 ? (
            <div className={`p-8 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              No active user accounts found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? "border-white/[0.08] text-slate-400" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <th className="pb-3 px-3">User Email</th>
                    <th className="pb-3 px-3">Linked Staff Profile</th>
                    <th className="pb-3 px-3">Assigned Roles</th>
                    <th className="pb-3 px-3">Member Since</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {m.user.email}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {m.employee ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              {m.employee.firstName} {m.employee.lastName}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
                                isDark
                                  ? "bg-white/[0.08] text-slate-300 border border-white/[0.08]"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
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
                              className={`text-[10px] underline ml-1 cursor-pointer transition ${
                                isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                              }`}
                              title="Change linked staff profile"
                            >
                              Change
                            </button>
                          </div>
                        ) : m.user.id === currentUserId ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                isDark
                                  ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                  : "bg-sky-50 text-sky-800 border-sky-300"
                              }`}
                            >
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
                              className={`text-[10px] underline cursor-pointer transition ${
                                isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                              }`}
                              title="Link this login to an HR staff roster profile"
                            >
                              + Link Profile
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                isDark
                                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
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
                              className={`text-[10px] font-semibold underline cursor-pointer transition ${
                                isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-800"
                              }`}
                            >
                              Link Profile
                            </button>
                          </div>
                        )}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {(() => {
                          const activeRoles: [string, string][] = Array.from(
                            new Map<string, string>(
                              (m.accessGrants || [])
                                .filter((g: any) => g.status === "ACTIVE" && g.role)
                                .map((g: any): [string, string] => [String(g.role.id), String(g.role.name)])
                            ).entries()
                          );
                          return activeRoles.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                              {activeRoles.map(([rId, rName]) => (
                                <span
                                  key={rId}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    rName.toLowerCase().includes("owner") || rName.toLowerCase().includes("admin")
                                      ? isDark
                                        ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                        : "bg-purple-100 text-purple-800 border-purple-300"
                                      : isDark
                                      ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                      : "bg-blue-50 text-blue-800 border-blue-200"
                                  }`}
                                >
                                  {rName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                              No Roles Assigned
                            </span>
                          );
                        })()}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        {m.joinedAt
                          ? new Date(m.joinedAt).toLocaleDateString()
                          : m.createdAt
                          ? new Date(m.createdAt).toLocaleDateString()
                          : "Active"}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                            isDark
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          Active
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRoles(m)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer border ${
                              isDark
                                ? "text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30"
                                : "text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200"
                            }`}
                          >
                            Edit Roles & Profile
                          </button>
                          {m.user.id === currentUserId ? (
                            <span className={`text-[11px] font-medium italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                              You
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveTarget({ membershipId: m.id, email: m.user.email })}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer border ${
                                isDark
                                  ? "text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30"
                                  : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                              }`}
                            >
                              Remove Access
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invitations Table */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
            Pending Staff Invitations ({pendingInvitations.length})
          </h2>

          {pendingInvitations.length === 0 ? (
            <div className={`p-8 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              No pending staff invitations awaiting activation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? "border-white/[0.08] text-slate-400" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <th className="pb-3 px-3">Invited Email</th>
                    <th className="pb-3 px-3">Role Assigned</th>
                    <th className="pb-3 px-3">Branch Outlet</th>
                    <th className="pb-3 px-3">Expires</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {pendingInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {inv.email}
                      </td>
                      <td className={`py-3.5 px-3 font-medium ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {inv.role?.name || "General Access"}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {inv.outlet?.name || "All Outlets"}
                      </td>
                      <td className={`py-3.5 px-3 font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResendInvite(inv.id, inv.email)}
                            disabled={actionLoadingId === `resend-${inv.id}`}
                            title="Resend access invitation email"
                            className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer disabled:opacity-50 ${
                              isDark
                                ? "bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border-white/10"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                            }`}
                          >
                            {actionLoadingId === `resend-${inv.id}` ? "Sending..." : "Resend Email"}
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(inv.id)}
                            disabled={actionLoadingId === `cancel-${inv.id}`}
                            title="Cancel invitation and free up user slot"
                            className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 border ${
                              isDark
                                ? "text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30"
                                : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                            }`}
                          >
                            {actionLoadingId === `cancel-${inv.id}` ? "Cancelling..." : "Cancel"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* EXECUTIVE ACCESS PROVISIONING MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 transition ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#0071E3] block">
                  Access Provisioning
                </span>
                <h2 className="text-base font-bold tracking-tight mt-0.5">
                  {createdInviteUrl ? "Workspace Invitation Ready" : "Grant Portal Access"}
                </h2>
                <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {createdInviteUrl
                    ? "Invitation has been processed and is ready for team onboarding."
                    : "Invite a team member to access this restaurant's operating console."}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError("");
                  setCreatedInviteUrl("");
                }}
                className={`p-1.5 rounded-lg transition text-base cursor-pointer ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                ✕
              </button>
            </div>

            {/* SUCCESS CONFIRMATION STATE */}
            {createdInviteUrl ? (
              <div className="space-y-5 pt-1">
                {/* Executive Status Banner with Crisp Contrast */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition ${
                    isDark
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-100"
                      : "bg-emerald-50 border-emerald-200 text-emerald-950"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base shadow-sm ${
                        isDark
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-emerald-600 text-white shadow-emerald-600/20"
                      }`}
                    >
                      {createdEmailSent ? "✉️" : "✓"}
                    </div>
                    <div className="space-y-1">
                      <h4
                        className={`text-sm font-bold tracking-tight ${
                          isDark ? "text-emerald-300" : "text-emerald-950"
                        }`}
                      >
                        {createdEmailSent ? "Invitation Email Delivered" : "Access Credentials Provisioned"}
                      </h4>
                      <p
                        className={`text-xs leading-relaxed ${
                          isDark ? "text-emerald-200/90" : "text-emerald-900/90"
                        }`}
                      >
                        {createdEmailSent
                          ? `An access invitation email with secure password setup instructions has been dispatched to ${formData.email}.`
                          : `An activation token has been generated for ${formData.email}. Share the direct activation link below to let them set up their account.`}
                      </p>
                    </div>
                  </div>

                  {/* Summary Details Matrix */}
                  <div
                    className={`mt-4 pt-3.5 border-t grid grid-cols-2 gap-3 text-xs ${
                      isDark
                        ? "border-emerald-500/20 text-emerald-200/80"
                        : "border-emerald-200 text-emerald-950"
                    }`}
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-75 block">
                        Recipient Account
                      </span>
                      <span className={`font-semibold truncate block mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                        {formData.email}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-75 block">
                        Assigned Scope
                      </span>
                      <span className={`font-semibold truncate block mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                        {roles.find((r) => r.id === formData.roleId)?.name || "Staff"} • {outlets.find((o) => o.id === formData.outletId)?.name || "All Outlets"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Link Box */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? "text-slate-400" : "text-slate-700"
                      }`}
                    >
                      Direct Activation Link (Expires in 7 Days)
                    </label>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                        isDark
                          ? "bg-white/[0.06] text-slate-300 border-white/10"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      Single-Use
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono select-all transition ${
                      isDark
                        ? "bg-[#0A0C12] border-white/10 text-emerald-400"
                        : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  >
                    <span className="truncate mr-3 font-semibold">{createdInviteUrl}</span>
                  </div>

                  <button
                    onClick={handleCopyLink}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                      copiedInvite
                        ? "bg-emerald-600 text-white"
                        : "bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white"
                    }`}
                  >
                    {copiedInvite ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Link Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Copy Activation Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Secondary Navigation Actions */}
                <div
                  className={`flex items-center justify-between pt-3 border-t ${
                    isDark ? "border-white/[0.08]" : "border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedInviteUrl("");
                      setFormData({ employeeId: "", email: "", roleId: "", outletId: "" });
                    }}
                    className={`text-xs font-semibold hover:underline cursor-pointer ${
                      isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    + Invite Another Staff Member
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setCreatedInviteUrl("");
                      setFormData({ employeeId: "", email: "", roleId: "", outletId: "" });
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                      isDark
                        ? "bg-white/[0.08] hover:bg-white/[0.14] text-white border-white/[0.1]"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                    }`}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4 pt-1">
                {modalError && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in transition ${
                      isDark
                        ? "bg-rose-950/60 border-rose-500/40 text-rose-200"
                        : "bg-rose-50 border-rose-300 text-rose-900"
                    }`}
                  >
                    <span className="text-base shrink-0 leading-none">⚠️</span>
                    <div className="flex-1 text-[11px] leading-relaxed">
                      <span className="font-bold block text-xs mb-0.5">Invitation Not Allowed</span>
                      {modalError}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalError("")}
                      className="text-xs p-1 opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    Select Staff Member
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] cursor-pointer ${
                      isDark
                        ? "bg-[#0A0C12] border-white/10 text-white"
                        : "bg-white border-slate-300 text-slate-900 shadow-xs"
                    }`}
                  >
                    <option value="">Choose employee profile to auto-fill...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    Login Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (modalError) setModalError("");
                    }}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] ${
                      isDark
                        ? "bg-[#0A0C12] border-white/10 text-white"
                        : "bg-white border-slate-300 text-slate-900 shadow-xs"
                    }`}
                  />
                  {formData.email.trim() &&
                    memberships.some(
                      (m) => m.user.email.toLowerCase() === formData.email.trim().toLowerCase()
                    ) && (
                      <div
                        className={`mt-2 p-3 rounded-xl border text-[11px] flex items-start gap-2 animate-in fade-in transition ${
                          isDark
                            ? "bg-amber-950/40 border-amber-500/30 text-amber-200"
                            : "bg-amber-50 border-amber-300 text-amber-900"
                        }`}
                      >
                        <span className="text-base shrink-0 leading-none">💡</span>
                        <div className="leading-relaxed">
                          <strong className="block font-bold">This user is already an active member!</strong>
                          <span>
                            {formData.email} already has portal access. To assign them additional roles (e.g. Analytics, Shift Manager), please close this dialog and click <strong>&quot;Edit Roles &amp; Profile&quot;</strong> on their row in the Active Members table.
                          </span>
                        </div>
                      </div>
                    )}
                  <p className={`text-[11px] mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Access instructions and a cryptographic password setup link will be dispatched to this email.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      System Role *
                    </label>
                    <select
                      required
                      value={formData.roleId}
                      onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] cursor-pointer ${
                        isDark
                          ? "bg-[#0A0C12] border-white/10 text-white"
                          : "bg-white border-slate-300 text-slate-900 shadow-xs"
                      }`}
                    >
                      <option value="">Select Role...</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      Branch Outlet Scope
                    </label>
                    <select
                      value={formData.outletId}
                      onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] cursor-pointer ${
                        isDark
                          ? "bg-[#0A0C12] border-white/10 text-white"
                          : "bg-white border-slate-300 text-slate-900 shadow-xs"
                      }`}
                    >
                      <option value="">All Outlets (Global)</option>
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
                    onClick={() => setShowModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending Invitation...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Access Invitation</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LINK STAFF PROFILE MODAL */}
      {linkingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 transition ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#0071E3] block">
                  Workforce Directory
                </span>
                <h2 className="text-base font-bold tracking-tight mt-0.5">Link Staff Profile</h2>
                <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Connect <strong className={isDark ? "text-white" : "text-slate-900"}>{linkingTarget.userEmail}</strong> with an HR employee profile from your roster.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLinkingTarget(null)}
                className={`p-1.5 rounded-lg transition text-base cursor-pointer ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  Select Employee from Staff Directory
                </label>
                <select
                  value={selectedLinkEmployeeId}
                  onChange={(e) => setSelectedLinkEmployeeId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] cursor-pointer ${
                    isDark
                      ? "bg-[#0A0C12] border-white/10 text-white"
                      : "bg-white border-slate-300 text-slate-900 shadow-xs"
                  }`}
                >
                  <option value="">-- Choose Employee --</option>
                  {employees
                    .filter((e) => !e.archivedAt)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode}) {emp.personalEmail ? `• ${emp.personalEmail}` : ""}
                      </option>
                    ))}
                </select>
              </div>

              <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Linking connects this user account to their attendance punches, shift rosters, and payroll records.
              </p>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              {linkingTarget.currentEmployeeId ? (
                <button
                  type="button"
                  onClick={() => handleSaveStaffLink(null)}
                  disabled={linkSaving}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer disabled:opacity-50"
                >
                  Unlink Profile
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLinkingTarget(null)}
                  disabled={linkSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveStaffLink(selectedLinkEmployeeId || null)}
                  disabled={linkSaving || !selectedLinkEmployeeId}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {linkSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Link...</span>
                    </>
                  ) : (
                    <span>Save Link</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM REVOKE ACCESS MODAL */}
      {confirmRemoveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 text-xl font-bold shrink-0">
                ⚠️
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-base font-bold">Revoke User Access</h3>
                <p className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Are you sure you want to revoke access for <strong className={isDark ? "text-white" : "text-slate-900"}>{confirmRemoveTarget.email}</strong>?
                </p>
                <p className={`text-[11px] p-2.5 rounded-xl border mt-2 leading-relaxed ${
                  isDark ? "bg-rose-950/30 border-rose-500/20 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  This will remove all assigned roles, revoke login access, and invalidate all active sessions for this restaurant.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                disabled={actionLoadingId === `remove-${confirmRemoveTarget.membershipId}`}
                onClick={() => setConfirmRemoveTarget(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoadingId === `remove-${confirmRemoveTarget.membershipId}`}
                onClick={async () => {
                  await handleRemoveMembership(confirmRemoveTarget.membershipId, confirmRemoveTarget.email);
                  setConfirmRemoveTarget(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoadingId === `remove-${confirmRemoveTarget.membershipId}` ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Revoking Access...</span>
                  </>
                ) : (
                  <span>Yes, Revoke Access</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE PROFILE & ASSIGN MULTIPLE ROLES MODAL */}
      {editRolesTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 transition ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#0071E3] block">
                  Workforce &amp; Permissions
                </span>
                <h2 className="text-base font-bold tracking-tight mt-0.5">Edit Profile &amp; Assign Roles</h2>
                <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Update roles and linked staff profile for <strong className={isDark ? "text-white" : "text-slate-900"}>{editRolesTarget.userEmail}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditRolesTarget(null)}
                className={`p-1.5 rounded-lg transition text-base cursor-pointer ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                ✕
              </button>
            </div>

            {/* Modal Error */}
            {editRolesError && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in transition ${
                  isDark ? "bg-rose-950/60 border-rose-500/40 text-rose-200" : "bg-rose-50 border-rose-300 text-rose-900"
                }`}
              >
                <span className="text-base shrink-0 leading-none">⚠️</span>
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-bold block text-xs mb-0.5">Failed to Update</span>
                  {editRolesError}
                </div>
                <button
                  type="button"
                  onClick={() => setEditRolesError("")}
                  className="text-xs p-1 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="space-y-4">
              {/* Linked Staff Profile */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  Linked HR Staff Profile
                </label>
                <select
                  value={editRolesTarget.employeeId}
                  onChange={(e) =>
                    setEditRolesTarget({ ...editRolesTarget, employeeId: e.target.value })
                  }
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] cursor-pointer ${
                    isDark
                      ? "bg-[#0A0C12] border-white/10 text-white"
                      : "bg-white border-slate-300 text-slate-900 shadow-xs"
                  }`}
                >
                  <option value="">-- No HR Staff Profile Linked (Unlinked) --</option>
                  {employees
                    .filter((e) => !e.archivedAt)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode}) {emp.personalEmail ? `• ${emp.personalEmail}` : ""}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Links this user login to time punches, shift rosters, and payroll records.
                </p>
              </div>

              {/* Multiple Roles Checkbox Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    Assigned Roles ({editRolesTarget.selectedRoleIds.length} Selected)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setEditRolesTarget({
                          ...editRolesTarget,
                          selectedRoleIds: roles.map((r) => r.id),
                        })
                      }
                      className="text-[#0071E3] hover:underline font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className={isDark ? "text-white/20" : "text-slate-300"}>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditRolesTarget({
                          ...editRolesTarget,
                          selectedRoleIds: [],
                        })
                      }
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-2xl border max-h-56 overflow-y-auto space-y-2 ${
                    isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50/70 border-slate-200"
                  }`}
                >
                  {roles.length === 0 ? (
                    <p className={`text-xs p-3 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      No roles created yet.
                    </p>
                  ) : (
                    roles.map((r) => {
                      const isChecked = editRolesTarget.selectedRoleIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-start gap-3 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                            isChecked
                              ? isDark
                                ? "bg-blue-500/15 border-blue-500/30 text-white"
                                : "bg-blue-50/80 border-blue-200 text-blue-900"
                              : isDark
                              ? "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] text-slate-300"
                              : "bg-white border-slate-200/80 hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const newRoles = e.target.checked
                                ? [...editRolesTarget.selectedRoleIds, r.id]
                                : editRolesTarget.selectedRoleIds.filter((id) => id !== r.id);
                              setEditRolesTarget({
                                ...editRolesTarget,
                                selectedRoleIds: newRoles,
                              });
                            }}
                            className="mt-0.5 w-4 h-4 rounded text-[#0071E3] focus:ring-[#0071E3] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{r.name}</span>
                              {r.permissions && r.permissions.length > 0 && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                    isDark ? "bg-white/10 text-slate-300" : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {r.permissions.length} perms
                                </span>
                              )}
                            </div>
                            {r.description && (
                              <p className={`text-[11px] mt-0.5 truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {r.description}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Branch Outlet Scope */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  Branch Outlet Scope
                </label>
                <select
                  value={editRolesTarget.outletId}
                  onChange={(e) =>
                    setEditRolesTarget({ ...editRolesTarget, outletId: e.target.value })
                  }
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] cursor-pointer ${
                    isDark
                      ? "bg-[#0A0C12] border-white/10 text-white"
                      : "bg-white border-slate-300 text-slate-900 shadow-xs"
                  }`}
                >
                  <option value="">All Outlets (Global Scope)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setEditRolesTarget(null)}
                disabled={editRolesSaving}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRolesAndProfile}
                disabled={editRolesSaving}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {editRolesSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Roles &amp; Profile</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
