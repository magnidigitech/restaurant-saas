"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Outlet {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
}

export default function RestaurantOutletsPage() {
  const router = useRouter();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    timezone: "UTC",
    currency: "USD",
  });

  const fetchOutlets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/restaurant/outlets");
      const data = await res.json();
      if (res.ok) setOutlets(data.outlets || []);
      else setError(data.error || "Failed to load outlets");
    } catch (e) {
      setError("Network error loading outlets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/restaurant/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create outlet");

      setShowModal(false);
      setFormData({ name: "", address: "", timezone: "UTC", currency: "USD" });
      fetchOutlets();
    } catch (err: any) {
      setError(err.message || "Error creating outlet");
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
          <h2 className="text-3xl font-extrabold text-white">Physical Outlets (Branches)</h2>
          <p className="text-sm text-slate-400 mt-1">Configure locations, branch timezones, and currencies.</p>
        </div>
        <button
          onClick={() => { setError(""); setShowModal(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-lg"
        >
          + Add New Outlet
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading outlets...</div>
      ) : outlets.length === 0 ? (
        <div className="text-slate-500 py-16 text-center border border-dashed border-slate-800 rounded-2xl space-y-3">
          <p className="text-base font-semibold">No outlets configured yet.</p>
          <p className="text-xs text-slate-600">Click &quot;Add New Outlet&quot; to create your first restaurant location.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              className="bg-slate-900/30 border border-slate-900 p-6 rounded-2xl space-y-4 hover:border-slate-800 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold text-white">{outlet.name}</h3>
                  <span className="text-xs px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-blue-400 font-mono">
                    {outlet.currency}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{outlet.address || "No address specified"}</p>
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-900/50 flex justify-between">
                  <span>Timezone:</span>
                  <span className="text-slate-300 font-mono">{outlet.timezone}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Add New Outlet</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Outlet Name</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Main Branch / Downtown Outlet"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Address</label>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main St, City, Country"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="AED">AED (AED)</option>
                    <option value="CAD">CAD ($)</option>
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
                  {saving ? "Creating..." : "Create Outlet"}
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
