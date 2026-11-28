"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";
import { convertQuantity, formatUnit } from "@/core/inventory/units";

interface OutletOption {
  id: string;
  name: string;
}

interface PurchasePack {
  id: string;
  name: string;
  packUnit: string;
  netQuantityPerPack: number | string;
}

interface CountItemRow {
  id: string;
  itemId: string;
  unitOfMeasure: string;
  isCounted: boolean;
  countedBaseInput: number | null;
  countedPacksJson: Array<{
    packId: string;
    packName: string;
    packUnit: string;
    packCount: number;
    netQuantityPerPack: number;
    conversionFactorToBase: number;
    baseQty: number;
  }> | null;
  countedBaseQty: number | null;
  expectedAtCutoff: number;
  laterMovementsQty: number;
  varianceQty: number;
  recountRequested: boolean;
  recountReason: string | null;
  adjustmentLedgerId: string | null;
  isStaleReview?: boolean;
  item: {
    id: string;
    name: string;
    sku: string | null;
    unitOfMeasure: string;
    purchasePacks: PurchasePack[];
  };
}

interface StockCountDetail {
  id: string;
  outletId: string;
  outlet: { id: string; name: string };
  countNumber: string;
  status: "DRAFT" | "SUBMITTED" | "NEEDS_RECOUNT" | "APPROVED" | "CANCELLED";
  countDate: string;
  cutoffAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  requiresRefresh: boolean;
  skippedItems: Array<{ itemId: string; itemName: string }>;
  progress: {
    totalItems: number;
    countedItems: number;
    remainingItems: number;
    varianceItems: number;
  };
  items: CountItemRow[];
}

