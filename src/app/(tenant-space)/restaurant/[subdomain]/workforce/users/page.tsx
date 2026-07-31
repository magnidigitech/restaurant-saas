"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function InternalUsersPage() {
  const router = useRouter();

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
    } catch (e) {
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
      const url = `${protocol}//${host}/activate?token=${data.inviteToken}`;
      setCreatedInviteUrl(url);

      fetchData();
    } catch (err: any) {
      setError(err.message || "Error creating invitation");
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
          <h2 className="text-3xl font-extrabold text-white">App Users & Staff Invitations</h2>
          <p className="text-sm text-slate-400 mt-1">Grant application login credentials to existing employees.</p>
        </div>
        <button
          onClick={() => { setError(""); setCreatedInviteUrl(""); setShowModal(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-lg"
        >
          + Grant App Access to Employee
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading users...</div>
      ) : (
        <div className="space-y-8">
          {/* Active Memberships */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Active App Memberships ({memberships.length})</h3>
            {memberships.length === 0 ? (
              <div className="text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-2xl">
                No active user memberships found.
              </div>
            ) : (
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                      <th className="p-4">User Email</th>
                      <th className="p-4">Linked Employee</th>
                      <th className="p-4">Joined Date</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-sm">
                    {memberships.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-900/10">
                        <td className="p-4 text-white font-bold">{m.user.email}</td>
                        <td className="p-4 text-slate-300">
                          {m.employee ? (
                            <span className="font-semibold text-blue-400">
                              {m.employee.firstName} {m.employee.lastName} ({m.employee.employeeCode})
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Unlinked</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-400 text-xs">{new Date(m.joinedAt).toLocaleDateString()}</td>
                        <td className="p-4">
                          <span className="text-xs px-2.5 py-1 rounded bg-green-950 text-green-200 border border-green-800 font-bold uppercase">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Pending Invitations ({pendingInvitations.length})</h3>
            {pendingInvitations.length === 0 ? (
              <div className="text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-2xl text-sm">
                No pending invitations.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white">{inv.email}</h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-950 text-yellow-200 border border-yellow-800 font-bold uppercase">
                        SENT
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <p>Initial Role: <span className="text-slate-200 font-semibold">{inv.role?.name || "-"}</span></p>
                      <p>Outlet Scope: <span className="text-slate-200">{inv.outlet?.name || "Restaurant-Wide"}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Grant Application Access</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>

            {createdInviteUrl ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-950/40 border border-green-800 text-green-200 text-xs rounded-xl space-y-2">
                  <p className="font-bold">✓ Activation Link Created Successfully!</p>
                  <p className="text-slate-300">Copy and share this secure link with the employee to set their password:</p>
                </div>
                <input
                  readOnly
                  value={createdInviteUrl}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-blue-300 selection:bg-blue-900"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdInviteUrl);
                    alert("Activation URL copied to clipboard!");
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg cursor-pointer"
                >
                  Copy Activation URL
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Select Employee *</label>
                  <select
                    required
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  >
                    <option value="">Select an employee...</option>
                    {employees
                      .filter((e) => !e.archivedAt)
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.employeeCode})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Login Email *</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="employee@restaurant.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Initial Role *</label>
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
                    {saving ? "Generating..." : "Generate Invitation Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  </div>
);
}
