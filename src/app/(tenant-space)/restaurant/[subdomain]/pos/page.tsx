"use client";

import React, { useState, useEffect, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  Store,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Clock,
  Search,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Plus,
  Settings,
  Receipt,
  ShoppingBag,
  Layers,
  X,
  Lock,
  Calendar,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Database,
  Check,
} from "lucide-react";

// --- Types ---
interface PosIntegrationItem {
  id: string;
  restaurantId: string;
  outletId: string;
  outletName: string;
  provider: "TOAST" | "SQUARE" | "CLOVER";
  status: "ACTIVE" | "NEEDS_REAUTH" | "DISCONNECTED" | "ERROR";
  environment: "PRODUCTION" | "SANDBOX";
  providerLocationId: string | null;
  providerLocationName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  errorMessage: string | null;
  ordersImportedCount: number;
  maskedCredentials: Record<string, string>;
  createdAt: string;
}

interface PosOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  modifiers?: Array<{ name: string; price: number; option?: string }>;
}

interface PosOrder {
  id: string;
  orderNumber: string;
  provider: "TOAST" | "SQUARE" | "CLOVER" | null;
  providerOrderId: string | null;
  providerLocationId: string | null;
  outletId: string;
  outlet: { id: string; name: string; currency: string };
  orderType: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  refundAmount: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: string;
  rawPayload?: any;
  items: PosOrderItem[];
}

interface Outlet {
  id: string;
  name: string;
  currency: string;
}

interface DashboardMetrics {
  grossVolume: number;
  netSales: number;
  orderCount: number;
  aov: number;
  totalTips: number;
  totalRefunds: number;
}

// Provider definitions with logos & metadata
const POS_PROVIDERS = [
  {
    id: "TOAST" as const,
    name: "Toast POS",
    tagline: "Full-service dining, handheld Go terminals & kitchen flow",
    badge: "API v2 Bulk",
    status: "AVAILABLE",
    color: "#FF6022",
    accentBg: "rgba(255, 96, 34, 0.1)",
    accentBorder: "rgba(255, 96, 34, 0.25)",
    logoSvg: (
      <svg viewBox="0 0 48 48" className="w-8 h-8">
        <rect width="48" height="48" rx="10" fill="#FF6022" />
        <path
          d="M12 20C12 16.6863 14.6863 14 18 14H30C33.3137 14 36 16.6863 36 20V28C36 31.3137 33.3137 34 30 34H18C14.6863 34 12 31.3137 12 28V20Z"
          fill="white"
        />
        <rect x="18" y="21" width="12" height="6" rx="2" fill="#FF6022" />
      </svg>
    ),
    description:
      "Seamlessly synchronizes Toast orders, line-item modifications, server tips, and kitchen tickets via Toast Partner Orders API v2.",
    prerequisites: [
      "Toast Partner Integrations API access enabled in Toast Portal",
      "Toast Client ID & Client Secret",
      "Toast Restaurant External GUID",
    ],
  },
  {
    id: "SQUARE" as const,
    name: "Square POS",
    tagline: "Counter-service, Square Stand & contactless terminal sync",
    badge: "Connect v2",
    status: "AVAILABLE",
    color: "#006AFF",
    accentBg: "rgba(0, 106, 255, 0.1)",
    accentBorder: "rgba(0, 106, 255, 0.25)",
    logoSvg: (
      <svg viewBox="0 0 48 48" className="w-8 h-8">
        <rect width="48" height="48" rx="10" fill="#006AFF" />
        <rect x="13" y="13" width="22" height="22" rx="4" fill="white" />
        <rect x="19" y="19" width="10" height="10" rx="2" fill="#006AFF" />
      </svg>
    ),
    description:
      "Imports Square Register, Terminal, and Online orders with support for multi-location catalog references and automated tenders reporting.",
    prerequisites: [
      "Square Developer Account or Merchant OAuth permissions",
      "Square Access Token (Production or Developer Sandbox)",
      "Square Location ID",
    ],
  },
  {
    id: "CLOVER" as const,
    name: "Clover POS",
    tagline: "Flex, Mini & Station Duo multi-station order ingestion",
    badge: "REST API v3",
    status: "AVAILABLE",
    color: "#22B14C",
    accentBg: "rgba(34, 177, 76, 0.1)",
    accentBorder: "rgba(34, 177, 76, 0.25)",
    logoSvg: (
      <svg viewBox="0 0 48 48" className="w-8 h-8">
        <rect width="48" height="48" rx="10" fill="#22B14C" />
        <circle cx="24" cy="18" r="5" fill="white" />
        <circle cx="18" cy="28" r="5" fill="white" />
        <circle cx="30" cy="28" r="5" fill="white" />
      </svg>
    ),
    description:
      "Ingests Clover transactions across counter and table stations via Clover REST API v3 with line-item discounts and refund adjustments.",
    prerequisites: [
      "Clover Merchant Account with API Read permissions",
      "Clover API Token (E-Commerce or REST API token)",
      "Clover Merchant ID (mId)",
    ],
  },
];