interface DraftInputState {
  isCounted: boolean;
  baseQtyStr: string;
  packs: Record<string, string>;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export default function PhysicalStockCountsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);

  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [countsList, setCountsList] = useState<any[]>([]);
  const [activeCount, setActiveCount] = useState<StockCountDetail | null>(null);
  const [draftInputs, setDraftInputs] = useState<Record<string, DraftInputState>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const hydrateDrafts = useCallback((count: StockCountDetail) => {
    const map: Record<string, DraftInputState> = {};
    for (const row of count.items) {
      const packsMap: Record<string, string> = {};
      for (const p of row.countedPacksJson || []) {
        packsMap[p.packId] = String(p.packCount);
      }
      map[row.itemId] = {
        isCounted: row.isCounted,
        baseQtyStr: row.countedBaseInput !== null ? String(row.countedBaseInput) : "",
        packs: packsMap,
      };
    }
    setDraftInputs(map);
  }, []);

  const loadCounts = useCallback(async (outletId?: string) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (outletId) q.set("outletId", outletId);
      const [outletsRes, countsRes] = await Promise.all([
        fetch("/api/restaurant/outlets", { cache: "no-store" }),
        fetch(`/api/restaurant/inventory/counts?${q.toString()}`, { cache: "no-store" }),
      ]);

      if (outletsRes.ok) {
        const od = await outletsRes.json();
        const list = od.outlets || od.data || [];
        setOutlets(list);
        if (list.length > 0 && !selectedOutletId) {
          setSelectedOutletId(list[0].id);
        }
      }
      if (countsRes.ok) {
        const cd = await countsRes.json();
        setCountsList(cd.counts || []);
      }
    } catch (e: any) {
      setBanner({ type: "error", text: e.message || "Failed to load counts" });
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const openCount = async (countId: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/restaurant/inventory/counts/${countId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load count");
      setActiveCount(data.count);
      hydrateDrafts(data.count);
    } catch (e: any) {
      setBanner({ type: "error", text: e.message || "Failed to open count" });
    } finally {
      setBusy(false);
    }
  };

  const handleStartOrResume = async () => {
    if (!selectedOutletId) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/restaurant/inventory/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId: selectedOutletId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start count");
      setActiveCount(data.count);
      hydrateDrafts(data.count);
      await loadCounts(selectedOutletId);
    } catch (e: any) {
      setBanner({ type: "error", text: e.message || "Failed to start count" });
    } finally {
      setBusy(false);
    }
  };

  const computeConvertedBase = (row: CountItemRow, input?: DraftInputState): number | null => {
    if (!input || !input.isCounted) return null;
    let total = Number(input.baseQtyStr || 0);
    for (const pack of row.item.purchasePacks) {
      const pCount = Number(input.packs[pack.id] || 0);
      if (pCount > 0) {
        const net = Number(pack.netQuantityPerPack);
        const factor =
          pack.packUnit === row.unitOfMeasure
            ? net
            : convertQuantity(net, pack.packUnit as any, row.unitOfMeasure as any);
        total += pCount * factor;
      }
    }
    return round4(total);
  };

  const handleSaveDraft = async () => {
    if (!activeCount) return;
    setBusy(true);
    setBanner(null);
    try {
      const entries = activeCount.items.map((row) => {
        const inp = draftInputs[row.itemId];
        if (!inp || !inp.isCounted) {
          return { itemId: row.itemId, isCounted: false };
        }
        return {
          itemId: row.itemId,
          isCounted: true,
          baseQty: Number(inp.baseQtyStr || 0),
          packs: Object.entries(inp.packs)
            .filter(([, v]) => Number(v) > 0)
            .map(([packId, v]) => ({ packId, packCount: Number(v) })),
        };
      });

      const res = await fetch(`/api/restaurant/inventory/counts/${activeCount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SAVE_ENTRIES", entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save draft");
      setActiveCount(data.count);
      hydrateDrafts(data.count);
      setBanner({ type: "success", text: "Draft count saved (no stock movements posted)." });
    } catch (e: any) {
      setBanner({ type: "error", text: e.message || "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (
    action: "SUBMIT" | "REFRESH_REVIEW" | "APPROVE",
    successMsg: string
  ) => {
    if (!activeCount) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/restaurant/inventory/counts/${activeCount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Action ${action} failed`);
      setActiveCount(data.count);
      hydrateDrafts(data.count);
      setBanner({ type: "success", text: successMsg });
      await loadCounts(selectedOutletId);
    } catch (e: any) {
      setBanner({ type: "error", text: e.message || "Action failed" });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestRecount = async (itemId: string) => {
    if (!activeCount) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/restaurant/inventory/counts/${activeCount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_RECOUNT",
          items: [{ itemId, reason: "Variance flagged by manager" }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request recount");
      setActiveCount(data.count);
      hydrateDrafts(data.count);
      setBanner({ type: "success", text: "Sent back for recount." });
    } catch (e: any) {
      setBanner({ type: "error", text: e.message || "Failed to request recount" });
    } finally {
      setBusy(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!activeCount) return [];
    return activeCount.items.filter((row) => {
      const matchesSearch =
        !searchQuery.trim() ||
        row.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.item.sku || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDiff =
        !differencesOnly ||
        (row.isCounted && Math.abs(row.varianceQty) > 0.0001);
      return matchesSearch && matchesDiff;
    });
  }, [activeCount, searchQuery, differencesOnly]);

  const isDraftMode =
    activeCount?.status === "DRAFT" || activeCount?.status === "NEEDS_RECOUNT";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Header */}
        <header className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link
                href={`/restaurant/${subdomain}/inventory/stock`}
                className="inline-flex items-center gap-1 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Stock Overview
              </Link>
              <span>/</span>
              <span className="font-medium text-slate-700">Physical Stock Counts</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-600" />
              Physical Stock Counts &amp; Variance Review
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Count in base units or purchase packs, review variance against cutoff balance, and approve signed adjustments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select outlet"
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !selectedOutletId}
              onClick={handleStartOrResume}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              Start / Resume Draft Count
            </button>
          </div>
        </header>

        {banner && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
              banner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        {/* Active Count Workspace */}
        {activeCount && (
          <section className="space-y-4">
            {/* Count Summary Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      {activeCount.countNumber}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                      {activeCount.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {activeCount.outlet.name} • Count Date:{" "}
                    {new Date(activeCount.countDate).toLocaleString()} • Cutoff:{" "}
                    {new Date(activeCount.cutoffAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-xs sm:text-sm font-semibold text-slate-700">
                  Progress: {activeCount.progress.countedItems} / {activeCount.progress.totalItems} counted (
                  {activeCount.progress.remainingItems} left)
                </div>
              </div>

              {activeCount.requiresRefresh && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-950">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      A backdated movement changed expected balances at cutoff. Refresh review before approving.
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      handleAction("REFRESH_REVIEW", "Variance review refreshed against latest cutoff ledger.")
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh Review
                  </button>
                </div>
              )}

              {!isDraftMode && activeCount.skippedItems.length > 0 && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                  <span className="font-semibold">
                    Excluded uncounted items ({activeCount.skippedItems.length}):
                  </span>{" "}
                  {activeCount.skippedItems.map((s) => s.itemName).join(", ")} — no adjustments will be posted for uncounted items.
                </div>
              )}

              {/* Search & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      aria-label="Search count items"
                      placeholder="Search item or SKU..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  {!isDraftMode && (
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 px-2">
                      <input
                        type="checkbox"
                        checked={differencesOnly}
                        onChange={(e) => setDifferencesOnly(e.target.checked)}
                      />
                      Differences only
                    </label>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isDraftMode && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSaveDraft}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Draft
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleAction(
                            "SUBMIT",
                            "Count submitted for variance review (no stock movements posted yet)."
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit for Review
                      </button>
                    </>
                  )}
                  {activeCount.status === "SUBMITTED" && (
                    <button
                      type="button"
                      disabled={busy || activeCount.requiresRefresh}
                      onClick={() =>
                        handleAction(
                          "APPROVE",
                          "Stock count approved and signed variance adjustments posted to StockLedger."
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve &amp; Post Adjustments
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* DRAFT / MOBILE COUNT ENTRY MODE */}
            {isDraftMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredItems.map((row) => {
                  const inp = draftInputs[row.itemId] || {
                    isCounted: false,
                    baseQtyStr: "",
                    packs: {},
                  };
                  const converted = computeConvertedBase(row, inp);
                  const unitLabel = formatUnit(row.unitOfMeasure as any);

                  return (
                    <article
                      key={row.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-slate-900">{row.item.name}</div>
                          <div className="text-xs text-slate-500">
                            Base unit: {unitLabel}
                            {row.recountRequested && (
                              <span className="ml-2 text-amber-700 font-semibold">
                                • Recount: {row.recountReason}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            inp.isCounted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {inp.isCounted ? `Counted: ${converted} ${unitLabel}` : "Not counted"}
                        </span>
                      </div>

                      {/* Purchase Packs */}
                      {row.item.purchasePacks.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {row.item.purchasePacks.map((pack) => (
                            <div key={pack.id}>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                {pack.name} ({Number(pack.netQuantityPerPack)} {pack.packUnit})
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={inp.packs[pack.id] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftInputs((prev) => {
                                    const cur = prev[row.itemId] || { isCounted: false, baseQtyStr: "", packs: {} };
                                    return {
                                      ...prev,
                                      [row.itemId]: {
                                        ...cur,
                                        isCounted: true,
                                        packs: { ...cur.packs, [pack.id]: val },
                                      },
                                    };
                                  });
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Base Unit Entry */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Loose / Base Quantity ({unitLabel})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder={`0 ${unitLabel}`}
                          value={inp.baseQtyStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftInputs((prev) => {
                              const cur = prev[row.itemId] || { isCounted: false, baseQtyStr: "", packs: {} };
                              return {
                                ...prev,
                                [row.itemId]: {
                                  ...cur,
                                  isCounted: true,
                                  baseQtyStr: val,
                                },
                              };
                            });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setDraftInputs((prev) => ({
                              ...prev,
                              [row.itemId]: { isCounted: true, baseQtyStr: "0", packs: {} },
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Mark 0 (Empty)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftInputs((prev) => ({
                              ...prev,
                              [row.itemId]: { isCounted: false, baseQtyStr: "", packs: {} },
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          Clear (Not counted)
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* VARIANCE REVIEW MODE: DESKTOP TABLE + MOBILE CARDS */
              <>
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="variance-table-caption"
                  className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-auto shadow-xs"
                >
                  <table className="w-full text-left text-sm border-collapse">
                    <caption id="variance-table-caption" className="sr-only">
                      Physical Stock Count Variance Review
                    </caption>
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-600">
                      <tr>
                        <th className="py-3 px-4">Item</th>
                        <th className="py-3 px-4">Counted Breakdown</th>
                        <th className="py-3 px-4 text-right">Expected (Cutoff)</th>
                        <th className="py-3 px-4 text-right">Counted</th>
                        <th className="py-3 px-4 text-right">Variance</th>
                        <th className="py-3 px-4 text-right">Later Movements</th>
                        <th className="py-3 px-4 text-right">Action / Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((row) => {
                        const unitLabel = formatUnit(row.unitOfMeasure as any);
                        const packDesc = (row.countedPacksJson || [])
                          .map((p) => `${p.packCount}×${p.packName}`)
                          .join(" + ");
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <th scope="row" className="py-3 px-4 font-semibold text-slate-900">
                              <div>{row.item.name}</div>
                              {!row.isCounted && (
                                <span className="text-[11px] font-normal text-slate-500">
                                  Skipped (Not counted)
                                </span>
                              )}
                            </th>
                            <td className="py-3 px-4 text-xs text-slate-600">
                              {!row.isCounted
                                ? "—"
                                : [
                                    packDesc,
                                    row.countedBaseInput ? `${row.countedBaseInput} ${unitLabel}` : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" + ") || `0 ${unitLabel}`}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">
                              {row.expectedAtCutoff} {unitLabel}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-medium">
                              {row.isCounted ? `${row.countedBaseQty} ${unitLabel}` : "Not counted"}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold">
                              {!row.isCounted ? (
                                <span className="text-slate-400">—</span>
                              ) : row.varianceQty < 0 ? (
                                <span className="text-rose-600">
                                  {row.varianceQty} {unitLabel} (shortage)
                                </span>
                              ) : row.varianceQty > 0 ? (
                                <span className="text-emerald-600">
                                  +{row.varianceQty} {unitLabel}
                                </span>
                              ) : (
                                <span className="text-slate-600">0 {unitLabel}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-xs text-slate-600">
                              {row.laterMovementsQty !== 0
                                ? `${row.laterMovementsQty > 0 ? "+" : ""}${row.laterMovementsQty} ${unitLabel}`
                                : "0"}
                            </td>
                            <td className="py-3 px-4 text-right text-xs">
                              {activeCount.status === "SUBMITTED" && row.isCounted ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleRequestRecount(row.itemId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Recount
                                </button>
                              ) : row.adjustmentLedgerId ? (
                                <span className="font-mono text-[11px] text-emerald-700">
                                  Posted
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Variance Rows */}
                <div className="md:hidden space-y-3">
                  {filteredItems.map((row) => {
                    const unitLabel = formatUnit(row.unitOfMeasure as any);
                    return (
                      <article
                        key={row.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2"
                      >
                        <div className="font-bold text-sm text-slate-900">{row.item.name}</div>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5">
                          <div>
                            <span className="text-slate-500 block">Expected (Cutoff)</span>
                            <span className="font-semibold tabular-nums">
                              {row.expectedAtCutoff} {unitLabel}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Counted</span>
                            <span className="font-semibold tabular-nums">
                              {row.isCounted ? `${row.countedBaseQty} ${unitLabel}` : "Not counted"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Variance</span>
                            <span
                              className={`font-bold tabular-nums ${
                                row.varianceQty < 0
                                  ? "text-rose-600"
                                  : row.varianceQty > 0
                                    ? "text-emerald-600"
                                    : "text-slate-700"
                              }`}
                            >
                              {!row.isCounted
                                ? "Excluded"
                                : `${row.varianceQty > 0 ? "+" : ""}${row.varianceQty} ${unitLabel}`}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Later Movements</span>
                            <span className="font-medium tabular-nums">
                              {row.laterMovementsQty > 0 ? "+" : ""}
                              {row.laterMovementsQty} {unitLabel}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* Recent Counts History */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Recent Stock Counts</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading counts...
            </div>
          ) : countsList.length === 0 ? (
            <p className="text-xs text-slate-500">No physical stock counts recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {countsList.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs sm:text-sm"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {c.countNumber} • {c.outlet?.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.status} • {c.progress.countedItems}/{c.progress.totalItems} counted •{" "}
                      {new Date(c.countDate).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCount(c.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 self-start sm:self-auto"
                  >
                    Open Count
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
