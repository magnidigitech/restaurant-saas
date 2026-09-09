"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import { WORLDWIDE_TIMEZONES, WORLDWIDE_CURRENCIES } from "@/core/constants/locales";
import SearchableTimezoneSelect from "@/components/SearchableTimezoneSelect";
import SearchableCurrencySelect from "@/components/SearchableCurrencySelect";
import {
  Store,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Coins,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  Shield,
  Database,
} from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
}

export default function RestaurantProfilePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<"profile" | "outlets">("profile");

  // Read initial tab from URL if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "outlets") {
        setActiveTab("outlets");
      }
    }
  }, []);

  const switchTab = (tab: "profile" | "outlets") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "outlets") {
        url.searchParams.set("tab", "outlets");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  // Profile Form State
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    applicationName: "",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "#0071E3",
    secondaryColor: "#3b82f6",
    supportEmail: "",
    supportPhone: "",
  });
  const [restaurantData, setRestaurantData] = useState<any>(null);

  // Outlets State
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletsLoading, setOutletsLoading] = useState(true);
  const [outletError, setOutletError] = useState("");
  const [outletSuccess, setOutletSuccess] = useState("");

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingOutlet, setCreatingOutlet] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: "",
    address: "",
    timezone: "UTC",
    currency: "USD",
  });

  // Edit Modal
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    address: "",
    timezone: "UTC",
    currency: "USD",
  });
  const [updatingOutlet, setUpdatingOutlet] = useState(false);

  // Delete Modal
  const [deletingOutlet, setDeletingOutlet] = useState<Outlet | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch Profile
  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/restaurant/profile");
      const data = await res.json();
      if (res.ok && data.restaurant) {
        const r = data.restaurant;
        const b = r.branding || {};
        setRestaurantData(r);
        setFormData({
          name: r.name || "",
          applicationName: b.applicationName || r.name || "",
          logoUrl: b.logoUrl || "",
          faviconUrl: b.faviconUrl || "",
          primaryColor: b.primaryColor || "#0071E3",
          secondaryColor: b.secondaryColor || "#3b82f6",
          supportEmail: b.supportEmail || "",
          supportPhone: b.supportPhone || "",
        });
      } else {
        setProfileError(data.error || "Failed to load profile");
      }
    } catch {
      setProfileError("Network error loading profile");
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch Outlets
  const fetchOutlets = async () => {
    setOutletsLoading(true);
    try {
      const res = await fetch("/api/restaurant/outlets");
      const data = await res.json();
      if (res.ok) setOutlets(data.outlets || []);
      else setOutletError(data.error || "Failed to load outlets");
    } catch {
      setOutletError("Network error loading outlets");
    } finally {
      setOutletsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchOutlets();
  }, []);

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const res = await fetch("/api/restaurant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details?.fieldErrors) {
          const firstField = Object.keys(data.details.fieldErrors)[0];
          const firstMsg = data.details.fieldErrors[firstField]?.[0];
          throw new Error(`Validation Error (${firstField}): ${firstMsg}`);
        }
        throw new Error(data.error || "Failed to update profile");
      }

      setProfileSuccess("Restaurant profile and branding updated successfully!");
      fetchProfile();
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err: any) {
      setProfileError(err.message || "Error updating profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Outlet Create
  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingOutlet(true);
    setOutletError("");
    setOutletSuccess("");

    try {
      const res = await fetch("/api/restaurant/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createFormData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create outlet");

      setShowCreateModal(false);
      setCreateFormData({ name: "", address: "", timezone: "UTC", currency: "USD" });
      setOutletSuccess(`Branch location "${createFormData.name}" created successfully.`);
      fetchOutlets();
      setTimeout(() => setOutletSuccess(""), 4000);
    } catch (err: any) {
      setOutletError(err.message || "Error creating outlet");
    } finally {
      setCreatingOutlet(false);
    }
  };

  // Handle Outlet Edit Modal
  const openEditModal = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setEditFormData({
      name: outlet.name,
      address: outlet.address || "",
      timezone: outlet.timezone,
      currency: outlet.currency,
    });
    setOutletError("");
    setOutletSuccess("");
  };

  // Handle Outlet Update
  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet) return;
    setUpdatingOutlet(true);
    setOutletError("");
    setOutletSuccess("");

    try {
      const res = await fetch(`/api/restaurant/outlets/${editingOutlet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update outlet");

      setEditingOutlet(null);
      setOutletSuccess(`Branch location "${editFormData.name}" updated.`);
      fetchOutlets();
      setTimeout(() => setOutletSuccess(""), 4000);
    } catch (err: any) {
      setOutletError(err.message || "Error updating outlet");
    } finally {
      setUpdatingOutlet(false);
    }
  };

  // Handle Outlet Delete
  const handleDeleteOutlet = async () => {
    if (!deletingOutlet) return;
    setDeleting(true);
    setOutletError("");
    setOutletSuccess("");

    try {
      const res = await fetch(`/api/restaurant/outlets/${deletingOutlet.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove outlet");

      const removedName = deletingOutlet.name;
      setDeletingOutlet(null);
      setOutletSuccess(`Branch location "${removedName}" has been removed.`);
      fetchOutlets();
      setTimeout(() => setOutletSuccess(""), 4000);
    } catch (err: any) {
      setOutletError(err.message || "Error removing outlet");
    } finally {
      setDeleting(false);
    }
  };

  const isSubdomain =
    typeof window !== "undefined" &&
    (window.location.host.startsWith(`${subdomain}.`) ||
      (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin.")));

  const p = (path: string) => (isSubdomain ? path : `/restaurant/${subdomain}${path}`);

  if (profileLoading && outletsLoading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
          }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Restaurant & Outlets...</p>
      </div>
    );
  }

  const activeSub = restaurantData?.subscriptions?.[0];

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
    >
      <RestaurantNavbar activeSection="Restaurant & Outlets" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16 sm:py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-4 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl border transition relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 ${
            isDark
              ? "bg-gradient-to-br from-[#121829] via-[#0E1320] to-[#0A0D14] border-white/[0.08] shadow-xl shadow-black/20"
              : "bg-gradient-to-br from-blue-50/80 via-indigo-50/25 to-white border-blue-100/80 shadow-sm shadow-blue-500/5"
          }`}
        >
          {/* Ambient Glow Orbs */}
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-blue-500/10 dark:bg-[#0071E3]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -bottom-16 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Left: Nav & Title */}
          <div className="relative z-10 space-y-2.5 sm:space-y-3 w-full md:w-auto min-w-0">
            {/* Nav & Category Pills */}
            <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
              <button
                onClick={() => router.push(p("/dashboard"))}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                }`}
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Dashboard</span>
              </button>
              <span className="hidden sm:inline text-slate-300 dark:text-white/20">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse" />
                <span className="hidden sm:inline">Administration & Setup</span>
                <span className="sm:hidden">Setup & Outlets</span>
              </span>
            </div>

            {/* Title with Squircle Icon */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#0071E3] via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 border border-white/20">
                <Store className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className={`text-base sm:text-2xl font-extrabold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  Restaurant & Outlets
                </h1>
                <span className={`text-[10px] sm:text-xs block sm:hidden font-medium mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Domain: {subdomain} • {outlets.length} active outlets
                </span>
              </div>
            </div>
          </div>

          {/* Right: Tenant Status Capsule (Desktop/Tablet only) */}
          <div className="relative z-10 hidden md:flex items-center gap-3 shrink-0">
            <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
              isDark
                ? "bg-[#141A29]/80 border-white/[0.08] shadow-sm"
                : "bg-white/90 backdrop-blur-xs border-slate-200/80 shadow-xs"
            }`}>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Tenant Instance Active
                  </span>
                </div>
                <span className={`text-[11px] font-medium block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Domain: {subdomain} • {outlets.length} Outlets Provisioned
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Apple Segmented Control */}
        <div className="p-1 sm:p-1.5 bg-slate-200/70 dark:bg-white/[0.06] rounded-2xl grid grid-cols-2 gap-1 w-full max-w-md">
          <button
            onClick={() => switchTab("profile")}
            className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${activeTab === "profile"
                ? "bg-white dark:bg-[#151A28] text-[#0071E3] dark:text-white shadow-sm font-bold"
                : isDark
                  ? "text-[#8F95A3] hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Brand Profile</span>
          </button>
          <button
            onClick={() => switchTab("outlets")}
            className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${activeTab === "outlets"
                ? "bg-white dark:bg-[#151A28] text-[#0071E3] dark:text-white shadow-sm font-bold"
                : isDark
                  ? "text-[#8F95A3] hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Branch Outlets ({outlets.length})</span>
          </button>
        </div>

        {/* TAB 1: Brand & Profile */}
        {activeTab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {profileError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {/* Subscription Plan & Limits Overview */}
            {activeSub && (
              <div
                className={`p-5 sm:p-6 rounded-3xl border transition space-y-4 ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06] shadow-xl shadow-black/10" : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <h2 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                      Active Subscription Plan
                    </h2>
                  </div>
                  <span className="self-start sm:self-auto text-[11px] font-bold uppercase px-3 py-1 bg-[#0071E3]/10 dark:bg-[#0071E3]/20 text-[#0071E3] dark:text-[#58A6FF] border border-[#0071E3]/25 rounded-full whitespace-nowrap">
                    Plan: {activeSub.plan.name}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs">
                  <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50/80 border-slate-200/80"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Outlets
                      </span>
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <span className={`font-bold text-lg sm:text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
                      {activeSub.plan.maxOutlets}
                    </span>
                  </div>

                  <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50/80 border-slate-200/80"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Staff Limit
                      </span>
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <span className={`font-bold text-lg sm:text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
                      {activeSub.plan.maxEmployees}
                    </span>
                  </div>

                  <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50/80 border-slate-200/80"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Admin Logins
                      </span>
                      <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <span className={`font-bold text-lg sm:text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
                      {activeSub.plan.maxAdminUsers}
                    </span>
                  </div>

                  <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50/80 border-slate-200/80"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Cloud Storage
                      </span>
                      <Database className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <span className={`font-bold text-lg sm:text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
                      {activeSub.plan.storageQuotaGb} GB
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Settings Form */}
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div
                className={`p-5 sm:p-7 rounded-3xl border transition space-y-5 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                  }`}
              >
                <h2 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                  General Identity & Branding
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Organization Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                        }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Application Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.applicationName}
                      onChange={(e) => setFormData({ ...formData, applicationName: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                        }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Logo Image URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={formData.logoUrl}
                      onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                        }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Favicon URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/favicon.ico"
                      value={formData.faviconUrl}
                      onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                        }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Brand Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-10 h-10 p-0 border-0 rounded-xl cursor-pointer bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className={`flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                          }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Secondary Tone
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-10 h-10 p-0 border-0 rounded-xl cursor-pointer bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className={`flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                          }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={formData.supportEmail}
                      onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                        }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Support Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.supportPhone}
                      onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50/80 border-slate-200/90 text-slate-900 focus:bg-white"
                        }`}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-2xl sm:rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50 text-center"
                  >
                    {savingProfile ? "Saving Changes..." : "Save Profile & Branding"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Outlets & Branches */}
        {activeTab === "outlets" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {outletError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{outletError}</span>
              </div>
            )}

            {outletSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{outletSuccess}</span>
              </div>
            )}

            {/* Outlets Action Bar */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3.5">
              <div>
                <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Branch Outlets
                </h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {outlets.length} active physical locations across this restaurant entity.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-2xl sm:rounded-xl transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Branch Location</span>
              </button>
            </div>

            {/* Outlets List or Empty State */}
            {outlets.length === 0 ? (
              <div
                className={`p-8 sm:p-12 rounded-3xl border text-center flex flex-col items-center justify-center space-y-4 ${isDark ? "bg-[#121622]/40 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                  }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${isDark
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-emerald-50 text-emerald-600 border-emerald-200"
                    }`}
                >
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className={`text-sm sm:text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    No Branch Outlets Configured
                  </h3>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Create your first restaurant outlet to manage branch-specific shift rosters, inventory levels, tables, and staff permissions.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full sm:w-auto px-6 py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-2xl transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Your First Branch Location</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {outlets.map((outlet) => (
                  <div
                    key={outlet.id}
                    className={`p-5 rounded-3xl border transition flex flex-col justify-between space-y-4 ${isDark
                        ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                        : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300"
                      }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${isDark
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-emerald-50 text-emerald-600 border-emerald-200"
                              }`}
                          >
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className={`text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                              {outlet.name}
                            </h3>
                            <span
                              className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mt-0.5 ${isDark ? "bg-white/[0.04] text-[#8F95A3]" : "bg-slate-100 text-slate-600"
                                }`}
                            >
                              ID: {outlet.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(outlet)}
                            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${isDark
                                ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.06]"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              }`}
                            title="Edit Outlet"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingOutlet(outlet)}
                            className="p-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Delete Outlet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            Physical Address
                          </span>
                          <p className={`mt-0.5 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                            {outlet.address || "No address provided"}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                          <div>
                            <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                              Timezone
                            </span>
                            <span className={`flex items-center gap-1 mt-0.5 font-mono text-[11px] ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                              <Clock className="w-3 h-3 text-sky-400" />
                              {outlet.timezone}
                            </span>
                          </div>

                          <div>
                            <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                              Currency
                            </span>
                            <span className={`flex items-center gap-1 mt-0.5 font-mono text-[11px] ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                              <Coins className="w-3 h-3 text-amber-400" />
                              {outlet.currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Outlet Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
            >
              <div className="flex justify-between items-center pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h2 className="text-base font-bold tracking-tight">Add New Branch Location</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`text-sm cursor-pointer ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-400 hover:text-slate-800"}`}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateOutlet} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Outlet Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Downtown Central"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Physical Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Street, City, Postal Code"
                    value={createFormData.address}
                    onChange={(e) => setCreateFormData({ ...createFormData, address: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Timezone *
                    </label>
                    <SearchableTimezoneSelect
                      value={createFormData.timezone}
                      onChange={(val) => setCreateFormData({ ...createFormData, timezone: val })}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Currency *
                    </label>
                    <SearchableCurrencySelect
                      value={createFormData.currency}
                      onChange={(val) => setCreateFormData({ ...createFormData, currency: val })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingOutlet}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {creatingOutlet ? "Creating..." : "Create Branch"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Outlet Modal */}
        {editingOutlet && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
            >
              <div className="flex justify-between items-center pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h2 className="text-base font-bold tracking-tight">Edit Branch Location</h2>
                <button
                  onClick={() => setEditingOutlet(null)}
                  className={`text-sm cursor-pointer ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-400 hover:text-slate-800"}`}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateOutlet} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Outlet Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Physical Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Street, City, Postal Code"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Timezone *
                    </label>
                    <SearchableTimezoneSelect
                      value={editFormData.timezone}
                      onChange={(val) => setEditFormData({ ...editFormData, timezone: val })}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Currency *
                    </label>
                    <SearchableCurrencySelect
                      value={editFormData.currency}
                      onChange={(val) => setEditFormData({ ...editFormData, currency: val })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setEditingOutlet(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingOutlet}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {updatingOutlet ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Outlet Modal */}
        {deletingOutlet && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <h2 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Remove Branch Location
                  </h2>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Are you sure you want to remove{" "}
                    <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {deletingOutlet.name}
                    </span>
                    ? This will delete this location. If active shifts or employee records are assigned to it, they must be reassigned first.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeletingOutlet(null)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${isDark
                      ? "bg-white/[0.04] text-[#8F95A3] hover:text-white hover:bg-white/[0.08]"
                      : "bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                    }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteOutlet}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm shadow-rose-600/20 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? "Removing..." : "Remove Location"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
