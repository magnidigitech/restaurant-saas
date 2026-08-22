"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

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

export default function PurchaseOrdersDirectoryPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const searchParams = useSearchParams();
  const { isDark } = useTheme();

  const paramItemId = searchParams.get("itemId");
  const paramSuggestedQty = searchParams.get("suggestedQty");
  const paramOutletId = searchParams.get("outletId");

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [vendorItemMaps, setVendorItemMaps] = useState<VendorItemMap[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autoFillMsg, setAutoFillMsg] = useState("");
  type POTab = "UPCOMING" | "COMPLETED" | "ALL";
  const [activeTab, setActiveTab] = useState<POTab>("ALL");

  // Form State
  const [formVendorId, setFormVendorId] = useState("");
  const [formOutletId, setFormOutletId] = useState("");
  const [formDeliveryDate, setFormDeliveryDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  // Checklist State: itemId -> { selected: boolean, quantity: string, unitCost: string }
  const [vendorItemsState, setVendorItemsState] = useState<
    Record<string, { selected: boolean; quantity: string; unitCost: string }>
  >({});

  const fetchMasterData = async () => {
    try {
      setLoading(true);
      const [resPOs, resVendors, resOutlets, resItems, resMaps, resStock] = await Promise.all([
        fetch(`/api/restaurant/inventory/purchase-orders`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }),
        fetch(`/api/restaurant/inventory/vendors`, { cache: "no-store" }),
        fetch(`/api/restaurant/outlets`, { cache: "no-store" }),
        fetch(`/api/restaurant/inventory/items`, { cache: "no-store" }),
        fetch(`/api/restaurant/inventory/vendor-items`, { cache: "no-store" }),
        fetch(`/api/restaurant/inventory/stock`, { cache: "no-store" }),
      ]);

      const fetchedPOs = resPOs.ok ? (await resPOs.json()).purchaseOrders || [] : [];
      const fetchedVendors = resVendors.ok ? (await resVendors.json()).vendors || [] : [];
      const fetchedOutlets = resOutlets.ok ? (await resOutlets.json()).outlets || [] : [];
      const fetchedItems = resItems.ok ? (await resItems.json()).items || [] : [];
      const fetchedMaps = resMaps.ok ? (await resMaps.json()).vendorItems || [] : [];
      const fetchedStock = resStock.ok ? (await resStock.json()).stock || [] : [];

      setPurchaseOrders(fetchedPOs);
      setVendors(fetchedVendors);
      setOutlets(fetchedOutlets);
      setInventoryItems(fetchedItems);
      setVendorItemMaps(fetchedMaps);
      setStockList(fetchedStock);

      if (fetchedOutlets.length > 0 && !formOutletId && !paramOutletId) {
        setFormOutletId(fetchedOutlets[0].id);
      }

      if (paramItemId && fetchedItems.length > 0) {
        const targetItem = fetchedItems.find((i: any) => i.id === paramItemId);
        if (targetItem) {
          const prefMap = fetchedMaps.find((m: any) => m.itemId === paramItemId && m.isPreferred);
          const initialCost = prefMap?.unitCost ?? targetItem.costPerUnit ?? 0;
          const initialVendor = prefMap?.vendorId || "";

          if (initialVendor) setFormVendorId(initialVendor);
          if (paramOutletId) setFormOutletId(paramOutletId);

          // Pre-select the target item
          setVendorItemsState({
            [paramItemId]: {
              selected: true,
              quantity: paramSuggestedQty ? Number(paramSuggestedQty).toString() : "1",
              unitCost: initialCost.toString(),
            },
          });
          setShowCreate(true);
        }
      }
    } catch {
      setError("Failed to load purchase orders data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
    const handleFocus = () => {
      fetchPOs();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [paramItemId]);

  const fetchPOs = async (s = search, st = statusFilter) => {
    try {
      const p = new URLSearchParams();
      if (s) p.set("search", s);
      if (st && st !== "ALL") p.set("status", st);
      const res = await fetch(`/api/restaurant/inventory/purchase-orders?${p.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.purchaseOrders)) {
        setPurchaseOrders(data.purchaseOrders);
      }
    } catch {
      setError("Failed to load purchase orders");
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchPOs(val, statusFilter);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    fetchPOs(search, val);
  };

  const getItemStockMetrics = (itemId: string, outletId?: string) => {
    const item = inventoryItems.find((i) => i.id === itemId);
    const rawReorder = Number(item?.reorderPoint || 0);
    const rawPar = Number(item?.parLevel || 0);

    // Par Level: Ideal / target quantity you want to maintain after restocking
    const parLevel = rawPar > 0 ? rawPar : (rawReorder > 0 ? rawReorder : 0);
    // Reorder Level: Point at or below which a purchase order must be placed
    const reorderLevel = rawReorder > 0 ? rawReorder : (rawPar > 0 ? rawPar : 0);

    const matchRecords = stockList.filter(
      (s) => s.itemId === itemId && (!outletId || s.outletId === outletId)
    );
    const currentStock = matchRecords.reduce(
      (sum, s) => sum + Number(s.currentStock || 0),
      0
    );

    // Low stock is triggered when Current Stock <= Reorder Level (or stock <= 0)
    const isLowStock =
      reorderLevel > 0
        ? currentStock <= reorderLevel
        : currentStock <= 0;

    // Formula: Reorder Quantity = Par Level - Current Stock (minimum 1)
    const targetPar = parLevel > 0 ? parLevel : Math.max(reorderLevel, 1);
    const suggestedQty = isLowStock
      ? Math.max(1, targetPar - currentStock)
      : Math.max(0, targetPar - currentStock);

    return {
      currentStock,
      reorderPoint: rawReorder,
      parLevel: rawPar,
      reorderLevel,
      targetPar,
      isLowStock,
      suggestedQty,
    };
  };

  const handleVendorSelect = (selectedVendorId: string) => {
    setFormVendorId(selectedVendorId);
    setAutoFillMsg("");

    if (!selectedVendorId) {
      setVendorItemsState({});
      return;
    }

    const mappingsForVendor = vendorItemMaps.filter((m) => m.vendorId === selectedVendorId);
    const newState: Record<string, { selected: boolean; quantity: string; unitCost: string }> = {};

    mappingsForVendor.forEach((m) => {
      const itemObj = inventoryItems.find((i) => i.id === m.itemId);
      const metrics = getItemStockMetrics(m.itemId, formOutletId);
      const cost = (m.unitCost ?? itemObj?.costPerUnit ?? 0).toString();
      const defaultQty = metrics.isLowStock && metrics.suggestedQty > 0 ? metrics.suggestedQty.toString() : "1";

      newState[m.itemId] = {
        selected: false,
        quantity: defaultQty,
        unitCost: cost,
      };
    });

    setVendorItemsState(newState);
  };

  const handleAutofillLowStock = () => {
    if (!formVendorId) return;
    const mappingsForVendor = vendorItemMaps.filter((m) => m.vendorId === formVendorId);
    let lowStockCount = 0;

    setVendorItemsState((prev) => {
      const copy = { ...prev };
      mappingsForVendor.forEach((m) => {
        const itemObj = inventoryItems.find((i) => i.id === m.itemId);
        const metrics = getItemStockMetrics(m.itemId, formOutletId);
        const cost = copy[m.itemId]?.unitCost ?? (m.unitCost ?? itemObj?.costPerUnit ?? 0).toString();

        if (metrics.isLowStock) {
          lowStockCount++;
          copy[m.itemId] = {
            selected: true,
            quantity: metrics.suggestedQty.toString(),
            unitCost: cost,
          };
        } else {
          copy[m.itemId] = {
            selected: false,
            quantity: copy[m.itemId]?.quantity || "1",
            unitCost: cost,
          };
        }
      });
      return copy;
    });

    if (lowStockCount > 0) {
      setAutoFillMsg(`⚡ Selected and calculated replenishment for ${lowStockCount} low-stock item(s).`);
    } else {
      setAutoFillMsg(`✅ All items from this supplier currently have adequate stock.`);
    }
  };

  const handleToggleItemSelection = (itemId: string) => {
    setVendorItemsState((prev) => {
      const current = prev[itemId] || { selected: false, quantity: "1", unitCost: "0" };
      return {
        ...prev,
        [itemId]: {
          ...current,
          selected: !current.selected,
        },
      };
    });
  };

  const handleSelectAll = (select: boolean) => {
    setVendorItemsState((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((id) => {
        copy[id] = { ...copy[id], selected: select };
      });
      return copy;
    });
  };

  const handleItemQtyChange = (itemId: string, qty: string) => {
    setVendorItemsState((prev) => {
      const current = prev[itemId] || { selected: false, quantity: "1", unitCost: "0" };
      return {
        ...prev,
        [itemId]: {
          ...current,
          quantity: qty,
          selected: parseFloat(qty) > 0 ? true : current.selected,
        },
      };
    });
  };

  const handleItemCostChange = (itemId: string, cost: string) => {
    setVendorItemsState((prev) => {
      const current = prev[itemId] || { selected: false, quantity: "1", unitCost: "0" };
      return {
        ...prev,
        [itemId]: {
          ...current,
          unitCost: cost,
        },
      };
    });
  };

  const currentVendorItems = useMemo(() => {
    if (!formVendorId) return [];
    return vendorItemMaps
      .filter((m) => m.vendorId === formVendorId)
      .map((m) => {
        const itemObj = inventoryItems.find((i) => i.id === m.itemId);
        const metrics = getItemStockMetrics(m.itemId, formOutletId);
        const state = vendorItemsState[m.itemId] || {
          selected: false,
          quantity: metrics.suggestedQty.toString(),
          unitCost: (m.unitCost ?? itemObj?.costPerUnit ?? 0).toString(),
        };
        const otherPrefMap = vendorItemMaps.find(
          (om) => om.itemId === m.itemId && om.isPreferred && om.vendorId !== formVendorId
        );
        const otherPrefVendor = otherPrefMap ? vendors.find((v) => v.id === otherPrefMap.vendorId) : null;

        return {
          id: m.id,
          itemId: m.itemId,
          name: itemObj?.name || "Unknown Item",
          unitOfMeasure: itemObj?.unitOfMeasure || "PIECES",
          isPreferred: m.isPreferred,
          preferredVendorName: otherPrefVendor?.name || null,
          currentStock: metrics.currentStock,
          reorderPoint: metrics.reorderPoint,
          parLevel: metrics.parLevel,
          isLowStock: metrics.isLowStock,
          suggestedQty: metrics.suggestedQty,
          selected: state.selected,
          quantity: state.quantity,
          unitCost: state.unitCost,
          rowTotal: (parseFloat(state.quantity) || 0) * (parseFloat(state.unitCost) || 0),
        };
      })
      .sort((a, b) => {
        // 1. Low stock items always on top
        if (a.isLowStock && !b.isLowStock) return -1;
        if (!a.isLowStock && b.isLowStock) return 1;

        // 2. For low stock items, sort by highest deficit descending
        if (a.isLowStock && b.isLowStock) {
          if (b.suggestedQty !== a.suggestedQty) {
            return b.suggestedQty - a.suggestedQty;
          }
        }

        // 3. Primary items before secondary
        if (a.isPreferred && !b.isPreferred) return -1;
        if (!a.isPreferred && b.isPreferred) return 1;

        // 4. Alphabetical by name
        return a.name.localeCompare(b.name);
      });
  }, [formVendorId, formOutletId, vendorItemMaps, inventoryItems, vendorItemsState, stockList]);

  const selectedCount = currentVendorItems.filter((i) => i.selected).length;
  const calculatedGrandTotal = currentVendorItems
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + i.rowTotal, 0);

  const handleCreatePO = async () => {
    if (!formVendorId) {
      setError("Please select a vendor");
      return;
    }
    if (!formOutletId) {
      setError("Please select a delivery branch outlet");
      return;
    }

    const selectedItems = currentVendorItems.filter((i) => i.selected && parseFloat(i.quantity) > 0);

    if (selectedItems.length === 0) {
      setError("Please check and select at least one item to place an order");
      return;
    }

    const validItems = selectedItems.map((item) => ({
      itemId: item.itemId,
      orderedQuantity: parseFloat(item.quantity),
      unitCost: parseFloat(item.unitCost) || 0,
    }));

    if (validItems.length === 0) {
      setError("Please specify at least one valid item with positive quantity");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/restaurant/inventory/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: formVendorId,
          outletId: formOutletId,
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
      setVendorItemsState({});

      if (data.purchaseOrder) {
        setPurchaseOrders((prev) => [data.purchaseOrder, ...prev.filter((p) => p.id !== data.purchaseOrder.id)]);
        setActiveTab("UPCOMING");
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
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Purchase Orders...</p>
      </div>
    );
  }

  const pendingCount = purchaseOrders.filter((po) => ["DRAFT", "SENT", "PARTIALLY_RECEIVED"].includes(po.status)).length;
  const totalSpend = purchaseOrders.reduce((sum, po) => sum + Number(po.grandTotal || (po as any).totalAmount || 0), 0);

  // Segregated Tab Datasets
  const upcomingPOs = purchaseOrders.filter((po) =>
    ["DRAFT", "SENT", "PARTIALLY_RECEIVED"].includes(po.status)
  );
  const completedPOs = purchaseOrders.filter((po) =>
    ["RECEIVED", "CANCELLED"].includes(po.status)
  );

  // Tab & Search filtered list
  const displayedPOs = (
    activeTab === "UPCOMING"
      ? upcomingPOs
      : activeTab === "COMPLETED"
      ? completedPOs
      : purchaseOrders
  ).filter((po) => {
    if (statusFilter && po.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      po.poNumber?.toLowerCase().includes(q) ||
      po.vendor?.name?.toLowerCase().includes(q) ||
      po.outlet?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <ModuleAccessGuard moduleKey="purchase_management" moduleName="Purchase Management" activeSection="Purchase Orders">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Purchase Orders" />

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
                Procurement & Stock Orders
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Purchase Orders Directory
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              {purchaseOrders.length} total orders recorded • {pendingCount} pending deliveries awaiting branch receipt.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPOs()}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              Refresh
            </button>
            <button
              onClick={() => {
                if (outlets.length > 0 && !formOutletId) {
                  setFormOutletId(outlets[0].id);
                }
                setShowCreate(true);
                setAutoFillMsg("");
                setError("");
              }}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Create PO</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Upcoming & Active POs
            </span>
            <p className="text-2xl font-bold font-mono tracking-tight mt-1 text-amber-500">
              {upcomingPOs.length}
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Completed / Received
            </span>
            <p className="text-2xl font-bold font-mono tracking-tight mt-1 text-emerald-500">
              {completedPOs.length}
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Total Purchase Orders
            </span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {purchaseOrders.length}
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Total Committed Spend
            </span>
            <p className="text-2xl font-bold font-mono tracking-tight mt-1 text-[#0071E3]">
              ${totalSpend.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className={`p-1.5 rounded-2xl border flex items-center gap-1.5 flex-wrap ${
            isDark ? "bg-[#121622]/80 border-white/[0.06]" : "bg-slate-100/90 border-slate-200"
          }`}>
            <button
              type="button"
              onClick={() => {
                setActiveTab("UPCOMING");
                setStatusFilter("");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === "UPCOMING"
                  ? isDark
                    ? "bg-[#0071E3] text-white shadow-md"
                    : "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
                  : isDark
                  ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>Upcoming & In-Flight POs</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "UPCOMING"
                  ? "bg-white/20 text-white"
                  : isDark
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              }`}>
                {upcomingPOs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("COMPLETED");
                setStatusFilter("");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === "COMPLETED"
                  ? isDark
                    ? "bg-[#0071E3] text-white shadow-md"
                    : "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
                  : isDark
                  ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>Completed & Received</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "COMPLETED"
                  ? "bg-white/20 text-white"
                  : isDark
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}>
                {completedPOs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === "ALL"
                  ? isDark
                    ? "bg-[#0071E3] text-white shadow-md"
                    : "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
                  : isDark
                  ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>All Orders</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "ALL"
                  ? "bg-white/20 text-white"
                  : isDark
                  ? "bg-white/[0.08] text-[#8F95A3]"
                  : "bg-slate-200 text-slate-700"
              }`}>
                {purchaseOrders.length}
              </span>
            </button>
          </div>

          {/* Search & Status Filter */}
          <div className="flex gap-2 items-center flex-1 sm:flex-none">
            <input
              placeholder="Search by PO number, supplier, or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`flex-1 sm:w-64 px-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            />
            {activeTab === "ALL" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-3 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SENT">SENT</option>
                <option value="PARTIALLY_RECEIVED">PARTIALLY RECEIVED</option>
                <option value="RECEIVED">RECEIVED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            )}
          </div>
        </div>

        {/* PO Directory Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          {displayedPOs.length === 0 ? (
            <div className={`p-12 text-center text-xs space-y-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              <p className="font-semibold text-sm">
                {activeTab === "UPCOMING"
                  ? "No upcoming purchase orders pending delivery"
                  : activeTab === "COMPLETED"
                  ? "No completed purchase orders yet"
                  : "No purchase orders found"}
              </p>
              <p className="opacity-75">
                {activeTab === "UPCOMING"
                  ? "All procurement requisitions have been fulfilled and stock ledgers updated."
                  : "Click '+ Create PO' to draft a new procurement requisition."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-3 px-3">PO Number</th>
                    <th className="pb-3 px-3">Supplier Vendor</th>
                    <th className="pb-3 px-3">Delivery Branch</th>
                    <th className="pb-3 px-3">Items & Delivery</th>
                    <th className="pb-3 px-3">Grand Total</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {displayedPOs.map((po) => {
                    const totalQty = po.items?.reduce((a, b) => a + Number(b.orderedQuantity || 0), 0) || 0;
                    const recQty = po.items?.reduce((a, b) => a + Number(b.receivedQuantity || 0), 0) || 0;

                    return (
                      <tr
                        key={po.id}
                        onClick={() => router.push(`/restaurant/${subdomain}/inventory/purchase-orders/${po.id}`)}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer group"
                      >
                        <td className="py-3.5 px-3">
                          <div className="font-mono font-bold text-[#0071E3]">
                            {po.poNumber}
                          </div>
                          <div className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            {new Date(po.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {po.vendor?.name || "Vendor"}
                        </td>
                        <td className={`py-3.5 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                          {po.outlet?.name || "Branch"}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className={`text-xs ${isDark ? "text-white" : "text-slate-900"}`}>
                            {po.items?.length || 0} item{(po.items?.length || 0) !== 1 ? "s" : ""}
                            <span className={`text-[10px] ml-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                              ({recQty}/{totalQty} units received)
                            </span>
                          </div>
                          {po.expectedDeliveryDate && (
                            <div className="text-[10px] text-amber-500 font-medium mt-0.5">
                              Due: {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className={`py-3.5 px-3 font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${Number(po.grandTotal || (po as any).totalAmount || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                            po.status === "RECEIVED"
                              ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : po.status === "SENT" || po.status === "PARTIALLY_RECEIVED"
                              ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-100 text-amber-800 border-amber-200"
                              : po.status === "CANCELLED"
                              ? isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
                              : isDark ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]" : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {po.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <span className="text-[#0071E3] font-semibold group-hover:underline text-xs">
                            {["SENT", "PARTIALLY_RECEIVED"].includes(po.status) ? "Receive Stock →" : "Inspect →"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Purchase Order Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Draft Purchase Order</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Requisition items from verified suppliers for branch delivery.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setError("");
                  setAutoFillMsg("");
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-500 dark:text-rose-400 text-xs rounded-xl flex items-center justify-between">
                <span className="font-medium">{error}</span>
                <button type="button" onClick={() => setError("")} className="text-rose-400 hover:text-rose-300 font-bold ml-2 cursor-pointer">✕</button>
              </div>
            )}

            {autoFillMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                {autoFillMsg}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Supplier Vendor *
                  </label>
                  <select
                    value={formVendorId}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="">Select Supplier...</option>
                    {vendors.map((v: Vendor) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Delivery Branch *
                  </label>
                  <select
                    value={formOutletId}
                    onChange={(e) => setFormOutletId(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="">Select Branch...</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formDeliveryDate}
                    onChange={(e) => setFormDeliveryDate(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Checklist Container */}
            <div className="space-y-3">
              {!formVendorId ? (
                <div className={`p-8 text-center rounded-2xl border ${
                  isDark ? "bg-[#0A0C12]/40 border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  <p className="text-sm font-medium">Please select a Supplier Vendor above to view catalog items.</p>
                </div>
              ) : currentVendorItems.length === 0 ? (
                <div className={`p-8 text-center rounded-2xl border ${
                  isDark ? "bg-[#0A0C12]/40 border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  <p className="text-sm font-medium">No catalog items mapped to this supplier.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Action Header */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                          Supplier Catalog Items
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDark ? "bg-white/[0.08] text-slate-300" : "bg-slate-200 text-slate-700"
                        }`}>
                          {currentVendorItems.length} items
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Check items to order or use 1-click low-stock replenishment:
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleAutofillLowStock}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-amber-500/20 flex items-center gap-1.5 active:scale-95"
                      >
                        <span>⚡ Autofill Low Stock</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAll(true)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                          isDark
                            ? "bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs"
                        }`}
                      >
                        ✓ Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAll(false)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                          isDark
                            ? "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:bg-white/[0.08]"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100 shadow-xs"
                        }`}
                      >
                        ✕ Clear All
                      </button>
                    </div>
                  </div>

                  {/* Clean Tabular Catalog Table */}
                  <div className={`rounded-2xl border overflow-hidden shadow-xs ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-white border-slate-200"
                  }`}>
                    {/* Table Column Headers */}
                    <div className={`hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 border-b text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? "bg-white/[0.03] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}>
                      <div className="col-span-6 flex items-center gap-3">
                        <span>Item & Stock Status</span>
                      </div>
                      <div className="col-span-2 text-center">Order Qty</div>
                      <div className="col-span-2 text-center">Unit Cost ($)</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-white/[0.04] max-h-[44vh] overflow-y-auto">
                      {currentVendorItems.map((item) => {
                        const isLow = item.isLowStock;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleItemSelection(item.itemId)}
                            className={`p-3 sm:px-4 sm:py-3 transition cursor-pointer flex flex-col sm:grid sm:grid-cols-12 gap-2.5 sm:gap-3 sm:items-center ${
                              item.selected
                                ? isDark
                                  ? "bg-[#0071E3]/15 border-l-4 border-l-[#0071E3]"
                                  : "bg-blue-50/70 border-l-4 border-l-[#0071E3]"
                                : isLow
                                ? isDark
                                  ? "bg-amber-500/[0.04] border-l-4 border-l-amber-500 hover:bg-amber-500/[0.08]"
                                  : "bg-amber-500/[0.03] border-l-4 border-l-amber-500 hover:bg-amber-500/[0.06]"
                                : isDark
                                ? "border-l-4 border-l-transparent hover:bg-white/[0.02]"
                                : "border-l-4 border-l-transparent hover:bg-slate-50/60"
                            }`}
                          >
                            {/* Col 1: Checkbox + Name + Badges (col-span-6) */}
                            <div className="sm:col-span-6 flex items-start sm:items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleItemSelection(item.itemId)}
                                className="w-4 h-4 rounded border-slate-300 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer mt-0.5 sm:mt-0 shrink-0"
                              />

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold ${
                                    item.selected
                                      ? isDark ? "text-white" : "text-blue-950"
                                      : isDark ? "text-slate-200" : "text-slate-900"
                                  }`}>
                                    {item.name}
                                  </span>
                                  <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                    ({item.unitOfMeasure})
                                  </span>
                                  {item.isPreferred ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/15 text-[#0071E3] dark:text-blue-400 border border-blue-500/30">
                                      ⭐ Primary
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                                      Secondary {item.preferredVendorName ? `(${item.preferredVendorName})` : ""}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                  {isLow ? (
                                    <>
                                      <span className="px-1.5 py-0.2 rounded-md font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                        ⚠️ Reorder
                                      </span>
                                      <span className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                                        Stock: <strong>{item.currentStock}</strong> {item.reorderPoint > 0 && `| Min: ${item.reorderPoint}`} | Par: {item.parLevel}
                                      </span>
                                      <span className="bg-amber-600 text-white px-1.5 py-0.2 rounded-md font-black text-[9px]">
                                        Deficit: {item.suggestedQty}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded-md font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                      ✅ In Stock: <strong>{item.currentStock}</strong> {item.parLevel > 0 && `(Par: ${item.parLevel})`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Order Qty (col-span-2) */}
                            <div className="sm:col-span-2 flex sm:justify-center items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <span className="sm:hidden text-[10px] font-medium text-slate-500 w-16">Qty:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) => handleItemQtyChange(item.itemId, e.target.value)}
                                className={`w-20 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg border transition ${
                                  item.selected
                                    ? isDark ? "bg-[#0A0C12] border-[#0071E3] text-white" : "bg-white border-[#0071E3] text-blue-900"
                                    : isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                                }`}
                              />
                            </div>

                            {/* Col 3: Unit Cost (col-span-2) */}
                            <div className="sm:col-span-2 flex sm:justify-center items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <span className="sm:hidden text-[10px] font-medium text-slate-500 w-16">Cost:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Cost"
                                value={item.unitCost}
                                onChange={(e) => handleItemCostChange(item.itemId, e.target.value)}
                                className={`w-20 px-2 py-1 text-xs font-mono text-center rounded-lg border transition ${
                                  isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                                }`}
                              />
                            </div>

                            {/* Col 4: Subtotal (col-span-2) */}
                            <div className="sm:col-span-2 flex sm:justify-end items-center justify-between" onClick={(e) => e.stopPropagation()}>
                              <span className="sm:hidden text-[10px] font-medium text-slate-500">Subtotal:</span>
                              <span className={`font-mono font-black text-xs ${
                                item.selected
                                  ? isDark ? "text-[#64B5FF]" : "text-[#0071E3]"
                                  : isDark ? "text-[#8F95A3]" : "text-slate-400"
                              }`}>
                                {item.selected ? `$${item.rowTotal.toFixed(2)}` : "--"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grand Total Bar */}
                  <div className={`p-4 rounded-2xl border flex justify-between items-center transition ${
                    isDark
                      ? "bg-gradient-to-r from-[#0071E3]/20 via-[#0071E3]/15 to-[#0071E3]/10 border-[#0071E3]/30"
                      : "bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50 border-blue-200 shadow-sm"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[#64B5FF]" : "text-blue-900"}`}>
                        Estimated Grand Total
                      </span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold shadow-xs ${
                        selectedCount > 0
                          ? "bg-[#0071E3] text-white"
                          : isDark ? "bg-white/[0.08] text-slate-400" : "bg-slate-200 text-slate-600"
                      }`}>
                        {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
                      </span>
                    </div>
                    <span className={`text-xl font-black font-mono tracking-tight ${isDark ? "text-white" : "text-[#0071E3]"}`}>
                      ${calculatedGrandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Delivery gate, unloading terms, or invoice contact notes..."
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setError("");
                  setAutoFillMsg("");
                }}
                className={`px-4 py-2 rounded-xl text-xs font-medium ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePO}
                disabled={submitting}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Creating..." : "Create Purchase Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
