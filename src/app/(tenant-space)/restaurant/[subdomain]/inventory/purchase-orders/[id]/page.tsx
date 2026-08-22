"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

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

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; id: string }>;
}) {
  const router = useRouter();
  const { subdomain, id: poId } = use(params);
  const { isDark } = useTheme();

  const formatCurrency = (val: number) => `$${Number(val || 0).toFixed(2)}`;

  const [po, setPO] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Interactive Receiving Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveRows, setReceiveRows] = useState<ReceiveItemRow[]>([]);
  const [receiveError, setReceiveError] = useState("");

  // Custom Apple Confirm Dialog Modal State
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

  const handleShareWhatsApp = () => {
    if (!po) return;

    const itemsText = po.items
      .map(
        (pi, index) =>
          `*${index + 1}. ${pi.item?.name}* (${pi.item?.unitOfMeasure || "Units"})\n   Qty: *${pi.orderedQuantity}* × $${Number(pi.unitCost).toFixed(2)} = *$${Number(pi.totalCost).toFixed(2)}*`
      )
      .join("\n\n");

    const messageParts = [
      `*PURCHASE ORDER: ${po.poNumber}*`,
      `────────────────────────`,
      `*Vendor:* ${po.vendor.name}`,
      `*Delivery Branch:* ${po.outlet.name}`,
      `*Order Date:* ${new Date(po.createdAt).toLocaleDateString()}`,
      po.expectedDeliveryDate ? `*Expected Delivery:* ${new Date(po.expectedDeliveryDate).toLocaleDateString()}` : null,
      `────────────────────────`,
      `*ORDERED ITEMS:*`,
      itemsText,
      `────────────────────────`,
      `*GRAND TOTAL: $${Number(po.grandTotal).toFixed(2)}*`,
      po.notes ? `\n*Notes:* ${po.notes}` : null,
      `\n_Please confirm order receipt & delivery schedule. Thank you._`,
    ];

    const message = messageParts.filter(Boolean).join("\n\n");
    const cleanPhone = po.vendor.phone ? po.vendor.phone.replace(/[^0-9]/g, "") : "";
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(waUrl, "_blank");
  };

  const handlePrintPDF = () => {
    if (!po) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const itemsRows = po.items
      .map(
        (pi, idx) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #64748B;">${idx + 1}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #1E293B;">
            ${pi.item?.name} <span style="font-size: 11px; font-weight: 400; color: #64748B;">(${pi.item?.unitOfMeasure})</span>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">
            ${pi.orderedQuantity}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; color: #475569;">
            $${Number(pi.unitCost).toFixed(2)}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0071E3;">
            $${Number(pi.totalCost).toFixed(2)}
          </td>
        </tr>
      `
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${po.poNumber}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 16mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1E293B;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
            background: #FFF;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0071E3;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .title-section h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            color: #0071E3;
            letter-spacing: -0.5px;
          }
          .title-section p {
            margin: 3px 0 0;
            color: #64748B;
            font-size: 12px;
          }
          .meta-box {
            text-align: right;
          }
          .po-pill {
            display: inline-block;
            background: #EFF6FF;
            color: #0071E3;
            border: 1px solid #BFDBFE;
            padding: 4px 10px;
            border-radius: 6px;
            font-family: monospace;
            font-weight: 700;
            font-size: 14px;
          }
          .grid-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }
          .card {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 14px;
          }
          .card h3 {
            margin: 0 0 8px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748B;
          }
          .card p {
            margin: 2px 0;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          th {
            background: #F1F5F9;
            color: #475569;
            text-transform: uppercase;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
            padding: 10px 12px;
            border-top: 1px solid #CBD5E1;
            border-bottom: 1px solid #CBD5E1;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          .totals-table {
            width: 280px;
          }
          .totals-table td {
            padding: 6px 10px;
          }
          .grand-total-row td {
            border-top: 2px solid #0071E3;
            font-size: 15px;
            font-weight: 800;
            color: #0071E3;
            padding-top: 10px;
          }
          .footer-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px dashed #CBD5E1;
            display: flex;
            justify-content: space-between;
          }
          .sig-box {
            width: 200px;
            border-top: 1px solid #94A3B8;
            text-align: center;
            padding-top: 6px;
            font-size: 11px;
            color: #64748B;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-section">
            <h1>PURCHASE ORDER</h1>
            <p>Official Material Requisition & Supply Order</p>
          </div>
          <div class="meta-box">
            <div class="po-pill">${po.poNumber}</div>
            <p style="margin: 6px 0 0; color: #64748B; font-size: 11px;">Status: <strong>${po.status}</strong></p>
            <p style="margin: 2px 0 0; color: #64748B; font-size: 11px;">Date: ${new Date(po.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div class="grid-info">
          <div class="card">
            <h3>Supplier Vendor</h3>
            <p style="font-weight: 700; font-size: 14px; color: #0F172A;">${po.vendor.name}</p>
            ${po.vendor.code ? `<p style="color: #64748B;">Code: ${po.vendor.code}</p>` : ""}
            ${po.vendor.phone ? `<p>Phone: ${po.vendor.phone}</p>` : ""}
            ${po.vendor.email ? `<p>Email: ${po.vendor.email}</p>` : ""}
          </div>

          <div class="card">
            <h3>Delivery Branch / Outlet</h3>
            <p style="font-weight: 700; font-size: 14px; color: #0F172A;">${po.outlet.name}</p>
            ${po.expectedDeliveryDate ? `<p style="color: #0071E3; font-weight: 600;">Expected Date: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}</p>` : ""}
            ${po.notes ? `<p style="color: #64748B; margin-top: 6px;"><em>Notes: ${po.notes}</em></p>` : ""}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>Item Description</th>
              <th style="width: 100px; text-align: right;">Ordered Qty</th>
              <th style="width: 100px; text-align: right;">Unit Price</th>
              <th style="width: 110px; text-align: right;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="totals-wrap">
          <table class="totals-table">
            <tr>
              <td style="color: #64748B;">Subtotal:</td>
              <td style="text-align: right; font-family: monospace; font-weight: 600;">$${Number(po.totalAmount).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #64748B;">Tax Amount:</td>
              <td style="text-align: right; font-family: monospace; font-weight: 600;">$${Number(po.taxAmount || 0).toFixed(2)}</td>
            </tr>
            <tr class="grand-total-row">
              <td>Grand Total:</td>
              <td style="text-align: right; font-family: monospace;">$${Number(po.grandTotal).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="footer-section">
          <div class="sig-box">
            Authorized Signature
          </div>
          <div class="sig-box">
            Vendor Acknowledgment
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleUpdateStatus = async (status: "SENT" | "CANCELLED") => {
    const isCancel = status === "CANCELLED";

    setConfirmDialog({
      show: true,
      title: isCancel ? "Cancel Purchase Order?" : "Send PO to Vendor?",
      message: isCancel
        ? `Are you sure you want to cancel purchase order "${po?.poNumber}"?`
        : `Mark purchase order "${po?.poNumber}" as SENT to vendor "${po?.vendor.name}"?`,
      confirmText: isCancel ? "Cancel PO" : "Mark as Sent",
      variant: isCancel ? "red" : "indigo",
      onConfirm: async () => {
        setUpdating(true);
        setError("");
        setSuccessMsg("");
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

  const openReceiveModal = () => {
    if (!po) return;
    setReceiveRows(
      po.items.map((pi) => {
        const remaining = Math.max(0, pi.orderedQuantity - (pi.receivedQuantity || 0));
        return {
          itemId: pi.itemId,
          itemName: pi.item?.name || "Item",
          unitOfMeasure: pi.item?.unitOfMeasure || "PIECES",
          orderedQuantity: pi.orderedQuantity,
          previouslyReceived: pi.receivedQuantity || 0,
          receivingQuantity: remaining.toString(),
          unitCost: pi.unitCost.toString(),
        };
      })
    );
    setReceiveError("");
    setShowReceiveModal(true);
  };

  const handleReceiveRowChange = (itemId: string, val: string) => {
    setReceiveRows((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, receivingQuantity: val } : r))
    );
  };

  const handleReceiveUnitCostChange = (itemId: string, val: string) => {
    setReceiveRows((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, unitCost: val } : r))
    );
  };

  const handleSubmitReceive = async () => {
    setReceiveError("");
    const receivingItems = receiveRows
      .filter((r) => parseFloat(r.receivingQuantity) > 0)
      .map((r) => ({
        itemId: r.itemId,
        receivedQuantity: parseFloat(r.receivingQuantity),
        unitCost: parseFloat(r.unitCost || "0"),
      }));

    if (receivingItems.length === 0) {
      setReceiveError("Please enter a positive receiving quantity for at least one item");
      return;
    }

    setUpdating(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/restaurant/inventory/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "receive_items",
          items: receivingItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowReceiveModal(false);
      const targetStatus = data.purchaseOrder?.status || "RECEIVED";
      setSuccessMsg(`Inventory stock updated successfully! Status set to [${targetStatus}].`);
      fetchPODetail();
    } catch (e: any) {
      setReceiveError(e.message || "Failed to process stock receipt");
    } finally {
      setUpdating(false);
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
        <p className="text-xs font-medium">Loading Purchase Order...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="PO Inspection" />
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/purchase-orders`)}
            className="text-xs text-[#0071E3] hover:underline cursor-pointer"
          >
            ← Back to Purchase Orders
          </button>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error || "Purchase order not found"}
          </div>
        </main>
      </div>
    );
  }

  const isEditable = po.status === "DRAFT";
  const isSendable = po.status === "DRAFT";
  const isReceivable = ["SENT", "PARTIALLY_RECEIVED"].includes(po.status);
  const isCancellable = ["DRAFT", "SENT"].includes(po.status);

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="PO Inspection" />

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
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/purchase-orders`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← All Orders
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {po.poNumber}
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
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
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {po.vendor.name}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Destination: <span className="font-semibold">{po.outlet.name}</span> • Created {new Date(po.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Share on WhatsApp */}
            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
              title="Share Purchase Order on WhatsApp"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span>Share on WhatsApp</span>
            </button>

            {/* Create PO PDF */}
            <button
              onClick={handlePrintPDF}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                isDark
                  ? "bg-white/[0.06] text-white border-white/[0.1] hover:bg-white/[0.1]"
                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
              }`}
              title="Generate and Download / Print PO PDF"
            >
              <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Create PO PDF</span>
            </button>

            {isSendable && (
              <button
                onClick={() => handleUpdateStatus("SENT")}
                disabled={updating}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                Mark as Sent →
              </button>
            )}

            {isReceivable && (
              <button
                onClick={openReceiveModal}
                disabled={updating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                + Receive Delivery Stock
              </button>
            )}

            {isCancellable && (
              <button
                onClick={() => handleUpdateStatus("CANCELLED")}
                disabled={updating}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                    : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                }`}
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl">
            {successMsg}
          </div>
        )}

        {/* PO Line Items Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex justify-between items-center">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Ordered Line Items ({po.items.length})
            </h2>
            <span className={`text-xs font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Grand Total: ${Number(po.grandTotal).toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                  isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                }`}>
                  <th className="pb-3 px-3">Item Description</th>
                  <th className="pb-3 px-3 text-right">Ordered Qty</th>
                  <th className="pb-3 px-3 text-right">Received Qty</th>
                  <th className="pb-3 px-3 text-right">Unit Price</th>
                  <th className="pb-3 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {po.items.map((pi) => (
                  <tr key={pi.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                    <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {pi.item?.name} <span className="text-[10px] opacity-75 font-normal">({pi.item?.unitOfMeasure})</span>
                    </td>
                    <td className={`py-3.5 px-3 text-right font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {pi.orderedQuantity}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono">
                      <span className={`font-bold ${
                        pi.receivedQuantity >= pi.orderedQuantity
                          ? "text-emerald-500"
                          : pi.receivedQuantity > 0
                          ? "text-amber-500"
                          : isDark ? "text-[#8F95A3]" : "text-slate-400"
                      }`}>
                        {pi.receivedQuantity || 0}
                      </span>
                    </td>
                    <td className={`py-3.5 px-3 text-right font-mono ${isDark ? "text-[#BAC0CD]" : "text-slate-600"}`}>
                      ${Number(pi.unitCost).toFixed(2)}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      ${Number(pi.totalCost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Receive Stock Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Receive Purchase Order Stock</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Verify delivered quantities and automatically increment branch stock ledgers.
                </p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {receiveError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
                {receiveError}
              </div>
            )}

            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-right">Ordered</th>
                    <th className="py-2.5 px-3 text-right">Prev. Received</th>
                    <th className="py-2.5 px-3 text-right">Receive Qty</th>
                    <th className="py-2.5 px-3 text-right">Actual Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {receiveRows.map((r) => {
                    const recQty = parseFloat(r.receivingQuantity || "0") || 0;
                    const unitPrice = parseFloat(r.unitCost || "0") || 0;
                    const lineTotal = recQty * unitPrice;

                    return (
                      <tr key={r.itemId}>
                        <td className="py-2.5 px-3 font-semibold">
                          {r.itemName} <span className="text-[10px] opacity-75 font-normal">({r.unitOfMeasure})</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{r.orderedQuantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">{r.previouslyReceived}</td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={r.receivingQuantity}
                            onChange={(e) => handleReceiveRowChange(r.itemId, e.target.value)}
                            className={`w-20 px-2 py-1 text-xs font-mono rounded-lg border text-right focus:outline-none focus:border-[#0071E3] ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={r.unitCost}
                            onChange={(e) => handleReceiveUnitCostChange(r.itemId, e.target.value)}
                            className={`w-24 px-2 py-1 text-xs font-mono rounded-lg border text-right focus:outline-none focus:border-emerald-500 font-semibold ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08] text-emerald-400" : "bg-white border-slate-200 text-emerald-700"
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Receiving Valuation Summary */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
            }`}>
              <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                💡 Updating unit price re-calculates the Purchase Order value and updates latest item cost.
              </span>
              <div className="text-right flex-shrink-0">
                <span className={`text-[10px] uppercase font-bold mr-2 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Total Receiving Value:
                </span>
                <span className="font-mono font-bold text-sm text-emerald-500">
                  {formatCurrency(
                    receiveRows.reduce((acc, r) => {
                      const recQty = parseFloat(r.receivingQuantity || "0") || 0;
                      const unitPrice = parseFloat(r.unitCost || "0") || 0;
                      return acc + recQty * unitPrice;
                    }, 0)
                  )}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-medium ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReceive}
                disabled={updating}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {updating ? "Processing..." : "Confirm & Update Stock"}
              </button>
            </div>
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
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 ${
                confirmDialog.variant === "red"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                  : "bg-[#0071E3]/10 border-[#0071E3]/20 text-[#0071E3]"
              }`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                className={`px-5 py-2.5 text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer ${
                  confirmDialog.variant === "red"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-[#0071E3] hover:bg-[#0077ED]"
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
