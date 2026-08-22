"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

export default function AccessGrantsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [grants, setGrants] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    membershipId: "",
    moduleId: "",
    roleId: "",
    outletId: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resGrants, resUsers, resMods, resRoles, resOutlets] = await Promise.all([
        fetch("/api/restaurant/access-grants"),
        fetch("/api/restaurant/users"),
        fetch("/api/restaurant/modules"),
        fetch("/api/restaurant/roles"),
        fetch("/api/restaurant/outlets"),
      ]);

      const dataGrants = await resGrants.json();
      const dataUsers = await resUsers.json();
      const dataMods = await resMods.json();
      const dataRoles = await resRoles.json();
      const dataOutlets = await resOutlets.json();

      if (resGrants.ok) setGrants(dataGrants.grants || []);
      if (resUsers.ok) setMemberships(dataUsers.memberships || []);
      if (resMods.ok) setModules(dataMods.modules || []);
      if (resRoles.ok) setRoles(dataRoles.roles || []);
      if (resOutlets.ok) setOutlets(dataOutlets.outlets || []);
    } catch {
      setError("Network error loading access grants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/restaurant/access-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: formData.membershipId,
          moduleId: formData.moduleId || undefined,
          roleId: formData.roleId || undefined,
          outletId: formData.outletId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create access grant");

      setShowModal(false);
      setFormData({ membershipId: "", moduleId: "", roleId: "", outletId: "" });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Error creating access grant");
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    if (!confirm("Are you sure you want to revoke this access grant?")) return;
    try {
      const res = await fetch(`/api/restaurant/access-grants?id=${grantId}`, {
        method: "DELETE",
      });
      if (res.ok) fetchData();
    } catch {
      setError("Failed to revoke grant");
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
        <p className="text-xs font-medium">Loading Access Grants...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Access Grants" />

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
              User Access Grants & Scopes
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Manage fine-grained module authorizations and branch outlet scoping per user membership.
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setShowModal(true);
            }}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            + New Access Grant
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Access Grants Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
            Configured Access Grants ({grants.length})
          </h2>

          {grants.length === 0 ? (
            <div className={`p-12 text-center text-xs space-y-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              <p className="font-semibold text-sm">No access grants configured</p>
              <p className="opacity-75">Click &quot;+ New Access Grant&quot; to assign custom role or module scopes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-3 px-3">User / Staff</th>
                    <th className="pb-3 px-3">Module Scope</th>
                    <th className="pb-3 px-3">Role Assigned</th>
                    <th className="pb-3 px-3">Outlet Scope</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {grants.map((g) => (
                    <tr key={g.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className="py-3 px-3">
                        <span className={`font-semibold block ${isDark ? "text-white" : "text-slate-900"}`}>
                          {g.membership?.user?.email || "Unknown User"}
                        </span>
                        {g.membership?.employee && (
                          <span className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {g.membership.employee.firstName} {g.membership.employee.lastName}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {g.module ? (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                            isDark ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]" : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {g.module.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">All Modules</span>
                        )}
                      </td>
                      <td className={`py-3 px-3 font-medium ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {g.role?.name || "Global Entitlement"}
                      </td>
                      <td className="py-3 px-3">
                        {g.outlet ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${
                            isDark ? "bg-blue-500/10 text-blue-300 border-blue-500/20" : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}>
                            {g.outlet.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">All Outlets</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleRevokeGrant(g.id)}
                          className="text-xs text-rose-500 hover:underline cursor-pointer font-medium"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* New Grant Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Create Access Grant</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Bind a user to a specific module, role, or outlet.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGrant} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  User Membership *
                </label>
                <select
                  required
                  value={formData.membershipId}
                  onChange={(e) => setFormData({ ...formData, membershipId: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">Select User...</option>
                  {memberships.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.email} {m.employee ? `(${m.employee.firstName} ${m.employee.lastName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Module Scope (Optional)
                </label>
                <select
                  value={formData.moduleId}
                  onChange={(e) => setFormData({ ...formData, moduleId: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">All Enabled Modules</option>
                  {modules.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Role Scope (Optional)
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">Default Permissions</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Outlet Scope (Optional)
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
                  {saving ? "Granting..." : "Create Grant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
