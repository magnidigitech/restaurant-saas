"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccessGrantsPage() {
  const router = useRouter();

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
    } catch (e) {
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
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create access grant");

      setShowModal(false);
      setFormData({ membershipId: "", moduleId: "", roleId: "", outletId: "" });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Error creating grant");
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    if (!confirm("Are you sure you want to revoke this access grant?")) return;

    try {
      const res = await fetch(`/api/restaurant/access-grants?grantId=${grantId}`, {
        method: "DELETE",
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
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
          <h2 className="text-3xl font-extrabold text-white">Module Access Grants</h2>
          <p className="text-sm text-slate-400 mt-1">Assign module-level roles and outlet restrictions to user memberships.</p>
        </div>
        <button
          onClick={() => { setError(""); setShowModal(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-lg"
        >
          + Create Access Grant
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading access grants...</div>
      ) : grants.length === 0 ? (
        <div className="text-slate-500 py-16 text-center border border-dashed border-slate-800 rounded-2xl">
          No access grants active. Click &quot;Create Access Grant&quot; to assign access.
        </div>
      ) : (
        <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                <th className="p-4">User / Member</th>
                <th className="p-4">Module</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Outlet Scope</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-sm">
              {grants.map((g) => (
                <tr key={g.id} className="hover:bg-slate-900/10">
                  <td className="p-4 text-white font-semibold">
                    {g.membership?.user?.email}
                    {g.membership?.employee && (
                      <span className="block text-xs text-slate-400 font-normal">
                        {g.membership.employee.firstName} {g.membership.employee.lastName}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-xs px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                      {g.module?.name || g.moduleId}
                    </span>
                  </td>
                  <td className="p-4 text-slate-200 font-medium">{g.role?.name}</td>
                  <td className="p-4 text-slate-400 text-xs">{g.outlet?.name || "Restaurant-Wide"}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleRevokeGrant(g.id)}
                      className="px-3 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-semibold rounded cursor-pointer"
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

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Create Access Grant</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreateGrant} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Select User Membership *</label>
                <select
                  required
                  value={formData.membershipId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, membershipId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                >
                  <option value="">Select membership...</option>
                  {memberships.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.email} {m.employee ? `(${m.employee.firstName} ${m.employee.lastName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Entitled Module *</label>
                <select
                  required
                  value={formData.moduleId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, moduleId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                >
                  <option value="">Select entitled module...</option>
                  {modules.map((mod) => (
                    <option key={mod.key} value={mod.key}>{mod.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Role *</label>
                <select
                  required
                  value={formData.roleId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, roleId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                >
                  <option value="">Select role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Outlet Scope (Optional)</label>
                <select
                  value={formData.outletId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, outletId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                >
                  <option value="">All Outlets (Restaurant-Wide)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
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
                  {saving ? "Creating..." : "Create Access Grant"}
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
