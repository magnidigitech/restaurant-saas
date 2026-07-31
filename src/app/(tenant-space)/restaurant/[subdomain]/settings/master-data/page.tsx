"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MasterDataPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"departments" | "designations" | "job-grades" | "cost-centers">("departments");
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/${activeTab}`);
      const data = await res.json();
      if (res.ok) {
        if (activeTab === "departments") setDataList(data.departments || []);
        else if (activeTab === "designations") setDataList(data.designations || []);
        else if (activeTab === "job-grades") setDataList(data.jobGrades || []);
        else if (activeTab === "cost-centers") setDataList(data.costCenters || []);
      } else {
        setError(data.error || "Failed to load master data");
      }
    } catch (e) {
      setError("Network error loading master data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload: any = { name: nameInput, code: codeInput };
      if (activeTab === "job-grades" || activeTab === "cost-centers") {
        payload.description = descInput;
      }

      const res = await fetch(`/api/restaurant/${activeTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");

      setShowModal(false);
      setNameInput("");
      setCodeInput("");
      setDescInput("");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Error creating master data item");
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
          <h2 className="text-3xl font-extrabold text-white">Master Data Configuration</h2>
          <p className="text-sm text-slate-400 mt-1">Manage organization structure used across HR, Payroll, and Operations.</p>
        </div>
        <button
          onClick={() => { setError(""); setShowModal(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-lg"
        >
          + Add New Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 gap-2">
        {(["departments", "designations", "job-grades", "cost-centers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-all cursor-pointer ${
              activeTab === tab
                ? "border-blue-500 text-blue-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading {activeTab}...</div>
      ) : dataList.length === 0 ? (
        <div className="text-slate-500 py-16 text-center border border-dashed border-slate-800 rounded-2xl">
          No records found for {activeTab.replace("-", " ")}. Click &quot;Add New Entry&quot; to create one.
        </div>
      ) : (
        <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                <th className="p-4">Code</th>
                <th className="p-4">Name</th>
                {(activeTab === "job-grades" || activeTab === "cost-centers") && <th className="p-4">Description</th>}
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-sm">
              {dataList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/10">
                  <td className="p-4 font-mono text-xs text-blue-400 font-bold">{item.code}</td>
                  <td className="p-4 text-slate-200 font-semibold">{item.name}</td>
                  {(activeTab === "job-grades" || activeTab === "cost-centers") && (
                    <td className="p-4 text-slate-400 text-xs">{item.description || "-"}</td>
                  )}
                  <td className="p-4">
                    <span className="text-xs px-2.5 py-1 rounded bg-green-950 text-green-200 border border-green-800 font-bold">
                      {item.status || "ACTIVE"}
                    </span>
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
              <h3 className="text-xl font-bold text-white capitalize">Add {activeTab.replace("-", " ")}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Code</label>
                <input
                  required
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. KITCHEN / MGR / CC-01"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Name</label>
                <input
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Kitchen Operations / Head Chef"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                />
              </div>

              {(activeTab === "job-grades" || activeTab === "cost-centers") && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Description</label>
                  <input
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  />
                </div>
              )}

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
                  {saving ? "Saving..." : "Save Entry"}
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
