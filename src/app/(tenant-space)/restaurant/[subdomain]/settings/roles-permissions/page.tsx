"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function RolesPermissionsPage() {
  const router = useRouter();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

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
    } catch (e) {
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
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/restaurant/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName,
          description: roleDesc,
          permissionIds: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create role");

      setShowModal(false);
      setRoleName("");
      setRoleDesc("");
      setSelectedPermissions([]);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Error creating role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100">
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-xs text-blue-400 hover:text-blue-300 mb-2 cursor-pointer">
            &larr; Back to Dashboard
          </button>
          <h2 className="text-3xl font-extrabold text-white">Custom Roles & Permissions Matrix</h2>
          <p className="text-sm text-slate-400 mt-1">Define restaurant-level custom roles and granular permission sets.</p>
        </div>
        <button
          onClick={() => { setError(""); setShowModal(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-lg"
        >
          + Create Custom Role
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading roles...</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.id} className="bg-slate-900/30 border border-slate-900 p-6 rounded-2xl space-y-4 hover:border-slate-800 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">{role.name}</h3>
                <p className="text-xs text-slate-400">{role.description || "No description provided."}</p>
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Permissions ({role.permissions.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((rp) => (
                      <span key={rp.permissionId} className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-blue-300 border border-slate-800 font-mono">
                        {rp.permissionId}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg p-6 rounded-2xl space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Create Custom Role</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Role Name *</label>
                <input
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Senior Shift Supervisor"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Description</label>
                <input
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Role duties overview"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Assign Permissions</label>
                <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  {permissions.map((p) => {
                    const isChecked = selectedPermissions.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(p.id)}
                          className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-0"
                        />
                        <span className="font-mono text-blue-400">{p.id}</span>
                        <span className="text-slate-500">({p.name})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Role"}
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
