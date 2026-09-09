"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import UsersTab from "./UsersTab";
import {
  Building2,
  Briefcase,
  ShieldCheck,
  Plus,
  Search,
  Sparkles,
  Shield,
  Users,
  UserPlus,
  ArrowLeft,
} from "lucide-react";

interface MasterDataItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
  moduleId: string;
  module: { name: string };
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ permissionId: string }>;
}

type TabType = "users" | "roles" | "departments" | "designations";

const DEPARTMENT_PRESETS = [
  { name: "Kitchen & Culinary (BOH)", code: "KITCHEN", desc: "Food prep, cooking line, stock handling & stewarding" },
  { name: "Front of House (FOH)", code: "FOH", desc: "Dining room service, table hosting & guest experience" },
  { name: "Bar & Beverage", code: "BAR", desc: "Cocktail mixology, wine cellar & beverage inventory" },
  { name: "Management & Operations", code: "MGMT", desc: "Store supervision, roster scheduling & cash audits" },
  { name: "Billing & Delivery", code: "BILLING", desc: "Cashier counters, POS settlement & takeout orders" },
  { name: "Pastry & Bakery", code: "BAKERY", desc: "Desserts, bread crafting & confectionery station" },
];

const DESIGNATION_PRESETS = [
  { name: "Executive Chef", code: "EXEC-CHEF", desc: "Kitchen leadership, menu formulation & food costing" },
  { name: "Sous Chef", code: "SOUS-CHEF", desc: "Kitchen line supervision & prep checklists" },
  { name: "Line Cook", code: "LINE-COOK", desc: "Station cooking across grill, sauté, fryer & pantry" },
  { name: "Bartender", code: "BARTENDER", desc: "Crafting drinks, draft beer & bar stock management" },
  { name: "Lead Server / Waiter", code: "SERVER", desc: "Table orders, food delivery & guest checkout" },
  { name: "Cashier / Host", code: "CASHIER", desc: "Reservations, guest reception & billing desk" },
  { name: "Shift Supervisor", code: "SUPERVISOR", desc: "Floor coordination, shift handovers & approvals" },
  { name: "General Manager", code: "GM", desc: "Full operations, staff payroll & P&L oversight" },
];

