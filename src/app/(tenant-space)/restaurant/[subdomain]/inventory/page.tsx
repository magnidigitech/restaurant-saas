"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface DashboardStats {
  totalItems: number;
  lowStockCount: number;
  wastageThisMonth: number;
  totalCategories: number;
  totalVendors: number;
}

export default function InventoryDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";

  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockCount: 0,
    wastageThisMonth: 0,
    totalCategories: 0,
    totalVendors: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [resItems, resAlerts, resWastage, resCategories, resVendors] = await Promise.all([
        fetch("/api/restaurant/inventory/items"),
        fetch("/api/restaurant/inventory/alerts"),
        fetch("/api/restaurant/inventory/wastage"),
        fetch("/api/restaurant/inventory/categories"),
        fetch("/api/restaurant/inventory/vendors"),
      ]);

      const items = resItems.ok ? (await resItems.json()).items || [] : [];
      const alerts = resAlerts.ok ? (await resAlerts.json()).alerts || [] : [];
      const wastageLogs = resWastage.ok ? (await resWastage.json()).wastageLogs || [] : [];
      const categories = resCategories.ok ? (await resCategories.json()).categories || [] : [];
      const vendors = resVendors.ok ? (await resVendors.json()).vendors || [] : [];

      const thisMonth = new Date();
      thisMonth.setDate(1);
      const wastageThisMonth = wastageLogs.filter((w: any) => new Date(w.occurredAt) >= thisMonth).length;

      setStats({
        totalItems: items.length,
        lowStockCount: alerts.length,
        wastageThisMonth,
        totalCategories: categories.length,
        totalVendors: vendors.length,
      });
    } catch {
      // stats fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const navCards = [
    { label: "Item Master", desc: "Manage all inventory items and SKUs", path: "inventory/items" },
    { label: "Purchase Orders", desc: "Create POs, track deliveries, and receive inventory stock", path: "inventory/purchase-orders" },
    { label: "Vendor Management", desc: "Manage suppliers, contacts, and payment terms", path: "inventory/vendors" },
    { label: "Categories", desc: "Organize items into hierarchical categories", path: "inventory/categories" },
    { label: "Stock Management", desc: "View real-time stock levels per outlet", path: "inventory/stock" },
    { label: "Low-Stock Alerts", desc: "Items that have fallen below reorder point", path: "inventory/alerts" },
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading Inventory Module...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm">
            ← Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Inventory Dashboard</h1>
            <p className="text-xs text-gray-500">Real-time stock tracking, vendors, and wastage management</p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/restaurant/${subdomain}/inventory/items`)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
        >
          + Add Item
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Items</span>
            <p className="text-3xl font-extrabold text-gray-900 font-mono">{stats.totalItems}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Vendors</span>
            <p className="text-3xl font-extrabold text-indigo-600 font-mono">{stats.totalVendors}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Categories</span>
            <p className="text-3xl font-extrabold text-gray-900 font-mono">{stats.totalCategories}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Low Stock</span>
            <p className={`text-3xl font-extrabold font-mono ${stats.lowStockCount > 0 ? "text-amber-600" : "text-gray-900"}`}>
              {stats.lowStockCount}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Wastage Logs</span>
            <p className="text-3xl font-extrabold text-gray-900 font-mono">{stats.wastageThisMonth}</p>
          </div>
        </div>

        {/* Low Stock Alert Banner */}
        {stats.lowStockCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">[ALERT]</span>
              <p className="text-sm font-semibold text-amber-900">
                {stats.lowStockCount} item{stats.lowStockCount > 1 ? "s" : ""} require reordering.
              </p>
            </div>
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/inventory/alerts`)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              View Alerts
            </button>
          </div>
        )}

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {navCards.map((card) => (
            <div
              key={card.label}
              onClick={() => router.push(`/restaurant/${subdomain}/${card.path}`)}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
            >
              <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {card.label}
              </h3>
              <p className="text-xs text-gray-500">{card.desc}</p>
              <span className="inline-block text-xs font-bold text-indigo-600 mt-2">Open Module →</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
