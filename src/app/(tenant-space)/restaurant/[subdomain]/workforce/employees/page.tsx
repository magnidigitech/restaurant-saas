"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Department {
  id: string;
  name: string;
}

interface Designation {
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
  phone: string | null;
  workerType: string;
  joiningDate: string;
  archivedAt: string | null;
  employmentRecords: Array<{
    department?: Department | null;
    designation?: Designation | null;
    primaryOutlet?: Outlet | null;
  }>;
  outletAssignments: Array<{ outlet: Outlet }>;
  memberships: Array<{ id: string; user: { email: string } }>;
}

export default function EmployeeDirectoryPage() {
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    personalEmail: "",
    phone: "",
    gender: "MALE",
    workerType: "FULL_TIME",
    joiningDate: new Date().toISOString().split("T")[0],
    departmentId: "",
    designationId: "",
    primaryOutletId: "",
  });

  const fetchFilters = async () => {
    try {
      const [resDepts, resOutlets] = await Promise.all([
        fetch("/api/restaurant/departments"),
        fetch("/api/restaurant/outlets"),
      ]);
      const dataDepts = await resDepts.json();
      const dataOutlets = await resOutlets.json();
      if (resDepts.ok) setDepartments(dataDepts.departments || []);
      if (resOutlets.ok) setOutlets(dataOutlets.outlets || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedDept) params.append("departmentId", selectedDept);
      if (selectedOutlet) params.append("outletId", selectedOutlet);

      const res = await fetch(`/api/restaurant/employees?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
      else setError(data.error || "Failed to load employees");
    } catch (e) {
      setError("Network error loading employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, selectedDept, selectedOutlet]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/restaurant/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to onboard employee");

      setShowModal(false);
      setFormData({
        firstName: "",
        lastName: "",
        personalEmail: "",
        phone: "",
        gender: "MALE",
        workerType: "FULL_TIME",
        joiningDate: new Date().toISOString().split("T")[0],
        departmentId: "",
        designationId: "",
        primaryOutletId: "",
      });
      fetchEmployees();
    } catch (err: any) {
      setError(err.message || "Error adding employee");
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
          <h2 className="text-3xl font-extrabold text-white">Employee Directory</h2>
          <p className="text-sm text-slate-400 mt-1">Manage workforce profiles, employment records, and outlet assignments.</p>
        </div>
        <button
          onClick={() => { setError(""); setShowModal(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-lg"
        >
          + Add Employee
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid gap-4 sm:grid-cols-3 bg-slate-900/20 border border-slate-900 p-4 rounded-2xl">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, or email..."
          className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={selectedOutlet}
          onChange={(e) => setSelectedOutlet(e.target.value)}
          className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Outlets</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading employee directory...</div>
      ) : employees.length === 0 ? (
        <div className="text-slate-500 py-16 text-center border border-dashed border-slate-800 rounded-2xl">
          No employees found matching criteria. Click &quot;Add Employee&quot; to onboard staff.
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="grid gap-4 sm:hidden">
            {employees.map((emp) => {
              const currentRec = emp.employmentRecords[0];
              const hasLogin = emp.memberships.length > 0;
              return (
                <div
                  key={emp.id}
                  onClick={() => router.push(`./employees/${emp.id}`)}
                  className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-3 hover:border-slate-800 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono text-blue-400 font-bold">{emp.employeeCode}</span>
                      <h3 className="text-lg font-bold text-white">{emp.firstName} {emp.lastName}</h3>
                    </div>
                    {hasLogin ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-green-950 text-green-200 border border-green-800 font-bold uppercase">
                        Login Active
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-800 font-bold uppercase">
                        No Login
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Department: <span className="text-slate-200">{currentRec?.department?.name || "-"}</span></p>
                    <p>Designation: <span className="text-slate-200">{currentRec?.designation?.name || "-"}</span></p>
                    <p>Primary Outlet: <span className="text-slate-200">{currentRec?.primaryOutlet?.name || "-"}</span></p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                  <th className="p-4">Code</th>
                  <th className="p-4">Employee Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Designation</th>
                  <th className="p-4">Primary Outlet</th>
                  <th className="p-4">App Access</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm">
                {employees.map((emp) => {
                  const currentRec = emp.employmentRecords[0];
                  const hasLogin = emp.memberships.length > 0;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-900/10">
                      <td className="p-4 font-mono text-xs text-blue-400 font-bold">{emp.employeeCode}</td>
                      <td className="p-4 text-slate-100 font-bold">
                        {emp.firstName} {emp.lastName}
                        {emp.personalEmail && (
                          <span className="block text-xs text-slate-500 font-normal">{emp.personalEmail}</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-300">{currentRec?.department?.name || "-"}</td>
                      <td className="p-4 text-slate-300">{currentRec?.designation?.name || "-"}</td>
                      <td className="p-4 text-slate-300">{currentRec?.primaryOutlet?.name || "-"}</td>
                      <td className="p-4">
                        {hasLogin ? (
                          <span className="text-xs px-2.5 py-1 rounded bg-green-950 text-green-200 border border-green-800 font-bold">
                            User Login
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded bg-slate-950 text-slate-500 border border-slate-800 font-bold">
                            Employee Only
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => router.push(`./employees/${emp.id}`)}
                          className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-xs font-semibold text-blue-400 rounded border border-slate-800 cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg p-6 rounded-2xl space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Add New Employee</h3>
                <p className="text-xs text-slate-400">Creates an employee profile (does not grant login credentials).</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">First Name *</label>
                  <input
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Jane"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Last Name *</label>
                  <input
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Smith"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={formData.personalEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, personalEmail: e.target.value }))}
                    placeholder="jane@example.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Phone Number</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 555-0199"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Worker Type</label>
                  <select
                    value={formData.workerType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, workerType: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  >
                    <option value="FULL_TIME">Full-time</option>
                    <option value="PART_TIME">Part-time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                    <option value="CONSULTANT">Consultant</option>
                    <option value="TEMPORARY">Temporary</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, joiningDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  />
                </div>
              </div>

              <hr className="border-slate-800" />
              <p className="text-xs font-bold uppercase text-slate-400">Initial Job Assignment</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Department</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-slate-800 bg-slate-950 text-xs text-white"
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Primary Outlet</label>
                  <select
                    value={formData.primaryOutletId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, primaryOutletId: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-slate-800 bg-slate-950 text-xs text-white"
                  >
                    <option value="">None</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
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
                  {saving ? "Onboarding..." : "Onboard Employee"}
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