export default function MasterDataAndRolesPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [usersCount, setUsersCount] = useState(0);
  const [showGrantModal, setShowGrantModal] = useState(false);

  const [departmentsList, setDepartmentsList] = useState<MasterDataItem[]>([]);
  const [designationsList, setDesignationsList] = useState<MasterDataItem[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [permissionsList, setPermissionsList] = useState<Permission[]>([]);

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Master Data Modal State (Departments & Designations)
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [editingMasterItem, setEditingMasterItem] = useState<MasterDataItem | null>(null);
  const [savingMaster, setSavingMaster] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [statusInput, setStatusInput] = useState("ACTIVE");

  // Role Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

  // Sync tab with URL query parameter on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam === "users") {
        setActiveTab("users");
      } else if (tabParam === "roles") {
        setActiveTab("roles");
      } else if (tabParam === "designations") {
        setActiveTab("designations");
      } else if (tabParam === "departments") {
        setActiveTab("departments");
      }
    }
  }, []);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError("");
    try {
      const [deptRes, desRes, rolesRes, permsRes, usersRes] = await Promise.all([
        fetch("/api/restaurant/departments"),
        fetch("/api/restaurant/designations"),
        fetch("/api/restaurant/roles"),
        fetch("/api/restaurant/permissions"),
        fetch("/api/restaurant/users"),
      ]);

      const deptData = deptRes.ok ? await deptRes.json() : {};
      const desData = desRes.ok ? await desRes.json() : {};
      const rolesData = rolesRes.ok ? await rolesRes.json() : {};
      const permsData = permsRes.ok ? await permsRes.json() : {};
      const usersData = usersRes.ok ? await usersRes.json() : {};

      setDepartmentsList(deptData.departments || []);
      setDesignationsList(desData.designations || []);
      setRolesList(rolesData.roles || []);
      setPermissionsList(permsData.permissions || []);
      setUsersCount((usersData.memberships || []).length);
    } catch {
      setError("Network error loading master data & roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSeedPresets = async () => {
    setSeeding(true);
    setSeedSuccess(null);
    setError("");
    try {
      const res = await fetch("/api/restaurant/master-data/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize presets");
      setSeedSuccess(data.message || "Standard restaurant departments & roles initialized.");
      fetchAllData();
    } catch (err: any) {
      setError(err.message || "Error seeding presets");
    } finally {
      setSeeding(false);
    }
  };

  // Master Data (Dept/Desig) Handlers
  const handleOpenAddMaster = () => {
    setEditingMasterItem(null);
    setNameInput("");
    setCodeInput("");
    setDescInput("");
    setStatusInput("ACTIVE");
    setShowMasterModal(true);
  };

  const handleOpenEditMaster = (item: MasterDataItem) => {
    setEditingMasterItem(item);
    setNameInput(item.name);
    setCodeInput(item.code);
    setDescInput(item.description || "");
    setStatusInput(item.status);
    setShowMasterModal(true);
  };

  const handleApplyPreset = (preset: { name: string; code: string; desc: string }) => {
    setNameInput(preset.name);
    setCodeInput(preset.code);
    setDescInput(preset.desc);
  };

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMaster(true);
    setError("");

    try {
      const method = editingMasterItem ? "PATCH" : "POST";
      const payload: any = {
        name: nameInput,
        code: codeInput,
        description: descInput || null,
        status: statusInput,
      };
      if (editingMasterItem) payload.id = editingMasterItem.id;

      const endpoint = activeTab === "departments" ? "/api/restaurant/departments" : "/api/restaurant/designations";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to save record");

      setShowMasterModal(false);
      fetchAllData();
    } catch (err: any) {
      setError(err.message || "Error saving record");
    } finally {
      setSavingMaster(false);
    }
  };

  // Role Handlers
  const handleOpenAddRole = () => {
    setError("");
    setEditingRoleId(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPermissions([]);
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (role: Role) => {
    setError("");
    setEditingRoleId(role.id);
    setRoleName(role.name);
    setRoleDesc(role.description || "");
    setSelectedPermissions(role.permissions.map((p) => p.permissionId));
    setShowRoleModal(true);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const toggleModulePermissions = (perms: Permission[]) => {
    const permIds = perms.map((p) => p.id);
    const allSelected = permIds.every((id) => selectedPermissions.includes(id));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((id) => !permIds.includes(id)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...permIds])));
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRole(true);
    setError("");

    try {
      const url = editingRoleId ? `/api/restaurant/roles/${editingRoleId}` : "/api/restaurant/roles";
      const method = editingRoleId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName,
          description: roleDesc,
          permissionIds: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${editingRoleId ? "update" : "create"} role`);

      setShowRoleModal(false);
      setEditingRoleId(null);
      setRoleName("");
      setRoleDesc("");
      setSelectedPermissions([]);
      fetchAllData();
    } catch (err: any) {
      setError(err.message || `Error ${editingRoleId ? "updating" : "creating"} role`);
    } finally {
      setSavingRole(false);
    }
  };

  // Group permissions by module
  const permissionsByModule = permissionsList.reduce((acc, p) => {
    const mod = p.module?.name || "General Core";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Filtered lists
  const filteredDepartments = departmentsList.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDesignations = designationsList.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredRoles = rolesList.filter(
    (role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const tabs = [
    {
      key: "users" as TabType,
      desktopLabel: "Staff Logins",
      mobileLabel: "Users",
      count: usersCount,
      icon: Users,
    },
    {
      key: "roles" as TabType,
      desktopLabel: "Roles & Permissions",
      mobileLabel: "Roles",
      count: rolesList.length,
      icon: ShieldCheck,
    },
    {
      key: "departments" as TabType,
      desktopLabel: "Departments",
      mobileLabel: "Depts",
      count: departmentsList.length,
      icon: Building2,
    },
    {
      key: "designations" as TabType,
      desktopLabel: "Designations",
      mobileLabel: "Titles",
      count: designationsList.length,
      icon: Briefcase,
    },
  ];

  if (loading && departmentsList.length === 0 && designationsList.length === 0 && rolesList.length === 0 && usersCount === 0) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Users, Roles & Master Data...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Users, Roles & Master Data" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
                onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
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
                <span className="hidden sm:inline">Administration & Access Hub</span>
                <span className="sm:hidden">Access Hub</span>
              </span>
            </div>

            {/* Title with Squircle Icon */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#0071E3] via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 border border-white/20">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className={`text-base sm:text-2xl font-extrabold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  Users, Roles & Master Data
                </h1>
                <span className={`text-[10px] sm:text-xs block sm:hidden font-medium mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {usersCount} staff accounts • {rolesList.length} roles active
                </span>
              </div>
            </div>
          </div>

          {/* Right: RBAC Status Capsule (Desktop/Tablet only) */}
          <div className="relative z-10 hidden md:flex items-center gap-3 shrink-0">
            <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
              isDark
                ? "bg-[#141A29]/80 border-white/[0.08] shadow-sm"
                : "bg-white/90 backdrop-blur-xs border-slate-200/80 shadow-xs"
            }`}>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Access Governance Active
                  </span>
                </div>
                <span className={`text-[11px] font-medium block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {usersCount} Staff Accounts • {rolesList.length} Roles Assigned
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {seedSuccess && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-xs transition animate-in fade-in ${
              isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>{seedSuccess}</span>
            </div>
            <button onClick={() => setSeedSuccess(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}

        {/* Interactive Stats Grid - Single line on mobile screen (4 columns) */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-3.5">
          {/* Card 1: Users */}
          <div
            onClick={() => switchTab("users")}
            className={`p-2 sm:p-5 rounded-2xl sm:rounded-3xl border transition cursor-pointer flex flex-col justify-between sm:flex-row sm:items-center gap-1 sm:gap-2 ${
              activeTab === "users"
                ? isDark
                  ? "bg-[#0071E3]/15 border-[#0071E3]/50 shadow-sm shadow-[#0071E3]/10"
                  : "bg-blue-50/80 border-blue-300 shadow-sm"
                : isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/10"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider block truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                <span className="hidden sm:inline">Staff Logins</span>
                <span className="sm:hidden">Users</span>
              </span>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className={`text-sm sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {usersCount}
                </span>
                <span className={`text-[8px] sm:text-xs truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  <span className="hidden sm:inline">active logins</span>
                  <span className="sm:hidden">logins</span>
                </span>
              </div>
            </div>
            <div
              className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 border ${
                activeTab === "users"
                  ? "bg-[#0071E3] text-white border-[#0071E3]"
                  : isDark
                  ? "bg-white/5 border-white/10 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Roles */}
          <div
            onClick={() => switchTab("roles")}
            className={`p-2 sm:p-5 rounded-2xl sm:rounded-3xl border transition cursor-pointer flex flex-col justify-between sm:flex-row sm:items-center gap-1 sm:gap-2 ${
              activeTab === "roles"
                ? isDark
                  ? "bg-[#0071E3]/15 border-[#0071E3]/50 shadow-sm shadow-[#0071E3]/10"
                  : "bg-blue-50/80 border-blue-300 shadow-sm"
                : isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/10"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider block truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                <span className="hidden sm:inline">Security & Roles</span>
                <span className="sm:hidden">Roles</span>
              </span>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className={`text-sm sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {rolesList.length}
                </span>
                <span className={`text-[8px] sm:text-xs truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  <span className="hidden sm:inline">access policies</span>
                  <span className="sm:hidden">roles</span>
                </span>
              </div>
            </div>
            <div
              className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 border ${
                activeTab === "roles"
                  ? "bg-[#0071E3] text-white border-[#0071E3]"
                  : isDark
                  ? "bg-white/5 border-white/10 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Departments */}
          <div
            onClick={() => switchTab("departments")}
            className={`p-2 sm:p-5 rounded-2xl sm:rounded-3xl border transition cursor-pointer flex flex-col justify-between sm:flex-row sm:items-center gap-1 sm:gap-2 ${
              activeTab === "departments"
                ? isDark
                  ? "bg-[#0071E3]/15 border-[#0071E3]/50 shadow-sm shadow-[#0071E3]/10"
                  : "bg-blue-50/80 border-blue-300 shadow-sm"
                : isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/10"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider block truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                <span className="hidden sm:inline">Departments</span>
                <span className="sm:hidden">Depts</span>
              </span>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className={`text-sm sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {departmentsList.length}
                </span>
                <span className={`text-[8px] sm:text-xs truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  <span className="hidden sm:inline">stations</span>
                  <span className="sm:hidden">stations</span>
                </span>
              </div>
            </div>
            <div
              className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 border ${
                activeTab === "departments"
                  ? "bg-[#0071E3] text-white border-[#0071E3]"
                  : isDark
                  ? "bg-white/5 border-white/10 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Designations */}
          <div
            onClick={() => switchTab("designations")}
            className={`p-2 sm:p-5 rounded-2xl sm:rounded-3xl border transition cursor-pointer flex flex-col justify-between sm:flex-row sm:items-center gap-1 sm:gap-2 ${
              activeTab === "designations"
                ? isDark
                  ? "bg-[#0071E3]/15 border-[#0071E3]/50 shadow-sm shadow-[#0071E3]/10"
                  : "bg-blue-50/80 border-blue-300 shadow-sm"
                : isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/10"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider block truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                <span className="hidden sm:inline">Designations</span>
                <span className="sm:hidden">Titles</span>
              </span>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className={`text-sm sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {designationsList.length}
                </span>
                <span className={`text-[8px] sm:text-xs truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  <span className="hidden sm:inline">job titles</span>
                  <span className="sm:hidden">titles</span>
                </span>
              </div>
            </div>
            <div
              className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 border ${
                activeTab === "designations"
                  ? "bg-[#0071E3] text-white border-[#0071E3]"
                  : isDark
                  ? "bg-white/5 border-white/10 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Switcher & Search / Create Row */}
        <div className="space-y-3">
          {/* Segmented Control - 4 Tabs clearly visible */}
          <div className="p-1 sm:p-1.5 bg-slate-200/70 dark:bg-white/[0.06] rounded-2xl grid grid-cols-4 gap-1 w-full max-w-2xl">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`py-2 px-1 sm:px-3 rounded-xl text-[10px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                    isActive
                      ? "bg-white dark:bg-[#151A28] text-[#0071E3] dark:text-white shadow-sm font-bold"
                      : isDark
                      ? "text-[#8F95A3] hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.desktopLabel}</span>
                  <span className="sm:hidden">{tab.mobileLabel}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full hidden sm:inline-block ${
                      isActive
                        ? "bg-blue-50 text-[#0071E3] dark:bg-white/10 dark:text-white"
                        : isDark
                        ? "bg-white/[0.06] text-[#8F95A3]"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box & Actions (Create Button Below Search on Mobile, Alongside on Desktop) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Box */}
            <div className="relative flex-1 sm:max-w-md">
              <input
                type="text"
                placeholder={`Search ${
                  activeTab === "users"
                    ? "users, emails & roles..."
                    : activeTab === "roles"
                    ? "roles & policies..."
                    : activeTab === "departments"
                    ? "departments..."
                    : "designations..."
                }`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              />
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Action Buttons: Positioned under search on mobile */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {activeTab !== "roles" && activeTab !== "users" && departmentsList.length === 0 && designationsList.length === 0 && (
                <button
                  onClick={handleSeedPresets}
                  disabled={seeding}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${seeding ? "animate-spin" : ""}`} />
                  <span>{seeding ? "Initializing..." : "Auto-Seed Presets"}</span>
                </button>
              )}

              {activeTab === "users" ? (
                <button
                  onClick={() => setShowGrantModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Grant App Access</span>
                </button>
              ) : activeTab === "roles" ? (
                <button
                  onClick={handleOpenAddRole}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Custom Role</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenAddMaster}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add {activeTab === "departments" ? "Department" : "Designation"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TAB CONTENT: USERS & STAFF LOGINS */}
        {activeTab === "users" && (
          <UsersTab
            subdomain={subdomain}
            searchQuery={searchQuery}
            showGrantModal={showGrantModal}
            onCloseGrantModal={() => setShowGrantModal(false)}
            onUsersCountChange={(count) => setUsersCount(count)}
          />
        )}

        {/* TAB CONTENT: DEPARTMENTS & DESIGNATIONS */}
        {(activeTab === "departments" || activeTab === "designations") && (
          <div
            className={`p-6 rounded-3xl border transition space-y-4 animate-in fade-in duration-150 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            {(activeTab === "departments" ? filteredDepartments : filteredDesignations).length === 0 ? (
              <div className={`p-12 text-center text-xs space-y-3 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto text-xl">
                  📋
                </div>
                <div>
                  <p className="font-semibold text-sm">No {activeTab} configured yet</p>
                  <p className="opacity-75 max-w-sm mx-auto mt-1">
                    Click &quot;Auto-Seed Presets&quot; to initialize with standard culinary and service divisions, or create a custom entry.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                  <button
                    onClick={handleSeedPresets}
                    disabled={seeding}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Seed Presets</span>
                  </button>
                  <button
                    onClick={handleOpenAddMaster}
                    className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom {activeTab === "departments" ? "Department" : "Designation"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Mobile Cards View */}
                <div className="sm:hidden space-y-2.5">
                  {(activeTab === "departments" ? filteredDepartments : filteredDesignations).map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-2.5 ${
                        isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                isDark
                                  ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {item.code}
                            </span>
                            <h4 className={`text-xs font-bold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                              {item.name}
                            </h4>
                          </div>
                          {item.description && (
                            <p className={`text-[11px] line-clamp-2 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                            item.status === "ACTIVE"
                              ? isDark
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : isDark
                              ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-end pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                        <button
                          onClick={() => handleOpenEditMaster(item)}
                          className="text-xs text-[#0071E3] hover:underline cursor-pointer font-semibold py-1 px-2"
                        >
                          Edit Details →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr
                        className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                          isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                        }`}
                      >
                        <th className="pb-3 px-3">Identifier Code</th>
                        <th className="pb-3 px-3">
                          {activeTab === "departments" ? "Department Name" : "Designation Title"}
                        </th>
                        <th className="pb-3 px-3">Scope / Description</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {(activeTab === "departments" ? filteredDepartments : filteredDesignations).map((item) => (
                        <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                          <td className="py-3.5 px-3">
                            <span
                              className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                isDark
                                  ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {item.code}
                            </span>
                          </td>
                          <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {item.name}
                          </td>
                          <td className={`py-3.5 px-3 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {item.description || "—"}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                item.status === "ACTIVE"
                                  ? isDark
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : isDark
                                  ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => handleOpenEditMaster(item)}
                              className="text-xs text-[#0071E3] hover:underline cursor-pointer font-semibold"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: ROLES & PERMISSIONS */}
        {activeTab === "roles" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {filteredRoles.length === 0 ? (
              <div
                className={`p-12 text-center text-xs space-y-3 rounded-3xl border ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto text-xl">
                  🛡️
                </div>
                <div>
                  <p className="font-semibold text-sm">No roles found matching query</p>
                  <p className="opacity-75 max-w-sm mx-auto mt-1">
                    Clear your search query or create a new custom role with specific permissions.
                  </p>
                </div>
                <button
                  onClick={handleOpenAddRole}
                  className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  + Create Custom Role
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRoles.map((role) => {
                  const isOwnerRole = role.name === "Restaurant Owner";
                  return (
                    <div
                      key={role.id}
                      className={`p-6 rounded-3xl border transition flex flex-col justify-between space-y-4 ${
                        isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                isOwnerRole
                                  ? isDark
                                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                                    : "bg-amber-50 border-amber-200 text-amber-700"
                                  : isDark
                                  ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                                  : "bg-blue-50 border-blue-200 text-blue-700"
                              }`}
                            >
                              <Shield className="w-4 h-4" />
                            </div>
                            <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                              {role.name}
                            </h3>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                              isDark
                                ? "bg-white/[0.04] text-[#58A6FF] border-white/[0.08]"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}
                          >
                            {role.permissions.length} Permissions
                          </span>
                        </div>

                        <p className={`text-xs min-h-[32px] line-clamp-2 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          {role.description || "System standard operational authorization policy."}
                        </p>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={`font-mono text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            ID: {role.id.slice(0, 8)}...
                          </span>

                          {isOwnerRole ? (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                isDark ? "bg-white/5 text-[#8F95A3]" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Root Role
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenEditRole(role)}
                              className={`text-xs font-semibold px-3 py-1 rounded-lg border transition cursor-pointer ${
                                isDark
                                  ? "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              Edit Permissions
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MASTER DATA (DEPARTMENT / DESIGNATION) MODAL */}
      {showMasterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">
                  {editingMasterItem ? "Edit" : "Add"} {activeTab === "departments" ? "Department" : "Designation"}
                </h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Define standardized organizational units for staff assignments.
                </p>
              </div>
              <button
                onClick={() => setShowMasterModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            {!editingMasterItem && (
              <div className="space-y-1.5 pt-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  Quick Select Common Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(activeTab === "departments" ? DEPARTMENT_PRESETS : DESIGNATION_PRESETS).map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        nameInput === p.name
                          ? "bg-[#0071E3] text-white border-[#0071E3]"
                          : isDark
                          ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08] hover:text-white hover:bg-white/[0.08]"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveMaster} className="space-y-3.5 pt-2">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  {activeTab === "departments" ? "Department Name" : "Designation Title"} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "departments" ? "e.g. Kitchen & Culinary" : "e.g. Executive Chef"}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Identifier Code (Uppercase) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "departments" ? "e.g. KITCHEN" : "e.g. CHEF"}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Operational Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Primary duties, stations & reporting scope..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Status
                </label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowMasterModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMaster}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {savingMaster ? "Saving..." : editingMasterItem ? "Update Record" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE CREATE / EDIT MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">
                  {editingRoleId ? "Edit Role & Policies" : "Create Custom Role"}
                </h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Define title and assign granular module permission keys to this role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmDiscard(true)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kitchen Lead"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Role Description
                  </label>
                  <input
                    type="text"
                    placeholder="Responsibilities and access scope"
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Assign Permissions ({selectedPermissions.length} selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions(permissionsList.map((p) => p.id))}
                      className="text-[11px] text-[#0071E3] hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-400 text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions([])}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {Object.entries(permissionsByModule).map(([modName, perms]) => {
                    const allModSelected = perms.every((p) => selectedPermissions.includes(p.id));
                    return (
                      <div
                        key={modName}
                        className={`p-3.5 rounded-2xl border ${
                          isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                            {modName}
                          </h4>
                          <button
                            type="button"
                            onClick={() => toggleModulePermissions(perms)}
                            className="text-[10px] font-semibold text-[#0071E3] hover:underline cursor-pointer"
                          >
                            {allModSelected ? "Deselect Module" : "Select Module"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((p) => {
                            const checked = selectedPermissions.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition text-xs ${
                                  checked
                                    ? isDark
                                      ? "bg-[#0071E3]/15 border-[#0071E3]/30 text-white"
                                      : "bg-blue-50 border-blue-200 text-blue-900"
                                    : isDark
                                    ? "bg-transparent border-white/[0.04] text-[#8F95A3] hover:border-white/[0.08]"
                                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(p.id)}
                                  className="mt-0.5 accent-[#0071E3]"
                                />
                                <div className="min-w-0">
                                  <span className="font-semibold block truncate">{p.name}</span>
                                  {p.description && (
                                    <span className={`text-[10px] block leading-tight ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                      {p.description}
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRole}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {savingRole ? "Saving..." : editingRoleId ? "Update Role" : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DISCARD MODAL */}
      {showConfirmDiscard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold tracking-tight">Save Changes?</h3>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Do you want to save your role updates or discard them?
            </p>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                onClick={() => {
                  setShowConfirmDiscard(false);
                  setShowRoleModal(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white bg-white/5" : "text-slate-600 hover:text-slate-900 bg-slate-100"
                }`}
              >
                Discard
              </button>
              <button
                onClick={(e) => {
                  setShowConfirmDiscard(false);
                  handleSaveRole(e as any);
                }}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
