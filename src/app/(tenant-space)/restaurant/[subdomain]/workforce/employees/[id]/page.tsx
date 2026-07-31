"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeDetailPage({ params }: { params: Promise<{ subdomain: string; id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "history" | "outlets" | "emergency" | "documents">("profile");

  // Sub-modal states
  const [showModal, setShowModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form inputs
  const [contactForm, setContactForm] = useState({ name: "", relationship: "Spouse", phone: "", address: "" });
  const [docForm, setDocForm] = useState({ type: "AADHAAR", documentNumber: "", fileUrl: "", issueDate: "", expiryDate: "" });

  const fetchEmployee = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurant/employees/${id}`);
      const data = await res.json();
      if (res.ok) setEmployee(data.employee);
      else setError(data.error || "Failed to load employee details");
    } catch (e) {
      setError("Network error loading employee");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEmployee();
  }, [id]);

  const handleArchiveToggle = async () => {
    if (!employee) return;
    const isArchived = !!employee.archivedAt;
    if (!confirm(`Are you sure you want to ${isArchived ? "reactivate" : "archive"} ${employee.firstName}?`)) return;

    try {
      const res = await fetch(`/api/restaurant/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !isArchived }),
      });
      if (res.ok) fetchEmployee();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/restaurant/employees/${id}/emergency-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setShowModal(null);
        setContactForm({ name: "", relationship: "Spouse", phone: "", address: "" });
        fetchEmployee();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/restaurant/employees/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docForm),
      });
      if (res.ok) {
        setShowModal(null);
        setDocForm({ type: "AADHAAR", documentNumber: "", fileUrl: "", issueDate: "", expiryDate: "" });
        fetchEmployee();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="p-8 bg-slate-950 text-slate-400 font-semibold min-h-screen">Loading employee details...</main>;
  }

  if (error || !employee) {
    return (
      <main className="p-8 bg-slate-950 text-slate-100 min-h-screen space-y-4">
        <button onClick={() => router.back()} className="text-xs text-blue-400">&larr; Back</button>
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-lg">{error || "Employee not found"}</div>
      </main>
    );
  }

  const isArchived = !!employee.archivedAt;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 max-w-6xl mx-auto space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-xs text-blue-400 hover:text-blue-300 mb-2 cursor-pointer">
            &larr; Back to Directory
          </button>
          <div className="flex items-center space-x-3">
            <h2 className="text-3xl font-extrabold text-white">{employee.firstName} {employee.lastName}</h2>
            <span className="font-mono text-xs text-blue-400 font-bold px-2.5 py-1 bg-slate-900 border border-slate-800 rounded">
              {employee.employeeCode}
            </span>
            {isArchived && (
              <span className="text-xs px-2.5 py-1 rounded bg-red-950 text-red-200 border border-red-800 font-bold uppercase">
                Archived
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">Joined on {new Date(employee.joiningDate).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleArchiveToggle}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              isArchived ? "bg-green-950 border-green-800 text-green-200" : "bg-red-950 border-red-800 text-red-200 hover:bg-red-900"
            }`}
          >
            {isArchived ? "Reactivate Employee" : "Archive Employee"}
          </button>
        </div>
      </div>

      {/* Detail Tabs */}
      <div className="flex border-b border-slate-900 gap-2 overflow-x-auto">
        {(["profile", "history", "outlets", "emergency", "documents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab
                ? "border-blue-500 text-blue-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "history" ? "Employment History" : tab === "emergency" ? "Emergency Contacts" : tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Profile Details */}
      {activeTab === "profile" && (
        <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-6">
          <h3 className="text-lg font-bold text-white">Personal & Contact Info</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">Worker Type</span>
              <span className="font-semibold text-slate-200">{employee.workerType}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Personal Email</span>
              <span className="font-semibold text-slate-200">{employee.personalEmail || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Phone</span>
              <span className="font-semibold text-slate-200">{employee.phone || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Alternate Phone</span>
              <span className="font-semibold text-slate-200">{employee.alternatePhone || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Gender</span>
              <span className="font-semibold text-slate-200">{employee.gender || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Date of Birth</span>
              <span className="font-semibold text-slate-200">
                {employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : "-"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employment History */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Employment Records History</h3>
          {employee.employmentRecords?.length === 0 ? (
            <div className="text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-xl">
              No employment history records found.
            </div>
          ) : (
            <div className="space-y-4">
              {employee.employmentRecords.map((rec: any) => (
                <div key={rec.id} className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs px-2.5 py-1 rounded bg-blue-950 text-blue-200 border border-blue-800 font-bold uppercase">
                      Status: {rec.status}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Effective: {new Date(rec.effectiveFrom).toLocaleDateString()} {rec.effectiveTo ? `- ${new Date(rec.effectiveTo).toLocaleDateString()}` : "(Current)"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Department</span>
                      <span className="font-semibold text-slate-200">{rec.department?.name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Designation</span>
                      <span className="font-semibold text-slate-200">{rec.designation?.name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Primary Outlet</span>
                      <span className="font-semibold text-slate-200">{rec.primaryOutlet?.name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Reporting Manager</span>
                      <span className="font-semibold text-slate-200">
                        {rec.reportingManager ? `${rec.reportingManager.firstName} ${rec.reportingManager.lastName}` : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Outlet Assignments */}
      {activeTab === "outlets" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Assigned Outlets</h3>
          {employee.outletAssignments?.length === 0 ? (
            <div className="text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-xl">
              No outlet assignments configured.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {employee.outletAssignments.map((asg: any) => (
                <div key={asg.id} className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white text-base">{asg.outlet.name}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{asg.outlet.timezone} &bull; {asg.outlet.currency}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded font-bold uppercase border ${
                    asg.isPrimary ? "bg-blue-950 text-blue-200 border-blue-800" : "bg-slate-950 text-slate-400 border-slate-800"
                  }`}>
                    {asg.assignmentType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Emergency Contacts */}
      {activeTab === "emergency" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">Emergency Contacts</h3>
            <button
              onClick={() => setShowModal("contact")}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              + Add Contact
            </button>
          </div>

          {employee.emergencyContacts?.length === 0 ? (
            <div className="text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-xl">
              No emergency contacts added yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {employee.emergencyContacts.map((c: any) => (
                <div key={c.id} className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-base">{c.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {c.relationship}
                    </span>
                  </div>
                  <p className="text-xs text-blue-400 font-mono">Phone: {c.phone}</p>
                  {c.address && <p className="text-xs text-slate-500">{c.address}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Document Metadata */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">Document Metadata Records</h3>
            <button
              onClick={() => setShowModal("document")}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              + Add Document Metadata
            </button>
          </div>

          {employee.documents?.length === 0 ? (
            <div className="text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-xl">
              No document metadata records added yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {employee.documents.map((doc: any) => (
                <div key={doc.id} className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase text-blue-400 px-2 py-0.5 bg-slate-950 border border-slate-800 rounded">
                      {doc.type}
                    </span>
                    {doc.verifiedBy && (
                      <span className="text-[10px] text-green-400 font-bold uppercase">✓ Verified</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-200">Doc #: {doc.documentNumber || "N/A"}</p>
                  {doc.issueDate && <p className="text-xs text-slate-500">Issued: {new Date(doc.issueDate).toLocaleDateString()}</p>}
                  {doc.expiryDate && <p className="text-xs text-slate-500">Expires: {new Date(doc.expiryDate).toLocaleDateString()}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Emergency Contact */}
      {showModal === "contact" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Add Emergency Contact</h3>
            <form onSubmit={handleAddContact} className="space-y-4">
              <input
                required
                placeholder="Full Name"
                value={contactForm.name}
                onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              />
              <input
                required
                placeholder="Relationship (e.g. Spouse / Parent)"
                value={contactForm.relationship}
                onChange={(e) => setContactForm((prev) => ({ ...prev, relationship: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              />
              <input
                required
                placeholder="Phone Number"
                value={contactForm.phone}
                onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              />
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowModal(null)} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">
                  {saving ? "Saving..." : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Document Metadata */}
      {showModal === "document" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Add Document Metadata</h3>
            <form onSubmit={handleAddDocument} className="space-y-4">
              <select
                value={docForm.type}
                onChange={(e) => setDocForm((prev) => ({ ...prev, type: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              >
                <option value="AADHAAR">Aadhaar</option>
                <option value="PASSPORT">Passport</option>
                <option value="VISA">Visa</option>
                <option value="CONTRACT">Contract</option>
                <option value="RESUME">Resume</option>
                <option value="CERTIFICATE">Certificate</option>
                <option value="MEDICAL">Medical</option>
                <option value="FOOD_LICENSE">Food License</option>
              </select>
              <input
                placeholder="Document Number / ID"
                value={docForm.documentNumber}
                onChange={(e) => setDocForm((prev) => ({ ...prev, documentNumber: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={docForm.issueDate}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={docForm.expiryDate}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowModal(null)} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">
                  {saving ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
