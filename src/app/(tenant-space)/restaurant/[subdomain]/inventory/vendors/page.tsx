"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface Outlet {
  id: string;
  name: string;
}

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
  outletIds?: string[];
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
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
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
    outletIds: [] as string[],
    notes: "",
  });

  const fetchOutlets = async () => {
    try {
      const res = await fetch("/api/restaurant/outlets");
      const data = await res.json();
      if (res.ok) setOutlets(data.outlets || []);
    } catch {
      // ignore
    }
  };

  const fetchVendors = async (s = search, st = statusFilter, out = outletFilter) => {
    try {
      const p = new URLSearchParams();
      if (s) p.set("search", s);
      if (st) p.set("status", st);
      if (out) p.set("outletId", out);
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
    fetchOutlets();
    fetchVendors();
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchVendors(val, statusFilter, outletFilter);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    fetchVendors(search, val, outletFilter);
  };

  const handleOutletFilter = (val: string) => {
    setOutletFilter(val);
    fetchVendors(search, statusFilter, val);
  };

  const toggleOutletSelection = (outletId: string) => {
    setForm((prev) => {
      const exists = prev.outletIds.includes(outletId);
      if (exists) {
        return { ...prev, outletIds: prev.outletIds.filter((id) => id !== outletId) };
      } else {
        return { ...prev, outletIds: [...prev.outletIds, outletId] };
      }
    });
  };

  const handleSelectAllOutlets = (selectAll: boolean) => {
    if (selectAll) {
      setForm((prev) => ({ ...prev, outletIds: outlets.map((o) => o.id) }));
    } else {
      setForm((prev) => ({ ...prev, outletIds: [] }));
    }
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
        outletIds: [],
        notes: "",
      });
      fetchVendors();
    } catch (e: any) {
      setError(e.message || "Failed to create vendor");
    } finally {
      setSubmitting(false);
    }
  };

  const getOutletNames = (outletIds?: string[]) => {
    if (!outletIds || outletIds.length === 0 || outletIds.length === outlets.length) {
      return "All Locations";
    }
    const names = outletIds
      .map((id) => outlets.find((o) => o.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "All Locations";
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

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Executive Header Banner */}
          <div
            className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
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
                Supplier &amp; Vendor Directory
              </h1>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Manage commercial distributors, multi-location coverage, payment terms, and price contracts.
              </p>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer shrink-0 text-center"
            >
              + Add Vendor
            </button>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
              {error}
            </div>
          )}

          {/* Filter Controls: Search + Status + Location Filter */}
          <div className="flex gap-3 flex-wrap items-center">
            <input
              placeholder="Search suppliers by name, code, contact or email..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className={`flex-1 min-w-56 px-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            />

            {/* Location / Branch Filter */}
            {outlets.length > 0 && (
              <select
                value={outletFilter}
                onChange={(e) => handleOutletFilter(e.target.value)}
                className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="">All Locations (Consolidated)</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    Location: {o.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
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

          {/* Vendors Display: Cards on Mobile, Table on Desktop */}
          {vendors.length === 0 ? (
            <div
              className={`p-12 rounded-3xl border text-center space-y-3 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#0071E3] mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold">No suppliers found</h3>
              <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {outletFilter
                  ? "No suppliers registered for this specific location. Click \"+ Add Vendor\" to configure suppliers."
                  : "Click \"+ Add Vendor\" to configure your procurement partners and location mappings."}
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (block md:hidden) */}
              <div className="block md:hidden space-y-3">
                {vendors.map((v) => {
                  const locationText = getOutletNames(v.outletIds);
                  const isAllLocations = !v.outletIds || v.outletIds.length === 0 || v.outletIds.length === outlets.length;

                  return (
                    <div
                      key={v.id}
                      onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors/${v.id}`)}
                      className={`p-4 rounded-2xl border shadow-2xs space-y-3.5 transition cursor-pointer active:scale-[0.99] ${
                        isDark ? "bg-[#121622] border-white/[0.08] hover:border-[#0071E3]/40" : "bg-white border-slate-200 hover:border-[#0071E3]/40"
                      }`}
                    >
                      {/* Card Top: Name, Code, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {v.name}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {v.code && (
                              <span className="font-mono text-[10px] opacity-60">
                                CODE: {v.code}
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                isAllLocations
                                  ? isDark ? "bg-blue-500/15 text-blue-300 border-blue-500/25" : "bg-blue-50 text-blue-700 border-blue-200"
                                  : isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/25" : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              📍 {locationText}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
                            v.status === "ACTIVE"
                              ? isDark
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : v.status === "BLOCKED"
                              ? isDark
                                ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                              : isDark
                              ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>

                      {/* Card Info Grid */}
                      <div
                        className={`grid grid-cols-2 gap-2 p-2.5 rounded-xl border text-xs ${
                          isDark ? "bg-[#090B10]/60 border-white/[0.04]" : "bg-slate-50/80 border-slate-100"
                        }`}
                      >
                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase">Contact</div>
                          <div className="font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                            {v.contactPerson || "Direct Line"}
                          </div>
                          {v.phone && (
                            <div className={`text-[11px] font-mono font-medium ${isDark ? "text-[#25D366]" : "text-emerald-700"}`}>
                              {v.phone}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase">Terms &amp; Tax</div>
                          <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                            {v.paymentTerms}
                          </div>
                          <div className="text-[10px] opacity-60 font-mono truncate">
                            {v.taxId || "No Tax ID"}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Link */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] opacity-60 truncate">
                          {v.email || "No email registered"}
                        </span>
                        <span className="text-[#0071E3] font-semibold flex items-center gap-1 shrink-0">
                          <span>View Catalog</span>
                          <span>→</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (hidden md:block) */}
              <div
                className={`hidden md:block rounded-3xl border overflow-hidden shadow-sm ${
                  isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
                }`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                        isDark ? "border-white/[0.08] text-[#8F95A3]" : "border-slate-200 text-slate-500 bg-slate-50/50"
                      }`}>
                        <th className="py-3.5 px-4">Vendor / Company</th>
                        <th className="py-3.5 px-4">Serviced Locations</th>
                        <th className="py-3.5 px-4">Representative Contact</th>
                        <th className="py-3.5 px-4">Payment Terms</th>
                        <th className="py-3.5 px-4">Tax Identifier</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] text-xs">
                      {vendors.map((v) => {
                        const locationText = getOutletNames(v.outletIds);
                        const isAllLocations = !v.outletIds || v.outletIds.length === 0 || v.outletIds.length === outlets.length;

                        return (
                          <tr
                            key={v.id}
                            onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors/${v.id}`)}
                            className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer group"
                          >
                            <td className="py-3.5 px-4">
                              <span className={`font-semibold block ${isDark ? "text-white" : "text-slate-900"}`}>
                                {v.name}
                              </span>
                              {v.code && (
                                <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                  CODE: {v.code}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                                  isAllLocations
                                    ? isDark ? "bg-blue-500/15 text-blue-300 border-blue-500/25" : "bg-blue-50 text-blue-700 border-blue-200"
                                    : isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/25" : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}
                              >
                                <span>📍</span>
                                <span>{locationText}</span>
                              </span>
                            </td>

                            <td className={`py-3.5 px-4 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                              <span className="block font-medium">{v.contactPerson || "Primary Contact"}</span>
                              {v.phone && <span className={`text-[10px] font-mono block ${isDark ? "text-[#25D366]" : "text-emerald-700 font-semibold"}`}>{v.phone}</span>}
                              {v.email && <span className={`text-[10px] block opacity-75 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>{v.email}</span>}
                            </td>
                            <td className={`py-3.5 px-4 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                              {v.paymentTerms}
                            </td>
                            <td className={`py-3.5 px-4 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                              {v.taxId || "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                                v.status === "ACTIVE"
                                  ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : v.status === "BLOCKED"
                                  ? isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
                                  : isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                {v.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="text-[#0071E3] font-semibold group-hover:underline text-xs">
                                Catalog →
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Add Vendor Modal (Bottom Sheet on Mobile, Centered Modal on Desktop) */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-4 max-h-[88vh] md:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Register Supplier Profile</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Add commercial credentials, location coverage, and payment terms.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1"
                >
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
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
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
                      className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                {/* Multi-Location Selection */}
                {outlets.length > 0 && (
                  <div className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    isDark ? "bg-[#090B10]/60 border-white/[0.06]" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className={`block text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          Serviced Restaurant Locations
                        </label>
                        <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          Select which branches or outlets this vendor delivers to.
                        </p>
                      </div>

                      {/* Clean Select All / Clear All Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, outletIds: outlets.map((o) => o.id) }))}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                            form.outletIds.length === outlets.length
                              ? "bg-[#0071E3] text-white border-[#0071E3]"
                              : isDark
                              ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, outletIds: [] }))}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                            form.outletIds.length === 0
                              ? isDark
                                ? "bg-white/[0.08] text-white border-white/[0.15]"
                                : "bg-slate-200 text-slate-800 border-slate-300"
                              : isDark
                              ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {outlets.map((o) => {
                        const isSelected = form.outletIds.includes(o.id);

                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => toggleOutletSelection(o.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? isDark
                                  ? "bg-[#0071E3] border-[#0071E3] text-white shadow-xs"
                                  : "bg-[#0071E3] border-[#0071E3] text-white shadow-xs"
                                : isDark
                                ? "bg-[#0A0C12] border-white/[0.08] text-[#8F95A3] hover:text-white hover:border-white/[0.15]"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{o.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {form.outletIds.length === 0
                        ? "No locations selected. Click locations to assign."
                        : form.outletIds.length === outlets.length
                        ? "✨ Supplying to all restaurant locations."
                        : `Delivering to ${form.outletIds.length} of ${outlets.length} selected location(s).`}
                    </div>
                  </div>
                )}

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
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
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
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                {/* Single Row for Phone / Mobile */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Phone / Mobile Number (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 000-0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Payment Terms
                    </label>
                    <select
                      value={form.paymentTerms}
                      onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
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
                      placeholder="Optional"
                      value={form.taxId}
                      onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
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
