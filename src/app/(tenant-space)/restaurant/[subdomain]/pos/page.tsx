"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface MenuItem {
  id: string;
  name: string;
  type: "DISH";
  description?: string;
  yieldQuantity: number;
  yieldUnit: string;
  sellingPrice: number;
  costPerUnit: number;
  grossMarginPercent: number;
}

interface Outlet {
  id: string;
  name: string;
  currency: string;
}

interface CartItem {
  recipeId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPerUnit: number;
}

interface DepletedIngredient {
  inventoryItemId: string;
  itemName: string;
  deductedQuantity: number;
  unitOfMeasure: string;
  wastageAdjusted: boolean;
}

interface OrderReceipt {
  orderNumber: string;
  outletName: string;
  totalAmount: number;
  taxAmount: number;
  finalAmount: number;
  paymentMethod: string;
  tableNumber?: string;
  items: CartItem[];
  deductions: DepletedIngredient[];
}

export default function PosTerminalPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [tableNumber, setTableNumber] = useState("T-01");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // Depletion Confirmation Receipt Modal
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  const fetchData = async () => {
    try {
      const [resMenu, resOutlets] = await Promise.all([
        fetch("/api/restaurant/pos/menu"),
        fetch("/api/restaurant/outlets"),
      ]);

      const menuData = resMenu.ok ? (await resMenu.json()).menuItems || [] : [];
      const outletsData = resOutlets.ok ? (await resOutlets.json()).outlets || [] : [];

      setMenuItems(menuData);
      setOutlets(outletsData);
      if (outletsData.length > 0 && !selectedOutletId) {
        setSelectedOutletId(outletsData[0].id);
      }
    } catch {
      setError("Failed to load POS terminal data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.recipeId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.recipeId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          recipeId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: Number(item.sellingPrice),
          costPerUnit: Number(item.costPerUnit),
        },
      ];
    });
  };

  const handleUpdateQty = (recipeId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.recipeId === recipeId) {
            const nextQty = c.quantity + delta;
            return nextQty > 0 ? { ...c, quantity: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const subtotal = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalCost = cart.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0);
  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;
  const estimatedProfit = subtotal - totalCost;

  const handlePlaceOrder = async () => {
    if (!selectedOutletId) {
      setError("Please select a branch outlet");
      return;
    }
    if (cart.length === 0) {
      setError("Cart is empty. Please select menu dishes.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const payload = {
        outletId: selectedOutletId,
        tableNumber: orderType === "DINE_IN" ? tableNumber : undefined,
        orderType,
        paymentMethod,
        items: cart.map((c) => ({
          recipeId: c.recipeId,
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
      };

      const res = await fetch("/api/restaurant/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process POS order");

      const outletObj = outlets.find((o) => o.id === selectedOutletId);

      // Show receipt with exact deducted ingredients
      setReceipt({
        orderNumber: data.order.orderNumber,
        outletName: outletObj?.name || "Branch Outlet",
        totalAmount: subtotal,
        taxAmount: tax,
        finalAmount: grandTotal,
        paymentMethod,
        tableNumber: orderType === "DINE_IN" ? tableNumber : undefined,
        items: [...cart],
        deductions: data.depletion?.deductions || [],
      });

      setCart([]);
    } catch (e: any) {
      setError(e.message || "Failed to complete order");
    } finally {
      setProcessing(false);
    }
  };

  const filteredMenuItems = menuItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading POS Terminal...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="pos" moduleName="Point of Sale (POS)" activeSection="POS">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="POS" />

        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Terminal Header Bar */}
          <div
            className={`p-4 sm:p-5 rounded-3xl border transition flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${
              isDark
                ? "bg-[#121622]/60 border-white/[0.06]"
                : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
            }`}
          >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Point of Sale Terminal
              </h1>
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-white/[0.08]" />

            {/* Outlet Selector */}
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-xl border font-semibold cursor-pointer ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-100 border-slate-200 text-slate-900"
              }`}
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.currency})
                </option>
              ))}
            </select>

            {/* Dining Mode Selector */}
            <div className="flex items-center bg-black/[0.04] dark:bg-white/[0.04] p-1 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
              {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setOrderType(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    orderType === m
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {m.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {orderType === "DINE_IN" && (
              <input
                placeholder="Table #"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className={`w-20 px-2.5 py-1 text-xs font-mono font-bold rounded-xl border ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/inventory/stock`)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] text-[#8F95A3] hover:text-white border-white/[0.08]"
                  : "bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200"
              }`}
            >
              Check Stock Ledger →
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* 2-Column POS Layout: Menu Grid (Left) & Cart / Bill Summary (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Menu Items */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex justify-between items-center gap-3">
              <input
                placeholder="Search menu dishes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`flex-1 px-4 py-2 text-xs rounded-xl border transition ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              />
              <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {filteredMenuItems.length} dishes
              </span>
            </div>

            {filteredMenuItems.length === 0 ? (
              <div
                className={`p-12 text-center rounded-3xl border text-xs space-y-2 ${
                  isDark ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-500 shadow-xs"
                }`}
              >
                <p className="font-semibold text-sm">No menu dishes found</p>
                <p className="opacity-75">Add recipes under &quot;Recipe Management&quot; to populate your POS terminal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {filteredMenuItems.map((item) => {
                  const inCart = cart.find((c) => c.recipeId === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleAddToCart(item)}
                      className={`p-4 rounded-3xl border transition flex flex-col justify-between space-y-3 cursor-pointer select-none active:scale-[0.98] ${
                        inCart
                          ? isDark ? "bg-[#0071E3]/15 border-[#0071E3]/40 shadow-sm" : "bg-blue-50/70 border-blue-300 shadow-sm"
                          : isDark
                          ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.14] hover:bg-[#121622]"
                          : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-md"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className={`text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                            {item.name}
                          </h3>
                          {inCart && (
                            <span className="w-5 h-5 rounded-full bg-[#0071E3] text-white text-[10px] font-bold flex items-center justify-center">
                              {inCart.quantity}
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className={`text-[10px] line-clamp-1 mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between items-end pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                        <span className={`text-base font-extrabold font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${Number(item.sellingPrice).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Cost: ${Number(item.costPerUnit).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Order Cart & Depletion Trigger */}
          <div className="lg:col-span-4">
            <div
              className={`p-6 rounded-3xl border transition space-y-4 sticky top-6 ${
                isDark ? "bg-[#121622]/80 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-md"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Current Order Cart
                  </h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {cart.reduce((s, i) => s + i.quantity, 0)} items in ticket
                  </p>
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-xs text-rose-500 hover:underline cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              {cart.length === 0 ? (
                <div className={`p-8 text-center text-xs space-y-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  <p className="font-semibold">Cart is empty</p>
                  <p className="opacity-75">Click on dishes from the menu to build the order.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.recipeId}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                        isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                          {item.name}
                        </h4>
                        <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          ${item.unitPrice.toFixed(2)} ea
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-black/[0.05] dark:bg-white/[0.05] rounded-xl border border-black/[0.05] dark:border-white/[0.05]">
                          <button
                            onClick={() => handleUpdateQty(item.recipeId, -1)}
                            className="px-2 py-0.5 text-xs font-bold hover:text-rose-500 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-2 text-xs font-mono font-bold">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQty(item.recipeId, 1)}
                            className="px-2 py-0.5 text-xs font-bold hover:text-[#0071E3] cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <span className={`w-14 text-right text-xs font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-1.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <label className={`block text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["CASH", "CARD", "UPI / QR"] as const).map((pm) => (
                    <button
                      key={pm}
                      onClick={() => setPaymentMethod(pm)}
                      className={`py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                        paymentMethod === pm
                          ? "bg-[#0071E3] text-white border-[#0071E3]"
                          : isDark
                          ? "bg-[#0A0C12] border-white/[0.08] text-[#8F95A3] hover:text-white"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bill Totals */}
              <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex justify-between">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Subtotal:</span>
                  <span className="font-mono font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Tax (5%):</span>
                  <span className="font-mono font-semibold">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Est. Recipe Cost:</span>
                  <span className="font-mono text-slate-400">${totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-500 font-bold">
                  <span>Est. Gross Profit:</span>
                  <span className="font-mono">+${estimatedProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-extrabold pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <span className={isDark ? "text-white" : "text-slate-900"}>Grand Total:</span>
                  <span className="font-mono text-lg text-[#0071E3]">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={cart.length === 0 || processing}
                className="w-full py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-bold rounded-2xl transition shadow-md shadow-[#0071E3]/20 cursor-pointer disabled:opacity-50"
              >
                {processing ? "Deducting Stock & Completing..." : "Place Order & Auto-Deduct Stock →"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Stock Depletion Confirmation Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Order Placed & Stock Deducted</h2>
                  <p className={`text-xs font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {receipt.orderNumber} • {receipt.outletName}
                  </p>
                </div>
              </div>

              <button onClick={() => setReceipt(null)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {/* Deducted Raw Ingredients Ledger Breakdown */}
            <div className="space-y-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                Auto-Deducted Raw Inventory Ingredients ({receipt.deductions.length})
              </span>

              {receipt.deductions.length === 0 ? (
                <div className={`p-4 rounded-xl border text-xs ${isDark ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200"}`}>
                  No raw inventory ingredients configured on these dish recipes.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {receipt.deductions.map((ing, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                        isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="font-semibold">{ing.itemName}</span>
                        {ing.wastageAdjusted && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400">
                            trim adjusted
                          </span>
                        )}
                      </div>

                      <span className="font-mono font-bold text-rose-500">
                        -{ing.deductedQuantity} {ing.unitOfMeasure}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receipt Summary */}
            <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
              isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex justify-between">
                <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Payment Status:</span>
                <span className="font-bold text-emerald-500">PAID via {receipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Grand Total:</span>
                <span className="font-mono font-bold">${receipt.finalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                onClick={() => {
                  setReceipt(null);
                  router.push(`/restaurant/${subdomain}/inventory/stock`);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                    : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                }`}
              >
                View Live Stock Ledger →
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Next POS Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
