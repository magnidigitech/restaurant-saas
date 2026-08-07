"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface POItem {
  id: string;
  itemId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  totalCost: number;
  item: { id: string; name: string; unitOfMeasure: string };
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  grandTotal: number;
  expectedDeliveryDate?: string;
  createdAt: string;
  vendor: { id: string; name: string; code?: string };
  outlet: { id: string; name: string };
  items: POItem[];
}

interface Vendor {
  id: string;
  name: string;
}

interface Outlet {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unitOfMeasure: string;
  costPerUnit: number;
  reorderPoint?: number;
  parLevel?: number;
}

interface VendorItemMap {
  id: string;
  vendorId: string;
  itemId: string;
  unitCost?: number | null;
  isPreferred?: boolean;
}

export default function PurchaseOrdersDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramItemId = searchParams.get("itemId");
  const paramSuggestedQty = searchParams.get("suggestedQty");
  const paramOutletId = searchParams.get("outletId");

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [vendorItemMaps, setVendorItemMaps] = useState<VendorItemMap[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autoFillMsg, setAutoFillMsg] = useState("");

  // Form State
  const [formVendorId, setFormVendorId] = useState("");
  const [formOutletId, setFormOutletId] = useState("");
  const [formDeliveryDate, setFormDeliveryDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [lineItems, setLineItems] = useState<{ itemId: string; orderedQuantity: string; unitCost: string }[]>([
    { itemId: "", orderedQuantity: "1", unitCost: "0" },
  ]);

  const fetchMasterData = async () => {
    try {
      const [resPOs, resVendors, resOutlets, resItems, resMaps] = await Promise.all([
        fetch(`/api/restaurant/inventory/purchase-orders`),
        fetch(`/api/restaurant/inventory/vendors`),
        fetch(`/api/restaurant/outlets`),
        fetch(`/api/restaurant/inventory/items`),
        fetch(`/api/restaurant/inventory/vendor-items`),
      ]);

      const fetchedPOs = resPOs.ok ? (await resPOs.json()).purchaseOrders || [] : [];
      const fetchedVendors = resVendors.ok ? (await resVendors.json()).vendors || [] : [];
      const fetchedOutlets = resOutlets.ok ? (await resOutlets.json()).outlets || [] : [];
      const fetchedItems = resItems.ok ? (await resItems.json()).items || [] : [];
      const fetchedMaps = resMaps.ok ? (await resMaps.json()).vendorItems || [] : [];

      setPurchaseOrders(fetchedPOs);
      setVendors(fetchedVendors);
      setOutlets(fetchedOutlets);
      setInventoryItems(fetchedItems);
      setVendorItemMaps(fetchedMaps);

      // Pre-fill modal if query params passed from Low-Stock Alerts
      if (paramItemId || paramSuggestedQty) {
        setShowCreate(true);
        if (paramOutletId) setFormOutletId(paramOutletId);

        // Find supplier for this item
        const itemMaps = fetchedMaps.filter((m: any) => m.itemId === paramItemId);
        if (itemMaps.length === 1) {
          setFormVendorId(itemMaps[0].vendorId);
        }

        const targetItem = fetchedItems.find((i: any) => i.id === paramItemId);
        const unitCost = itemMaps[0]?.unitCost?.toString() || targetItem?.costPerUnit?.toString() || "0";

        setLineItems([
          {
            itemId: paramItemId || "",
            orderedQuantity: paramSuggestedQty || "1",
            unitCost,
          },
        ]);
      }
    } catch {
      setError("Failed to load purchase management data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPOs = async (s = search, st = statusFilter) => {
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (st) params.set("status", st);
      const res = await fetch(`/api/restaurant/inventory/purchase-orders?${params}`);
      const data = await res.json();
      if (res.ok) setPurchaseOrders(data.purchaseOrders || []);
    } catch {
      setError("Failed to reload purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchPOs(val, statusFilter);
  };

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

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    fetchPOs(search, val);
  };

  // Vendor Change Safeguard
  const handleVendorSelect = (newVendorId: string) => {
    const hasItems = lineItems.some((r) => r.itemId !== "");
    if (hasItems && formVendorId && formVendorId !== newVendorId) {
      setConfirmDialog({
        show: true,
        title: "Change Supplier Vendor?",
        message: "Changing vendor will reset line items to ensure supplier-product compatibility. Proceed?",
        confirmText: "Reset & Change Vendor",
        onConfirm: () => {
          setLineItems([{ itemId: "", orderedQuantity: "1", unitCost: "0" }]);
          setFormVendorId(newVendorId);
        },
      });
      return;
    }
    setFormVendorId(newVendorId);
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, { itemId: "", orderedQuantity: "1", unitCost: "0" }]);
  };

  const handleRemoveLineItem = (idx: number) => {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineItemChange = (idx: number, field: string, value: string) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      if (field === "itemId" && value) {
        // Item-First Selection: Check mapped vendor unit cost
        const mapEntry = vendorItemMaps.find((m) => m.itemId === value && (formVendorId ? m.vendorId === formVendorId : true));
        const selectedItem = inventoryItems.find((i) => i.id === value);
        const cost = mapEntry?.unitCost ?? selectedItem?.costPerUnit ?? 0;
        updated[idx].unitCost = cost.toString();

        // Bi-Directional: If no vendor selected yet, check mapped suppliers for this item
        if (!formVendorId) {
          const itemMaps = vendorItemMaps.filter((m) => m.itemId === value);
          if (itemMaps.length === 1) {
            // Auto-select single vendor if exactly 1 supplier is mapped!
            setFormVendorId(itemMaps[0].vendorId);
          }
        }
      }
      return updated;
    });
  };

  // Auto-Fill Low Stock Items for Selected Vendor
  const handleAutoFillStock = async () => {
    if (!formVendorId) {
      setError("Please select a Vendor first to auto-fill low stock items.");
      return;
    }

    try {
      setError(""); setAutoFillMsg("");
      const params = new URLSearchParams();
      if (formOutletId) params.set("outletId", formOutletId);
      const res = await fetch(`/api/restaurant/inventory/alerts?${params}`);
      const data = await res.json();

      const alerts = res.ok ? data.alerts || [] : [];

      // Filter items mapped to this vendor
      const vendorItemIds = vendorItemMaps
        .filter((m) => m.vendorId === formVendorId)
        .map((m) => m.itemId);

      let relevantAlerts = alerts.filter((a: any) =>
        vendorItemIds.length > 0 ? vendorItemIds.includes(a.itemId) : true
      );

      // Fallback: If alerts API returned no items, auto-fill items mapped to this vendor
      if (relevantAlerts.length === 0 && vendorItemIds.length > 0) {
        const mappedItems = inventoryItems.filter((i) => vendorItemIds.includes(i.id));
        relevantAlerts = mappedItems.map((i) => ({
          itemId: i.id,
          itemName: i.name,
          suggestedOrder: i.parLevel ? Number(i.parLevel) : 1,
        }));
      }

      if (relevantAlerts.length === 0) {
        setAutoFillMsg("No low-stock items requiring reorder were found for this vendor.");
        return;
      }

      const newRows = relevantAlerts.map((a: any) => {
        const mapEntry = vendorItemMaps.find((m) => m.vendorId === formVendorId && m.itemId === a.itemId);
        const targetItem = inventoryItems.find((i) => i.id === a.itemId);
        const unitCost = mapEntry?.unitCost ?? targetItem?.costPerUnit ?? 0;
        return {
          itemId: a.itemId,
          orderedQuantity: (a.suggestedOrder ?? 1).toString(),
          unitCost: unitCost.toString(),
        };
      });

      setLineItems(newRows);
      setAutoFillMsg(`✓ Auto-filled ${newRows.length} low-stock item(s) with suggested order quantities!`);
    } catch (e: any) {
      setError(e.message || "Failed to auto-fill stock");
    }
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((sum, row) => {
      const q = Number(row.orderedQuantity) || 0;
      const c = Number(row.unitCost) || 0;
      return sum + q * c;
    }, 0);
  };

  // Filter available Vendors dynamically based on selected Items
  const getAvailableVendors = () => {
    const selectedItemIds = lineItems.map((r) => r.itemId).filter(Boolean);
    if (selectedItemIds.length === 0) return vendors;

    // Filter vendors that are mapped to selected items
    const approvedVendorIds = vendorItemMaps
      .filter((m) => selectedItemIds.includes(m.itemId))
      .map((m) => m.vendorId);

    if (approvedVendorIds.length === 0) return vendors; // Fallback if no explicit links defined yet
    return vendors.filter((v) => approvedVendorIds.includes(v.id));
  };

  // Filter available Line Items dynamically based on selected Vendor
  const getAvailableItems = () => {
    if (!formVendorId) return inventoryItems;
    const mappedItemIds = vendorItemMaps
      .filter((m) => m.vendorId === formVendorId)
      .map((m) => m.itemId);

    if (mappedItemIds.length === 0) return inventoryItems; // Fallback to all items if no explicit links set
    return inventoryItems.filter((i) => mappedItemIds.includes(i.id));
  };

  const handleCreatePO = async () => {
    if (!formVendorId) { setError("Please select a vendor"); return; }
    if (!formOutletId) { setError("Please select a destination outlet"); return; }

    const validItems = lineItems
      .filter((row) => row.itemId && Number(row.orderedQuantity) > 0)
      .map((row) => ({
        itemId: row.itemId,
        orderedQuantity: Number(row.orderedQuantity),
        unitCost: Number(row.unitCost),
      }));

    if (validItems.length === 0) {
      setError("Please add at least one valid line item with quantity > 0");
      return;
    }

    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: formOutletId,
          vendorId: formVendorId,
          expectedDeliveryDate: formDeliveryDate || undefined,
          notes: formNotes || undefined,
          items: validItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowCreate(false);
      setFormVendorId("");
      setFormOutletId("");
      setFormDeliveryDate("");
      setFormNotes("");
      setAutoFillMsg("");
      setLineItems([{ itemId: "", orderedQuantity: "1", unitCost: "0" }]);

      if (data.purchaseOrder) {
        setPurchaseOrders((prev) => [data.purchaseOrder, ...prev]);
      }
      await fetchPOs();
    } catch (e: any) {
      setError(e.message || "Failed to create purchase order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading purchase orders...
      </main>
    );
  }

  const pendingCount = purchaseOrders.filter((po) => ["DRAFT", "SENT", "PARTIALLY_RECEIVED"].includes(po.status)).length;
  const totalSpend = purchaseOrders.reduce((sum, po) => sum + Number(po.grandTotal), 0);
  const filteredVendors = getAvailableVendors();
  const filteredItems = getAvailableItems();

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
            <h1 className="text-lg font-bold text-gray-900">Purchase Management</h1>
            <p className="text-xs text-gray-500">{purchaseOrders.length} orders total • {pendingCount} pending deliveries</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPOs()}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-gray-200"
          >
            Refresh
          </button>
          <button
            onClick={() => { setShowCreate(true); setAutoFillMsg(""); setError(""); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            + Create Purchase Order
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">{error}</div>}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Purchase Orders</span>
            <p className="text-3xl font-extrabold text-gray-900 font-mono">{purchaseOrders.length}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Pending Deliveries</span>
            <p className="text-3xl font-extrabold text-amber-600 font-mono">{pendingCount}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Total PO Value</span>
            <p className="text-3xl font-extrabold text-indigo-600 font-mono">₹{totalSpend.toFixed(2)}</p>
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Search by PO code, vendor name, or outlet..."
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
            <option value="DRAFT">DRAFT</option>
            <option value="SENT">SENT</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        {/* Purchase Orders Table */}
        {purchaseOrders.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-300 bg-white rounded-2xl space-y-2">
            <p className="text-gray-900 font-bold text-lg">No Purchase Orders Found</p>
            <p className="text-gray-500 text-xs">Create your first purchase order using the button above.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3.5 px-4">PO Number & Date</th>
                    <th className="py-3.5 px-4">Supplier Vendor</th>
                    <th className="py-3.5 px-4">Destination Outlet</th>
                    <th className="py-3.5 px-4 text-center">Items Count</th>
                    <th className="py-3.5 px-4 text-right">Grand Total</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {purchaseOrders.map((po) => (
                    <tr
                      key={po.id}
                      onClick={() => router.push(`/inventory/purchase-orders/${po.id}`)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-all"
                    >
                      <td className="py-3.5 px-4 font-mono">
                        <p className="font-bold text-gray-900 text-sm">{po.poNumber}</p>
                        <p className="text-[11px] text-gray-500">{new Date(po.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{po.vendor?.name || "—"}</td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">{po.outlet?.name || "—"}</td>
                      <td className="py-3.5 px-4 text-center font-bold font-mono text-gray-700">{po.items?.length || 0} line items</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900 text-sm">₹{Number(po.grandTotal).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            po.status === "RECEIVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : po.status === "SENT"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : po.status === "DRAFT"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          [{po.status}]
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

      {/* Create PO Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-2xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create Purchase Order</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select vendor, outlet, and add line items for procurement</p>
              </div>

              {/* Auto-fill Stock Button */}
              <button
                type="button"
                onClick={handleAutoFillStock}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                ⚡ Auto-Fill Low Stock Items
              </button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold">{error}</div>}
            {autoFillMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold">{autoFillMsg}</div>}

            <div className="grid grid-cols-2 gap-4">
              {/* Vendor Selector (Filtered dynamically) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Supplier Vendor *
                  {filteredVendors.length < vendors.length && (
                    <span className="text-[10px] text-indigo-600 font-semibold ml-1">(Filtered by Item)</span>
                  )}
                </label>
                <select
                  value={formVendorId}
                  onChange={(e) => handleVendorSelect(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">Select Vendor...</option>
                  {filteredVendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Destination Outlet Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Destination Outlet *</label>
                <select
                  value={formOutletId}
                  onChange={(e) => setFormOutletId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">Select Outlet...</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              {/* Expected Delivery Date */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={formDeliveryDate}
                  onChange={(e) => setFormDeliveryDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                />
              </div>

              {/* Line Items Table Builder */}
              <div className="col-span-2 space-y-3 pt-2">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    Line Items
                    {formVendorId && filteredItems.length < inventoryItems.length && (
                      <span className="text-[10px] text-indigo-600 font-normal">({filteredItems.length} vendor items)</span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    + Add Line Item
                  </button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((row, idx) => {
                    const rowTotal = (Number(row.orderedQuantity) || 0) * (Number(row.unitCost) || 0);
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                        {/* Item Selector */}
                        <div className="flex-1">
                          <select
                            value={row.itemId}
                            onChange={(e) => handleLineItemChange(idx, "itemId", e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                          >
                            <option value="">Select Item...</option>
                            {filteredItems.map((i) => (
                              <option key={i.id} value={i.id}>{i.name} ({i.unitOfMeasure})</option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="w-24">
                          <input
                            type="number"
                            placeholder="Qty"
                            min="1"
                            value={row.orderedQuantity}
                            onChange={(e) => handleLineItemChange(idx, "orderedQuantity", e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        {/* Unit Cost */}
                        <div className="w-24">
                          <input
                            type="number"
                            placeholder="Unit Cost ₹"
                            min="0"
                            step="0.01"
                            value={row.unitCost}
                            onChange={(e) => handleLineItemChange(idx, "unitCost", e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        {/* Row Total */}
                        <div className="w-24 text-right font-mono font-bold text-xs text-gray-900">
                          ₹{rowTotal.toFixed(2)}
                        </div>

                        {/* Delete Row Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          disabled={lineItems.length === 1}
                          className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-30 cursor-pointer px-1"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Grand Total Summary */}
                <div className="flex justify-between items-center p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Estimated PO Grand Total</span>
                  <span className="text-lg font-extrabold text-indigo-700 font-mono">₹{calculateGrandTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Notes / Instructions</label>
                <textarea
                  placeholder="Additional delivery instructions or payment terms..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowCreate(false); setError(""); setAutoFillMsg(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePO}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {submitting ? "Creating..." : "Create Purchase Order"}
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
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
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
