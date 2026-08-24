"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import { formatUnit } from "@/core/inventory/units";

interface VendorItemMap {
  id: string;
  vendorId: string;
  itemId: string;
  vendorSku?: string | null;
  unitCost?: number | null;
  leadTimeDays?: number | null;
  isPreferred: boolean;
  vendor?: { id: string; name: string; code?: string };
  item?: {
    id: string;
    name: string;
    unitOfMeasure: string;
    costPerUnit: number;
  };
}

interface VendorDetail {
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
  vendorItems?: VendorItemMap[];
}

interface InventoryItem {
  id: string;
  name: string;
  unitOfMeasure: string;
  costPerUnit: number;
}

interface MultiSelectItemRow {
  itemId: string;
  name: string;
  unitOfMeasure: string;
  selected: boolean;
  isPreferred: boolean;
  unitCost: string;
  vendorSku: string;
  existingPreferredVendor?: string | null;
}

export default function VendorDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; id: string }>;
}) {
  const router = useRouter();
  const { subdomain, id: vendorId } = use(params);
  const { isDark } = useTheme();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [vendorItems, setVendorItems] = useState<VendorItemMap[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [allRestaurantVendorItems, setAllRestaurantVendorItems] = useState<VendorItemMap[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Multi-Select Catalog Modal State
  const [multiSelectRows, setMultiSelectRows] = useState<MultiSelectItemRow[]>([]);
  const [modalSearch, setModalSearch] = useState("");

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

  // Custom Apple Confirm Dialog Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: (() => void) | null;
  }>({
    show: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    onConfirm: null,
  });

  const fetchVendorDetail = async () => {
    try {
      const [resVendor, resVendorItems, resAllVendorItems, resAllItems] = await Promise.all([
        fetch(`/api/restaurant/inventory/vendors/${vendorId}`),
        fetch(`/api/restaurant/inventory/vendor-items?vendorId=${vendorId}`),
        fetch(`/api/restaurant/inventory/vendor-items`),
        fetch(`/api/restaurant/inventory/items`),
      ]);

      const dataVendor = await resVendor.json();
      const dataVItems = await resVendorItems.json();
      const dataAllVItems = await resAllVendorItems.json();
      const dataAllItems = await resAllItems.json();

      if (resVendor.ok && dataVendor.vendor) {
        setVendor(dataVendor.vendor);
        setForm({
          name: dataVendor.vendor.name || "",
          code: dataVendor.vendor.code || "",
          contactPerson: dataVendor.vendor.contactPerson || "",
          email: dataVendor.vendor.email || "",
          phone: dataVendor.vendor.phone || "",
          address: dataVendor.vendor.address || "",
          taxId: dataVendor.vendor.taxId || "",
          paymentTerms: dataVendor.vendor.paymentTerms || "NET30",
          status: dataVendor.vendor.status || "ACTIVE",
          notes: dataVendor.vendor.notes || "",
        });
      } else {
        setError(dataVendor.error || "Vendor not found");
      }

      if (resVendorItems.ok) setVendorItems(dataVItems.vendorItems || []);
      if (resAllVendorItems.ok) setAllRestaurantVendorItems(dataAllVItems.vendorItems || []);
      if (resAllItems.ok) setAllItems(dataAllItems.items || []);
    } catch {
      setError("Failed to load vendor details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) fetchVendorDetail();
  }, [vendorId]);

  const openMultiSelectModal = () => {
    const preferredMap: Record<string, string> = {};
    allRestaurantVendorItems.forEach((vi) => {
      if (vi.isPreferred && vi.vendorId !== vendorId) {
        preferredMap[vi.itemId] = vi.vendor?.name || "Another Supplier";
      }
    });

    setMultiSelectRows(
      allItems.map((i) => {
        const existing = vendorItems.find((vi) => vi.itemId === i.id);
        const cost = existing?.unitCost ?? i.costPerUnit ?? 0;
        return {
          itemId: i.id,
          name: i.name,
          unitOfMeasure: i.unitOfMeasure,
          selected: Boolean(existing),
          isPreferred: existing ? existing.isPreferred : false,
          unitCost: cost.toString(),
          vendorSku: existing?.vendorSku || "",
          existingPreferredVendor: preferredMap[i.id] || null,
        };
      })
    );
    setModalSearch("");
    setError("");
    setShowLinkModal(true);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setMultiSelectRows((prev) =>
      prev.map((r) => {
        const matchesSearch = r.name.toLowerCase().includes(modalSearch.toLowerCase());
        return matchesSearch ? { ...r, selected: checked } : r;
      })
    );
  };

  const handleRowChange = (itemId: string, field: string, value: any) => {
    setMultiSelectRows((prev) =>
      prev.map((r) => {
        if (r.itemId === itemId) {
          const updated = { ...r, [field]: value };
          if (field === "isPreferred" && value === true) {
            updated.selected = true;
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleBulkLinkItems = async () => {
    setSubmitting(true);
    setError("");
    try {
      const selectedRows = multiSelectRows.filter((r) => r.selected);
      const unselectedPreviouslyLinked = multiSelectRows.filter(
        (r) => !r.selected && vendorItems.some((vi) => vi.itemId === r.itemId)
      );

      for (const unselected of unselectedPreviouslyLinked) {
        await fetch(`/api/restaurant/inventory/vendor-items?vendorId=${vendorId}&itemId=${unselected.itemId}`, {
          method: "DELETE",
        });
      }

      if (selectedRows.length > 0) {
        const payload = {
          vendorId,
          items: selectedRows.map((r) => ({
            itemId: r.itemId,
            vendorSku: r.vendorSku || undefined,
            unitCost: Number(r.unitCost) || undefined,
            isPreferred: r.isPreferred,
          })),
        };

        const res = await fetch("/api/restaurant/inventory/vendor-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      setShowLinkModal(false);
      fetchVendorDetail();
    } catch (e: any) {
      setError(e.message || "Failed to update vendor item catalog");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowEdit(false);
      fetchVendorDetail();
    } catch (e: any) {
      setError(e.message || "Failed to update vendor details");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkItem = (itemId: string) => {
    const itemMap = vendorItems.find((vi) => vi.itemId === itemId);
    const itemName = itemMap?.item?.name || "this item";

    setConfirmDialog({
      show: true,
      title: "Unlink Catalog Item",
      message: `Are you sure you want to unlink "${itemName}" from ${vendor?.name}? This will remove negotiated pricing and supplier mapping.`,
      confirmText: "Unlink Item",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/restaurant/inventory/vendor-items?vendorId=${vendorId}&itemId=${itemId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error);
          }
          fetchVendorDetail();
        } catch (e: any) {
          setError(e.message || "Failed to unlink item");
        }
      },
    });
  };

  const handleArchive = () => {
    setConfirmDialog({
      show: true,
      title: "Archive Supplier Profile",
      message: `Are you sure you want to archive "${vendor?.name}"? You will not be able to raise new purchase orders for this supplier.`,
      confirmText: "Archive Supplier",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/restaurant/inventory/vendors/${vendorId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error);
          }
          router.push(`/restaurant/${subdomain}/inventory/vendors`);
        } catch (e: any) {
          setError(e.message || "Failed to archive vendor");
        }
      },
    });
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Supplier Profile...</p>
      </div>
    );
  }

  if (error && !vendor) {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Vendor Details" />
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors`)}
            className="text-xs text-[#0071E3] hover:underline cursor-pointer"
          >
            ← Back to Suppliers
          </button>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error || "Vendor not found"}
          </div>
        </main>
      </div>
    );
  }

  const selectedCount = multiSelectRows.filter((r) => r.selected).length;
  const filteredModalRows = multiSelectRows.filter((r) =>
    r.name.toLowerCase().includes(modalSearch.toLowerCase())
  );
  const allFilteredSelected =
    filteredModalRows.length > 0 && filteredModalRows.every((r) => r.selected);

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Vendor Details" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← All Suppliers
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                vendor?.status === "ACTIVE"
                  ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
              }`}>
                {vendor?.status}
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {vendor?.name}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Code: <span className="font-mono font-semibold">{vendor?.code || "N/A"}</span> • {vendorItems.length} mapped catalog items
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowEdit(true)}
              className="flex-1 sm:flex-none px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer text-center"
            >
              Edit Profile
            </button>
            <button
              onClick={handleArchive}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                isDark
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                  : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
              }`}
            >
              <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Archive</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Dynamic Container: Catalog on TOP for mobile (order-1), Details BELOW for mobile (order-2) */}
        <div className="flex flex-col space-y-6">

          {/* Product Price Catalog (Order 1 on Mobile, Order 2 on Desktop) */}
          <div
            className={`order-1 md:order-2 p-5 sm:p-6 rounded-3xl border transition space-y-4 shadow-2xs ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                  Product Catalog &amp; Contract Pricing ({vendorItems.length})
                </h2>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Items supplied by {vendor?.name} with contract price rates.
                </p>
              </div>
              <button
                onClick={openMultiSelectModal}
                className="w-full sm:w-auto px-3.5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs text-center shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>+ Map Catalog Items</span>
              </button>
            </div>

            {vendorItems.length === 0 ? (
              <div className={`p-10 text-center text-xs space-y-2 rounded-2xl border ${isDark ? "border-white/[0.04] text-[#8F95A3] bg-[#090B10]/40" : "border-slate-100 text-slate-400 bg-slate-50/50"}`}>
                <p className="font-semibold text-sm">No items mapped to this vendor</p>
                <p className="opacity-75">Click "+ Map Catalog Items" to link inventory ingredients with supplier pricing.</p>
              </div>
            ) : (
              <>
                {/* MOBILE CARDS VIEW FOR CATALOG ITEMS (block md:hidden) */}
                <div className="block md:hidden space-y-3">
                  {vendorItems.map((vi) => (
                    <div
                      key={vi.id}
                      className={`p-3.5 rounded-2xl border space-y-3 transition ${
                        isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50/80 border-slate-200"
                      }`}
                    >
                      {/* Card Top: Item Name, Unit, Preference Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {vi.item?.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-[#0071E3] dark:text-[#64B5FF]">
                              Unit: {formatUnit((vi.item?.unitOfMeasure || "PIECES") as any)}
                            </span>
                            {vi.vendorSku && (
                              <span className="font-mono text-[10px] opacity-60">
                                SKU: {vi.vendorSku}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {vi.isPreferred ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full whitespace-nowrap">
                              Preferred
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-200 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 rounded-full whitespace-nowrap">
                              Secondary
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Middle: Contract Cost */}
                      <div
                        className={`p-2 rounded-xl border flex items-center justify-between text-xs ${
                          isDark ? "bg-[#121622] border-white/[0.04]" : "bg-white border-slate-200"
                        }`}
                      >
                        <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          Negotiated Cost
                        </span>
                        <span className={`font-mono text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${Number(vi.unitCost ?? vi.item?.costPerUnit ?? 0).toFixed(2)}
                        </span>
                      </div>

                      {/* Card Bottom: Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                        <button
                          type="button"
                          onClick={openMultiSelectModal}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                            isDark
                              ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-200"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
                          }`}
                        >
                          Edit Rate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnlinkItem(vi.itemId)}
                          className="px-3 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP TABLE VIEW FOR CATALOG ITEMS (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                        isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                      }`}>
                        <th className="pb-3 px-3">Item Name</th>
                        <th className="pb-3 px-3">Unit</th>
                        <th className="pb-3 px-3">Vendor SKU</th>
                        <th className="pb-3 px-3 text-right">Negotiated Cost</th>
                        <th className="pb-3 px-3 text-center">Preference</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {vendorItems.map((vi) => (
                        <tr key={vi.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                          <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {vi.item?.name}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px]">
                            {formatUnit((vi.item?.unitOfMeasure || "PIECES") as any)}
                          </td>
                          <td className={`py-3.5 px-3 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                            {vi.vendorSku || "—"}
                          </td>
                          <td className={`py-3.5 px-3 text-right font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                            ${Number(vi.unitCost ?? vi.item?.costPerUnit ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {vi.isPreferred ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full">
                                Preferred Supplier
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Secondary</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right space-x-2">
                            <button
                              onClick={openMultiSelectModal}
                              className="text-xs text-[#0071E3] hover:underline cursor-pointer font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleUnlinkItem(vi.itemId)}
                              className="text-xs text-rose-500 hover:underline cursor-pointer font-medium"
                            >
                              Unlink
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Vendor Contact & Payment Details Cards (Order 2 on Mobile, Order 1 on Desktop) */}
          <div className="order-2 md:order-1 space-y-2">
            <h3 className={`text-xs font-bold uppercase tracking-wider px-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Supplier Account &amp; Contact Details
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Payment Terms
                </span>
                <p className={`text-base font-bold font-mono tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {vendor?.paymentTerms}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Representative
                </span>
                <p className={`text-sm font-bold tracking-tight mt-1 truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  {vendor?.contactPerson || "Direct Line"}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Phone / WhatsApp
                </span>
                <p className={`text-xs font-mono font-bold tracking-tight mt-1.5 truncate ${
                  vendor?.phone ? (isDark ? "text-[#25D366]" : "text-emerald-600") : (isDark ? "text-[#8F95A3]" : "text-slate-400")
                }`}>
                  {vendor?.phone || "—"}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Email Address
                </span>
                <p className={`text-xs font-mono font-medium tracking-tight mt-1.5 truncate ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                  {vendor?.email || "—"}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs col-span-2 sm:col-span-1"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Tax ID / GST
                </span>
                <p className={`text-xs font-mono font-semibold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {vendor?.taxId || "Not Registered"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Multi-Select Link Items Modal (Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-4xl max-h-[88vh] md:max-h-[85vh] overflow-y-auto p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-4 animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
              isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Map Catalog Products</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Select items provided by {vendor?.name} and configure negotiated unit costs.
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                placeholder="Search catalog items..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className={`flex-1 px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                }`}
              />
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="accent-[#0071E3]"
                />
                <span>Select All Filtered</span>
              </label>
            </div>

            {/* Catalog Mapping Rows */}
            <div className="overflow-x-auto max-h-80 border rounded-2xl">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}>
                    <th className="py-2.5 px-3 w-8">Select</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3">Unit Cost ($)</th>
                    <th className="py-2.5 px-3">Vendor SKU</th>
                    <th className="py-2.5 px-3 text-center">Preferred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {filteredModalRows.map((row) => (
                    <tr key={row.itemId} className={row.selected ? (isDark ? "bg-[#0071E3]/10" : "bg-blue-50/50") : ""}>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => handleRowChange(row.itemId, "selected", e.target.checked)}
                          className="accent-[#0071E3]"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] opacity-75">
                        {formatUnit(row.unitOfMeasure as any)}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.01"
                          value={row.unitCost}
                          onChange={(e) => handleRowChange(row.itemId, "unitCost", e.target.value)}
                          className={`w-24 px-2 py-1 text-xs rounded-lg border font-mono ${
                            isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                          }`}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={row.vendorSku}
                          placeholder="SKU"
                          onChange={(e) => handleRowChange(row.itemId, "vendorSku", e.target.value)}
                          className={`w-28 px-2 py-1 text-xs rounded-lg border font-mono ${
                            isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                          }`}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.isPreferred}
                          onChange={(e) => handleRowChange(row.itemId, "isPreferred", e.target.checked)}
                          className="accent-[#0071E3]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <span className={`text-xs text-center sm:text-left ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {selectedCount} item(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl text-xs font-medium transition cursor-pointer text-center ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkLinkItems}
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer text-center"
                >
                  {submitting ? "Saving..." : "Save Mappings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal (Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {showEdit && (
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
                <h2 className="text-base font-bold tracking-tight">Edit Supplier Details</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Update commercial terms and contact details for {vendor?.name}.
                </p>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Code
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Representative
                  </label>
                  <input
                    type="text"
                    placeholder="Contact person"
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
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              {/* Single Full Row for Phone / Mobile */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Phone / Mobile Number (WhatsApp)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 555-0100"
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
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">Cash On Delivery (COD)</option>
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
                    placeholder="Tax registration ID"
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Address / Warehouse Location
                  </label>
                  <input
                    type="text"
                    placeholder="Street, City, Postal Code"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
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
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h2 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {confirmDialog.title}
                </h2>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, show: false }))}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] text-[#8F95A3] hover:text-white hover:bg-white/[0.08]"
                    : "bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConf = confirmDialog.onConfirm;
                  setConfirmDialog((prev) => ({ ...prev, show: false }));
                  if (onConf) onConf();
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm shadow-rose-600/20 cursor-pointer"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
