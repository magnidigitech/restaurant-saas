"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Branding {
  applicationName: string;
}

interface Plan {
  id: string;
  name: string;
  maxOutlets: number;
  maxEmployees: number;
  maxAdminUsers: number;
  storageQuotaGb: number;
  priceMonthly?: number;
}

interface Subscription {
  plan: Plan;
}

interface RestaurantModule {
  moduleId: string;
  status: string;
}

interface StaffInvitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
}

interface Restaurant {
  id: string;
  name: string;
  subdomain: string;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  branding?: Branding | null;
  subscriptions: Subscription[];
  modules: RestaurantModule[];
  invitations: StaffInvitation[];
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  userEmail: string;
  newValues: string | null;
  createdAt: string;
}

interface SystemModule {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
}

export default function PlatformAdminDashboard() {
  const router = useRouter();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"tenants" | "onboard" | "modules" | "logs">("tenants");

  // State
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [systemModules, setSystemModules] = useState<SystemModule[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    subdomain: "",
    subscriptionPlanId: "",
    maxOutlets: 2,
    maxEmployees: 30,
    maxAdminUsers: 3,
    storageQuotaGb: 5,
    primaryAdminName: "",
    primaryAdminEmail: "",
  });
  // No modules selected by default
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdInvite, setCreatedInvite] = useState<{ url: string; subdomain: string } | null>(null);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingModuleId, setSavingModuleId] = useState<string | null>(null);

  // Fallback Module List if systemModules is loading
  const availableModules = systemModules.length > 0 ? systemModules.map(m => ({ key: m.id, label: m.name, priceMonthly: Number(m.priceMonthly || 0) })) : [
    { key: "hr_onboarding", label: "HR Onboarding", priceMonthly: 0 },
    { key: "shift_management", label: "Shift Management", priceMonthly: 0 },
    { key: "attendance", label: "Attendance", priceMonthly: 0 },
    { key: "leave_management", label: "Leave Management", priceMonthly: 0 },
    { key: "payroll", label: "Payroll", priceMonthly: 0 },
    { key: "inventory", label: "Inventory", priceMonthly: 0 },
    { key: "vendor_management", label: "Vendor Management", priceMonthly: 0 },
    { key: "purchase_management", label: "Purchase Management", priceMonthly: 0 },
  ];

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTenants, resPlans, resLogs, resModules] = await Promise.all([
        fetch("/api/platform-admin/restaurants"),
        fetch("/api/platform-admin/subscription-plans"),
        fetch("/api/platform-admin/audit-logs"),
        fetch("/api/platform-admin/modules"),
      ]);

      const dataTenants = await resTenants.json();
      const dataPlans = await resPlans.json();
      const dataLogs = await resLogs.json();
      const dataModules = await resModules.json();

      if (resTenants.ok) setRestaurants(dataTenants.restaurants || []);
      if (resPlans.ok) {
        setPlans(dataPlans.plans || []);
        if (dataPlans.plans?.length > 0 && !formData.subscriptionPlanId) {
          setFormData((prev) => ({ ...prev, subscriptionPlanId: dataPlans.plans[0].id }));
        }
      }
      if (resLogs.ok) setLogs(dataLogs.auditLogs || []);
      if (resModules.ok) {
        setSystemModules(
          (dataModules.modules || []).map((m: any) => ({
            ...m,
            priceMonthly: Number(m.priceMonthly ?? 0),
          }))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/platform-admin/auth/logout", { method: "POST" });
    router.push("/platform-admin/login");
    router.refresh();
  };

  // Onboard Submit
  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    setCreatedInvite(null);

    try {
      const res = await fetch("/api/platform-admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          enabledModules: selectedModules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to onboard restaurant");

      // Set invitation details
      // Build dynamic link using host subdomain matching pattern
      const originParts = window.location.origin.split("//");
      const protocol = originParts[0];
      const rootHost = originParts[1].replace("admin.", ""); // strip admin subdomain
      const inviteUrl = `${protocol}//${data.subdomain}.${rootHost}/activate?token=${data.invitationToken}`;

      setCreatedInvite({
        url: inviteUrl,
        subdomain: data.subdomain,
      });

      // Clear Form
      setFormData({
        name: "",
        subdomain: "",
        subscriptionPlanId: plans[0]?.id || "",
        maxOutlets: 2,
        maxEmployees: 30,
        maxAdminUsers: 3,
        storageQuotaGb: 5,
        primaryAdminName: "",
        primaryAdminEmail: "",
      });

      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Error occurred");
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle module entitlement per tenant
  const handleToggleModule = async (restaurantId: string, moduleId: string, currentlyEnabled: boolean) => {
    try {
      const res = await fetch(`/api/platform-admin/restaurants/${restaurantId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          enabled: !currentlyEnabled,
        }),
      });

      if (res.ok) {
        // Update local state instantly
        setRestaurants((prev) =>
          prev.map((r) => {
            if (r.id !== restaurantId) return r;
            const updatedModules = currentlyEnabled
              ? r.modules.filter((m) => m.moduleId !== moduleId)
              : [...r.modules, { moduleId, status: "ACTIVE" }];
            return { ...r, modules: updatedModules };
          })
        );
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update tenant status (suspend/activate/deactivate)
  const handleStatusChange = async (restaurantId: string, newStatus: string) => {
    setStatusLoading(restaurantId);
    try {
      const res = await fetch(`/api/platform-admin/restaurants/${restaurantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setRestaurants((prev) =>
          prev.map((r) => r.id === restaurantId ? { ...r, status: newStatus as Restaurant["status"] } : r)
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStatusLoading(null);
    }
  };

  // Generate / resend an activation invite link for a tenant
  const handleGenerateInvite = async (restaurantId: string, subdomain: string) => {
    setInviteLoadingId(restaurantId);
    try {
      const res = await fetch(`/api/platform-admin/restaurants/${restaurantId}/resend-invite`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate link");

      const protocol = window.location.protocol;
      const rootHost = window.location.host.replace(/^admin\./, "");
      const url = `${protocol}//${subdomain}.${rootHost}/activate?token=${data.token}`;
      setInviteUrls((prev) => ({ ...prev, [restaurantId]: url }));
    } catch (e: any) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setInviteLoadingId(null);
    }
  };

  const handleCopyUrl = (restaurantId: string) => {
    const url = inviteUrls[restaurantId];
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(restaurantId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Plan Selection Syncs limits
  const handlePlanChange = (planId: string) => {
    const selectedPlan = plans.find((p) => p.id === planId);
    if (selectedPlan) {
      setFormData((prev) => ({
        ...prev,
        subscriptionPlanId: planId,
        maxOutlets: selectedPlan.maxOutlets,
        maxEmployees: selectedPlan.maxEmployees,
        maxAdminUsers: selectedPlan.maxAdminUsers,
        storageQuotaGb: selectedPlan.storageQuotaGb,
      }));
    }
  };

  // Update module add-on price
  const handleUpdateModulePrice = async (moduleId: string, newPrice: number) => {
    setSavingModuleId(moduleId);
    try {
      const res = await fetch(`/api/platform-admin/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceMonthly: newPrice }),
      });
      const data = await res.json();
      if (res.ok) {
        setSystemModules((prev) =>
          prev.map((m) => (m.id === moduleId ? { ...m, priceMonthly: Number(data.module?.priceMonthly ?? newPrice) } : m))
        );
      } else {
        alert(data.error || "Failed to update module price");
      }
    } catch (e: any) {
      console.error("Update module price error:", e);
      alert("Error updating module price: " + e.message);
    } finally {
      setSavingModuleId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Banner */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg">B</div>
          <h1 className="text-xl font-bold tracking-tight text-white">Bahubali Platforms</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-2 py-1 rounded bg-slate-900 border border-slate-800">
            Super Admin
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 border-r border-slate-900 p-4 space-y-2 flex flex-col justify-start">
          <button
            onClick={() => setActiveTab("tenants")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === "tenants" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
              }`}
          >
            Manage Tenants
          </button>
          <button
            onClick={() => setActiveTab("onboard")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === "onboard" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
              }`}
          >
            Onboard Tenant
          </button>
          <button
            onClick={() => setActiveTab("modules")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === "modules" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
              }`}
          >
            Module Add-on Pricing
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === "logs" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
              }`}
          >
            Audit Logs
          </button>
        </aside>

        {/* Dashboard Content Panel */}
        <main className="flex-1 p-6 md:p-8 bg-slate-950">
          {loading ? (
            <div className="flex justify-center items-center h-64 text-slate-400 font-semibold">
              Loading platform data...
            </div>
          ) : (
            <>
              {/* Tab 1: Tenants List */}
              {activeTab === "tenants" && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold tracking-tight text-white">Active Tenants</h3>
                  {restaurants.length === 0 ? (
                    <div className="text-slate-500 py-12 text-center border border-dashed border-slate-800 rounded-xl">
                      No restaurant tenants found. Onboard a restaurant to begin.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {restaurants.map((restaurant) => {
                        const sub = restaurant.subscriptions[0];
                        const isExpanded = expandedTenant === restaurant.id;
                        const statusColor = restaurant.status === "ACTIVE"
                          ? "bg-green-950 text-green-200 border-green-800"
                          : restaurant.status === "SUSPENDED"
                            ? "bg-yellow-950 text-yellow-200 border-yellow-800"
                            : "bg-red-950 text-red-200 border-red-800";
                        return (
                          <div
                            key={restaurant.id}
                            className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden hover:border-slate-800 transition-all"
                          >
                            {/* Tenant Card Header - always visible */}
                            <div
                              className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
                              onClick={() => setExpandedTenant(isExpanded ? null : restaurant.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-900/60 border border-blue-800 flex items-center justify-center font-bold text-blue-300 uppercase">
                                  {restaurant.name.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="text-base font-bold text-white leading-tight">{restaurant.name}</h4>
                                  <p className="text-xs text-slate-500 font-mono">{restaurant.subdomain}.yourplatform.com</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${statusColor}`}>
                                  {restaurant.status}
                                </span>
                                <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-blue-950 text-blue-200 border border-blue-800">
                                  {sub?.plan.name || "No Plan"}
                                </span>
                                <svg
                                  className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>

                            {/* Expanded Details Panel */}
                            {isExpanded && (
                              <div className="border-t border-slate-900 p-5 space-y-5 bg-slate-950/40">
                                {/* Plan Limits */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  {[
                                    { label: "Outlets", value: sub?.plan.maxOutlets ?? 0 },
                                    { label: "Employees", value: sub?.plan.maxEmployees ?? 0 },
                                    { label: "Admins", value: sub?.plan.maxAdminUsers ?? 0 },
                                    { label: "Storage", value: `${sub?.plan.storageQuotaGb ?? 0} GB` },
                                  ].map((item) => (
                                    <div key={item.label} className="bg-slate-900/50 rounded-lg p-3 border border-slate-900">
                                      <span className="text-slate-500 text-xs block mb-1">{item.label} Limit</span>
                                      <span className="font-bold text-slate-200">{item.value}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* Module Toggles */}
                                <div>
                                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">
                                    Active Modules (click to toggle)
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {availableModules.map((mod) => {
                                      const isEnabled = restaurant.modules.some((rm) => rm.moduleId === mod.key);
                                      return (
                                        <button
                                          key={mod.key}
                                          onClick={() => handleToggleModule(restaurant.id, mod.key, isEnabled)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${isEnabled
                                              ? "bg-blue-950 text-blue-200 border-blue-800 hover:bg-red-950 hover:text-red-200 hover:border-red-800"
                                              : "bg-slate-950 text-slate-500 border-slate-900 hover:border-green-800 hover:text-green-200 hover:bg-green-950"
                                            }`}
                                          title={isEnabled ? `Disable ${mod.label}` : `Enable ${mod.label}`}
                                        >
                                          {mod.label} {isEnabled ? "✓" : "+"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Status Management */}
                                <div>
                                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">
                                    Tenant Status
                                  </span>
                                  <div className="flex gap-2 flex-wrap">
                                    {(["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const).map((s) => (
                                      <button
                                        key={s}
                                        disabled={restaurant.status === s || statusLoading === restaurant.id}
                                        onClick={() => handleStatusChange(restaurant.id, s)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${s === "ACTIVE" ? "border-green-800 text-green-200 hover:bg-green-950" :
                                            s === "SUSPENDED" ? "border-yellow-800 text-yellow-200 hover:bg-yellow-950" :
                                              "border-red-800 text-red-200 hover:bg-red-950"
                                          } ${restaurant.status === s ? "bg-slate-900" : "bg-transparent"}`}
                                      >
                                        {statusLoading === restaurant.id ? "Saving..." : s}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Invite Link */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                                      Admin Activation URL
                                    </span>
                                    {restaurant.invitations.length > 0 && (
                                      <span className="text-xs text-slate-500">
                                        Pending invite for: <span className="text-slate-300">{restaurant.invitations[0].email}</span>
                                      </span>
                                    )}
                                  </div>

                                  {inviteUrls[restaurant.id] ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-lg border border-blue-900">
                                        <input
                                          readOnly
                                          value={inviteUrls[restaurant.id]}
                                          className="w-full bg-transparent text-xs text-blue-300 font-mono focus:outline-none selection:bg-blue-900"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleCopyUrl(restaurant.id)}
                                          className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${copiedId === restaurant.id
                                              ? "bg-green-950 border-green-800 text-green-200"
                                              : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                            }`}
                                        >
                                          {copiedId === restaurant.id ? "✓ Copied!" : "Copy URL"}
                                        </button>
                                        <button
                                          onClick={() => handleGenerateInvite(restaurant.id, restaurant.subdomain)}
                                          disabled={inviteLoadingId === restaurant.id}
                                          className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-40"
                                        >
                                          {inviteLoadingId === restaurant.id ? "Generating..." : "↻ Regenerate"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleGenerateInvite(restaurant.id, restaurant.subdomain)}
                                      disabled={inviteLoadingId === restaurant.id || restaurant.invitations.length === 0}
                                      className="w-full py-2.5 text-sm font-semibold rounded-lg border border-blue-800 text-blue-300 hover:bg-blue-950 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {inviteLoadingId === restaurant.id
                                        ? "Generating link..."
                                        : restaurant.invitations.length === 0
                                          ? "No pending invitation"
                                          : "Generate Activation Link"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Onboard Tenant Form */}
              {activeTab === "onboard" && (
                <div className="max-w-3xl space-y-6">
                  <h3 className="text-2xl font-bold tracking-tight text-white">Onboard New Restaurant</h3>

                  {formError && (
                    <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
                      {formError}
                    </div>
                  )}

                  {createdInvite && (
                    <div className="bg-green-950/30 border border-green-800 text-green-100 p-6 rounded-2xl space-y-3">
                      <h4 className="font-bold text-green-200 text-lg">Restaurant Onboarding Initiated!</h4>
                      <p className="text-sm">
                        Restaurant has been set up under subdomain <span className="text-blue-400 font-bold">{createdInvite.subdomain}</span>. Provide this activation invitation link to the primary administrator:
                      </p>
                      <div className="flex items-center space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-900 mt-2">
                        <input
                          readOnly
                          value={createdInvite.url}
                          className="w-full bg-transparent text-sm focus:outline-none text-blue-300 selection:bg-blue-900 font-mono"
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(createdInvite.url)}
                          className="px-3 py-1 bg-slate-900 text-xs font-bold rounded border border-slate-800 hover:bg-slate-850 cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleOnboard} className="space-y-6 bg-slate-900/10 border border-slate-900 p-6 rounded-2xl backdrop-blur-md">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Restaurant Name</label>
                        <input
                          required
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Coyote Grill"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Subdomain</label>
                        <div className="flex items-center">
                          <input
                            required
                            value={formData.subdomain}
                            onChange={(e) => setFormData((prev) => ({ ...prev, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                            placeholder="coyote"
                            className="w-full px-4 py-2.5 rounded-l-lg border border-r-0 border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <span className="bg-slate-900 border border-l-0 border-slate-800 px-3 py-2.5 rounded-r-lg text-sm text-slate-400 font-mono">
                            .yourplatform.com
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Plan</label>
                        <select
                          value={formData.subscriptionPlanId}
                          onChange={(e) => handlePlanChange(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.priceMonthly || 0}/mo)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Storage (GB)</label>
                        <input
                          type="number"
                          value={formData.storageQuotaGb}
                          onChange={(e) => setFormData((prev) => ({ ...prev, storageQuotaGb: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Max Outlets</label>
                        <input
                          type="number"
                          value={formData.maxOutlets}
                          onChange={(e) => setFormData((prev) => ({ ...prev, maxOutlets: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-505 uppercase block mb-1">Max Employees</label>
                        <input
                          type="number"
                          value={formData.maxEmployees}
                          onChange={(e) => setFormData((prev) => ({ ...prev, maxEmployees: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Max Admins</label>
                        <input
                          type="number"
                          value={formData.maxAdminUsers}
                          onChange={(e) => setFormData((prev) => ({ ...prev, maxAdminUsers: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-200"
                        />
                      </div>
                    </div>

                    <hr className="border-slate-900" />

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Primary Administrator Name</label>
                        <input
                          required
                          value={formData.primaryAdminName}
                          onChange={(e) => setFormData((prev) => ({ ...prev, primaryAdminName: e.target.value }))}
                          placeholder="John Doe"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Primary Admin Email</label>
                        <input
                          required
                          type="email"
                          value={formData.primaryAdminEmail}
                          onChange={(e) => setFormData((prev) => ({ ...prev, primaryAdminEmail: e.target.value }))}
                          placeholder="owner@coyotegrill.com"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>

                    <hr className="border-slate-900" />

                    {/* Module entitlements checkboxes */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-semibold text-slate-400 uppercase block">Enable Modules (Add-ons)</label>
                        <span className="text-xs text-slate-500 font-semibold">
                          Selected: {selectedModules.length} module(s)
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {availableModules.map((mod) => {
                          const isChecked = selectedModules.includes(mod.key);
                          const price = mod.priceMonthly || 0;
                          return (
                            <label
                              key={mod.key}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer select-none ${isChecked
                                  ? "bg-blue-950/30 border-blue-800/80 text-blue-200"
                                  : "bg-slate-950/50 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-300"
                                }`}
                            >
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedModules((prev) =>
                                      isChecked ? prev.filter((k) => k !== mod.key) : [...prev, mod.key]
                                    );
                                  }}
                                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                                />
                                <span className="text-sm font-semibold">{mod.label}</span>
                              </div>
                              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${price > 0 ? "bg-blue-950 text-blue-300 border border-blue-800" : "bg-slate-900 text-slate-500"
                                }`}>
                                {price > 0 ? `+$${price}/mo` : "$0/mo"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pricing Summary */}
                    {(() => {
                      const selectedPlan = plans.find((p) => p.id === formData.subscriptionPlanId);
                      const basePrice = Number(selectedPlan?.priceMonthly || 0);
                      const addOnPrice = selectedModules.reduce((acc, key) => {
                        const m = availableModules.find((mod) => mod.key === key);
                        return acc + Number(m?.priceMonthly || 0);
                      }, 0);
                      const totalPrice = basePrice + addOnPrice;

                      return (
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-sm">
                          <div>
                            <span className="text-slate-400 font-semibold block">Total Subscription & Add-on Price:</span>
                            <span className="text-xs text-slate-500">
                              Base ({selectedPlan?.name || "Plan"}): ${basePrice}/mo &bull; Add-ons ({selectedModules.length}): +${addOnPrice}/mo
                            </span>
                          </div>
                          <span className="text-xl font-extrabold text-blue-400 font-mono">
                            ${totalPrice}/mo
                          </span>
                        </div>
                      );
                    })()}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {formLoading ? "Creating tenant workspace..." : "Onboard Restaurant"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tab 3: Module Add-on Pricing Settings */}
              {activeTab === "modules" && (
                <div className="space-y-6 max-w-4xl">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-white">Module Add-on Pricing</h3>
                    <p className="text-sm text-slate-400 mt-1">Configure monthly add-on fees for each operational module.</p>
                  </div>

                  {systemModules.length === 0 ? (
                    <div className="text-slate-500 py-12 text-center border border-dashed border-slate-800 rounded-xl">
                      No system modules found. Run seeding to populate initial modules.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {systemModules.map((mod) => (
                        <div
                          key={mod.id}
                          className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-slate-800 transition-all"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-3">
                              <h4 className="text-lg font-bold text-white">{mod.name}</h4>
                              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-blue-400 border border-slate-800">
                                {mod.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">{mod.description || "No description."}</p>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-1 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                              <span className="text-xs text-slate-500 font-bold">$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={mod.priceMonthly ?? 0}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const val = raw === "" ? 0 : parseFloat(raw);
                                  setSystemModules((prev) =>
                                    prev.map((m) => (m.id === mod.id ? { ...m, priceMonthly: isNaN(val) ? 0 : val } : m))
                                  );
                                }}
                                className="w-20 bg-transparent text-sm font-bold font-mono text-white focus:outline-none"
                              />
                              <span className="text-xs text-slate-500 font-semibold">/mo</span>
                            </div>
                            <button
                              onClick={() => handleUpdateModulePrice(mod.id, Number(mod.priceMonthly))}
                              disabled={savingModuleId === mod.id}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
                            >
                              {savingModuleId === mod.id ? "Saving..." : "Save Price"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: System Audit Logs */}
              {activeTab === "logs" && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold tracking-tight text-white">System Audit Log</h3>
                  {logs.length === 0 ? (
                    <div className="text-slate-500 py-12 text-center border border-dashed border-slate-800 rounded-xl">
                      No system audit logs found.
                    </div>
                  ) : (
                    <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">Actor</th>
                            <th className="p-4">Action</th>
                            <th className="p-4">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-sm">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-900/10">
                              <td className="p-4 font-mono text-xs text-slate-400">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="p-4 text-slate-300 font-semibold">{log.userEmail}</td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-950 border border-slate-800 text-blue-400">
                                  {log.action}
                                </span>
                              </td>
                              <td className="p-4 text-slate-400 text-xs truncate max-w-xs md:max-w-md" title={log.newValues || ""}>
                                {log.newValues || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
