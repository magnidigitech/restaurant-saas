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

interface Restaurant {
  id: string;
  name: string;
  subdomain: string;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  branding?: Branding | null;
  subscriptions: Subscription[];
  modules: RestaurantModule[];
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

export default function PlatformAdminDashboard() {
  const router = useRouter();
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"tenants" | "onboard" | "logs">("tenants");

  // State
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
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
  const [selectedModules, setSelectedModules] = useState<string[]>([
    "hr_onboarding",
    "inventory",
  ]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdInvite, setCreatedInvite] = useState<{ url: string; subdomain: string } | null>(null);

  // Module List
  const availableModules = [
    { key: "hr_onboarding", label: "HR Onboarding" },
    { key: "shift_management", label: "Shift Management" },
    { key: "attendance", label: "Attendance" },
    { key: "leave_management", label: "Leave Management" },
    { key: "payroll", label: "Payroll" },
    { key: "inventory", label: "Inventory" },
    { key: "vendor_management", label: "Vendor Management" },
    { key: "purchase_management", label: "Purchase Management" },
  ];

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTenants, resPlans, resLogs] = await Promise.all([
        fetch("/api/platform-admin/restaurants"),
        fetch("/api/platform-admin/subscription-plans"),
        fetch("/api/platform-admin/audit-logs"),
      ]);

      const dataTenants = await resTenants.json();
      const dataPlans = await resPlans.json();
      const dataLogs = await resLogs.json();

      if (resTenants.ok) setRestaurants(dataTenants.restaurants || []);
      if (resPlans.ok) {
        setPlans(dataPlans.plans || []);
        if (dataPlans.plans?.length > 0 && !formData.subscriptionPlanId) {
          setFormData((prev) => ({ ...prev, subscriptionPlanId: dataPlans.plans[0].id }));
        }
      }
      if (resLogs.ok) setLogs(dataLogs.auditLogs || []);
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
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "tenants" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
            }`}
          >
            Manage Tenants
          </button>
          <button
            onClick={() => setActiveTab("onboard")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "onboard" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
            }`}
          >
            Onboard Tenant
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "logs" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
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
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold tracking-tight text-white">Active Tenants</h3>
                  {restaurants.length === 0 ? (
                    <div className="text-slate-500 py-12 text-center border border-dashed border-slate-800 rounded-xl">
                      No restaurant tenants found. Onboard a restaurant to begin.
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {restaurants.map((restaurant) => {
                        const sub = restaurant.subscriptions[0];
                        return (
                          <div
                            key={restaurant.id}
                            className="bg-slate-900/30 border border-slate-900 p-6 rounded-2xl space-y-4 hover:border-slate-800 transition-all"
                          >
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                              <div>
                                <h4 className="text-xl font-bold text-white">{restaurant.name}</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                  Domain: <span className="text-blue-400 font-semibold">{restaurant.subdomain}.yourplatform.com</span>
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-green-950 text-green-200 border border-green-800">
                                  {restaurant.status}
                                </span>
                                <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-blue-950 text-blue-200 border border-blue-800">
                                  Plan: {sub?.plan.name || "None"}
                                </span>
                              </div>
                            </div>

                            <hr className="border-slate-900" />

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-slate-500 block">Outlets Limit</span>
                                <span className="font-semibold text-slate-200">{sub?.plan.maxOutlets || 0}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Employees Limit</span>
                                <span className="font-semibold text-slate-200">{sub?.plan.maxEmployees || 0}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Admin Limit</span>
                                <span className="font-semibold text-slate-200">{sub?.plan.maxAdminUsers || 0}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Storage Limit</span>
                                <span className="font-semibold text-slate-200">{sub?.plan.storageQuotaGb || 0} GB</span>
                              </div>
                            </div>

                            <hr className="border-slate-900" />

                            {/* Modules entitlement configuration */}
                            <div>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">
                                Modules Entitled
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {availableModules.map((mod) => {
                                  const isEnabled = restaurant.modules.some((rm) => rm.moduleId === mod.key);
                                  return (
                                    <button
                                      key={mod.key}
                                      onClick={() => handleToggleModule(restaurant.id, mod.key, isEnabled)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                        isEnabled
                                          ? "bg-blue-950 text-blue-200 border-blue-800 hover:bg-blue-900/50"
                                          : "bg-slate-950 text-slate-500 border-slate-900 hover:border-slate-800 hover:text-slate-300"
                                      }`}
                                    >
                                      {mod.label} {isEnabled ? "✓" : "+"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
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
                      <label className="text-xs font-semibold text-slate-400 uppercase block mb-3">Enable Modules</label>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {availableModules.map((mod) => {
                          const isChecked = selectedModules.includes(mod.key);
                          return (
                            <label
                              key={mod.key}
                              className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                                isChecked
                                  ? "bg-blue-950/20 border-blue-800/80 text-blue-200"
                                  : "bg-slate-950/50 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-300"
                              }`}
                            >
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
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4">
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

              {/* Tab 3: System Audit Logs */}
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
