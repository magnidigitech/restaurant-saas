"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface MasterDataItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
}

type TabType = "departments" | "designations" | "job-grades" | "cost-centers";

export default function MasterDataPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("departments");
  const [dataList, setDataList] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [statusInput, setStatusInput] = useState("ACTIVE");

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
    setSearchQuery("");
    fetchData();
  }, [activeTab]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setNameInput("");
    setCodeInput("");
    setDescInput("");
    setStatusInput("ACTIVE");
    setError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: MasterDataItem) => {
    setEditingItem(item);
    setNameInput(item.name);
    setCodeInput(item.code);
    setDescInput(item.description || "");
    setStatusInput(item.status || "ACTIVE");
    setError("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const isEditing = !!editingItem;
      const url = `/api/restaurant/${activeTab}`;
      const method = isEditing ? "PATCH" : "POST";
      const payload: any = {
        ...(isEditing && { id: editingItem.id }),
        name: nameInput,
        code: codeInput,
        description: descInput || undefined,
        status: statusInput,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} item`);

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Error saving master data item");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete/archive "${name}"?`)) return;

    try {
      const res = await fetch(`/api/restaurant/${activeTab}?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete item");

      fetchData();
    } catch (err: any) {
      alert("Delete Error: " + err.message);
    }
  };

  const handleToggleStatus = async (item: MasterDataItem) => {
    const newStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/restaurant/${activeTab}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: newStatus }),
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered List
  const filteredData = dataList.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  const getTabTitle = (tab: TabType) => {
    switch (tab) {
      case "departments": return "Department";
      case "designations": return "Designation";
      case "job-grades": return "Job Grade";
      case "cost-centers": return "Cost Center";
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100">
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button onClick={() => router.back()} className="text-xs text-blue-400 hover:text-blue-300 mb-2 cursor-pointer">
              &larr; Back to Dashboard
            </button>
            <h2 className="text-3xl font-extrabold text-white">Master Data Configuration</h2>
            <p className="text-sm text-slate-400 mt-1">Manage organization structure used across HR, Payroll, and Operations.</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-lg flex items-center justify-center space-x-2"
          >
            <span>+ Add New {getTabTitle(activeTab)}</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-900 gap-2 overflow-x-auto">
          {(["departments", "designations", "job-grades", "cost-centers"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400 font-bold bg-slate-900/40"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
              }`}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab.replace("-", " ")} by code, name, or description...`}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            Total Entries: <span className="text-slate-300 font-mono font-bold">{filteredData.length}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        {/* Data Table / Empty State */}
        {loading ? (
          <div className="text-slate-500 py-16 text-center font-semibold">Loading master data...</div>
        ) : filteredData.length === 0 ? (
          <div className="w-full py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/10 flex flex-col items-center justify-center space-y-3 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-bold">
              {activeTab.charAt(0).toUpperCase()}
            </div>
            <h4 className="text-base font-bold text-slate-300">
              No {activeTab.replace("-", " ")} records found
            </h4>
            <p className="text-xs text-slate-500 max-w-md">
              {searchQuery
                ? `No entries match your search "${searchQuery}". Try clearing the filter.`
                : `Get started by configuring your restaurant's ${activeTab.replace("-", " ")} master data.`}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreate}
                className="mt-2 px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg transition-all cursor-pointer"
              >
                + Create First {getTabTitle(activeTab)}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                    <th className="p-4">Code</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-sm">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-blue-400 font-bold">{item.code}</td>
                      <td className="p-4 text-slate-100 font-semibold">{item.name}</td>
                      <td className="p-4 text-slate-400 text-xs">{item.description || "-"}</td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`text-xs px-2.5 py-1 rounded font-bold transition-all cursor-pointer border ${
                            item.status === "ACTIVE"
                              ? "bg-green-950 text-green-200 border-green-800 hover:bg-red-950 hover:text-red-200 hover:border-red-800"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-green-950 hover:text-green-200 hover:border-green-800"
                          }`}
                          title="Click to toggle status"
                        >
                          {item.status || "ACTIVE"}
                        </button>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="px-3 py-1 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white rounded border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchive(item.id, item.name)}
                          className="px-3 py-1 bg-red-950/40 text-xs font-semibold text-red-300 hover:bg-red-950 hover:text-red-100 rounded border border-red-900/60 transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Creation / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white capitalize">
                  {editingItem ? "Edit" : "Add"} {getTabTitle(activeTab)}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer font-bold text-lg">&times;</button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Code</label>
                  <input
                    required
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. KITCHEN / MGR / CC-01"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Name</label>
                  <input
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Kitchen Operations / Head Chef"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    placeholder="Provide additional details or notes..."
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {editingItem && (
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Status</label>
                    <select
                      value={statusInput}
                      onChange={(e) => setStatusInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
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
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    {saving ? "Saving..." : editingItem ? "Save Changes" : "Create Entry"}
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
