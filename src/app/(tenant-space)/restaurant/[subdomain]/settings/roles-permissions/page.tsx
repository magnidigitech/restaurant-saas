"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface Permission {
  id: string;
  name: string;
  description: string | null;
  moduleId: string;
  module: { name: string };
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ permissionId: string }>;
}

export default function RolesPermissionsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRoles, resPerms] = await Promise.all([
        fetch("/api/restaurant/roles"),
        fetch("/api/restaurant/permissions"),
      ]);

      const dataRoles = await resRoles.json();
      const dataPerms = await resPerms.json();

      if (resRoles.ok) setRoles(dataRoles.roles || []);
      if (resPerms.ok) setPermissions(dataPerms.permissions || []);
    } catch {
      setError("Network error loading roles and permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingRoleId ? `/api/restaurant/roles/${editingRoleId}` : "/api/restaurant/roles";
      const method = editingRoleId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName,
          description: roleDesc,
          permissionIds: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${editingRoleId ? "update" : "create"} role`);

      setShowModal(false);
      setEditingRoleId(null);
      setRoleName("");
      setRoleDesc("");
      setSelectedPermissions([]);
      fetchData();
    } catch (err: any) {
      setError(err.message || `Error ${editingRoleId ? "updating" : "creating"} role`);
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, p) => {
    const mod = p.module?.name || "General";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Roles & Permissions...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Roles & Permissions" />

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
              Roles & Access Control Policies
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Define customized authorization roles and assign granular module permissions.
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setEditingRoleId(null);
              setRoleName("");
              setRoleDesc("");
              setSelectedPermissions([]);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            + Create New Role
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Roles Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`p-6 rounded-3xl border transition space-y-4 flex flex-col justify-between ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {role.name}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isDark ? "bg-white/[0.04] text-[#58A6FF] border-white/[0.08]" : "bg-blue-50 text-blue-800 border-blue-200"
                  }`}>
                    {role.permissions.length} Permissions
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {role.description || "No description provided"}
                  </p>
                  {role.name !== "Restaurant Owner" && (
                    <button
                      onClick={() => {
                        setEditingRoleId(role.id);
                        setRoleName(role.name);
                        setRoleDesc(role.description || "");
                        setSelectedPermissions(role.permissions.map(p => p.permissionId));
                        setShowModal(true);
                      }}
                      className={`text-xs font-medium px-3 py-1 rounded-lg border transition cursor-pointer ${
                        isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className={`pt-3 border-t text-[11px] font-medium ${
                isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-100 text-slate-400"
              }`}>
                Role ID: <span className="font-mono">{role.id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Create Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">{editingRoleId ? "Edit Role" : "Create Custom Role"}</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Assign specific permission keys to this role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kitchen Lead"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Role Description
                  </label>
                  <input
                    type="text"
                    placeholder="Responsibilities and access scope"
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-2 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Assign Permissions ({selectedPermissions.length} selected)
                </label>

                <div className="space-y-3">
                  {Object.entries(permissionsByModule).map(([modName, perms]) => (
                    <div
                      key={modName}
                      className={`p-3.5 rounded-2xl border ${
                        isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                        {modName}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {perms.map((p) => {
                          const checked = selectedPermissions.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition text-xs ${
                                checked
                                  ? isDark
                                    ? "bg-[#0071E3]/15 border-[#0071E3]/30 text-white"
                                    : "bg-blue-50 border-blue-200 text-blue-900"
                                  : isDark
                                  ? "bg-transparent border-white/[0.04] text-[#8F95A3] hover:border-white/[0.08]"
                                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(p.id)}
                                className="mt-0.5 accent-[#0071E3]"
                              />
                              <div className="min-w-0">
                                <span className="font-semibold block truncate">{p.name}</span>
                                {p.description && (
                                  <span className={`text-[10px] block leading-tight ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                    {p.description}
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                  {saving ? "Saving..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Close Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"}`}>
            <h3 className="text-base font-bold tracking-tight">Save Changes?</h3>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Do you want to save your changes or discard them?
            </p>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setShowModal(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white bg-white/5" : "text-slate-600 hover:text-slate-900 bg-slate-100"
                }`}
              >
                Discard
              </button>
              <button
                onClick={(e) => {
                  setShowConfirm(false);
                  handleSaveRole(e as any);
                }}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
