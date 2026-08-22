"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface CateringRecipe {
  id: string;
  name: string;
  type: string;
  yieldQuantity: number;
  yieldUnit: string;
  sellingPrice: number;
  costPerUnit: number;
}

interface CateringOrderItem {
  id?: string;
  recipeId?: string | null;
  itemName: string;
  category?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  notes?: string;
  recipe?: CateringRecipe;
}

interface CateringOrder {
  id: string;
  orderNumber: string;
  eventName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  eventDate: string;
  eventTime?: string | null;
  eventType: string;
  guestCount: number;
  venueAddress?: string | null;
  status: "DRAFT" | "CONFIRMED" | "IN_PREPARATION" | "DELIVERED" | "COMPLETED" | "CANCELLED";
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  notes?: string | null;
  items: CateringOrderItem[];
  createdAt: string;
}

interface CateringPackageItem {
  id: string;
  recipeId?: string | null;
  itemName: string;
  category: string;
  unitPrice: number;
  portionQtyPerPax: number;
}

interface CateringPackage {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  pricePerPax: number;
  suggestedPax: number;
  items: CateringPackageItem[];
}

interface IngredientReportItem {
  inventoryItemId: string;
  name: string;
  categoryName?: string;
  unitOfMeasure: string;
  requiredQuantity: number;
  estimatedUnitCost: number;
  totalEstimatedCost: number;
  usedInDishes: string[];
}

interface IngredientReport {
  orderId: string;
  orderNumber: string;
  eventName: string;
  guestCount: number;
  rawMaterials: IngredientReportItem[];
  totalRawCost: number;
}

const COURSE_CATEGORIES = [
  "Starters & Appetizers",
  "Main Course",
  "Breads & Rice",
  "Desserts",
  "Beverages",
  "Equipment & Staffing",
];

