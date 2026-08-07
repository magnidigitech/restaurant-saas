"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Vendor {
  id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  notes?: string;
  createdAt: string;
}

export default function VendorDirectoryPage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    paymentTerms: "NET30",
    status: "ACTIVE",
    notes: "",
  });

  const fetchVendors = async (s = search, st = statusFilter) => {
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (st) params.set("status", st);
      const res = await fetch(`/api/restaurant/inventory/vendors?${params}`);
      const data = await res.json();
      if (res.ok) setVendors(data.vendors || []);
    } catch {
      setError("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchVendors(val, statusFilter);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    fetchVendors(search, val);
  };

  const handleCreate = async () => {
    if (!form.name) {
      setError("Vendor name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setShowCreate(false);
      setForm({
        name: "",
        code: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        taxId: "",
        paymentTerms: "NET30",
        status: "ACTIVE",
        notes: "",
      });

      // Optimistic instant state update + AJAX re-fetch
      if (data.vendor) {
        setVendors((prev) => [data.vendor, ...prev]);
      }
      await fetchVendors();
    } catch (e: any) {
      setError(e.message || "Failed to create vendor");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading vendor directory...
      </main>
    );
  }

  const activeCount = vendors.filter((v) => v.status === "ACTIVE").length;
  const creditCount = vendors.filter((v) => ["NET7", "NET15", "NET30", "NET60"].includes(v.paymentTerms)).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Header Navbar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm">
            ← Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Vendor Management</h1>
            <p className="text-xs text-gray-500">{vendors.length} vendors total • {activeCount} active suppliers</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchVendors()}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-gray-200"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            + Register Vendor
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">{error}</div>}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Registered Suppliers</span>
            <p className="text-3xl font-extrabold text-gray-900 font-mono">{vendors.length}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Active Suppliers</span>
            <p className="text-3xl font-extrabold text-emerald-600 font-mono">{activeCount}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Credit Term Suppliers</span>
            <p className="text-3xl font-extrabold text-indigo-600 font-mono">{creditCount}</p>
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Search vendor name, code, contact person, or phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 min-w-56 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-600 shadow-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
        </div>

        {/* Vendor Table */}
        {vendors.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-300 bg-white rounded-2xl space-y-2">
            <p className="text-gray-900 font-bold text-lg">No Vendors Registered</p>
            <p className="text-gray-500 text-xs">Register your first vendor/supplier using the button above.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3.5 px-4">Vendor & Code</th>
                    <th className="py-3.5 px-4">Contact Person</th>
                    <th className="py-3.5 px-4">Phone / Email</th>
                    <th className="py-3.5 px-4">Tax ID / GSTIN</th>
                    <th className="py-3.5 px-4">Payment Terms</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      onClick={() => router.push(`/inventory/vendors/${vendor.id}`)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-all"
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-gray-900 text-sm">{vendor.name}</p>
                        {vendor.code && <p className="text-[11px] text-gray-500 font-mono">{vendor.code}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 font-semibold">{vendor.contactPerson || "—"}</td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        <p className="text-gray-900 font-mono">{vendor.phone || "—"}</p>
                        {vendor.email && <p className="text-gray-500 text-[11px]">{vendor.email}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-mono">{vendor.taxId || "—"}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                          {vendor.paymentTerms}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            vendor.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : vendor.status === "INACTIVE"
                              ? "bg-gray-100 text-gray-600 border-gray-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          [{vendor.status}]
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Register Vendor Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Register New Vendor</h2>
              <p className="text-xs text-gray-500 mt-0.5">Add vendor details, contact info, and credit payment terms</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Agro Traders"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Vendor Code</label>
                <input
                  type="text"
                  placeholder="e.g. VEND-001"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="Contact manager name"
                  value={form.contactPerson}
                  onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="vendor@company.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">GSTIN / Tax ID</label>
                <input
                  type="text"
                  placeholder="22AAAAA0000A1Z5"
                  value={form.taxId}
                  onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Payment Terms</label>
                <select
                  value={form.paymentTerms}
                  onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="COD">COD (Cash on Delivery)</option>
                  <option value="IMMEDIATE">Immediate Payment</option>
                  <option value="NET7">Net 7 Days</option>
                  <option value="NET15">Net 15 Days</option>
                  <option value="NET30">Net 30 Days</option>
                  <option value="NET60">Net 60 Days</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Address</label>
                <textarea
                  placeholder="Full supplier address..."
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowCreate(false); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {submitting ? "Registering..." : "Register Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
