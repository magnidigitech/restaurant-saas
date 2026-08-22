"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

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

export default function VendorDirectoryPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

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
      const p = new URLSearchParams();
      if (s) p.set("search", s);
      if (st) p.set("status", st);
      const res = await fetch(`/api/restaurant/inventory/vendors?${p}`);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
      fetchVendors();
    } catch (e: any) {
      setError(e.message || "Failed to create vendor");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Vendor Directory...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="vendor_management" moduleName="Vendor Management" activeSection="Vendors">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Vendors" />

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
                onClick={() => router.push(`/restaurant/${subdomain}/inventory`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Inventory Hub
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Procurement Partners
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Supplier & Vendor Directory
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Manage commercial distributors, payment credit terms, contact leads, and item price contracts.
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            + Add Vendor
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Search suppliers by name, code, contact or email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className={`flex-1 min-w-56 px-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
              isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
              isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
        </div>

        {/* Vendors Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          {vendors.length === 0 ? (
            <div className={`p-12 text-center text-xs space-y-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              <p className="font-semibold text-sm">No suppliers registered</p>
              <p className="opacity-75">Click &quot;+ Add Vendor&quot; to configure your procurement supply lines.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-3 px-3">Vendor / Company</th>
                    <th className="pb-3 px-3">Representative Contact</th>
                    <th className="pb-3 px-3">Payment Terms</th>
                    <th className="pb-3 px-3">Tax Identifier</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {vendors.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors/${v.id}`)}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer group"
                    >
                      <td className="py-3 px-3">
                        <span className={`font-semibold block ${isDark ? "text-white" : "text-slate-900"}`}>
                          {v.name}
                        </span>
                        {v.code && (
                          <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            CODE: {v.code}
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        <span className="block font-medium">{v.contactPerson || "Primary Contact"}</span>
                        {v.phone && <span className={`text-[10px] font-mono block ${isDark ? "text-[#25D366]" : "text-emerald-700 font-semibold"}`}>{v.phone}</span>}
                        {v.email && <span className={`text-[10px] block opacity-75 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>{v.email}</span>}
                      </td>
                      <td className={`py-3 px-3 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        {v.paymentTerms}
                      </td>
                      <td className={`py-3 px-3 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        {v.taxId || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          v.status === "ACTIVE"
                            ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : v.status === "BLOCKED"
                            ? isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
                            : isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[#0071E3] font-medium group-hover:underline text-xs">
                          Catalog →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Vendor Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Register Supplier Profile</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Add commercial credentials, payment terms, and direct contacts.
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Vendor Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sysco Foods Inc."
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Vendor Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VEN-SYS"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Representative Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="orders@vendor.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Payment Terms
                  </label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">Cash On Delivery</option>
                    <option value="NET7">Net 7 Days</option>
                    <option value="NET15">Net 15 Days</option>
                    <option value="NET30">Net 30 Days</option>
                    <option value="NET60">Net 60 Days</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Tax ID / GST
                  </label>
                  <input
                    type="text"
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Register Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
