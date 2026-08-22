"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

// --- Types ---
interface Branding {
  applicationName: string;
  primaryColor?: string;
  logoUrl?: string | null;
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
  module?: { id: string; name: string };
}

interface StaffInvitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface UserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  tokenVersion: number;
}

interface MembershipSummary {
  id: string;
  user: UserSummary;
}

interface Restaurant {
  id: string;
  name: string;
  subdomain: string;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  branding?: Branding | null;
  subscriptions: Subscription[];
  modules: RestaurantModule[];
  memberships?: MembershipSummary[];
  invitations: StaffInvitation[];
  _count?: {
    outlets: number;
    employees: number;
    memberships: number;
  };
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

export const UNIFIED_CORE_MODULES = [
  {
    id: "inventory",
    name: "Inventory & Supply Chain",
    desc: "Item Masters, Stock Ledger, Recipes, Vendors & Purchase Orders",
    subIds: ["inventory", "vendor_management", "purchase_management"],
  },
  {
    id: "attendance",
    name: "Time & Attendance",
    desc: "Punch Clock Kiosk, Live Timesheets & Leave Management",
    subIds: ["attendance", "leave_management"],
  },
  {
    id: "workforce",
    name: "Staff & Workforce",
    desc: "Employee Profiles, Code Sequences & HR Onboarding",
    subIds: ["hr_onboarding"],
  },
  {
    id: "shifts",
    name: "Shift Scheduling & Rosters",
    desc: "Weekly Visual Roster Planner & Timing Templates",
    subIds: ["shifts", "shift_management"],
  },
  {
    id: "payroll",
    name: "Payroll & Compensation",
    desc: "Attendance-Driven Pay Runs, Allowances & Payslips",
    subIds: ["payroll"],
  },
  {
    id: "pos",
    name: "Point of Sale (POS)",
    desc: "Table Ordering, Menu Catalog & Bill Settlement",
    subIds: ["pos"],
  },
  {
    id: "finance",
    name: "Finance & P&L Tracker",
    desc: "Real-time P&L Intelligence & Automated Expense Sync",
    subIds: ["finance"],
  },
  {
    id: "analytics",
    name: "Analytics & Menu Engineering",
    desc: "Menu Matrix (Stars/Dogs) & Food Profitability",
    subIds: ["analytics"],
  },
  {
    id: "vault",
    name: "Secrets Vault & 2FA",
    desc: "Encrypted Credential Vault & 2FA Authenticator",
    subIds: ["vault"],
  },
];

export default function ApplePlatformAdminDashboard() {
  const router = useRouter();

  // --- Theme State (Default: Light Theme, Persisted in LocalStorage) ---
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("platform_admin_theme") as "light" | "dark" | null;
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    } else {
      setTheme("light");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("platform_admin_theme", nextTheme);
  };

  const isDark = theme === "dark";

  // Navigation
  const [activeTab, setActiveTab] = useState<"tenants" | "onboard" | "modules" | "logs">("tenants");

  // Data
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [systemModules, setSystemModules] = useState<SystemModule[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  // Operation States
  const [moduleLoadingId, setModuleLoadingId] = useState<string | null>(null);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null);
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" } | null>(null);

  // Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTenant, setResetTenant] = useState<Restaurant | null>(null);
  const [resetTargetEmail, setResetTargetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetInvalidateSessions, setResetInvalidateSessions] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; pass: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Limits Modal
  const [limitsModalOpen, setLimitsModalOpen] = useState(false);
  const [limitsTenant, setLimitsTenant] = useState<Restaurant | null>(null);
  const [editMaxOutlets, setEditMaxOutlets] = useState(2);
  const [editMaxEmployees, setEditMaxEmployees] = useState(30);
  const [editMaxAdmins, setEditMaxAdmins] = useState(3);
  const [editStorageQuota, setEditStorageQuota] = useState(5);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  // Module Pricing
  const [pricingInputs, setPricingInputs] = useState<Record<string, number>>({});
  const [pricingSaving, setPricingSaving] = useState<string | null>(null);

