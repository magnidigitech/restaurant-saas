"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

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

export default function VendorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = params?.id as string;

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

  // Custom Confirm Dialog Modal State
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

      const fetchedVItems: VendorItemMap[] = resVendorItems.ok ? dataVItems.vendorItems || [] : [];
      const fetchedAllVItems: VendorItemMap[] = resAllVendorItems.ok ? dataAllVItems.vendorItems || [] : [];
      const fetchedAllItems: InventoryItem[] = resAllItems.ok ? dataAllItems.items || [] : [];

      setVendorItems(fetchedVItems);
      setAllRestaurantVendorItems(fetchedAllVItems);
      setAllItems(fetchedAllItems);

      // Build preferred supplier lookup map
      const preferredMap: Record<string, string> = {};
      fetchedAllVItems.forEach((m) => {
        if (m.isPreferred && m.vendor?.name) {
          preferredMap[m.itemId] = m.vendor.name;
        }
      });

      // Build rows for ALL inventory items (showing selected state, unit cost, SKU, and preferred status)
      setMultiSelectRows(
        fetchedAllItems.map((i) => {
          const existing = fetchedVItems.find((vi) => vi.itemId === i.id);
          const isSel = Boolean(existing);
          const cost = existing?.unitCost ?? i.costPerUnit ?? 0;
          return {
            itemId: i.id,
            name: i.name,
            unitOfMeasure: i.unitOfMeasure,
            selected: isSel,
            isPreferred: existing ? existing.isPreferred : false,
            unitCost: cost.toString(),
            vendorSku: existing?.vendorSku || "",
            existingPreferredVendor: preferredMap[i.id] || null,
          };
        })
      );
    } catch {
      setError("Failed to load vendor detail");
    } fontally: {
      setLoading(false);
    }
  };

  const fetchVendorDetailWithFinally = async () => {
    try {
      await fetchVendorDetail();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) fetchVendorDetailWithFinally();
  }, [vendorId]);

  const openMultiSelectModal = () => {
    const preferredMap: Record<string, string> = {};
    allRestaurantVendorItems.forEach((m) => {
      if (m.isPreferred && m.vendor?.name) {
        preferredMap[m.itemId] = m.vendor.name;
      }
    });

    // Populate ALL items in the system with their current linked state for this vendor
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
    setSubmitting(true); setError("");
    try {
      const selectedRows = multiSelectRows.filter((r) => r.selected);
      const unselectedPreviouslyLinked = multiSelectRows.filter(
        (r) => !r.selected && vendorItems.some((vi) => vi.itemId === r.itemId)
      );

      // Unlink items that were unchecked
      for (const unselected of unselectedPreviouslyLinked) {
        await fetch(`/api/restaurant/inventory/vendor-items?vendorId=${vendorId}&itemId=${unselected.itemId}`, {
          method: "DELETE",
        });
      }

      // Upsert selected items (updates unit cost, SKU, and preferred flag)
      if (selectedRows.length > 0) {
        const res = await fetch(`/api/restaurant/inventory/vendor-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorId,
            items: selectedRows.map((s) => ({
              itemId: s.itemId,
              vendorSku: s.vendorSku || undefined,
              unitCost: Number(s.unitCost) || 0,
              isPreferred: s.isPreferred,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      setShowLinkModal(false);
      fetchVendorDetailWithFinally();
    } catch (e: any) {
      setError(e.message || "Failed to save product catalog changes");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!form.name) {
      setError("Vendor name is required");
      return;
    }
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
      fetchVendorDetailWithFinally();
    } catch (e: any) {
      setError(e.message || "Failed to update vendor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkItem = async (itemId: string) => {
    setConfirmDialog({
      show: true,
      title: "Unlink Product Mapping",
      message: "Are you sure you want to remove this product mapping for this vendor?",
      confirmText: "Yes, Unlink Product",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/restaurant/inventory/vendor-items?vendorId=${vendorId}&itemId=${itemId}`, {
            method: "DELETE",
          });
          if (res.ok) fetchVendorDetailWithFinally();
        } catch {
          setError("Failed to unlink item");
        }
      },
    });
  };

  const handleArchive = async () => {
    setConfirmDialog({
      show: true,
      title: "Archive Vendor?",
      message: `Are you sure you want to archive vendor "${vendor?.name}"?`,
      confirmText: "Yes, Archive Vendor",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/restaurant/inventory/vendors/${vendorId}`, {
            method: "DELETE",
          });
          if (res.ok) router.push("/inventory/vendors");
        } catch {
          setError("Failed to archive vendor");
        }
      },
    });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading vendor profile...
      </main>
    );
  }

  if (error && !vendor) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-red-600 font-semibold">
        {error || "Vendor not found"}
      </main>
    );
  }

  const selectedCount = multiSelectRows.filter((r) => r.selected).length;
  const filteredModalRows = multiSelectRows.filter((r) =>
    r.name.toLowerCase().includes(modalSearch.toLowerCase())
  );
  const allFilteredSelected =
    filteredModalRows.length > 0 && filteredModalRows.every((r) => r.selected);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navbar Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm"
          >
            ← Back to Directory
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {vendor?.name}
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  vendor?.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : vendor?.status === "INACTIVE"
                    ? "bg-gray-100 text-gray-600 border-gray-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                [{vendor?.status}]
              </span>
            </h1>
            <p className="text-xs text-gray-500">{vendorItems.length} mapped products • Added: {vendor ? new Date(vendor.createdAt).toLocaleDateString() : ""}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Edit Profile
          </button>
          <button
            onClick={handleArchive}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Archive Vendor
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* Overview Banner */}
        <div className="bg-white border-t-4 border-t-indigo-600 border-x border-b border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{vendor?.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Code: <strong className="text-gray-900">{vendor?.code || "N/A"}</strong> • Contact Person: <strong className="text-gray-900">{vendor?.contactPerson || "N/A"}</strong>
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-right space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Payment Terms</span>
            <span className="text-lg font-extrabold text-indigo-700 font-mono">{vendor?.paymentTerms}</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-gray-500 text-[11px]">Contact Information</h3>
            <p className="text-gray-700 font-mono">Phone: {vendor?.phone || "—"}</p>
            <p className="text-gray-700 font-mono">Email: {vendor?.email || "—"}</p>
            <p className="text-gray-700">Tax ID / GSTIN: {vendor?.taxId || "—"}</p>
            <p className="text-gray-700">Address: {vendor?.address || "—"}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-gray-500 text-[11px]">Notes & Catalog Summary</h3>
            <p className="text-gray-700 font-medium">{vendor?.notes || "No additional notes provided."}</p>
            <p className="text-indigo-600 font-bold mt-2">Mapped Items: {vendorItems.length} active SKU links</p>
          </div>
        </div>

        {/* Supplied Products Catalog Manager */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Supplied Products Catalog ({vendorItems.length})</h3>
              <p className="text-xs text-gray-400 mt-0.5">Link inventory items supplied by this vendor for automated PO auto-fill</p>
            </div>
            <button
              onClick={openMultiSelectModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
            >
              + Manage Catalog / Edit Prices (Multi-Select)
            </button>
          </div>

          {vendorItems.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl space-y-1">
              <p className="text-gray-700 font-bold text-sm">No Supplied Items Linked</p>
              <p className="text-xs text-gray-400">Link items to enable dynamic PO filtering and 1-click auto-filling.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-4">Item Name & UOM</th>
                    <th className="py-3 px-4 text-right">Vendor Unit Cost (₹)</th>
                    <th className="py-3 px-4">Vendor SKU</th>
                    <th className="py-3 px-4 text-center">Preferred Supplier</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {vendorItems.map((vi) => (
                    <tr key={vi.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {vi.item?.name} <span className="text-[11px] text-gray-500 font-normal">({vi.item?.unitOfMeasure})</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                        ₹{Number(vi.unitCost ?? vi.item?.costPerUnit ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">{vi.vendorSku || "—"}</td>
                      <td className="py-3 px-4 text-center">
                        {vi.isPreferred ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            ★ Preferred Supplier
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-3">
                        <button
                          onClick={openMultiSelectModal}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleUnlinkItem(vi.itemId)}
                          className="text-xs text-red-600 hover:text-red-700 font-bold cursor-pointer"
                        >
                          Unlink
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Multi-Select Link / Edit Products Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-3xl space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Manage Supplied Catalog & Prices</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select/deselect products, edit vendor unit costs, and toggle preferred supplier status</p>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                {selectedCount} linked products
              </span>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg font-semibold">{error}</div>}

            {/* Filter Search inside Modal */}
            <div>
              <input
                placeholder="Search inventory items..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Scrollable Items Table showing ALL items */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl">
              {filteredModalRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 font-medium">
                  No matching inventory items found.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-indigo-600 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Item Name & Status</th>
                      <th className="py-2.5 px-3 w-28 text-center">Preferred</th>
                      <th className="py-2.5 px-3 w-32 text-right">Vendor Cost (₹)</th>
                      <th className="py-2.5 px-3 w-32">Vendor SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredModalRows.map((row) => (
                      <tr key={row.itemId} className={`hover:bg-indigo-50/30 transition-all ${row.selected ? "bg-indigo-50/40" : ""}`}>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => handleRowChange(row.itemId, "selected", e.target.checked)}
                            className="rounded text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{row.name}</span>
                            <span className="text-[11px] text-gray-500 font-normal">({row.unitOfMeasure})</span>
                            {row.existingPreferredVendor ? (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                row.existingPreferredVendor === vendor?.name
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  : "text-amber-700 bg-amber-50 border-amber-200"
                              }`}>
                                ★ Preferred: {row.existingPreferredVendor}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-normal">No preferred supplier set</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.isPreferred}
                            onChange={(e) => handleRowChange(row.itemId, "isPreferred", e.target.checked)}
                            className="rounded text-emerald-600 cursor-pointer"
                            title="Mark as Preferred Supplier"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            value={row.unitCost}
                            onChange={(e) => handleRowChange(row.itemId, "unitCost", e.target.value)}
                            disabled={!row.selected}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-600 disabled:opacity-40"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            placeholder="e.g. SKU-101"
                            value={row.vendorSku}
                            onChange={(e) => handleRowChange(row.itemId, "vendorSku", e.target.value)}
                            disabled={!row.selected}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono text-gray-800 focus:outline-none focus:border-indigo-600 disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLinkModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkLinkItems}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Saving Catalog..." : `Save Catalog (${selectedCount} items linked)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Edit Vendor Profile</h2>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg font-semibold">{error}</div>}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Vendor Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Contact Person</label>
                  <input
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Payment Terms</label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 font-semibold focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="COD">COD</option>
                    <option value="IMMEDIATE">IMMEDIATE</option>
                    <option value="NET7">NET 7</option>
                    <option value="NET15">NET 15</option>
                    <option value="NET30">NET 30</option>
                    <option value="NET60">NET 60</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={submitting}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal Dialog Box UI */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">{confirmDialog.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{confirmDialog.message}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, show: false }))}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const onConf = confirmDialog.onConfirm;
                  setConfirmDialog((prev) => ({ ...prev, show: false }));
                  if (onConf) onConf();
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
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