export default function CateringPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) || "";

  const initialTab = searchParams.get("tab") || "orders";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [recipes, setRecipes] = useState<CateringRecipe[]>([]);
  const [packages, setPackages] = useState<CateringPackage[]>([]);
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    activeOrders: 0,
    totalRevenue: 0,
    totalDeposits: 0,
    totalBalance: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Smart Package Builder & Form Fields
  const [builderCategoryFilter, setBuilderCategoryFilter] = useState("ALL");
  const [formEventName, setFormEventName] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formClientEmail, setFormClientEmail] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [formEventDate, setFormEventDate] = useState("");
  const [formEventTime, setFormEventTime] = useState("18:00");
  const [formEventType, setFormEventType] = useState("BUFFET");
  const [formGuestCount, setFormGuestCount] = useState(100);
  const [formVenueAddress, setFormVenueAddress] = useState("");
  const [formStatus, setFormStatus] = useState<string>("DRAFT");
  const [formTaxRate, setFormTaxRate] = useState(5);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formAdvancePaid, setFormAdvancePaid] = useState(0);
  const [formNotes, setFormNotes] = useState("");
  
  // Line Items in Builder
  const [formItems, setFormItems] = useState<
    Array<{
      recipeId?: string;
      itemName: string;
      category: string;
      unitPrice: number;
      quantity: number;
      notes?: string;
    }>
  >([]);

  // Scaler Drawer / View
  const [scalerOrderId, setScalerOrderId] = useState<string | null>(null);
  const [scalerReport, setScalerReport] = useState<IngredientReport | null>(null);
  const [scalerLoading, setScalerLoading] = useState(false);

  // Invoice Print View
  const [invoiceOrder, setInvoiceOrder] = useState<CateringOrder | null>(null);

  // Package Save Modal
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgCategory, setPkgCategory] = useState("Buffet");

  useEffect(() => {
    fetchCateringData();
  }, [statusFilter]);

  const fetchCateringData = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") q.set("status", statusFilter);
      if (search) q.set("search", search);

      const res = await fetch(`/api/restaurant/catering?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setMetrics(data.metrics || {});
        setRecipes(data.recipes || []);
        setPackages(data.packages || []);
      }
    } catch (err) {
      console.error("Failed to load catering data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCateringData();
  };

  const openCreateModal = () => {
    setEditingOrderId(null);
    setFormEventName("");
    setFormClientName("");
    setFormClientEmail("");
    setFormClientPhone("");
    setFormEventDate(new Date().toISOString().slice(0, 10));
    setFormEventTime("18:00");
    setFormEventType("BUFFET");
    setFormGuestCount(100);
    setFormVenueAddress("");
    setFormStatus("DRAFT");
    setFormTaxRate(5);
    setFormDiscount(0);
    setFormAdvancePaid(0);
    setFormNotes("");

    // Pre-populate with default dish selection if available
    if (recipes.length > 0) {
      setFormItems(
        recipes.slice(0, 3).map((r) => ({
          recipeId: r.id,
          itemName: r.name,
          category: r.type === "SUB_RECIPE" ? "Breads & Rice" : "Main Course",
          unitPrice: Number(r.sellingPrice) || Number(r.costPerUnit) * 2.5 || 15,
          quantity: 100,
        }))
      );
    } else {
      setFormItems([
        { itemName: "Welcome Drinks", category: "Beverages", unitPrice: 4, quantity: 100 },
        { itemName: "Paneer / Chicken Starter", category: "Starters & Appetizers", unitPrice: 8, quantity: 100 },
        { itemName: "Royal Main Course Feast", category: "Main Course", unitPrice: 18, quantity: 100 },
        { itemName: "Assorted Breads & Naan", category: "Breads & Rice", unitPrice: 5, quantity: 100 },
        { itemName: "Artisan Dessert Counter", category: "Desserts", unitPrice: 6, quantity: 100 },
      ]);
    }
    setShowModal(true);
  };

  const openEditModal = (order: CateringOrder) => {
    setEditingOrderId(order.id);
    setFormEventName(order.eventName);
    setFormClientName(order.clientName);
    setFormClientEmail(order.clientEmail || "");
    setFormClientPhone(order.clientPhone || "");
    setFormEventDate(order.eventDate ? new Date(order.eventDate).toISOString().slice(0, 10) : "");
    setFormEventTime(order.eventTime || "18:00");
    setFormEventType(order.eventType || "BUFFET");
    setFormGuestCount(order.guestCount || 100);
    setFormVenueAddress(order.venueAddress || "");
    setFormStatus(order.status);
    const calculatedTaxRate = order.subtotal > 0 ? (order.taxAmount * 100) / order.subtotal : 5;
    setFormTaxRate(Number(calculatedTaxRate.toFixed(1)));
    setFormDiscount(order.discountAmount || 0);
    setFormAdvancePaid(order.advancePaid || 0);
    setFormNotes(order.notes || "");
    setFormItems(
      order.items.map((i) => ({
        recipeId: i.recipeId || undefined,
        itemName: i.itemName,
        category: i.category || "Main Course",
        unitPrice: Number(i.unitPrice),
        quantity: Number(i.quantity),
        notes: i.notes || undefined,
      }))
    );
    setShowModal(true);
  };

  const addFormItem = () => {
    setFormItems([
      ...formItems,
      { itemName: "", category: "Main Course", unitPrice: 0, quantity: formGuestCount },
    ]);
  };

  const addRecipeToMenu = (recipe: CateringRecipe) => {
    const existingIndex = formItems.findIndex((i) => i.recipeId === recipe.id);
    if (existingIndex >= 0) {
      // Increments quantity
      const updated = [...formItems];
      updated[existingIndex].quantity += formGuestCount;
      setFormItems(updated);
    } else {
      setFormItems([
        ...formItems,
        {
          recipeId: recipe.id,
          itemName: recipe.name,
          category: recipe.type === "SUB_RECIPE" ? "Breads & Rice" : "Main Course",
          unitPrice: Number(recipe.sellingPrice) || Number(recipe.costPerUnit) * 2.5 || 15,
          quantity: formGuestCount,
        },
      ]);
    }
  };

  const removeFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleRecipeSelect = (index: number, recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      recipeId: recipe.id,
      itemName: recipe.name,
      unitPrice: Number(recipe.sellingPrice) || Number(recipe.costPerUnit) * 2.5 || 15,
      quantity: formGuestCount,
    };
    setFormItems(updated);
  };

  // Sync Guest Pax slider to all line items
  const handleGuestCountChange = (newPax: number) => {
    setFormGuestCount(newPax);
    setFormItems((prev) =>
      prev.map((item) => ({
        ...item,
        quantity: newPax,
      }))
    );
  };

  const loadPackageIntoBuilder = (pkg: CateringPackage) => {
    if (formItems.length > 0 && !confirm(`Load package "${pkg.name}"? This will replace current menu items.`)) {
      return;
    }
    setFormItems(
      pkg.items.map((i) => ({
        recipeId: i.recipeId || undefined,
        itemName: i.itemName,
        category: i.category || "Main Course",
        unitPrice: Number(i.unitPrice),
        quantity: formGuestCount,
      }))
    );
  };

  const handleSaveAsPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName || formItems.length === 0) {
      alert("Please provide a Package Name and ensure items are present.");
      return;
    }

    try {
      const pricePerPax = formItems.reduce((sum, i) => sum + Number(i.unitPrice), 0);
      const res = await fetch("/api/restaurant/catering/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pkgName,
          description: pkgDesc,
          category: pkgCategory,
          pricePerPax,
          suggestedPax: formGuestCount,
          items: formItems.map((i) => ({
            recipeId: i.recipeId,
            itemName: i.itemName,
            category: i.category,
            unitPrice: i.unitPrice,
            portionQtyPerPax: 1,
          })),
        }),
      });

      if (res.ok) {
        setShowPackageModal(false);
        setPkgName("");
        setPkgDesc("");
        fetchCateringData();
        alert("Catering package template saved successfully!");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save package");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save package");
    }
  };

  // Calculate financial stats & margins
  const calculateFormSubtotal = () => {
    return formItems.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0), 0);
  };

  const calculateFormFoodCost = () => {
    return formItems.reduce((sum, item) => {
      let cost = 0;
      if (item.recipeId) {
        const r = recipes.find((rec) => rec.id === item.recipeId);
        if (r) cost = Number(r.costPerUnit || 0);
      }
      if (cost === 0) cost = Number(item.unitPrice) * 0.35; // Default 35% estimated cost
      return sum + cost * (Number(item.quantity) || 0);
    }, 0);
  };

  const formSubtotal = calculateFormSubtotal();
  const formTaxAmount = (formSubtotal * formTaxRate) / 100;
  const formTotalAmount = Math.max(0, formSubtotal + formTaxAmount - formDiscount);
  const formBalanceDue = Math.max(0, formTotalAmount - formAdvancePaid);
  const formTotalFoodCost = calculateFormFoodCost();
  const formEstimatedProfit = Math.max(0, formSubtotal - formTotalFoodCost);
  const formGrossMarginPercent = formSubtotal > 0 ? (formEstimatedProfit * 100) / formSubtotal : 0;
  const formPricePerPax = formGuestCount > 0 ? formSubtotal / formGuestCount : 0;

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEventName || !formClientName || !formEventDate) {
      alert("Please fill in Event Name, Client Name, and Event Date.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        eventName: formEventName,
        clientName: formClientName,
        clientEmail: formClientEmail || undefined,
        clientPhone: formClientPhone || undefined,
        eventDate: formEventDate,
        eventTime: formEventTime,
        eventType: formEventType,
        guestCount: Number(formGuestCount),
        venueAddress: formVenueAddress || undefined,
        status: formStatus,
        taxRatePercent: formTaxRate,
        discountAmount: Number(formDiscount),
        advancePaid: Number(formAdvancePaid),
        notes: formNotes || undefined,
        items: formItems,
      };

      const url = editingOrderId
        ? `/api/restaurant/catering/${editingOrderId}`
        : `/api/restaurant/catering`;
      const method = editingOrderId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        fetchCateringData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save order");
      }
    } catch (err: any) {
      alert(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async (id: string, orderNumber: string) => {
    if (!confirm(`Are you sure you want to delete order ${orderNumber}?`)) return;
    try {
      const res = await fetch(`/api/restaurant/catering/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCateringData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete order");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete order");
    }
  };

  const loadIngredientScaler = async (orderId: string) => {
    try {
      setScalerOrderId(orderId);
      setScalerLoading(true);
      setActiveTab("ingredients");
      const res = await fetch(`/api/restaurant/catering/${orderId}/ingredients`);
      if (res.ok) {
        const data = await res.json();
        setScalerReport(data.report);
      }
    } catch (err) {
      console.error("Failed to calculate ingredients", err);
    } finally {
      setScalerLoading(false);
    }
  };

  const openInvoiceView = (order: CateringOrder) => {
    setInvoiceOrder(order);
    setActiveTab("invoices");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            Confirmed
          </span>
        );
      case "IN_PREPARATION":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            In Preparation
          </span>
        );
      case "DELIVERED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            Delivered
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            Completed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        );
    }
  };

  return (
    <ModuleAccessGuard moduleKey="catering" moduleName="Catering & Event Management" activeSection="Catering">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <RestaurantNavbar activeSection="Catering" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Smart Catering & Package Studio
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Visual Menu & Item Builder, Recipe Costing, Pax Ingredient Scaler, and Client Proposals.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-xs"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Smart Item Builder & Event
              </button>
            </div>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Events</span>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{metrics.totalOrders || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Bookings</span>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{metrics.activeOrders || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Projected Revenue</span>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">${metrics.totalRevenue?.toFixed(2) || "0.00"}</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deposits Collected</span>
              <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">${metrics.totalDeposits?.toFixed(2) || "0.00"}</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Balance Pending</span>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">${metrics.totalBalance?.toFixed(2) || "0.00"}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex space-x-8">
            <button
              onClick={() => setActiveTab("orders")}
              className={`pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center space-x-2 ${
                activeTab === "orders"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Event Directory Board</span>
            </button>

            <button
              onClick={() => setActiveTab("ingredients")}
              className={`pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center space-x-2 ${
                activeTab === "ingredients"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Recipe Ingredient Scaler</span>
            </button>

            <button
              onClick={() => setActiveTab("invoices")}
              className={`pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center space-x-2 ${
                activeTab === "invoices"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Client Proposals & Invoices</span>
            </button>
          </div>

          {/* TAB 1: Event Orders Directory */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search event, client, order #..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <button type="submit" className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium rounded-lg">
                    Search
                  </button>
                </form>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-slate-500">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="IN_PREPARATION">In Preparation</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center text-slate-500 text-sm">Loading catering orders...</div>
                ) : orders.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-sm">
                    No catering event orders found. Click &quot;Smart Item Builder & Event&quot; to build your first event.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-3.5">Order # / Event</th>
                          <th className="px-4 py-3.5">Client & Contact</th>
                          <th className="px-4 py-3.5">Date & Venue</th>
                          <th className="px-4 py-3.5">Pax</th>
                          <th className="px-4 py-3.5">Total ($)</th>
                          <th className="px-4 py-3.5">Paid ($)</th>
                          <th className="px-4 py-3.5">Balance ($)</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3.5 font-medium">
                              <span className="text-slate-900 dark:text-white font-semibold block">{o.eventName}</span>
                              <span className="text-slate-400 font-mono text-[11px]">{o.orderNumber}</span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                              <span className="block font-medium">{o.clientName}</span>
                              <span className="text-slate-400 text-[11px] block">{o.clientPhone || o.clientEmail || "—"}</span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                              <span className="block font-medium">
                                {new Date(o.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                              <span className="text-slate-400 text-[11px] block truncate max-w-[150px]">{o.venueAddress || "On-site"}</span>
                            </td>
                            <td className="px-4 py-3.5 font-medium">
                              <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                                {o.guestCount} Pax
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                              ${Number(o.totalAmount).toFixed(2)}
                            </td>
                            <td className="px-4 py-3.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              ${Number(o.advancePaid).toFixed(2)}
                            </td>
                            <td className="px-4 py-3.5 text-amber-600 dark:text-amber-400 font-medium">
                              ${Number(o.balanceDue).toFixed(2)}
                            </td>
                            <td className="px-4 py-3.5">{getStatusBadge(o.status)}</td>
                            <td className="px-4 py-3.5 text-right space-x-2">
                              <button
                                onClick={() => loadIngredientScaler(o.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-medium text-[11px]"
                                title="Calculate ingredient requirements"
                              >
                                Scaler
                              </button>
                              <button
                                onClick={() => openInvoiceView(o)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-medium text-[11px]"
                                title="View Quote & Invoice"
                              >
                                Invoice
                              </button>
                              <button
                                onClick={() => openEditModal(o)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(o.id, o.orderNumber)}
                                className="p-1.5 text-rose-400 hover:text-rose-600 inline-flex"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Recipe Ingredient Scaler */}
          {activeTab === "ingredients" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Bulk Ingredient Procurement Matrix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Calculates exact raw material stock requirements based on Pax headcount and linked recipes.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs font-medium text-slate-500">Select Event:</span>
                  <select
                    value={scalerOrderId || ""}
                    onChange={(e) => {
                      if (e.target.value) loadIngredientScaler(e.target.value);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="">-- Choose Catering Order --</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} - {o.eventName} ({o.guestCount} Pax)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {scalerLoading ? (
                <div className="p-12 text-center text-slate-500 text-sm">Calculating raw ingredient requirements...</div>
              ) : scalerReport ? (
                <div className="space-y-6">
                  {/* Event summary banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Event Name</span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{scalerReport.eventName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Guest Headcount</span>
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{scalerReport.guestCount} Pax</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Estimated Raw Material Cost</span>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${scalerReport.totalRawCost.toFixed(2)}</p>
                    </div>
                  </div>

                  {scalerReport.rawMaterials.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No linked recipe items found in this order. Link items to recipes in the Smart Item Builder to auto-calculate ingredient scaling.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase">
                          <tr>
                            <th className="px-4 py-3">Ingredient Name</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Scaled Qty Required</th>
                            <th className="px-4 py-3">Unit Cost ($)</th>
                            <th className="px-4 py-3">Est. Total Cost ($)</th>
                            <th className="px-4 py-3">Used In Dishes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {scalerReport.rawMaterials.map((rm) => (
                            <tr key={rm.inventoryItemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{rm.name}</td>
                              <td className="px-4 py-3 text-slate-500">{rm.categoryName || "General"}</td>
                              <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                                {rm.requiredQuantity} {rm.unitOfMeasure}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">${rm.estimatedUnitCost.toFixed(2)}</td>
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                ${rm.totalEstimatedCost.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {rm.usedInDishes.join(", ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Select a catering order from the dropdown above to view scaled raw ingredient requirements.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Client Proposals & Invoices View */}
          {activeTab === "invoices" && (
            <div className="space-y-6">
              {!invoiceOrder ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 text-sm">
                  Select an event order from the Directory tab and click &quot;Invoice&quot; to preview and print client quotation statements.
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-6 shadow-lg">
                  {/* Action buttons */}
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4 print:hidden">
                    <button
                      onClick={() => setInvoiceOrder(null)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                    >
                      &larr; Back to Select
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-xs inline-flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      <span>Print Client Invoice</span>
                    </button>
                  </div>

                  {/* Document Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
                        CATERING PROPOSAL & STATEMENT
                      </h1>
                      <p className="text-xs text-slate-400 font-mono mt-1">Invoice #{invoiceOrder.orderNumber}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p className="font-semibold text-slate-900 dark:text-white">Issue Date:</p>
                      <p>{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Client & Event Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">CLIENT INFORMATION</span>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{invoiceOrder.clientName}</p>
                      <p className="text-slate-600 dark:text-slate-300">{invoiceOrder.clientPhone || "—"}</p>
                      <p className="text-slate-600 dark:text-slate-300">{invoiceOrder.clientEmail || "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">EVENT SPECIFICATIONS</span>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{invoiceOrder.eventName}</p>
                      <p className="text-slate-600 dark:text-slate-300">
                        Date: {new Date(invoiceOrder.eventDate).toLocaleDateString()} at {invoiceOrder.eventTime || "18:00"}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">Guest Pax: {invoiceOrder.guestCount} Guests</p>
                      <p className="text-slate-600 dark:text-slate-300">Venue: {invoiceOrder.venueAddress || "On-site"}</p>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase">
                        <tr>
                          <th className="px-4 py-2.5">Item Name</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5 text-right">Unit Price</th>
                          <th className="px-4 py-2.5 text-right">Quantity / Pax</th>
                          <th className="px-4 py-2.5 text-right">Total ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {invoiceOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{item.itemName}</td>
                            <td className="px-4 py-3 text-slate-500">{item.category || "Main Course"}</td>
                            <td className="px-4 py-3 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">{item.quantity}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                              ${Number(item.totalPrice).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Totals */}
                  <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="w-full max-w-xs space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Subtotal:</span>
                        <span>${Number(invoiceOrder.subtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Tax:</span>
                        <span>+${Number(invoiceOrder.taxAmount).toFixed(2)}</span>
                      </div>
                      {invoiceOrder.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount:</span>
                          <span>-${Number(invoiceOrder.discountAmount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-900 dark:text-white">
                        <span>Total Estimated:</span>
                        <span>${Number(invoiceOrder.totalAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600 dark:text-blue-400 font-medium">
                        <span>Advance Paid:</span>
                        <span>-${Number(invoiceOrder.advancePaid).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold text-sm border-t border-slate-200 dark:border-slate-700 pt-1">
                        <span>Balance Due:</span>
                        <span>${Number(invoiceOrder.balanceDue).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SMART ITEM & PACKAGE BUILDER MODAL */}
          {showModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                        Interactive Package Studio
                      </span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {formGuestCount} Guests (Pax)
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {editingOrderId ? "Edit Catering Event & Menu Builder" : "Smart Catering Package & Event Builder"}
                    </h3>
                  </div>

                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSaveOrder} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto text-xs">
                  
                  {/* Preset Packages Loader Bar */}
                  {packages.length > 0 && (
                    <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-indigo-900 dark:text-indigo-300 text-xs block">
                          Fast-Track Package Templates
                        </span>
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                          Load pre-configured catering packages into this event menu with 1 click:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {packages.map((pkg) => (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => loadPackageIntoBuilder(pkg)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl font-semibold text-[11px] shadow-2xs transition-colors"
                          >
                            + {pkg.name} (${Number(pkg.pricePerPax).toFixed(0)}/pax)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Form Grid: Event & Client Specs */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm border-b border-slate-200 dark:border-slate-800 pb-2">
                      Event Profile & Guest Headcount
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Event Title *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Executive Corporate Gala"
                          value={formEventName}
                          onChange={(e) => setFormEventName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Client Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sarah Connor"
                          value={formClientName}
                          onChange={(e) => setFormClientName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Client Contact Phone</label>
                        <input
                          type="text"
                          placeholder="+1 (555) 234-5678"
                          value={formClientPhone}
                          onChange={(e) => setFormClientPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Event Date *</label>
                        <input
                          type="date"
                          required
                          value={formEventDate}
                          onChange={(e) => setFormEventDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Service Type</label>
                        <select
                          value={formEventType}
                          onChange={(e) => setFormEventType(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        >
                          <option value="BUFFET">Buffet Setup</option>
                          <option value="WEDDING">Wedding Banquet</option>
                          <option value="CORPORATE">Corporate Conference</option>
                          <option value="BIRTHDAY">Birthday Celebration</option>
                          <option value="PRIVATE_DINING">Private Dining</option>
                          <option value="PACKED_MEALS">Packed Meals</option>
                          <option value="OTHER">Custom Event</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Venue Location</label>
                        <input
                          type="text"
                          placeholder="Grand Hyatt Ballroom"
                          value={formVenueAddress}
                          onChange={(e) => setFormVenueAddress(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        />
                      </div>
                    </div>

                    {/* LIVE PAX GUEST SCALER SLIDER */}
                    <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-slate-900 dark:text-white text-xs flex items-center space-x-2">
                          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>Live Guest Headcount (Pax Scaler)</span>
                        </label>
                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-extrabold font-mono">
                          {formGuestCount} Guests
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={1000}
                        step={5}
                        value={formGuestCount}
                        onChange={(e) => handleGuestCountChange(Number(e.target.value))}
                        className="w-full h-2 bg-indigo-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>10 Pax (Intimate)</span>
                        <span>100 Pax (Standard)</span>
                        <span>500 Pax (Banquet)</span>
                        <span>1000 Pax (Mega Event)</span>
                      </div>
                    </div>
                  </div>

                  {/* VISUAL DISH & RECIPE PICKER CATALOG */}
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                          Course Dish Catalog & Recipe Master
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Click any dish to add to this event. Linked recipes automatically calculate raw ingredients & food costs.
                        </p>
                      </div>

                      {/* Course Filter Tabs */}
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setBuilderCategoryFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                            builderCategoryFilter === "ALL"
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          All Courses
                        </button>
                        {COURSE_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setBuilderCategoryFilter(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                              builderCategoryFilter === cat
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dish Cards Grid */}
                    {recipes.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
                        {recipes
                          .filter((r) => {
                            if (builderCategoryFilter === "ALL") return true;
                            if (builderCategoryFilter === "Breads & Rice") return r.type === "SUB_RECIPE";
                            return true;
                          })
                          .map((r) => (
                            <div
                              key={r.id}
                              onClick={() => addRecipeToMenu(r)}
                              className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-all cursor-pointer flex flex-col justify-between space-y-2 group shadow-2xs"
                            >
                              <div>
                                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider">
                                  {r.type === "SUB_RECIPE" ? "Sub-recipe" : "Dish"}
                                </span>
                                <h5 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {r.name}
                                </h5>
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-200/80 dark:border-slate-700/60 pt-2 text-[11px]">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  ${(Number(r.sellingPrice) || Number(r.costPerUnit) * 2.5 || 15).toFixed(2)}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold text-[10px]">
                                  + Add
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* ACTIVE MENU ITEM BUILDER TABLE */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                          Selected Event Menu Items ({formItems.length})
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Adjust unit prices, quantities, or add custom non-recipe charges (staffing, rentals).
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowPackageModal(true)}
                          disabled={formItems.length === 0}
                          className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 disabled:opacity-40"
                        >
                          ★ Save Menu as Package Template
                        </button>
                        <button
                          type="button"
                          onClick={addFormItem}
                          className="px-3 py-1.5 text-[11px] font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100"
                        >
                          + Add Custom Line Item
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {formItems.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                          No items added yet. Click dishes in the catalog above or &quot;Add Custom Line Item&quot; to build your menu.
                        </div>
                      ) : (
                        formItems.map((item, index) => (
                          <div
                            key={index}
                            className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                              {/* Recipe selector */}
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] text-slate-400 font-medium">Linked Recipe Master</label>
                                <select
                                  value={item.recipeId || ""}
                                  onChange={(e) => handleRecipeSelect(index, e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                                >
                                  <option value="">-- Custom Item --</option>
                                  {recipes.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name} (${Number(r.sellingPrice).toFixed(2)})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Item Name */}
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] text-slate-400 font-medium">Item / Dish Name *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Item name"
                                  value={item.itemName}
                                  onChange={(e) => {
                                    const updated = [...formItems];
                                    updated[index].itemName = e.target.value;
                                    setFormItems(updated);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                                />
                              </div>

                              {/* Category */}
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 font-medium">Course Category</label>
                                <select
                                  value={item.category || "Main Course"}
                                  onChange={(e) => {
                                    const updated = [...formItems];
                                    updated[index].category = e.target.value;
                                    setFormItems(updated);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                                >
                                  {COURSE_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Price per Pax */}
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 font-medium">Unit Price ($)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const updated = [...formItems];
                                    updated[index].unitPrice = Number(e.target.value);
                                    setFormItems(updated);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                                />
                              </div>

                              {/* Total Price */}
                              <div className="sm:col-span-1 text-right">
                                <label className="block text-[10px] text-slate-400 font-medium">Line Total</label>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs block py-1.5">
                                  ${(item.unitPrice * item.quantity).toFixed(0)}
                                </span>
                              </div>

                              {/* Remove button */}
                              <div className="sm:col-span-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeFormItem(index)}
                                  className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* REAL-TIME PROFITABILITY & FOOD COST METER */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                          Real-time Event Margin & Profitability Engine
                        </span>
                        <div className="flex items-center space-x-3 mt-0.5">
                          <span className="text-xl font-extrabold text-white">
                            ${formSubtotal.toFixed(2)} Total
                          </span>
                          <span className="text-xs text-slate-400">
                            (${formPricePerPax.toFixed(2)} / Pax)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Est. Raw Food Cost</span>
                          <span className="font-semibold text-slate-200">${formTotalFoodCost.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Est. Gross Profit</span>
                          <span className="font-bold text-emerald-400">${formEstimatedProfit.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Profit Margin %</span>
                          <span
                            className={`font-extrabold text-sm ${
                              formGrossMarginPercent >= 65
                                ? "text-emerald-400"
                                : formGrossMarginPercent >= 45
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            {formGrossMarginPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          formGrossMarginPercent >= 65
                            ? "bg-emerald-500"
                            : formGrossMarginPercent >= 45
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, formGrossMarginPercent))}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial & Status Summary */}
                  <div className="space-y-4 pt-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm border-b border-slate-200 dark:border-slate-800 pb-2">
                      Billing Status & Advance Deposit
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Status Workflow</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        >
                          <option value="DRAFT">Draft Quote</option>
                          <option value="CONFIRMED">Confirmed Booking</option>
                          <option value="IN_PREPARATION">In Preparation</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Tax Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formTaxRate}
                          onChange={(e) => setFormTaxRate(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Discount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formDiscount}
                          onChange={(e) => setFormDiscount(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Advance Deposit Paid ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formAdvancePaid}
                          onChange={(e) => setFormAdvancePaid(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex flex-wrap justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>Subtotal: ${formSubtotal.toFixed(2)}</span>
                      <span>Tax: +${formTaxAmount.toFixed(2)}</span>
                      <span>Total Quote: ${formTotalAmount.toFixed(2)}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">
                        Remaining Balance: ${formBalanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md disabled:opacity-50"
                    >
                      {saving ? "Saving Event..." : editingOrderId ? "Update Event Order" : "Save & Finalize Event"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SAVE AS PACKAGE TEMPLATE MODAL */}
          {showPackageModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Save Menu as Reusable Package Template
                </h3>
                <p className="text-slate-500">
                  Save current menu items so caterers can load this menu into future catering events with 1 click.
                </p>

                <form onSubmit={handleSaveAsPackage} className="space-y-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Package Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Wedding Feast Package"
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                    <select
                      value={pkgCategory}
                      onChange={(e) => setPkgCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="Buffet">Buffet Package</option>
                      <option value="Wedding">Wedding Feast</option>
                      <option value="Corporate">Corporate Executive Box</option>
                      <option value="Private Dining">Private Dining</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                    <textarea
                      placeholder="Includes 3 starters, 4 main courses, live naan counter & desserts..."
                      value={pkgDesc}
                      onChange={(e) => setPkgDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPackageModal(false)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      Save Package Template
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </ModuleAccessGuard>
  );
}