const UPCOMING_PROVIDERS = [
  { name: "Lightspeed Restaurant", badge: "Awaiting Certification", type: "K-Series / L-Series" },
  { name: "NCR Aloha POS", badge: "Under Development", type: "Enterprise Cloud" },
  { name: "Micros Oracle Simphony", badge: "Planned Q4", type: "Enterprise Hospitality" },
];

export default function PosHubPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<PosIntegrationItem[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    grossVolume: 0,
    netSales: 0,
    orderCount: 0,
    aov: 0,
    totalTips: 0,
    totalRefunds: 0,
  });

  // Filters
  const [selectedOutlet, setSelectedOutlet] = useState<string>("ALL");
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("30d");

  // Navigation tabs: 'orders' | 'integrations'
  const [activeTab, setActiveTab] = useState<"orders" | "integrations">("orders");

  // Modals & Drawers
  const [connectModalProvider, setConnectModalProvider] = useState<
    "TOAST" | "SQUARE" | "CLOVER" | null
  >(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<PosOrder | null>(null);
  const [syncingIntegrationId, setSyncingIntegrationId] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  // Wizard state for Connect Modal
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardEnvironment, setWizardEnvironment] = useState<"SANDBOX" | "PRODUCTION">("SANDBOX");
  const [wizardOutletId, setWizardOutletId] = useState<string>("");
  const [wizardImportPeriod, setWizardImportPeriod] = useState<number>(30);
  const [wizardCredentials, setWizardCredentials] = useState<Record<string, string>>({});
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardValidating, setWizardValidating] = useState<boolean>(false);
  const [wizardAvailableLocations, setWizardAvailableLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [wizardSelectedLocationId, setWizardSelectedLocationId] = useState<string>("");
  const [wizardSuccessInfo, setWizardSuccessInfo] = useState<{
    newOrders: number;
    outletName: string;
  } | null>(null);

  // Load Integrations, Orders, and Outlets
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [resInteg, resOutlets] = await Promise.all([
        fetch("/api/restaurant/pos/integrations"),
        fetch("/api/restaurant/outlets"),
      ]);

      const integData = resInteg.ok ? (await resInteg.json()).integrations || [] : [];
      const outletsData = resOutlets.ok ? (await resOutlets.json()).outlets || [] : [];

      setIntegrations(integData);
      setOutlets(outletsData);
      if (outletsData.length > 0 && !wizardOutletId) {
        setWizardOutletId(outletsData[0].id);
      }

      await fetchOrdersList();
    } catch (err) {
      console.error("Failed to load POS Hub data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrdersList = async () => {
    try {
      const q = new URLSearchParams();
      if (selectedOutlet !== "ALL") q.set("outletId", selectedOutlet);
      if (selectedProvider !== "ALL") q.set("provider", selectedProvider);
      if (selectedStatus !== "ALL") q.set("status", selectedStatus);
      if (searchQuery.trim()) q.set("search", searchQuery.trim());

      // Date range calculation
      const now = new Date();
      if (dateRange === "today") {
        const start = new Date(now.setHours(0, 0, 0, 0));
        q.set("startDate", start.toISOString());
      } else if (dateRange === "7d") {
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        q.set("startDate", start.toISOString());
      } else if (dateRange === "30d") {
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        q.set("startDate", start.toISOString());
      }

      const res = await fetch(`/api/restaurant/pos/orders?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Error fetching POS orders:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchOrdersList();
    }
  }, [selectedOutlet, selectedProvider, selectedStatus, dateRange]);

  // Check URL tab query
  useEffect(() => {
    if (searchParams.get("tab") === "settings") {
      setActiveTab("integrations");
    }
  }, [searchParams]);

  // Trigger manual synchronization
  const handleSyncIntegration = async (integrationId: string) => {
    try {
      setSyncingIntegrationId(integrationId);
      setSyncStatusMsg({ text: "Contacting POS provider API and importing fresh orders..." });

      const res = await fetch(`/api/restaurant/pos/integrations/${integrationId}/sync`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setSyncStatusMsg({
        text: `Sync completed: ${data.newOrdersCount} new orders, ${data.updatedOrdersCount} updated.`,
      });

      // Refresh data
      await fetchAllData();
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (err: any) {
      setSyncStatusMsg({ text: err.message || "Failed to synchronize orders", isError: true });
    } finally {
      setSyncingIntegrationId(null);
    }
  };

  // Disconnect connection
  const handleDisconnect = async (integrationId: string) => {
    if (
      !confirm(
        "Are you sure you want to disconnect this POS integration? Previously imported orders will remain intact as read-only historical records, but new order synchronization will stop."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/restaurant/pos/integrations/${integrationId}?action=DEACTIVATE`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  // Open Connect Wizard
  const openConnectWizard = (providerId: "TOAST" | "SQUARE" | "CLOVER") => {
    setConnectModalProvider(providerId);
    setWizardStep(1);
    setWizardEnvironment("SANDBOX");
    setWizardCredentials(
      providerId === "TOAST"
        ? { clientId: "toast_sbx_client_481", clientSecret: "toast_sec_991823", restaurantGuid: "toast-boston-main" }
        : providerId === "SQUARE"
        ? { accessToken: "EAAA_sq_sandbox_tok_8921", applicationId: "sq0idp-sandbox-restobird" }
        : { apiToken: "clv_sec_sandbox_99341", merchantId: "CLV_MERCH_01", region: "NA" }
    );
    setWizardError(null);
    setWizardAvailableLocations([]);
    setWizardSelectedLocationId("");
    setWizardSuccessInfo(null);
  };

  // Validate credentials step
  const handleValidateStep = async () => {
    if (!connectModalProvider) return;
    setWizardValidating(true);
    setWizardError(null);

    try {
      const res = await fetch("/api/restaurant/pos/integrations?validateOnly=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connectModalProvider,
          environment: wizardEnvironment,
          credentials: wizardCredentials,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.result?.error || data.error || "Validation failed");
      }

      const locations = data.result?.locations || [];
      setWizardAvailableLocations(locations);
      if (locations.length > 0) {
        setWizardSelectedLocationId(locations[0].id);
      }
      setWizardStep(3); // Proceed to location mapping
    } catch (err: any) {
      setWizardError(err.message || "Failed to validate credentials");
    } finally {
      setWizardValidating(false);
    }
  };

  // Complete Connection and Initial Import
  const handleCompleteConnection = async () => {
    if (!connectModalProvider) return;
    setWizardValidating(true);
    setWizardError(null);

    try {
      const selectedLoc = wizardAvailableLocations.find(
        (l) => l.id === wizardSelectedLocationId
      );

      const res = await fetch("/api/restaurant/pos/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connectModalProvider,
          outletId: wizardOutletId,
          environment: wizardEnvironment,
          credentials: wizardCredentials,
          providerLocationId: wizardSelectedLocationId,
          providerLocationName: selectedLoc?.name,
          importPeriodDays: wizardImportPeriod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connection could not be finalized");
      }

      const outletObj = outlets.find((o) => o.id === wizardOutletId);
      setWizardSuccessInfo({
        newOrders: data.initialImportCount || 0,
        outletName: outletObj?.name || "Selected Outlet",
      });
      setWizardStep(5); // Success step
      await fetchAllData();
    } catch (err: any) {
      setWizardError(err.message || "Failed to connect integration");
    } finally {
      setWizardValidating(false);
    }
  };

  const activeIntegrationsCount = integrations.filter((i) => i.status === "ACTIVE").length;

  return (
    <ModuleAccessGuard moduleKey="pos" moduleName="POS Integrations & Orders" activeSection="pos">
      <div className={`min-h-screen ${isDark ? "bg-[#0B0F17] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
        <RestaurantNavbar activeSection="pos" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Read-Only Orders Hub
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Toast • Square • Clover
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                POS Integrations & Orders Hub
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                Connect your existing point-of-sale systems. Restobird automatically imports your restaurant orders,
                line items, and payment adjustments into one consolidated, real-time reporting dashboard.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab(activeTab === "orders" ? "integrations" : "orders")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  activeTab === "integrations"
                    ? "bg-slate-800 text-white border-slate-700 dark:bg-slate-700"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Settings className="w-4 h-4" />
                {activeTab === "integrations" ? "View Orders Stream" : "Manage Connections"}
                {activeIntegrationsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-md bg-emerald-500/20 text-emerald-500 font-semibold">
                    {activeIntegrationsCount} Active
                  </span>
                )}
              </button>

              <button
                onClick={() => openConnectWizard("TOAST")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Connect New POS
              </button>
            </div>
          </div>

          {/* Sync Status Toast Bar */}
          {syncStatusMsg && (
            <div
              className={`mt-4 p-3 rounded-xl flex items-center justify-between text-sm ${
                syncStatusMsg.isError
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                {syncStatusMsg.isError ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{syncStatusMsg.text}</span>
              </div>
              <button
                onClick={() => setSyncStatusMsg(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View Mode: Zero State (No Active Connections) */}
          {activeIntegrationsCount === 0 && !loading && (
            <div className="mt-8">
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                  <Store className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Connect Your Existing POS
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                  Restobird connects directly to your restaurant’s point-of-sale system. Select your POS provider below
                  to start importing orders into your unified dashboard.
                </p>
              </div>

              {/* Provider Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {POS_PROVIDERS.map((prov) => (
                  <div
                    key={prov.id}
                    className="flex flex-col justify-between p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                          {prov.logoSvg}
                        </div>
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {prov.badge}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{prov.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{prov.tagline}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                        {prov.description}
                      </p>

                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Requirements
                        </p>
                        <ul className="space-y-1.5">
                          {prov.prerequisites.map((req, i) => (
                            <li
                              key={i}
                              className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 pt-4">
                      <button
                        onClick={() => openConnectWizard(prov.id)}
                        className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 flex items-center justify-center gap-2 transition-colors"
                      >
                        Connect {prov.name}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upcoming Providers */}
              <div className="mt-8 p-5 rounded-2xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Upcoming Supported POS Integrations (Awaiting Partner Certification)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {UPCOMING_PROVIDERS.map((up, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{up.name}</p>
                        <p className="text-[11px] text-slate-500">{up.type}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {up.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* View Mode: Connected Dashboard */}
          {activeIntegrationsCount > 0 && (
            <div className="mt-6 space-y-6">
              {/* Active Connections Status Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {integrations
                  .filter((i) => i.status === "ACTIVE")
                  .map((integ) => {
                    const provDef = POS_PROVIDERS.find((p) => p.id === integ.provider);
                    return (
                      <div
                        key={integ.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                            {provDef?.logoSvg}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {provDef?.name}
                              </p>
                              {integ.environment === "SANDBOX" && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-medium">
                                  TEST MODE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Outlet: <span className="font-medium text-slate-700 dark:text-slate-300">{integ.outletName}</span>
                            </p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {integ.lastSyncAt
                                ? `Synced ${new Date(integ.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                : "Sync pending"}
                            </p>
                          </div>
                        </div>

                        <button
                          disabled={syncingIntegrationId === integ.id}
                          onClick={() => handleSyncIntegration(integ.id)}
                          className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          title="Trigger manual sync"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${syncingIntegrationId === integ.id ? "animate-spin text-emerald-500" : ""}`}
                          />
                        </button>
                      </div>
                    );
                  })}
              </div>

              {/* KPI Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Gross Volume</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    ${metrics.grossVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Total revenue recorded across POS providers</p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Net Sales</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    ${metrics.netSales.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Excludes sales tax & refunds</p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Orders Synced</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {metrics.orderCount.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    AOV: ${metrics.aov.toFixed(2)} / order
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tips & Refunds</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div>
                      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        +${metrics.totalTips.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Tips</span>
                    </div>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    <div>
                      <span className="text-lg font-bold text-rose-500">
                        -${metrics.totalRefunds.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Refunds</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              {activeTab === "orders" ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Filters Bar */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Provider Tabs */}
                      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                        {["ALL", "TOAST", "SQUARE", "CLOVER"].map((prov) => (
                          <button
                            key={prov}
                            onClick={() => setSelectedProvider(prov)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              selectedProvider === prov
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            {prov === "ALL" ? "All POS" : prov}
                          </button>
                        ))}
                      </div>

                      {/* Outlet Filter */}
                      <select
                        value={selectedOutlet}
                        onChange={(e) => setSelectedOutlet(e.target.value)}
                        className="text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-slate-700 dark:text-slate-300 font-medium focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="ALL">All Outlets</option>
                        {outlets.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>

                      {/* Status Filter */}
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-slate-700 dark:text-slate-300 font-medium focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PENDING">Pending</option>
                        <option value="REFUNDED">Refunded</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>

                      {/* Date Range */}
                      <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-slate-700 dark:text-slate-300 font-medium focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="today">Today</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                      </select>
                    </div>

                    {/* Search Input */}
                    <div className="relative min-w-[240px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search order #, customer, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchOrdersList()}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3">Order Ref</th>
                          <th className="px-4 py-3">Provider</th>
                          <th className="px-4 py-3">Outlet</th>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Items</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                              <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                              <p className="font-semibold text-slate-700 dark:text-slate-300">No orders found</p>
                              <p className="text-xs mt-1">
                                Adjust your filters or trigger a sync to pull recent transactions.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          orders.map((order) => {
                            const provDef = POS_PROVIDERS.find((p) => p.id === order.provider);
                            return (
                              <tr
                                key={order.id}
                                onClick={() => setSelectedOrderDetails(order)}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                              >
                                <td className="px-5 py-3.5">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {order.orderNumber}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {order.providerOrderId || "Internal"}
                                  </div>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold"
                                    style={{
                                      backgroundColor: provDef?.accentBg || "rgba(100, 116, 139, 0.1)",
                                      color: provDef?.color || "#64748B",
                                    }}
                                  >
                                    {provDef?.name || order.provider || "Manual"}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                                  {order.outlet?.name}
                                </td>

                                <td className="px-4 py-3.5">
                                  {order.customerName ? (
                                    <div>
                                      <p className="font-medium text-slate-800 dark:text-slate-200">
                                        {order.customerName}
                                      </p>
                                      {order.customerPhone && (
                                        <p className="text-[10px] text-slate-400">{order.customerPhone}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">Anonymous / Walk-in</span>
                                  )}
                                </td>

                                <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                                  {new Date(order.createdAt).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                  })}{" "}
                                  •{" "}
                                  {new Date(order.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>

                                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                                  <span className="font-semibold">{order.items?.length || 0}</span> items
                                </td>

                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      order.status === "COMPLETED"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : order.status === "REFUNDED"
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                        : order.status === "CANCELLED"
                                        ? "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    }`}
                                  >
                                    {order.status}
                                  </span>
                                </td>

                                <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                                  ${order.totalAmount.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Manage Connections Tab */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Configured POS Integrations
                      </h2>
                      <p className="text-xs text-slate-500">
                        Manage active connections, location mappings, and sync health.
                      </p>
                    </div>
                    <button
                      onClick={() => openConnectWizard("TOAST")}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Provider
                    </button>
                  </div>

                  <div className="space-y-4">
                    {integrations.map((integ) => {
                      const provDef = POS_PROVIDERS.find((p) => p.id === integ.provider);
                      return (
                        <div
                          key={integ.id}
                          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              {provDef?.logoSvg}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 dark:text-white">
                                  {provDef?.name}
                                </h3>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    integ.status === "ACTIVE"
                                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                      : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                                  }`}
                                >
                                  {integ.status}
                                </span>
                                {integ.environment === "SANDBOX" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-semibold">
                                    SANDBOX TEST MODE
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                Mapped Outlet: <span className="font-semibold">{integ.outletName}</span>
                                {integ.providerLocationName && ` • POS Location: ${integ.providerLocationName}`}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Imported {integ.ordersImportedCount} orders total • Last sync:{" "}
                                {integ.lastSyncAt ? new Date(integ.lastSyncAt).toLocaleString() : "Never"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              disabled={syncingIntegrationId === integ.id}
                              onClick={() => handleSyncIntegration(integ.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${syncingIntegrationId === integ.id ? "animate-spin" : ""}`}
                              />
                              Sync Now
                            </button>

                            <button
                              onClick={() => handleDisconnect(integ.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors border border-rose-500/20"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      Data Isolation & Retention Notice
                    </p>
                    <p className="leading-relaxed">
                      Restobird securely stores POS API keys and only requests read-only order scopes. If you disconnect an
                      integration, all previously imported order history and food inventory depletion logs remain
                      intact in Restobird for historical accounting and tax audits.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drawer: Order Details */}
          {selectedOrderDetails && (
            <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
              <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Order {selectedOrderDetails.orderNumber}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                          {selectedOrderDetails.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Provider: {selectedOrderDetails.provider || "Manual"} • ID:{" "}
                        <span className="font-mono">{selectedOrderDetails.providerOrderId || "N/A"}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOrderDetails(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Customer & Location Details */}
                  <div className="grid grid-cols-2 gap-3 my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
                        Customer
                      </span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedOrderDetails.customerName || "Walk-In / Guest"}
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        {selectedOrderDetails.customerPhone || "Phone unavailable"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
                        Outlet & Timing
                      </span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedOrderDetails.outlet?.name}
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        {new Date(selectedOrderDetails.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Line Items List */}
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Line Items & Modifiers
                    </h4>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                      {selectedOrderDetails.items?.map((item, idx) => (
                        <div key={idx} className="py-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-medium text-slate-900 dark:text-white">
                              <span className="text-slate-400 font-bold mr-2">{item.quantity}x</span>
                              {item.name}
                            </div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              ${(item.quantity * item.unitPrice).toFixed(2)}
                            </div>
                          </div>

                          {/* Modifiers */}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="mt-1 pl-6 space-y-0.5">
                              {item.modifiers.map((m, mIdx) => (
                                <div key={mIdx} className="text-[11px] text-slate-500 flex justify-between">
                                  <span>
                                    + {m.name} {m.option ? `(${m.option})` : ""}
                                  </span>
                                  {m.price > 0 && <span>+${m.price.toFixed(2)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span>
                        $
                        {(
                          selectedOrderDetails.totalAmount -
                          selectedOrderDetails.taxAmount -
                          selectedOrderDetails.tipAmount +
                          selectedOrderDetails.discountAmount
                        ).toFixed(2)}
                      </span>
                    </div>

                    {selectedOrderDetails.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discounts Applied</span>
                        <span>-${selectedOrderDetails.discountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-500">
                      <span>Sales Tax</span>
                      <span>${selectedOrderDetails.taxAmount.toFixed(2)}</span>
                    </div>

                    {selectedOrderDetails.tipAmount > 0 && (
                      <div className="flex justify-between text-indigo-500">
                        <span>Staff Gratuity / Tip</span>
                        <span>+${selectedOrderDetails.tipAmount.toFixed(2)}</span>
                      </div>
                    )}

                    {selectedOrderDetails.refundAmount > 0 && (
                      <div className="flex justify-between text-rose-500 font-semibold">
                        <span>Refund Processed</span>
                        <span>-${selectedOrderDetails.refundAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                      <span>Total Charged</span>
                      <span>${selectedOrderDetails.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Read-Only Notice */}
                  <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      This order was imported directly from {selectedOrderDetails.provider || "POS"}. It is read-only
                      in Restobird. All billing adjustments, splits, or voids must be processed in your primary POS
                      terminal.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setSelectedOrderDetails(null)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Close Order Drawer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Connect POS Guided Flow */}
          {connectModalProvider && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header with Progress Steps */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {POS_PROVIDERS.find((p) => p.id === connectModalProvider)?.logoSvg}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Connect {POS_PROVIDERS.find((p) => p.id === connectModalProvider)?.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Step-by-step setup and synchronization wizard
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConnectModalProvider(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex items-center justify-between">
                    {[
                      { step: 1, label: "Prerequisites" },
                      { step: 2, label: "Credentials" },
                      { step: 3, label: "Map Outlet" },
                      { step: 4, label: "Import Scope" },
                      { step: 5, label: "Synced" },
                    ].map((s) => (
                      <div key={s.step} className="flex items-center gap-1.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            wizardStep === s.step
                              ? "bg-emerald-600 text-white"
                              : wizardStep > s.step
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                          }`}
                        >
                          {wizardStep > s.step ? <Check className="w-3.5 h-3.5" /> : s.step}
                        </div>
                        <span className="text-[11px] font-medium hidden sm:inline text-slate-600 dark:text-slate-300">
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body Content by Step */}
                <div className="p-6">
                  {wizardError && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{wizardError}</span>
                    </div>
                  )}

                  {/* Step 1: Prerequisites */}
                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                        <p className="font-bold flex items-center gap-1.5 mb-1">
                          <ShieldCheck className="w-4 h-4" />
                          What Data Restobird Requests & Why
                        </p>
                        <p className="leading-relaxed">
                          Restobird only requests <strong>Read-Only Orders & Line Items</strong> scope. We do NOT ask for
                          terminal control, credit card full pan data, or billing permissions. Your orders are used solely to
                          power consolidated sales analytics and inventory depletion.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Provider Requirements
                        </p>
                        {POS_PROVIDERS.find((p) => p.id === connectModalProvider)?.prerequisites.map((req, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">{req}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 flex justify-end">
                        <button
                          onClick={() => setWizardStep(2)}
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2"
                        >
                          Continue to Credentials
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Credentials & Environment */}
                  {wizardStep === 2 && (
                    <div className="space-y-4">
                      {/* Environment Toggle */}
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Connection Environment</p>
                          <p className="text-[11px] text-slate-500">
                            Use Developer Sandbox for test accounts or Production for live restaurant stores.
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setWizardEnvironment("SANDBOX")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                              wizardEnvironment === "SANDBOX"
                                ? "bg-indigo-600 text-white"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            Sandbox Test Mode
                          </button>
                          <button
                            type="button"
                            onClick={() => setWizardEnvironment("PRODUCTION")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                              wizardEnvironment === "PRODUCTION"
                                ? "bg-emerald-600 text-white"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            Live Production
                          </button>
                        </div>
                      </div>

                      {/* Toast Form */}
                      {connectModalProvider === "TOAST" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Toast Client ID
                            </label>
                            <input
                              type="text"
                              value={wizardCredentials.clientId || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, clientId: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="e.g. toast_partner_481..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Toast Client Secret
                            </label>
                            <input
                              type="password"
                              value={wizardCredentials.clientSecret || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, clientSecret: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="••••••••••••••••"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Toast Restaurant External GUID
                            </label>
                            <input
                              type="text"
                              value={wizardCredentials.restaurantGuid || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, restaurantGuid: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="e.g. toast-boston-main or GUID"
                            />
                          </div>
                        </div>
                      )}

                      {/* Square Form */}
                      {connectModalProvider === "SQUARE" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Square Access Token
                            </label>
                            <input
                              type="password"
                              value={wizardCredentials.accessToken || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, accessToken: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="EAAA..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Square Application ID (Optional)
                            </label>
                            <input
                              type="text"
                              value={wizardCredentials.applicationId || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, applicationId: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="sq0idp-..."
                            />
                          </div>
                        </div>
                      )}

                      {/* Clover Form */}
                      {connectModalProvider === "CLOVER" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Clover API Token
                            </label>
                            <input
                              type="password"
                              value={wizardCredentials.apiToken || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, apiToken: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="clv_sec_..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Clover Merchant ID (mId)
                            </label>
                            <input
                              type="text"
                              value={wizardCredentials.merchantId || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, merchantId: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="e.g. CLV_MERCH_01"
                            />
                          </div>
                        </div>
                      )}

                      <div className="pt-4 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setWizardStep(1)}
                          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={wizardValidating}
                          onClick={handleValidateStep}
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 disabled:opacity-50"
                        >
                          {wizardValidating ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Verifying Credentials...
                            </>
                          ) : (
                            <>
                              Verify & Continue
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Location to Restobird Outlet Mapping */}
                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                          Map Provider Location to Restobird Outlet
                        </p>
                        <p className="text-xs text-slate-500">
                          Incoming orders from this POS location will automatically be attributed to your selected Restobird outlet.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Provider Location */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Discovered POS Location
                          </label>
                          <select
                            value={wizardSelectedLocationId}
                            onChange={(e) => setWizardSelectedLocationId(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            {wizardAvailableLocations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name} ({loc.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Restobird Outlet */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Restobird Target Outlet
                          </label>
                          <select
                            value={wizardOutletId}
                            onChange={(e) => setWizardOutletId(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            {outlets.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name} ({o.currency})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setWizardStep(2)}
                          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardStep(4)}
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2"
                        >
                          Continue to Import Scope
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Initial Import Period */}
                  {wizardStep === 4 && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                          Choose Initial Order Import Period
                        </p>
                        <p className="text-xs text-slate-500">
                          Select how far back Restobird should import previous order history upon connection.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { days: 7, label: "Last 7 Days", desc: "Fast sync, recent tickets only" },
                          { days: 30, label: "Last 30 Days", desc: "Recommended for monthly accounting" },
                          { days: 90, label: "Last 90 Days", desc: "Comprehensive quarter review" },
                        ].map((p) => (
                          <div
                            key={p.days}
                            onClick={() => setWizardImportPeriod(p.days)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                              wizardImportPeriod === p.days
                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                            }`}
                          >
                            <p className="font-bold text-xs">{p.label}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{p.desc}</p>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
                          Duplicate Order Prevention
                        </p>
                        <p>
                          All imports are strictly idempotent. If tickets have already been imported, Restobird checks
                          unique provider order identifiers to update existing records rather than duplicating sales.
                        </p>
                      </div>

                      <div className="pt-4 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setWizardStep(3)}
                          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={wizardValidating}
                          onClick={handleCompleteConnection}
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 disabled:opacity-50"
                        >
                          {wizardValidating ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Connecting & Importing...
                            </>
                          ) : (
                            <>
                              Authorize & Start Import
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Success Confirmation */}
                  {wizardStep === 5 && (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                        POS Connection Established!
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        Your {POS_PROVIDERS.find((p) => p.id === connectModalProvider)?.name} integration is now active.
                        Restobird imported{" "}
                        <strong className="text-slate-900 dark:text-white">
                          {wizardSuccessInfo?.newOrders || 0} orders
                        </strong>{" "}
                        into outlet <strong>{wizardSuccessInfo?.outletName}</strong>.
                      </p>

                      <div className="pt-4">
                        <button
                          onClick={() => {
                            setConnectModalProvider(null);
                            setActiveTab("orders");
                          }}
                          className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          View Unified Orders Dashboard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ModuleAccessGuard>
  );
}
