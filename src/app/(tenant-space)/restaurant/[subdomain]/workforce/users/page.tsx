"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface Role {
  id: string;
  name: string;
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: "",
    email: "",
    roleId: "",
    outletId: "",
  });

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

      fetchData();
    } catch (err: any) {
      setError(err.message || "Error creating invitation");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (createdInviteUrl) {
      navigator.clipboard.writeText(createdInviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
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

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Active Memberships Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex justify-between items-center">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Active App Memberships ({memberships.length})
            </h2>
          </div>

          {memberships.length === 0 ? (
            <div className={`p-8 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              No active user accounts logged.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-3 px-3">User Email</th>
                    <th className="pb-3 px-3">Linked Staff Profile</th>
                    <th className="pb-3 px-3">Member Since</th>
                    <th className="pb-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {m.user.email}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {m.employee ? `${m.employee.firstName} ${m.employee.lastName} (${m.employee.employeeCode})` : "Unlinked Account"}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          Active
                        </span>
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
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
            Pending Staff Invitations ({pendingInvitations.length})
          </h2>

          {pendingInvitations.length === 0 ? (
            <div className={`p-8 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              No pending staff invitations awaiting activation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-3 px-3">Invited Email</th>
                    <th className="pb-3 px-3">Role Assigned</th>
                    <th className="pb-3 px-3">Branch Outlet</th>
                    <th className="pb-3 px-3">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {pendingInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {inv.email}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {inv.role?.name || "General Access"}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {inv.outlet?.name || "All Outlets"}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Grant App Access Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Grant App Access</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Invite a staff member to access the management portal.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError("");
                  setCreatedInviteUrl("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl space-y-2">
                  <p className="font-semibold">Staff Invitation Generated!</p>
                  <p className="opacity-90">Share this activation link with the staff member to let them set up their account password.</p>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    {copiedInvite ? "✓ Link Copied to Clipboard" : "Copy Activation Link"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Select Staff Member
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="">Choose employee profile...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Login Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      System Role *
                    </label>
                    <select
                      required
                      value={formData.roleId}
                      onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
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
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Branch Outlet Scope
                    </label>
                    <select
                      value={formData.outletId}
                      onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
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
                    {saving ? "Generating..." : "Generate Invitation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