  // Onboarding
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
    "inventory",
    "attendance",
    "workforce",
    "shifts",
    "payroll",
    "pos",
    "finance",
  ]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdInvite, setCreatedInvite] = useState<{ url: string; subdomain: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      const [resTenants, resPlans, resModules, resLogs] = await Promise.all([
        fetch("/api/platform-admin/restaurants"),
        fetch("/api/platform-admin/subscription-plans"),
        fetch("/api/platform-admin/modules"),
        fetch("/api/platform-admin/audit-logs"),
      ]);

      const dataTenants = resTenants.ok ? (await resTenants.json()).restaurants || [] : [];
      const dataPlans = resPlans.ok ? (await resPlans.json()).plans || [] : [];
      const dataModules = resModules.ok ? (await resModules.json()).modules || [] : [];
      const dataLogs = resLogs.ok ? (await resLogs.json()).logs || [] : [];

      setRestaurants(dataTenants);
      setPlans(dataPlans);
      setSystemModules(dataModules);
      setLogs(dataLogs);

      const initialPricing: Record<string, number> = {};
      UNIFIED_CORE_MODULES.forEach((u) => {
        const matching =
          dataModules.find((m: SystemModule) => u.subIds.includes(m.id) && Number(m.priceMonthly) > 0) ||
          dataModules.find((m: SystemModule) => m.id === u.id);
        initialPricing[u.id] = matching ? Number(matching.priceMonthly) : 0;
      });
      setPricingInputs(initialPricing);

      if (dataPlans.length > 0 && !formData.subscriptionPlanId) {
        const defaultPlan = dataPlans[0];
        setFormData((prev) => ({
          ...prev,
          subscriptionPlanId: defaultPlan.id,
          maxOutlets: defaultPlan.maxOutlets,
          maxEmployees: defaultPlan.maxEmployees,
          maxAdminUsers: defaultPlan.maxAdminUsers,
          storageQuotaGb: defaultPlan.storageQuotaGb,
        }));
      }

      if (dataTenants.length > 0 && !expandedTenant) {
        setExpandedTenant(dataTenants[0].id);
      }
    } catch {
      // ignore
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

  // Toggle Module
  const handleToggleModule = async (restaurantId: string, moduleId: string, currentStatus: string) => {
    setModuleLoadingId(`${restaurantId}-${moduleId}`);
    const nextEnabled = currentStatus !== "ACTIVE";

    try {
      const res = await fetch(`/api/platform-admin/restaurants/${restaurantId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, enabled: nextEnabled }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update module entitlement");
      }

      showToast(`Module updated successfully`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setModuleLoadingId(null);
    }
  };

  // Status Change
  const handleStatusChange = async (restaurantId: string, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => {
    setStatusLoadingId(restaurantId);
    try {
      const res = await fetch(`/api/platform-admin/restaurants/${restaurantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      showToast(`Tenant status updated to ${status}`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setStatusLoadingId(null);
    }
  };

  // Generate / Resend Invite
  const handleGenerateInvite = async (restaurantId: string, email?: string) => {
    setInviteLoadingId(restaurantId);
    try {
      const res = await fetch(`/api/platform-admin/restaurants/${restaurantId}/generate-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email && email !== "No admin user" ? email : undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate invite token");

      const fullUrl = `${window.location.origin}/activate?token=${data.token}&subdomain=${data.subdomain}`;
      setInviteUrls((prev) => ({ ...prev, [restaurantId]: fullUrl }));
      await navigator.clipboard.writeText(fullUrl);
      showToast("Activation link copied to clipboard");
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setInviteLoadingId(null);
    }
  };

  const generateStrongPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetNewPassword(pass);
  };

  const openPasswordResetModal = (t: Restaurant) => {
    setResetTenant(t);
    const firstAdmin = t.memberships?.[0]?.user?.email || t.invitations?.[0]?.email || `admin@${t.subdomain}.com`;
    setResetTargetEmail(firstAdmin);
    setResetNewPassword("");
    setResetInvalidateSessions(true);
    setResetResult(null);
    setResetError(null);
    setResetModalOpen(true);
  };

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTenant) return;
    setResetLoading(true);
    setResetError(null);

    try {
      const res = await fetch(`/api/platform-admin/restaurants/${resetTenant.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: resetTargetEmail,
          newPassword: resetNewPassword,
          invalidateSessions: resetInvalidateSessions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      setResetResult({
        email: resetTargetEmail,
        pass: resetNewPassword,
      });
      showToast("Administrator password updated");
      fetchData();
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const openLimitsModal = (t: Restaurant) => {
    setLimitsTenant(t);
    const plan = t.subscriptions?.[0]?.plan;
    setEditMaxOutlets(plan?.maxOutlets || 2);
    setEditMaxEmployees(plan?.maxEmployees || 30);
    setEditMaxAdmins(plan?.maxAdminUsers || 3);
    setEditStorageQuota(plan?.storageQuotaGb || 5);
    setLimitsError(null);
    setLimitsModalOpen(true);
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitsTenant) return;
    setLimitsLoading(true);
    setLimitsError(null);

    try {
      const res = await fetch(`/api/platform-admin/restaurants/${limitsTenant.id}/limits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxOutlets: Number(editMaxOutlets),
          maxEmployees: Number(editMaxEmployees),
          maxAdminUsers: Number(editMaxAdmins),
          storageQuotaGb: Number(editStorageQuota),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update limits");

      setLimitsModalOpen(false);
      showToast("Resource limits updated");
      fetchData();
    } catch (err: any) {
      setLimitsError(err.message);
    } finally {
      setLimitsLoading(false);
    }
  };

  const handleSavePricing = async (moduleId: string) => {
    setPricingSaving(moduleId);
    try {
      const price = pricingInputs[moduleId] || 0;
      const unified = UNIFIED_CORE_MODULES.find((u) => u.id === moduleId);
      const targetIds = unified ? unified.subIds : [moduleId];

      await Promise.all(
        targetIds.map((id) =>
          fetch(`/api/platform-admin/modules/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceMonthly: price }),
          })
        )
      );

      showToast(`Module price saved: $${price}/mo`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setPricingSaving(null);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      const expandedModules: string[] = [];
      selectedModules.forEach((mId) => {
        const unified = UNIFIED_CORE_MODULES.find((u) => u.id === mId);
        if (unified) {
          expandedModules.push(...unified.subIds);
        } else {
          expandedModules.push(mId);
        }
      });
      const uniqueEnabledModules = Array.from(new Set(expandedModules));

      const res = await fetch("/api/platform-admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          enabledModules: uniqueEnabledModules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onboarding failed");

      const targetSubdomain = data.subdomain || data.restaurant?.subdomain || formData.subdomain;
      const targetUrl =
        data.activationUrl ||
        `${window.location.origin}/activate?token=${data.invitationToken || data.token}&subdomain=${targetSubdomain}`;

      setCreatedInvite({
        url: targetUrl.startsWith("http") ? targetUrl : `${window.location.origin}${targetUrl}`,
        subdomain: targetSubdomain,
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.memberships?.some((m) => m.user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.invitations?.some((i) => i.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [restaurants, searchQuery, statusFilter]);

  const totalTenants = restaurants.length;
  const activeTenants = restaurants.filter((r) => r.status === "ACTIVE").length;
  const totalOutlets = restaurants.reduce((acc, r) => acc + (r._count?.outlets || 0), 0);
  const totalEmployees = restaurants.reduce((acc, r) => acc + (r._count?.employees || 0), 0);

  return (
    <div
      className={`min-h-screen font-sans antialiased selection:bg-blue-500 selection:text-white flex flex-col transition-colors duration-200 ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      {/* Apple-Style Floating Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border text-xs font-semibold flex items-center gap-2.5 transition-all duration-300 ${
            toast.type === "error"
              ? isDark
                ? "bg-rose-950/90 text-rose-200 border-rose-800/80 shadow-rose-950/50"
                : "bg-rose-50 text-rose-900 border-rose-200 shadow-rose-900/10"
              : isDark
              ? "bg-[#161B26]/90 text-emerald-300 border-emerald-500/30 shadow-black/80"
              : "bg-white/95 text-emerald-800 border-emerald-500/30 shadow-slate-900/10"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-2xl border-b px-6 py-3.5 transition-colors ${
          isDark
            ? "bg-[#090B10]/80 border-white/[0.06]"
            : "bg-white/80 border-black/[0.06] shadow-sm shadow-slate-900/5"
        }`}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#0071E3] to-[#0051A8] flex items-center justify-center font-bold text-white shadow-sm shadow-blue-500/30">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-sm font-semibold tracking-tight ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                  Bahubali Platforms
                </h1>
                <span
                  className={`text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full border ${
                    isDark
                      ? "bg-white/[0.06] text-[#9BA1B0] border-white/[0.08]"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  Platform Super Admin
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Apple Sliding Sun / Moon Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? "Light" : "Dark"} theme`}
              title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
              className={`relative inline-flex h-7 w-14 items-center rounded-full p-0.5 transition-colors duration-300 focus:outline-none cursor-pointer ${
                isDark
                  ? "bg-[#181C28] border border-white/[0.12]"
                  : "bg-[#E5E5EA] border border-black/[0.08]"
              }`}
            >
              {/* Sliding Thumb */}
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full shadow-md transition-transform duration-300 ease-in-out flex items-center justify-center ${
                  isDark
                    ? "translate-x-7 bg-[#2E354B] text-blue-200"
                    : "translate-x-0.5 bg-white text-amber-500 shadow-slate-900/10"
                }`}
              >
                {isDark ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </span>

              {/* Sun Icon Placeholder (Left) */}
              <span className="flex-1 flex justify-center text-slate-400">
                <svg className={`w-3.5 h-3.5 transition-opacity ${!isDark ? "opacity-0" : "opacity-40"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>

              {/* Moon Icon Placeholder (Right) */}
              <span className="flex-1 flex justify-center text-slate-400">
                <svg className={`w-3.5 h-3.5 transition-opacity ${isDark ? "opacity-0" : "opacity-40"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </span>
            </button>

            <div
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium ${
                isDark
                  ? "bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Production Live</span>
            </div>

            <button
              onClick={handleLogout}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                isDark
                  ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-6">
        {/* macOS Style Segmented Control Tabs */}
        <div
          className={`flex justify-between items-center flex-wrap gap-4 border-b pb-4 ${
            isDark ? "border-white/[0.06]" : "border-slate-200"
          }`}
        >
          <div
            className={`inline-flex p-1 rounded-xl border ${
              isDark ? "bg-[#121622] border-white/[0.06]" : "bg-[#E5E5EA] border-slate-200/80"
            }`}
          >
            {[
              { id: "tenants", label: "Tenants", count: totalTenants },
              { id: "onboard", label: "Onboard Restaurant" },
              { id: "modules", label: "Add-on Catalog" },
              { id: "logs", label: "Audit Logs", count: logs.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setCreatedInvite(null);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium tracking-tight transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === tab.id
                    ? isDark
                      ? "bg-[#252B3B] text-white shadow-sm font-semibold"
                      : "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                    : isDark
                    ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.02]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-black/[0.03]"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      activeTab === tab.id
                        ? isDark
                          ? "bg-white/[0.12] text-white"
                          : "bg-slate-100 text-slate-700"
                        : isDark
                        ? "bg-white/[0.04] text-[#8F95A3]"
                        : "bg-black/[0.04] text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className={`text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
            Multi-Tenant Isolation: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Strict Encapsulation</span>
          </div>
        </div>

        {/* TAB 1: TENANTS */}
        {activeTab === "tenants" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className={`p-5 rounded-2xl border transition ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06]"
                    : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
                }`}
              >
                <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Total Tenants
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {totalTenants}
                  </p>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ({activeTenants} Active)
                  </span>
                </div>
              </div>

              <div
                className={`p-5 rounded-2xl border transition ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06]"
                    : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
                }`}
              >
                <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Outlets Provisioned
                </p>
                <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {totalOutlets}
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border transition ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06]"
                    : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
                }`}
              >
                <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Employees Managed
                </p>
                <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {totalEmployees}
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border transition ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06]"
                    : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
                }`}
              >
                <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Session Guard
                </p>
                <p className="text-2xl font-bold text-[#0071E3] tracking-tight mt-1">Token-Versioned</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div
              className={`flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-2.5 rounded-2xl border ${
                isDark
                  ? "bg-[#121622]/40 border-white/[0.06]"
                  : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
              }`}
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search restaurants, subdomains, or admin emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full rounded-xl px-4 py-2 text-xs transition focus:outline-none focus:border-blue-500 border ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500 ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-[#C5C9D3]"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-700"
                  }`}
                >
                  <option value="ALL">All Statuses ({restaurants.length})</option>
                  <option value="ACTIVE">Active ({activeTenants})</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DEACTIVATED">Deactivated</option>
                </select>

                <button
                  onClick={() => setActiveTab("onboard")}
                  className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-sm whitespace-nowrap"
                >
                  + Add Restaurant
                </button>
              </div>
            </div>

            {/* Restaurant Accordion List */}
            {loading ? (
              <div className={`text-center py-20 text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Loading tenant records...
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <div
                className={`border rounded-2xl p-12 text-center text-xs ${
                  isDark
                    ? "bg-[#121622]/30 border-white/[0.06] text-[#8F95A3]"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                No matching restaurants found.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRestaurants.map((restaurant) => {
                  const isExpanded = expandedTenant === restaurant.id;
                  const subPlan = restaurant.subscriptions?.[0]?.plan;
                  const primaryAdminEmail =
                    restaurant.memberships?.[0]?.user?.email ||
                    restaurant.invitations?.[0]?.email ||
                    "No admin user";
                  const hasActiveUser = (restaurant.memberships?.length || 0) > 0;

                  return (
                    <div
                      key={restaurant.id}
                      className={`border rounded-2xl overflow-hidden transition ${
                        isDark
                          ? "bg-[#121622]/60 border-white/[0.06]"
                          : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
                      }`}
                    >
                      {/* Tenant Row Header */}
                      <div
                        onClick={() => setExpandedTenant(isExpanded ? null : restaurant.id)}
                        className={`p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer transition ${
                          isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/70"
                        }`}
                      >
                        <div className="flex items-center space-x-3.5">
                          {restaurant.branding?.logoUrl ? (
                            <div className={`w-10 h-10 rounded-xl p-1 flex items-center justify-center border shadow-xs flex-shrink-0 ${
                              isDark ? "bg-white/[0.06] border-white/[0.08]" : "bg-white border-slate-200"
                            }`}>
                              <img
                                src={restaurant.branding.logoUrl}
                                alt={restaurant.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-sm flex-shrink-0"
                              style={{
                                backgroundColor:
                                  restaurant.branding?.primaryColor &&
                                  restaurant.branding.primaryColor.toLowerCase() !== "#ffffff" &&
                                  restaurant.branding.primaryColor.toLowerCase() !== "#fff"
                                    ? restaurant.branding.primaryColor
                                    : "#0071E3",
                              }}
                            >
                              {restaurant.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3
                                className={`text-sm font-semibold tracking-tight ${
                                  isDark ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {restaurant.name}
                              </h3>
                              {restaurant.branding?.applicationName && (
                                <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                  • {restaurant.branding.applicationName}
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-xs font-mono mt-0.5 ${
                                isDark ? "text-[#8F95A3]" : "text-slate-500"
                              }`}
                            >
                              {restaurant.subdomain}.yourplatform.com{" "}
                              <span className={`font-sans ${isDark ? "text-[#555C6D]" : "text-slate-400"}`}>
                                • {primaryAdminEmail}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
                          <span
                            className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${
                              restaurant.status === "ACTIVE"
                                ? isDark
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : restaurant.status === "SUSPENDED"
                                ? isDark
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                                : isDark
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {restaurant.status}
                          </span>

                          <span
                            className={`text-[10px] font-medium uppercase px-2.5 py-0.5 rounded-full border ${
                              isDark
                                ? "bg-white/[0.04] text-[#9BA1B0] border-white/[0.08]"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {subPlan?.name || "Standard"}
                          </span>

                          <span className={`text-xs font-mono pl-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            {isExpanded ? "−" : "+"}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Settings Panel */}
                      {isExpanded && (
                        <div
                          className={`border-t p-6 space-y-6 ${
                            isDark
                              ? "border-white/[0.06] bg-[#0B0E15]/60"
                              : "border-slate-200 bg-[#FAFAFC]"
                          }`}
                        >
                          {/* Limits Row */}
                          <div>
                            <div className="flex justify-between items-center mb-2.5">
                              <span
                                className={`text-[11px] font-medium uppercase tracking-wider ${
                                  isDark ? "text-[#8F95A3]" : "text-slate-500"
                                }`}
                              >
                                Resource Limits & Allocation
                              </span>
                              <button
                                onClick={() => openLimitsModal(restaurant)}
                                className="text-xs font-medium text-[#0071E3] hover:underline transition"
                              >
                                Edit Limits
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div
                                className={`border p-3.5 rounded-xl ${
                                  isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"
                                }`}
                              >
                                <p className={`text-[10px] font-medium uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                  Outlets
                                </p>
                                <p className={`text-base font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {restaurant._count?.outlets || 1}{" "}
                                  <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                    / {subPlan?.maxOutlets || 2}
                                  </span>
                                </p>
                              </div>

                              <div
                                className={`border p-3.5 rounded-xl ${
                                  isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"
                                }`}
                              >
                                <p className={`text-[10px] font-medium uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                  Employees
                                </p>
                                <p className={`text-base font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {restaurant._count?.employees || 0}{" "}
                                  <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                    / {subPlan?.maxEmployees || 30}
                                  </span>
                                </p>
                              </div>

                              <div
                                className={`border p-3.5 rounded-xl ${
                                  isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"
                                }`}
                              >
                                <p className={`text-[10px] font-medium uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                  Admins
                                </p>
                                <p className={`text-base font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {restaurant._count?.memberships || 1}{" "}
                                  <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                    / {subPlan?.maxAdminUsers || 3}
                                  </span>
                                </p>
                              </div>

                              <div
                                className={`border p-3.5 rounded-xl ${
                                  isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"
                                }`}
                              >
                                <p className={`text-[10px] font-medium uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                  Storage
                                </p>
                                <p className={`text-base font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {subPlan?.storageQuotaGb || 5}{" "}
                                  <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                    GB
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Module Entitlements Toggle Grid */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[11px] font-medium uppercase tracking-wider ${
                                  isDark ? "text-[#8F95A3]" : "text-slate-500"
                                }`}
                              >
                                Module Entitlements (Unified Core Modules)
                              </span>
                              <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                Click to toggle module and all bundled features
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {UNIFIED_CORE_MODULES.map((mod) => {
                                const isEntitled = mod.subIds.some((sId) =>
                                  restaurant.modules.some((m) => m.moduleId === sId && m.status === "ACTIVE")
                                );
                                const isLoadingMod = moduleLoadingId === `${restaurant.id}-${mod.id}`;

                                return (
                                  <button
                                    key={mod.id}
                                    disabled={isLoadingMod}
                                    onClick={() =>
                                      handleToggleModule(restaurant.id, mod.id, isEntitled ? "ACTIVE" : "INACTIVE")
                                    }
                                    title={mod.desc}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition cursor-pointer ${
                                      isEntitled
                                        ? isDark
                                          ? "bg-[#0071E3]/15 text-[#64B5FF] border-[#0071E3]/40 hover:bg-[#0071E3]/25"
                                          : "bg-blue-50 text-[#0071E3] border-blue-200 hover:bg-blue-100"
                                        : isDark
                                        ? "bg-[#121622] text-[#8F95A3] border-white/[0.06] hover:text-white hover:border-white/[0.12]"
                                        : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isEntitled ? "bg-[#0071E3]" : isDark ? "bg-[#484E5E]" : "bg-slate-300"
                                      }`}
                                    />
                                    <span>{mod.name}</span>
                                    {isLoadingMod && <span className="text-[10px] animate-spin">◌</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Status Switcher */}
                          <div className="space-y-2.5">
                            <span
                              className={`text-[11px] font-medium uppercase tracking-wider ${
                                isDark ? "text-[#8F95A3]" : "text-slate-500"
                              }`}
                            >
                              Tenant Lifecycle Status
                            </span>
                            <div
                              className={`inline-flex p-1 rounded-xl border ${
                                isDark ? "bg-[#121622] border-white/[0.06]" : "bg-slate-100 border-slate-200"
                              }`}
                            >
                              {(["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const).map((st) => (
                                <button
                                  key={st}
                                  disabled={statusLoadingId === restaurant.id}
                                  onClick={() => handleStatusChange(restaurant.id, st)}
                                  className={`px-3.5 py-1 rounded-lg text-xs font-medium transition ${
                                    restaurant.status === st
                                      ? st === "ACTIVE"
                                        ? isDark
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                          : "bg-white text-emerald-700 shadow-sm border border-emerald-200"
                                        : st === "SUSPENDED"
                                        ? isDark
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                          : "bg-white text-amber-700 shadow-sm border border-amber-200"
                                        : isDark
                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                        : "bg-white text-rose-700 shadow-sm border border-rose-200"
                                      : isDark
                                      ? "text-[#8F95A3] hover:text-white"
                                      : "text-slate-600 hover:text-slate-900"
                                  }`}
                                >
                                  {statusLoadingId === restaurant.id && restaurant.status === st
                                    ? "Updating..."
                                    : st}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Security & Access Box */}
                          <div
                            className={`border p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                              isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"
                            }`}
                          >
                            <div>
                              <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                Administrator Access & Session Guard
                              </p>
                              <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                Admin:{" "}
                                <span className={`font-mono font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {primaryAdminEmail}
                                </span>{" "}
                                {hasActiveUser ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">(Active)</span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">(Pending Activation)</span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openPasswordResetModal(restaurant)}
                                className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-sm"
                              >
                                Reset Password
                              </button>

                              <button
                                disabled={inviteLoadingId === restaurant.id}
                                onClick={() => handleGenerateInvite(restaurant.id, primaryAdminEmail)}
                                className={`px-3.5 py-1.5 text-xs font-medium rounded-xl border transition ${
                                  isDark
                                    ? "bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.08]"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
                                }`}
                              >
                                {inviteLoadingId === restaurant.id ? "Generating..." : "Generate Invite Link"}
                              </button>

                              <a
                                href={`/restaurant/${restaurant.subdomain}/dashboard`}
                                target="_blank"
                                rel="noreferrer"
                                className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition ${
                                  isDark
                                    ? "bg-white/[0.03] hover:bg-white/[0.08] text-[#9BA1B0] hover:text-white border-white/[0.06]"
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200"
                                }`}
                              >
                                Open Console ↗
                              </a>
                            </div>
                          </div>

                          {inviteUrls[restaurant.id] && (
                            <div
                              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                                isDark
                                  ? "bg-[#0A0C12] border-white/[0.08] text-emerald-400"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                              }`}
                            >
                              <span className="truncate mr-3">{inviteUrls[restaurant.id]}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(inviteUrls[restaurant.id]);
                                  showToast("Copied to clipboard");
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium ${
                                  isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.15]" : "bg-emerald-600 text-white hover:bg-emerald-700"
                                }`}
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ONBOARD RESTAURANT */}
        {activeTab === "onboard" && (
          <div
            className={`border rounded-2xl p-6 sm:p-8 space-y-6 max-w-2xl ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
            }`}
          >
            <div>
              <h2 className={`text-base font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Onboard New Restaurant
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Provision a new isolated tenant instance with initial entitlements and admin credentials.
              </p>
            </div>

            {createdInvite ? (
              <div
                className={`p-5 rounded-2xl border space-y-3 ${
                  isDark
                    ? "bg-emerald-500/[0.08] border-emerald-500/20"
                    : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Tenant Provisioned Successfully</p>
                <p className={`text-xs ${isDark ? "text-[#C5C9D3]" : "text-slate-700"}`}>
                  Instance for <span className="font-semibold">{formData.name}</span> is live. Share the single-use activation link:
                </p>
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-emerald-400"
                      : "bg-white border-emerald-200 text-emerald-800"
                  }`}
                >
                  <span className="truncate mr-3">{`${window.location.origin}${createdInvite.url}`}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${createdInvite.url}`);
                      showToast("Activation link copied");
                    }}
                    className="px-3 py-1 bg-[#0071E3] text-white rounded-lg text-xs font-medium hover:bg-[#0077ED]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOnboardSubmit} className="space-y-5">
                {formError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Restaurant Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bistro Royal"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                          : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Subdomain
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="bistroroyal"
                      value={formData.subdomain}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                        })
                      }
                      className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 border ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                          : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Primary Admin Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="John Doe"
                      value={formData.primaryAdminName}
                      onChange={(e) => setFormData({ ...formData, primaryAdminName: e.target.value })}
                      className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                          : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Primary Admin Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@bistroroyal.com"
                      value={formData.primaryAdminEmail}
                      onChange={(e) => setFormData({ ...formData, primaryAdminEmail: e.target.value })}
                      className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 border ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                          : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Initial Plan
                  </label>
                  <select
                    value={formData.subscriptionPlanId}
                    onChange={(e) => {
                      const p = plans.find((x) => x.id === e.target.value);
                      if (p) {
                        setFormData({
                          ...formData,
                          subscriptionPlanId: p.id,
                          maxOutlets: p.maxOutlets,
                          maxEmployees: p.maxEmployees,
                          maxAdminUsers: p.maxAdminUsers,
                          storageQuotaGb: p.storageQuotaGb,
                        });
                      }
                    }}
                    className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.priceMonthly || 49}/mo) — {p.maxOutlets} outlets, {p.maxEmployees} staff
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={`block text-xs font-semibold ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Enabled Core Modules
                    </label>
                    <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Sub-features are automatically bundled
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {UNIFIED_CORE_MODULES.map((m) => {
                      const isChecked = selectedModules.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`p-3 rounded-xl border text-xs font-medium flex items-start justify-between cursor-pointer transition ${
                            isChecked
                              ? isDark
                                ? "bg-[#0071E3]/10 border-[#0071E3]/40 text-white"
                                : "bg-blue-50/70 border-blue-200 text-blue-950"
                              : isDark
                              ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3] hover:border-white/[0.12]"
                              : "bg-[#F5F5F7] border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedModules([...selectedModules, m.id]);
                                else setSelectedModules(selectedModules.filter((x) => x !== m.id));
                              }}
                              className="mt-0.5 rounded text-[#0071E3] focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <span className="font-semibold">{m.name}</span>
                              <p className={`text-[10px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                {m.desc}
                              </p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-sm disabled:opacity-50"
                  >
                    {formLoading ? "Provisioning..." : "Provision Instance"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: ADD-ON CATALOG */}
        {activeTab === "modules" && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-base font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Add-on Module Catalog
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Set standalone monthly rates for business modules available to tenants.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {UNIFIED_CORE_MODULES.map((mod) => (
                <div
                  key={mod.id}
                  className={`border p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition ${
                    isDark
                      ? "bg-[#121622]/60 border-white/[0.06]"
                      : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {mod.name}
                      </h3>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.06]" : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        {mod.id}
                      </span>
                    </div>
                    <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {mod.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    <div
                      className={`flex items-center border rounded-xl px-3 py-1.5 ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-[#F5F5F7] border-slate-200"
                      }`}
                    >
                      <span className={`text-xs mr-1 font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>$</span>
                      <input
                        type="number"
                        min="0"
                        value={pricingInputs[mod.id] ?? 0}
                        onChange={(e) =>
                          setPricingInputs({ ...pricingInputs, [mod.id]: Number(e.target.value) })
                        }
                        className={`w-16 bg-transparent text-xs font-semibold focus:outline-none ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      />
                      <span className={`text-[10px] ml-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>/mo</span>
                    </div>
                    <button
                      onClick={() => handleSavePricing(mod.id)}
                      disabled={pricingSaving === mod.id}
                      className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {pricingSaving === mod.id ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-base font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Platform Audit Trail
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Immutable security logs of super admin actions and lifecycle changes.
              </p>
            </div>

            <div
              className={`border rounded-2xl overflow-hidden ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
              }`}
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className={`border-b font-medium ${
                      isDark
                        ? "border-white/[0.06] text-[#8F95A3] bg-white/[0.02]"
                        : "border-slate-200 text-slate-500 bg-slate-50"
                    }`}
                  >
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Actor</th>
                    <th className="p-3.5">Entity</th>
                    <th className="p-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-white/[0.04]" : "divide-slate-100"}`}>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`p-8 text-center ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                        No logs recorded.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className={isDark ? "hover:bg-white/[0.01]" : "hover:bg-slate-50"}>
                        <td className={`p-3.5 font-mono whitespace-nowrap ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className={`p-3.5 font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                          {log.action}
                        </td>
                        <td className={`p-3.5 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                          {log.userEmail}
                        </td>
                        <td className={`p-3.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                          {log.entityType}
                        </td>
                        <td className={`p-3.5 font-mono max-w-xs truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          {log.newValues || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PASSWORD RESET MODAL */}
      {resetModalOpen && resetTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
          <div
            className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Reset Administrator Password
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {resetTenant.name}
                </p>
              </div>
              <button
                onClick={() => setResetModalOpen(false)}
                className={`text-base ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
              >
                ✕
              </button>
            </div>

            {resetError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                {resetError}
              </div>
            )}

            {resetResult ? (
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? "bg-emerald-500/[0.08] border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Password Updated Successfully</p>
                <div
                  className={`p-3 rounded-xl border space-y-1 text-xs font-mono ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-white border-emerald-200"
                  }`}
                >
                  <div className="flex justify-between">
                    <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Email:</span>
                    <span className={isDark ? "text-white" : "text-slate-900"}>{resetResult.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Password:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{resetResult.pass}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Email: ${resetResult.email}\nPassword: ${resetResult.pass}`);
                      showToast("Credentials copied");
                    }}
                    className="flex-1 px-3 py-1.5 bg-[#0071E3] text-white text-xs font-medium rounded-xl hover:bg-[#0077ED]"
                  >
                    Copy Credentials
                  </button>
                  <button
                    onClick={() => setResetModalOpen(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                      isDark
                        ? "bg-white/[0.06] text-white hover:bg-white/[0.1]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecutePasswordReset} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Target Administrator Email
                  </label>
                  <input
                    type="email"
                    required
                    value={resetTargetEmail}
                    onChange={(e) => setResetTargetEmail(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 border ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className={`text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      New Password
                    </label>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="text-xs text-[#0071E3] hover:underline font-medium"
                    >
                      Generate Strong
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={8}
                    placeholder="Enter min 8 characters"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 border ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <label className={`flex items-center gap-2 text-xs cursor-pointer ${isDark ? "text-[#C5C9D3]" : "text-slate-700"}`}>
                  <input
                    type="checkbox"
                    checked={resetInvalidateSessions}
                    onChange={(e) => setResetInvalidateSessions(e.target.checked)}
                    className="rounded text-[#0071E3] focus:ring-0"
                  />
                  <span>Invalidate all existing active sessions</span>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    className={`px-3.5 py-1.5 text-xs rounded-xl ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetNewPassword}
                    className="px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition disabled:opacity-50"
                  >
                    {resetLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LIMITS MODAL */}
      {limitsModalOpen && limitsTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
          <div
            className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Edit Resource Limits
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {limitsTenant.name}
                </p>
              </div>
              <button
                onClick={() => setLimitsModalOpen(false)}
                className={`text-base ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
              >
                ✕
              </button>
            </div>

            {limitsError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                {limitsError}
              </div>
            )}

            <form onSubmit={handleSaveLimits} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Max Outlets
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editMaxOutlets}
                    onChange={(e) => setEditMaxOutlets(Number(e.target.value))}
                    className={`w-full rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Max Employees
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editMaxEmployees}
                    onChange={(e) => setEditMaxEmployees(Number(e.target.value))}
                    className={`w-full rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Max Admins
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editMaxAdmins}
                    onChange={(e) => setEditMaxAdmins(Number(e.target.value))}
                    className={`w-full rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Storage (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editStorageQuota}
                    onChange={(e) => setEditStorageQuota(Number(e.target.value))}
                    className={`w-full rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLimitsModalOpen(false)}
                  className={`px-3.5 py-1.5 text-xs rounded-xl ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={limitsLoading}
                  className="px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition disabled:opacity-50"
                >
                  {limitsLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
