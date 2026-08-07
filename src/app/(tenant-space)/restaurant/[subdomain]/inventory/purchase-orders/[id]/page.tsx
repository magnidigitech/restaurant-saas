"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface POItem {
  id: string;
  itemId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  totalCost: number;
  item: { id: string; name: string; unitOfMeasure: string };
}

interface PODetail {
  id: string;
  poNumber: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
  expectedDeliveryDate?: string;
  notes?: string;
  receivedAt?: string;
  createdAt: string;
  vendor: { id: string; name: string; code?: string; email?: string; phone?: string };
  outlet: { id: string; name: string };
  items: POItem[];
}

interface ReceiveItemRow {
  itemId: string;
  itemName: string;
  unitOfMeasure: string;
  orderedQuantity: number;
  previouslyReceived: number;
  receivingQuantity: string;
  unitCost: string;
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const poId = params?.id as string;

  const [po, setPO] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Interactive Receiving Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveRows, setReceiveRows] = useState<ReceiveItemRow[]>([]);
  const [receiveError, setReceiveError] = useState("");

  // Custom Confirm Dialog Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: "emerald" | "red" | "indigo";
    onConfirm: (() => void) | null;
  }>({
    show: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "emerald",
    onConfirm: null,
  });

  const fetchPODetail = async () => {
    try {
      const res = await fetch(`/api/restaurant/inventory/purchase-orders/${poId}`);
      const data = await res.json();
      if (res.ok && data.purchaseOrder) {
        setPO(data.purchaseOrder);
      } else {
        setError(data.error || "Purchase order not found");
      }
    } catch {
      setError("Failed to load purchase order detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (poId) fetchPODetail();
  }, [poId]);

  const handleUpdateStatus = async (status: "SENT" | "CANCELLED") => {
    const isCancel = status === "CANCELLED";

    setConfirmDialog({
      show: true,
      title: isCancel ? "Cancel Purchase Order?" : "Send PO to Vendor?",
      message: isCancel
        ? `Are you sure you want to cancel purchase order "${po?.poNumber}"?`
        : `Mark purchase order "${po?.poNumber}" as SENT to vendor "${po?.vendor.name}"?`,
      confirmText: isCancel ? "Yes, Cancel PO" : "Yes, Mark as Sent",
      variant: isCancel ? "red" : "indigo",
      onConfirm: async () => {
        setUpdating(true); setError(""); setSuccessMsg("");
        try {
          const res = await fetch(`/api/restaurant/inventory/purchase-orders/${poId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update_status", status }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setSuccessMsg(`Purchase order status updated to ${status}`);
          fetchPODetail();
        } catch (e: any) {
          setError(e.message || "Failed to update purchase order status");
        } finally {
          setUpdating(false);
        }
      },
    });
  };

  const openReceiveGoodsModal = () => {
    if (!po) return;
    setReceiveError("");
    setReceiveRows(
      po.items.map((i) => {
        const prev = Number(i.receivedQuantity || 0);
        const rem = Math.max(0, Number(i.orderedQuantity) - prev);
        return {
          itemId: i.itemId,
          itemName: i.item?.name || "Unknown Item",
          unitOfMeasure: i.item?.unitOfMeasure || "unit",
          orderedQuantity: Number(i.orderedQuantity),
          previouslyReceived: prev,
          receivingQuantity: rem.toString(),
          unitCost: (i.unitCost ?? 0).toString(),
        };
      })
    );
    setShowReceiveModal(true);
  };

  const handleReceiveRowChange = (itemId: string, field: string, value: string) => {
    setReceiveRows((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, [field]: value } : r))
    );
  };

  const submitReceiveStock = async (targetStatus: "RECEIVED" | "PARTIALLY_RECEIVED") => {
    setUpdating(true); setReceiveError(""); setError(""); setSuccessMsg("");
    try {
      const itemsPayload = receiveRows.map((r) => ({
        itemId: r.itemId,
        receivedQuantity: Math.max(0, Number(r.receivingQuantity) || 0),
        unitCost: Math.max(0, Number(r.unitCost) || 0),
      }));

      const res = await fetch(`/api/restaurant/inventory/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "receive",
          receiveData: {
            status: targetStatus,
            items: itemsPayload,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowReceiveModal(false);
      setSuccessMsg(`✓ Inventory stock updated successfully! Status set to [${targetStatus}].`);
      fetchPODetail();
    } catch (e: any) {
      setReceiveError(e.message || "Failed to receive stock");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading purchase order details...
      </main>
    );
  }

  if (error || !po) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-red-600 font-semibold">
        {error || "Purchase order not found"}
      </main>
    );
  }

  const receivingGrandTotal = receiveRows.reduce((sum, r) => {
    return sum + (Number(r.receivingQuantity) || 0) * (Number(r.unitCost) || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navbar Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm">
            ← Back to Directory
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {po.poNumber}
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  po.status === "RECEIVED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : po.status === "PARTIALLY_RECEIVED"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : po.status === "SENT"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : po.status === "DRAFT"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                [{po.status}]
              </span>
            </h1>
            <p className="text-xs text-gray-500">Created: {new Date(po.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Workflow Action Buttons */}
        <div className="flex items-center gap-3">
          {po.status === "DRAFT" && (
            <button
              onClick={() => handleUpdateStatus("SENT")}
              disabled={updating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              Send to Vendor
            </button>
          )}

          {["DRAFT", "SENT", "PARTIALLY_RECEIVED"].includes(po.status) && (
            <button
              onClick={openReceiveGoodsModal}
              disabled={updating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              📦 Receive / Inspect Goods Stock
            </button>
          )}

          {["DRAFT", "SENT"].includes(po.status) && (
            <button
              onClick={() => handleUpdateStatus("CANCELLED")}
              disabled={updating}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel PO
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl font-semibold">
            {successMsg}
          </div>
        )}

        {/* Overview Banner */}
        <div className="bg-white border-t-4 border-t-indigo-600 border-x border-b border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Supplier Vendor</span>
            <h2 className="text-xl font-bold text-gray-900">{po.vendor.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Phone: {po.vendor.phone || "N/A"} • Email: {po.vendor.email || "N/A"}
            </p>
          </div>

          <div className="flex gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Destination Outlet</span>
              <span className="text-sm font-bold text-gray-900">{po.outlet.name}</span>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">PO Grand Total</span>
              <span className="text-lg font-extrabold text-indigo-700 font-mono">₹{Number(po.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Ordered Line Items ({po.items.length})</h3>
            {po.receivedAt && (
              <span className="text-xs text-gray-500 font-medium">Last Received: {new Date(po.receivedAt).toLocaleString()}</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3 px-4">Item Name & UOM</th>
                  <th className="py-3 px-4 text-center">Ordered Qty</th>
                  <th className="py-3 px-4 text-center">Received Qty</th>
                  <th className="py-3 px-4 text-right">Unit Cost (₹)</th>
                  <th className="py-3 px-4 text-right">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {po.items.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {row.item?.name} <span className="text-[11px] text-gray-500 font-normal">({row.item?.unitOfMeasure})</span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-gray-700">{row.orderedQuantity}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                      {row.receivedQuantity || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-700">₹{Number(row.unitCost).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">₹{Number(row.totalCost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Interactive Receive / Inspect Goods Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-3xl space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Receive Goods & Adjust Stock Quantities</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verify actual quantities and unit costs received for outlet: <strong className="text-gray-900">{po.outlet.name}</strong>
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                GRN Entry
              </span>
            </div>

            {receiveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg font-semibold">
                {receiveError}
              </div>
            )}

            {/* Line Items Receiving Table */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="py-2.5 px-3">Item Name & UOM</th>
                    <th className="py-2.5 px-3 text-center w-24">Ordered</th>
                    <th className="py-2.5 px-3 text-center w-24">Prev. Recv</th>
                    <th className="py-2.5 px-3 text-right w-32">Receiving Now</th>
                    <th className="py-2.5 px-3 text-right w-32">Unit Cost (₹)</th>
                    <th className="py-2.5 px-3 text-right w-32">Subtotal (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {receiveRows.map((row) => {
                    const rowTotal = (Number(row.receivingQuantity) || 0) * (Number(row.unitCost) || 0);
                    return (
                      <tr key={row.itemId} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          {row.itemName} <span className="text-[11px] text-gray-500 font-normal">({row.unitOfMeasure})</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-gray-700">
                          {row.orderedQuantity}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-gray-500">
                          {row.previouslyReceived}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.receivingQuantity}
                            onChange={(e) => handleReceiveRowChange(row.itemId, "receivingQuantity", e.target.value)}
                            className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-emerald-800 focus:outline-none focus:border-emerald-600"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitCost}
                            onChange={(e) => handleReceiveRowChange(row.itemId, "unitCost", e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-mono text-gray-800 focus:outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                          ₹{rowTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Receiving Summary Footer */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">Total Receiving Batch Value:</span>
              <span className="text-lg font-extrabold text-emerald-700 font-mono">₹{receivingGrandTotal.toFixed(2)}</span>
            </div>

            {/* Modal Controls */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => submitReceiveStock("PARTIALLY_RECEIVED")}
                disabled={updating}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                {updating ? "Saving..." : "Mark as PARTIALLY RECEIVED"}
              </button>
              <button
                onClick={() => submitReceiveStock("RECEIVED")}
                disabled={updating}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                {updating ? "Completing..." : "Complete & Mark RECEIVED"}
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
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  confirmDialog.variant === "red"
                    ? "bg-red-600 hover:bg-red-500"
                    : confirmDialog.variant === "indigo"
                    ? "bg-indigo-600 hover:bg-indigo-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
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
