"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  Link2,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Unplug,
  Utensils,
  X,
  XCircle,
} from "lucide-react";

interface OutletItem {
  id: string;
  name: string;
  currency?: string;
}

interface SyncRunItem {
  id: string;
  runType: string;
  status: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface PosIntegrationItem {
  id: string;
  outletId: string;
  outlet?: { id: string; name: string };
  provider: "TOAST" | "SQUARE" | "CLOVER";
  providerLocationId: string | null;
  providerLocationName: string | null;
  status: string;
  environment: string;
  syncFrequency: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncStatus: string | null;
  errorMessage: string | null;
  importedOrdersCount: number;
  stockPostingEnabled: boolean;
  stockPostingEffectiveFrom: string | null;
  health: "HEALTHY" | "STALE" | "ERROR" | "DISCONNECTED" | "SYNCING";
  credentialsMasked?: Record<string, any>;
  syncRuns?: SyncRunItem[];
}

interface PosOrderItemRow {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  taxAmount?: number | string;
  discountAmount?: number | string;
  netSales?: number | string;
  refundedQuantity?: number;
  isVoided?: boolean;
  modifiers?: Array<{ name: string; price?: number; option?: string }>;
  recipe?: { id: string; name: string } | null;
}

interface PaymentTender {
  tenderType: string;
  label: string;
  amount: number;
  tipAmount: number;
  cardBrand?: string;
  last4?: string;
}

interface RefundRecord {
  externalRefundId: string;
  amount: number;
  tipRefundAmount?: number;
  reason?: string;
  refundedAt?: string;
}

interface PosOrderRow {
  id: string;
  outletId: string;
  outlet?: { id: string; name: string };
  orderNumber: string;
  orderType: string;
  status: string;
  currency: string;
  environment: string;
  provider: string;
  providerOrderId: string | null;
  totalAmount: number | string;
  taxAmount: number | string;
  discountAmount: number | string;
  tipAmount: number | string;
  serviceChargeAmount: number | string;
  voidedAmount: number | string;
  refundAmount: number | string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentsJson?: PaymentTender[] | null;
  refundsJson?: RefundRecord[] | null;
  customerName: string | null;
  notes: string | null;
  createdAt: string;
  providerUpdatedAt: string | null;
  lastSyncedAt: string | null;
  depletedAt: string | null;
  items: PosOrderItemRow[];
}

interface CurrencyTotals {
  currency: string;
  orderCount: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  tax: number;
  tips: number;
  serviceCharges: number;
  totalCollected: number;
}

interface MenuItemMappingRow {
  id: string;
  outletId: string;
  outlet?: { id: string; name: string };
  provider: string;
  externalItemId: string;
  externalItemName: string;
  externalVariantId: string;
  externalVariantName: string | null;
  recipeId: string | null;
  recipe?: { id: string; name: string } | null;
  isIgnored: boolean;
}

interface RecipeOption {
  id: string;
  name: string;
}

function formatMoney(val: number | string, currency = "USD") {
  const num = Number(val || 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency || "USD"} ${num.toFixed(2)}`;
  }
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HealthBadge({ health }: { health: PosIntegrationItem["health"] }) {
  const map: Record<PosIntegrationItem["health"], { cls: string; label: string }> = {
    HEALTHY: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Healthy" },
    STALE: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Stale Sync" },
    ERROR: { cls: "bg-rose-50 text-rose-700 border-rose-200", label: "Sync Error" },
    DISCONNECTED: { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Disconnected" },
    SYNCING: { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "Syncing" },
  };
  const cfg = map[health] || map.STALE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function PosHubPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);

  const [activeTab, setActiveTab] = useState<"ORDERS" | "CONNECTIONS" | "MAPPINGS">("ORDERS");
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [integrations, setIntegrations] = useState<PosIntegrationItem[]>([]);
  const [orders, setOrders] = useState<PosOrderRow[]>([]);
  const [totalsByCurrency, setTotalsByCurrency] = useState<CurrencyTotals[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 100, totalCount: 0, totalPages: 1 });
  const [mappings, setMappings] = useState<MenuItemMappingRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [unmappedOnly, setUnmappedOnly] = useState(false);

  // Filters
  const [selectedOutletId, setSelectedOutletId] = useState("ALL");
  const [selectedProvider, setSelectedProvider] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Native <dialog> refs
  const orderDetailDialogRef = useRef<HTMLDialogElement>(null);
  const connectDialogRef = useRef<HTMLDialogElement>(null);
  const manualOrderDialogRef = useRef<HTMLDialogElement>(null);

  const [inspectedOrder, setInspectedOrder] = useState<PosOrderRow | null>(null);

  // Connect form state
  const [connectProvider, setConnectProvider] = useState<"TOAST" | "SQUARE" | "CLOVER">("SQUARE");
  const [connectOutletId, setConnectOutletId] = useState("");
  const [connectEnv, setConnectEnv] = useState<"SANDBOX" | "PRODUCTION">("SANDBOX");
  const [connectFreq, setConnectFreq] = useState("15_MIN");
  const [connectCreds, setConnectCreds] = useState<Record<string, string>>({});
  const [connectSaving, setConnectSaving] = useState(false);

  // Manual order state
  const [manualOutletId, setManualOutletId] = useState("");
  const [manualTable, setManualTable] = useState("");
  const [manualOrderType, setManualOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [manualPaymentMethod, setManualPaymentMethod] = useState("CASH");
  const [manualRecipeId, setManualRecipeId] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("15.00");
  const [manualSaving, setManualSaving] = useState(false);

  const loadCoreData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedOutletId !== "ALL") q.set("outletId", selectedOutletId);
      if (selectedProvider !== "ALL") q.set("provider", selectedProvider);
      if (selectedStatus !== "ALL") q.set("status", selectedStatus);
      if (startDate) q.set("startDate", startDate);
      if (endDate) q.set("endDate", endDate);
      if (searchQuery.trim()) q.set("search", searchQuery.trim());
      q.set("page", String(page));
      q.set("pageSize", "100");

      const [ordersRes, intRes, outletsRes] = await Promise.all([
        fetch(`/api/restaurant/pos/orders?${q.toString()}`, { cache: "no-store" }),
        fetch("/api/restaurant/pos/integrations", { cache: "no-store" }),
        fetch("/api/restaurant/outlets", { cache: "no-store" }),
      ]);

      if (ordersRes.ok) {
        const od = await ordersRes.json();
        setOrders(od.orders || []);
        setTotalsByCurrency(od.totalsByCurrency || []);
        if (od.pagination) setPagination(od.pagination);
      }
      if (intRes.ok) {
        const idata = await intRes.json();
        setIntegrations(idata.integrations || []);
      }
      if (outletsRes.ok) {
        const odata = await outletsRes.json();
        const list = odata.outlets || odata.data || [];
        setOutlets(list);
        if (list.length > 0 && !connectOutletId) setConnectOutletId(list[0].id);
        if (list.length > 0 && !manualOutletId) setManualOutletId(list[0].id);
      }
    } catch (e: any) {
      setBanner({ type: "error", text: e.message || "Failed to load POS Hub data" });
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId, selectedProvider, selectedStatus, startDate, endDate, searchQuery, page, connectOutletId, manualOutletId]);

  const loadMappings = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (selectedOutletId !== "ALL") q.set("outletId", selectedOutletId);
      if (unmappedOnly) q.set("unmappedOnly", "true");
      const res = await fetch(`/api/restaurant/pos/mappings?${q.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
        setRecipes(data.recipes || []);
        if ((data.recipes || []).length > 0 && !manualRecipeId) {
          setManualRecipeId(data.recipes[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [selectedOutletId, unmappedOnly, manualRecipeId]);

  useEffect(() => {
    loadCoreData();
  }, [loadCoreData]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const openOrderDetail = (order: PosOrderRow) => {
    setInspectedOrder(order);
    orderDetailDialogRef.current?.showModal();
  };

  const handleSyncNow = async (integrationId: string, mode: "MANUAL" | "BACKFILL" = "MANUAL") => {
    setActionBusyId(integrationId);
    setBanner(null);
    try {
      const res = await fetch(`/api/restaurant/pos/integrations/${integrationId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setBanner({
        type: "success",
        text: `${mode === "BACKFILL" ? "Backfill" : "Sync"} ${data.status}: ${data.importedCount} imported, ${data.updatedCount} updated, ${data.skippedCount} skipped.`,
      });
      await loadCoreData();
      await loadMappings();
    } catch (err: any) {
      setBanner({ type: "error", text: err.message || "Sync failed" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    setActionBusyId(integrationId);
    setBanner(null);
    try {
      const res = await fetch(`/api/restaurant/pos/integrations/${integrationId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.valid) throw new Error(data.error || "Connection test failed");
      setBanner({ type: "success", text: "Connection test succeeded." });
      await loadCoreData();
    } catch (err: any) {
      setBanner({ type: "error", text: err.message || "Connection test failed" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setActionBusyId(integrationId);
    setBanner(null);
    try {
      const res = await fetch(`/api/restaurant/pos/integrations/${integrationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      setBanner({
        type: "success",
        text: "Connection disconnected. All imported order history has been preserved.",
      });
      await loadCoreData();
    } catch (err: any) {
      setBanner({ type: "error", text: err.message || "Disconnect failed" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleUpdateIntegration = async (
    integrationId: string,
    patch: Record<string, any>,
    successMsg: string
  ) => {
    setActionBusyId(integrationId);
    setBanner(null);
    try {
      const res = await fetch(`/api/restaurant/pos/integrations/${integrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setBanner({ type: "success", text: successMsg });
      await loadCoreData();
    } catch (err: any) {
      setBanner({ type: "error", text: err.message || "Update failed" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/restaurant/pos/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: connectOutletId,
          provider: connectProvider,
          syncFrequency: connectFreq,
          isTestMode: connectEnv === "SANDBOX",
          credentials: {
            ...connectCreds,
            environment: connectEnv,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      connectDialogRef.current?.close();
      setConnectCreds({});
      setBanner({ type: "success", text: `${connectProvider} connected and encrypted.` });
      await loadCoreData();
    } catch (err: any) {
      setBanner({ type: "error", text: err.message || "Failed to connect POS" });
    } finally {
      setConnectSaving(false);
    }
  };

  const handleSaveMapping = async (
    row: MenuItemMappingRow,
    recipeId: string | null,
    isIgnored: boolean
  ) => {
    setActionBusyId(row.id);
    try {
      const res = await fetch("/api/restaurant/pos/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          outletId: row.outletId,
          provider: row.provider,
          externalItemId: row.externalItemId,
          externalItemName: row.externalItemName,
          externalVariantId: row.externalVariantId,
          externalVariantName: row.externalVariantName,
          recipeId,
          isIgnored,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save mapping");
      setBanner({ type: "success", text: `Saved mapping for ${row.externalItemName}.` });
      await loadMappings();
    } catch (err: any) {
      setBanner({ type: "error", text: err.message || "Failed to save mapping" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSaving(true);
    setBanner(null);
    try {
      const recipe = recipes.find((r) => r.id === manualRecipeId);
      const res = await fetch("/api/restaurant/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: manualOutletId,
          tableNumber: manualTable || undefined,
          orderType: manualOrderType,
          paymentMethod: manualPaymentMethod,
          items: [
            {
              recipeId: manualRecipeId,
              name: recipe?.name || "Manual Menu Item",
              quantity: Math.max(1, Number(manualQty) || 1),
              unitPrice: Number(manualPrice) || 0,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create manual order");
      manualOrderDialogRef.current?.close();
      setBanner({ type: "success", text: `Manual order ${data.order?.orderNumber} created.` });
      await loadCoreData();
    } catch (err: any) {
      setBanner({ type: "error", text: err.message || "Manual order failed" });
    } finally {
      setManualSaving(false);
    }
  };

  const staleOrErrorConnections = integrations.filter(
    (i) => i.health === "ERROR" || i.health === "STALE"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      <style>{`
        dialog:modal { overscroll-behavior: contain; }
        dialog::backdrop { overflow: hidden; overscroll-behavior: contain; background: rgba(15, 23, 42, 0.55); }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link
                href={`/restaurant/${subdomain}`}
                className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span className="font-medium text-slate-700">POS Integrations &amp; Orders Hub</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              POS Integrations &amp; Orders Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Scheduled &amp; webhook-assisted order ingestion, currency-isolated totals, tip tender attribution, and optional delta recipe depletion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => manualOrderDialogRef.current?.showModal()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50"
            >
              <Utensils className="w-4 h-4" />
              Manual Order
            </button>
            <button
              type="button"
              onClick={() => connectDialogRef.current?.showModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-medium hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              Connect POS
            </button>
          </div>
        </header>

        {/* Sync Health Alert */}
        {staleOrErrorConnections.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <span className="font-semibold">Attention needed:</span>{" "}
              {staleOrErrorConnections.length} POS connection(s) have stale or failed sync status (
              {staleOrErrorConnections.map((c) => `${c.provider} @ ${c.outlet?.name || "Outlet"}`).join(", ")}).
              Check the Connections &amp; Health tab.
            </div>
          </div>
        )}

        {/* Action Feedback Banner */}
        {banner && (
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              banner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {banner.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{banner.text}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setBanner(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Currency-isolated Metrics */}
        {totalsByCurrency.length > 0 && (
          <section className="space-y-3" aria-label="Sales Summary by Currency">
            {totalsByCurrency.map((bucket) => (
              <div key={bucket.currency} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Currency Summary: {bucket.currency} ({bucket.orderCount} orders)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {[
                    { label: "Gross Sales", value: bucket.grossSales },
                    { label: "Discounts", value: bucket.discounts },
                    { label: "Net Sales", value: bucket.netSales },
                    { label: "Tax", value: bucket.tax },
                    { label: "Service Chg", value: bucket.serviceCharges },
                    { label: "Tips", value: bucket.tips },
                    { label: "Total Collected", value: bucket.totalCollected, accent: true },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={`rounded-xl border p-3 ${
                        m.accent
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-900 border-slate-200"
                      }`}
                    >
                      <div className={`text-[11px] font-medium ${m.accent ? "text-slate-300" : "text-slate-500"}`}>
                        {m.label}
                      </div>
                      <div className="text-sm sm:text-base font-bold mt-0.5 tabular-nums">
                        {formatMoney(m.value, bucket.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Tabs */}
        <nav className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
          {[
            { id: "ORDERS", label: `Orders Hub (${pagination.totalCount})` },
            { id: "CONNECTIONS", label: `Connections & Health (${integrations.length})` },
            {
              id: "MAPPINGS",
              label: `Recipe Mapping (${mappings.filter((m) => !m.recipeId && !m.isIgnored).length} unmapped)`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ORDERS HUB TAB */}
        {activeTab === "ORDERS" && (
          <section className="space-y-4">
            {/* Compact Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Search orders"
                  placeholder="Search order #, customer, or external ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <select
                aria-label="Filter by outlet"
                value={selectedOutletId}
                onChange={(e) => {
                  setSelectedOutletId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="ALL">All Authorized Outlets</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by provider"
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="ALL">All Providers</option>
                <option value="TOAST">Toast</option>
                <option value="SQUARE">Square</option>
                <option value="CLOVER">Clover</option>
                <option value="MANUAL">Manual</option>
              </select>

              <select
                aria-label="Filter by status"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled / Voided</option>
              </select>

              <div className="flex items-center gap-1.5 lg:col-span-6">
                <label className="text-xs text-slate-500">From</label>
                <input
                  type="date"
                  aria-label="Start date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white"
                />
                <label className="text-xs text-slate-500 ml-2">To</label>
                <input
                  type="date"
                  aria-label="End date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white"
                />
              </div>
            </div>

            {loading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700">No orders match the current filters.</p>
                <p className="text-xs text-slate-500">Connect a POS provider or create a manual order to populate the Orders Hub.</p>
              </div>
            ) : (
              <>
                {/* Desktop Semantic Table */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="orders-table-caption"
                  className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-auto shadow-xs"
                >
                  <table className="w-full text-left border-collapse text-sm">
                    <caption id="orders-table-caption" className="sr-only">
                      Consolidated POS Orders Hub
                    </caption>
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="py-3 px-4">Order</th>
                        <th className="py-3 px-4">Outlet &amp; Provider</th>
                        <th className="py-3 px-4">Order Time vs Synced</th>
                        <th className="py-3 px-4">Tender</th>
                        <th className="py-3 px-4 text-right">Tips</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/70">
                          <th scope="row" className="py-3 px-4 font-semibold text-slate-900">
                            <div>{order.orderNumber}</div>
                            <div className="text-xs font-normal text-slate-500">
                              {order.items?.length || 0} line(s) {order.customerName ? `• ${order.customerName}` : ""}
                            </div>
                          </th>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{order.outlet?.name || "Outlet"}</div>
                            <div className="text-xs text-slate-500">
                              {order.provider} • {order.environment}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="text-slate-800">Ordered: {formatDateTime(order.createdAt)}</div>
                            <div className="text-slate-500">Last synced: {formatDateTime(order.lastSyncedAt)}</div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                              <CreditCard className="w-3 h-3" />
                              {order.paymentMethod || "N/A"}
                            </span>
                            {Number(order.refundAmount) > 0 && (
                              <div className="text-rose-600 mt-0.5">
                                Refund: {formatMoney(order.refundAmount, order.currency)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                            {formatMoney(order.tipAmount, order.currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">
                            {formatMoney(order.totalAmount, order.currency)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                                order.status === "COMPLETED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : order.status === "CANCELLED"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openOrderDetail(order)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards (360px / 390px, zero horizontal overflow) */}
                <div className="md:hidden space-y-3">
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{order.orderNumber}</div>
                          <div className="text-xs text-slate-500">
                            {order.outlet?.name || "Outlet"} • {order.provider}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            order.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : order.status === "CANCELLED"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5">
                        <div>
                          <span className="text-slate-500 block">Order Time</span>
                          <span className="font-medium text-slate-800">{formatDateTime(order.createdAt)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Last Synced</span>
                          <span className="font-medium text-slate-800">{formatDateTime(order.lastSyncedAt)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Tips ({order.paymentMethod || "N/A"})</span>
                          <span className="font-medium text-slate-800 tabular-nums">
                            {formatMoney(order.tipAmount, order.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Total</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            {formatMoney(order.totalAmount, order.currency)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openOrderDetail(order)}
                        className="w-full py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        View Order Breakdown
                      </button>
                    </article>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm">
                  <span className="text-slate-600 tabular-nums">
                    Showing{" "}
                    {pagination.totalCount === 0
                      ? 0
                      : (pagination.page - 1) * pagination.pageSize + 1}
                    –
                    {Math.min(
                      pagination.page * pagination.pageSize,
                      pagination.totalCount
                    )}{" "}
                    of {pagination.totalCount} (Page {pagination.page} of{" "}
                    {pagination.totalPages})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* CONNECTIONS & HEALTH TAB */}
        {activeTab === "CONNECTIONS" && (
          <section className="space-y-4">
            {integrations.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <p className="text-sm font-medium text-slate-700">No POS connections configured yet.</p>
                <button
                  type="button"
                  onClick={() => connectDialogRef.current?.showModal()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Connect Toast, Square, or Clover
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {integrations.map((conn) => (
                  <article
                    key={conn.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-bold text-slate-900">{conn.provider}</h2>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {conn.environment}
                          </span>
                          <HealthBadge health={conn.health} />
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5" />
                          <span>{conn.outlet?.name || "Outlet"}</span>
                          {conn.providerLocationName && (
                            <span>• {conn.providerLocationName}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>{conn.importedOrdersCount} orders</div>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Encrypted
                        </div>
                      </div>
                    </div>

                    {conn.errorMessage && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800">
                        {conn.errorMessage}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3">
                      <div>
                        <span className="text-slate-500 block">Last Successful Sync</span>
                        <span className="font-medium text-slate-800">
                          {formatDateTime(conn.lastSuccessfulSyncAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Sync Frequency</span>
                        <select
                          aria-label={`Sync frequency for ${conn.provider}`}
                          value={conn.syncFrequency}
                          disabled={actionBusyId === conn.id || conn.status === "DISCONNECTED"}
                          onChange={(e) =>
                            handleUpdateIntegration(
                              conn.id,
                              { syncFrequency: e.target.value },
                              `Updated sync frequency to ${e.target.value}`
                            )
                          }
                          className="mt-0.5 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                        >
                          <option value="5_MIN">Every 5 min</option>
                          <option value="15_MIN">Every 15 min</option>
                          <option value="30_MIN">Every 30 min</option>
                          <option value="HOURLY">Hourly</option>
                          <option value="MANUAL">Manual only</option>
                        </select>
                      </div>
                    </div>

                    {/* Stage 3: Stock Posting Opt-In */}
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <PackageCheck className="w-4 h-4 text-slate-600" />
                          Delta Recipe Stock Posting
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {conn.stockPostingEnabled
                            ? `Active for orders since ${formatDateTime(conn.stockPostingEffectiveFrom)}`
                            : "Disabled by default (reporting-only until enabled)"}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={actionBusyId === conn.id || conn.status === "DISCONNECTED"}
                        onClick={() =>
                          handleUpdateIntegration(
                            conn.id,
                            {
                              stockPostingEnabled: !conn.stockPostingEnabled,
                              ...(!conn.stockPostingEnabled
                                ? { stockPostingEffectiveFrom: new Date().toISOString() }
                                : {}),
                            },
                            !conn.stockPostingEnabled
                              ? "Enabled delta stock posting from now forward."
                              : "Disabled delta stock posting."
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg font-semibold border ${
                          conn.stockPostingEnabled
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {conn.stockPostingEnabled ? "Enabled" : "Enable"}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionBusyId === conn.id}
                        onClick={() => handleTestConnection(conn.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium hover:bg-slate-50"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        Test Connection
                      </button>
                      <button
                        type="button"
                        disabled={actionBusyId === conn.id || conn.status === "DISCONNECTED"}
                        onClick={() => handleSyncNow(conn.id, "MANUAL")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${actionBusyId === conn.id ? "animate-spin" : ""}`} />
                        Sync Now
                      </button>
                      <button
                        type="button"
                        disabled={actionBusyId === conn.id || conn.status === "DISCONNECTED"}
                        onClick={() => handleSyncNow(conn.id, "BACKFILL")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Backfill (30d)
                      </button>
                      {conn.status !== "DISCONNECTED" && (
                        <button
                          type="button"
                          disabled={actionBusyId === conn.id}
                          onClick={() => handleDisconnect(conn.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-medium hover:bg-rose-50 ml-auto"
                        >
                          <Unplug className="w-3.5 h-3.5" />
                          Disconnect
                        </button>
                      )}
                    </div>

                    {/* Recent Sync Runs */}
                    {conn.syncRuns && conn.syncRuns.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Recent Sync Runs
                        </div>
                        <div className="space-y-1">
                          {conn.syncRuns.slice(0, 3).map((run) => (
                            <div
                              key={run.id}
                              className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5"
                            >
                              <span className="font-medium text-slate-700">
                                {run.runType} • {run.status}
                              </span>
                              <span className="text-slate-500 tabular-nums">
                                +{run.importedCount} / ~{run.updatedCount} / ={run.skippedCount} / !{run.failedCount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* RECIPE MAPPING TAB (STAGE 3) */}
        {activeTab === "MAPPINGS" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Outlet Menu Item → Published Recipe Mapping</h2>
                <p className="text-xs text-slate-500">
                  Explicit mapping is required before delta stock depletion posts for any imported POS item.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={unmappedOnly}
                  onChange={(e) => setUnmappedOnly(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Unmapped queue only
              </label>
            </div>

            {mappings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
                No external menu items found in the queue yet. Sync orders from a POS connection first.
              </div>
            ) : (
              <div className="space-y-2.5">
                {mappings.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        {m.externalItemName}
                        {m.externalVariantName ? ` (${m.externalVariantName})` : ""}
                      </div>
                      <div className="text-xs text-slate-500">
                        {m.outlet?.name || "Outlet"} • {m.provider} • ID: {m.externalItemId}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Recipe mapping for ${m.externalItemName}`}
                        value={m.recipeId || ""}
                        disabled={actionBusyId === m.id}
                        onChange={(e) =>
                          handleSaveMapping(m, e.target.value || null, false)
                        }
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white min-w-[200px]"
                      >
                        <option value="">-- Unmapped --</option>
                        {recipes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={actionBusyId === m.id}
                        onClick={() => handleSaveMapping(m, null, !m.isIgnored)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                          m.isIgnored
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {m.isIgnored ? "Ignored" : "Ignore"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ORDER DETAIL NATIVE <dialog> */}
      <dialog
        ref={orderDetailDialogRef}
        aria-labelledby="order-detail-title"
        closedby="any"
        className="m-auto w-[min(94vw,680px)] max-h-[88vh] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl overflow-auto"
      >
        {inspectedOrder && (
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h1 id="order-detail-title" className="text-lg font-bold text-slate-900">
                  Order {inspectedOrder.orderNumber}
                </h1>
                <p className="text-xs text-slate-500">
                  {inspectedOrder.outlet?.name} • {inspectedOrder.provider} ({inspectedOrder.environment}) • {inspectedOrder.currency}
                </p>
              </div>
              <form method="dialog">
                <button
                  type="submit"
                  aria-label="Close order details"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3">
              <div>
                <span className="text-slate-500 block">Order Timestamp</span>
                <span className="font-medium">{formatDateTime(inspectedOrder.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Synced</span>
                <span className="font-medium">{formatDateTime(inspectedOrder.lastSyncedAt)}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Line Items
              </h2>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {inspectedOrder.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-start justify-between gap-3 text-xs sm:text-sm">
                    <div>
                      <div className="font-medium text-slate-900">
                        {item.quantity}x {item.name}
                        {item.isVoided && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px]">
                            VOIDED
                          </span>
                        )}
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-xs text-slate-500">
                          {item.modifiers.map((m) => m.name).join(", ")}
                        </div>
                      )}
                      {item.recipe && (
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          Mapped Recipe: {item.recipe.name}
                        </div>
                      )}
                    </div>
                    <div className="text-right font-semibold tabular-nums">
                      {formatMoney(item.netSales || item.totalPrice, inspectedOrder.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payments & Tenders */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payments &amp; Tip Tenders
              </h2>
              {Array.isArray(inspectedOrder.paymentsJson) && inspectedOrder.paymentsJson.length > 0 ? (
                <div className="space-y-1.5">
                  {inspectedOrder.paymentsJson.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2"
                    >
                      <span className="font-medium">
                        {p.tenderType} ({p.label})
                      </span>
                      <span className="tabular-nums">
                        Paid {formatMoney(p.amount, inspectedOrder.currency)} • Tip{" "}
                        {formatMoney(p.tipAmount, inspectedOrder.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  Tender-level breakdown unavailable ({inspectedOrder.paymentMethod || "Unknown method"}).
                </div>
              )}
            </div>

            {/* Amount Breakdown */}
            <div className="border-t border-slate-200 pt-3 space-y-1 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Discounts</span>
                <span className="tabular-nums">-{formatMoney(inspectedOrder.discountAmount, inspectedOrder.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tax</span>
                <span className="tabular-nums">{formatMoney(inspectedOrder.taxAmount, inspectedOrder.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Service Charges</span>
                <span className="tabular-nums">{formatMoney(inspectedOrder.serviceChargeAmount, inspectedOrder.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tips</span>
                <span className="tabular-nums">{formatMoney(inspectedOrder.tipAmount, inspectedOrder.currency)}</span>
              </div>
              {Number(inspectedOrder.refundAmount) > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>Refunds</span>
                  <span className="tabular-nums">-{formatMoney(inspectedOrder.refundAmount, inspectedOrder.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                <span>Total Collected</span>
                <span className="tabular-nums">{formatMoney(inspectedOrder.totalAmount, inspectedOrder.currency)}</span>
              </div>
            </div>
          </div>
        )}
      </dialog>

      {/* CONNECT POS NATIVE <dialog> */}
      <dialog
        ref={connectDialogRef}
        aria-labelledby="connect-pos-title"
        closedby="any"
        className="m-auto w-[min(94vw,520px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h1 id="connect-pos-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Connect POS Provider
          </h1>
          <form method="dialog">
            <button type="submit" aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>

        <form onSubmit={handleConnectSubmit} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
              <select
                value={connectProvider}
                onChange={(e) => {
                  setConnectProvider(e.target.value as any);
                  setConnectCreds({});
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="SQUARE">Square POS</option>
                <option value="TOAST">Toast POS</option>
                <option value="CLOVER">Clover POS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Outlet</label>
              <select
                required
                value={connectOutletId}
                onChange={(e) => setConnectOutletId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Environment</label>
              <select
                value={connectEnv}
                onChange={(e) => setConnectEnv(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="SANDBOX">Sandbox</option>
                <option value="PRODUCTION">Production</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sync Frequency</label>
              <select
                value={connectFreq}
                onChange={(e) => setConnectFreq(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="5_MIN">Every 5 min</option>
                <option value="15_MIN">Every 15 min</option>
                <option value="30_MIN">Every 30 min</option>
                <option value="HOURLY">Hourly</option>
                <option value="MANUAL">Manual only</option>
              </select>
            </div>
          </div>

          {connectProvider === "SQUARE" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Square Access Token</label>
              <input
                type="password"
                required
                placeholder="EAAA..."
                value={connectCreds.accessToken || ""}
                onChange={(e) => setConnectCreds((c) => ({ ...c, accessToken: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>
          )}

          {connectProvider === "TOAST" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Toast Client ID</label>
                <input
                  type="text"
                  required
                  value={connectCreds.clientId || ""}
                  onChange={(e) => setConnectCreds((c) => ({ ...c, clientId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Toast Client Secret</label>
                <input
                  type="password"
                  required
                  value={connectCreds.clientSecret || ""}
                  onChange={(e) => setConnectCreds((c) => ({ ...c, clientSecret: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Restaurant External GUID</label>
                <input
                  type="text"
                  required
                  value={connectCreds.restaurantGuid || ""}
                  onChange={(e) => setConnectCreds((c) => ({ ...c, restaurantGuid: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
            </>
          )}

          {connectProvider === "CLOVER" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Clover API Token</label>
                <input
                  type="password"
                  required
                  value={connectCreds.apiToken || ""}
                  onChange={(e) => setConnectCreds((c) => ({ ...c, apiToken: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Clover Merchant ID</label>
                <input
                  type="text"
                  required
                  value={connectCreds.merchantId || ""}
                  onChange={(e) => setConnectCreds((c) => ({ ...c, merchantId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => connectDialogRef.current?.close()}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={connectSaving}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
            >
              {connectSaving ? "Encrypting & Testing..." : "Test & Connect"}
            </button>
          </div>
        </form>
      </dialog>

      {/* MANUAL ORDER NATIVE <dialog> */}
      <dialog
        ref={manualOrderDialogRef}
        aria-labelledby="manual-order-title"
        closedby="any"
        className="m-auto w-[min(94vw,480px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h1 id="manual-order-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Create Manual POS Order
          </h1>
          <form method="dialog">
            <button type="submit" aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>

        <form onSubmit={handleCreateManualOrder} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Outlet</label>
            <select
              required
              value={manualOutletId}
              onChange={(e) => setManualOutletId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Order Type</label>
              <select
                value={manualOrderType}
                onChange={(e) => setManualOrderType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="DINE_IN">Dine-In</option>
                <option value="TAKEAWAY">Takeaway</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment</label>
              <select
                value={manualPaymentMethod}
                onChange={(e) => setManualPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Published Recipe</label>
            <select
              required
              value={manualRecipeId}
              onChange={(e) => setManualRecipeId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Table</label>
              <input
                type="text"
                value={manualTable}
                onChange={(e) => setManualTable(e.target.value)}
                placeholder="T-4"
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                value={manualQty}
                onChange={(e) => setManualQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit Price</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => manualOrderDialogRef.current?.close()}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={manualSaving || !manualRecipeId}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
            >
              {manualSaving ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
