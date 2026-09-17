"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  Store,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Search,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Plus,
  Settings,
  ShoppingBag,
  X,
  Lock,
  Calendar,
  ChevronDown,
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
  rawPayload?: Record<string, unknown> | null;
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
  use(params);
  const searchParams = useSearchParams();
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

  // Filters & Pagination
  const [selectedOutlet, setSelectedOutlet] = useState<string>("ALL");
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);
  const [calendarTab, setCalendarTab] = useState<"day" | "week" | "month" | "year" | "custom">("custom");
  const [pickingTarget, setPickingTarget] = useState<"start" | "end">("start");
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(new Date().getMonth());
  const [calendarViewYear, setCalendarViewYear] = useState<number>(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  // Date Filter & Calendar Helper Functions
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const formatDateDisplay = (date: Date | null, fallback: string) => {
    if (!date) return fallback;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isDateInRange = (date: Date, start: Date | null, end: Date | null) => {
    if (!start || !end) return false;
    const t = date.getTime();
    const s = new Date(start).setHours(0, 0, 0, 0);
    const e = new Date(end).setHours(23, 59, 59, 999);
    return t >= s && t <= e;
  };

  const getCalendarGridDays = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const daysList: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateObj: Date;
    }> = [];

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const dNum = daysInPrevMonth - i;
      daysList.push({
        day: dNum,
        month: prevM,
        year: prevY,
        isCurrentMonth: false,
        dateObj: new Date(prevY, prevM, dNum),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      daysList.push({
        day: d,
        month,
        year,
        isCurrentMonth: true,
        dateObj: new Date(year, month, d),
      });
    }

    // Next month leading days to complete grid
    const targetLength = daysList.length > 35 ? 42 : 35;
    const remainingCells = targetLength - daysList.length;
    for (let d = 1; d <= remainingCells; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      daysList.push({
        day: d,
        month: nextM,
        year: nextY,
        isCurrentMonth: false,
        dateObj: new Date(nextY, nextM, d),
      });
    }

    return daysList;
  };

  const handleCalendarDateClick = (dateObj: Date) => {
    if (calendarTab === "day") {
      const start = new Date(dateObj);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateObj);
      end.setHours(23, 59, 59, 999);
      setCustomStartDate(start);
      setCustomEndDate(end);
    } else if (calendarTab === "week") {
      const dayOfWeek = dateObj.getDay();
      const start = new Date(dateObj);
      start.setDate(dateObj.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      setCustomStartDate(start);
      setCustomEndDate(end);
    } else {
      if (pickingTarget === "start") {
        const start = new Date(dateObj);
        start.setHours(0, 0, 0, 0);
        setCustomStartDate(start);
        if (customEndDate && customEndDate < start) {
          setCustomEndDate(null);
        }
        setPickingTarget("end");
      } else {
        const end = new Date(dateObj);
        end.setHours(23, 59, 59, 999);
        if (customStartDate && end < customStartDate) {
          setCustomEndDate(customStartDate);
          setCustomStartDate(end);
        } else {
          setCustomEndDate(end);
        }
        setPickingTarget("start");
      }
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    const now = new Date();
    const nowMs = now.getTime();
    if (presetKey === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      setCustomStartDate(start);
      setCustomEndDate(end);
      setDateRange("today");
    } else if (presetKey === "7d") {
      const start = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
      const end = new Date(nowMs);
      setCustomStartDate(start);
      setCustomEndDate(end);
      setDateRange("7d");
    } else if (presetKey === "30d") {
      const start = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);
      const end = new Date(nowMs);
      setCustomStartDate(start);
      setCustomEndDate(end);
      setDateRange("30d");
    } else if (presetKey === "ytd") {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      const end = new Date(nowMs);
      setCustomStartDate(start);
      setCustomEndDate(end);
      setDateRange("ytd");
    } else if (presetKey === "all") {
      setCustomStartDate(null);
      setCustomEndDate(null);
      setDateRange("all");
    }
  };

  const handleApplyCalendarFilter = () => {
    if (customStartDate || customEndDate) {
      setDateRange("custom");
    }
    setIsDateModalOpen(false);
    setCurrentPage(1);
  };

  const getDateFilterLabel = () => {
    if (dateRange === "today") return "Today";
    if (dateRange === "7d") return "Last 7 Days";
    if (dateRange === "30d") return "Last 30 Days";
    if (dateRange === "ytd") return "Year to Date (YTD)";
    if (dateRange === "all") return "All Time (Full History)";
    if (dateRange === "custom") {
      if (customStartDate && customEndDate) {
        return `${formatDateDisplay(customStartDate, "")} - ${formatDateDisplay(customEndDate, "")}`;
      } else if (customStartDate) {
        return `From ${formatDateDisplay(customStartDate, "")}`;
      } else if (customEndDate) {
        return `Until ${formatDateDisplay(customEndDate, "")}`;
      }
      return "Custom Date Range";
    }
    return "All Time";
  };

  // Navigation tabs: 'orders' | 'integrations'
  const [activeTab, setActiveTab] = useState<"orders" | "integrations">(
    searchParams?.get("tab") === "settings" ? "integrations" : "orders"
  );

  // Modals & Drawers
  const [connectModalProvider, setConnectModalProvider] = useState<
    "TOAST" | "SQUARE" | "CLOVER" | null
  >(null);
  const [disconnectModalItem, setDisconnectModalItem] = useState<{
    id: string;
    provider: string;
    outletName: string;
  } | null>(null);
  const [disconnectConfirmText, setDisconnectConfirmText] = useState<string>("");
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<PosOrder | null>(null);
  const [syncingIntegrationId, setSyncingIntegrationId] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  // Wizard state for Connect Modal
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardEnvironment, setWizardEnvironment] = useState<"SANDBOX" | "PRODUCTION">("PRODUCTION");
  const [wizardOutletId, setWizardOutletId] = useState<string>("");
  const [wizardImportPeriod, setWizardImportPeriod] = useState<number>(365);
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

  const fetchOrdersList = useCallback(
    async (pageToFetch = currentPage) => {
      try {
        const q = new URLSearchParams();
        if (selectedOutlet !== "ALL") q.set("outletId", selectedOutlet);
        if (selectedProvider !== "ALL") q.set("provider", selectedProvider);
        if (selectedStatus !== "ALL") q.set("status", selectedStatus);
        if (searchQuery.trim()) q.set("search", searchQuery.trim());

        q.set("limit", String(pageSize));
        q.set("offset", String((pageToFetch - 1) * pageSize));

        // Date range calculation
        const now = new Date();
        const nowMs = now.getTime();
        if (dateRange === "today") {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          q.set("startDate", start.toISOString());
        } else if (dateRange === "7d") {
          const start = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
          q.set("startDate", start.toISOString());
        } else if (dateRange === "30d") {
          const start = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);
          q.set("startDate", start.toISOString());
        } else if (dateRange === "ytd") {
          const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
          q.set("startDate", start.toISOString());
        } else if (dateRange === "custom") {
          if (customStartDate) {
            const s = new Date(customStartDate);
            s.setHours(0, 0, 0, 0);
            q.set("startDate", s.toISOString());
          }
          if (customEndDate) {
            const e = new Date(customEndDate);
            e.setHours(23, 59, 59, 999);
            q.set("endDate", e.toISOString());
          }
        }

        const res = await fetch(`/api/restaurant/pos/orders?${q.toString()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          if (data.pagination) setTotalOrders(data.pagination.total || 0);
          if (data.metrics) setMetrics(data.metrics);
        }
      } catch (err) {
        console.error("Error fetching POS orders:", err);
      }
    },
    [
      currentPage,
      selectedOutlet,
      selectedProvider,
      selectedStatus,
      searchQuery,
      pageSize,
      dateRange,
      customStartDate,
      customEndDate,
    ]
  );

  // Load Integrations, Orders, and Outlets
  const fetchAllData = useCallback(async () => {
    try {
      const cacheBustHeaders = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      };

      const [resInteg, resOutlets] = await Promise.all([
        fetch("/api/restaurant/pos/integrations", {
          cache: "no-store",
          headers: cacheBustHeaders,
        }),
        fetch("/api/restaurant/outlets", {
          cache: "no-store",
          headers: cacheBustHeaders,
        }),
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
  }, [wizardOutletId, fetchOrdersList]);

  useEffect(() => {
    const init = async () => {
      await fetchAllData();
    };
    void init();
  }, [fetchAllData]);

  useEffect(() => {
    if (!loading) {
      const loadOrders = async () => {
        await fetchOrdersList(currentPage);
      };
      void loadOrders();
    }
  }, [currentPage, fetchOrdersList, loading]);

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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to synchronize orders";
      setSyncStatusMsg({ text: errorMessage, isError: true });
    } finally {
      setSyncingIntegrationId(null);
    }
  };

  // Disconnect connection modal launcher
  const handleDisconnect = (integ: PosIntegrationItem) => {
    setDisconnectModalItem({
      id: integ.id,
      provider: integ.provider,
      outletName: integ.outletName,
    });
    setDisconnectConfirmText("");
  };

  // Confirm and execute actual API deletion/deactivation
  const confirmAndExecuteDisconnect = async () => {
    if (!disconnectModalItem) return;

    const normalizedText = disconnectConfirmText.trim().toUpperCase();
    if (normalizedText !== "DELETE" && normalizedText !== "DISCONNECT") {
      return;
    }

    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `/api/restaurant/pos/integrations/${disconnectModalItem.id}?action=DELETE`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        setDisconnectModalItem(null);
        setDisconnectConfirmText("");
        await fetchAllData();
        setSyncStatusMsg({ text: "POS Integration successfully disconnected." });
        setTimeout(() => setSyncStatusMsg(null), 5000);
      } else {
        const data = await res.json();
        setSyncStatusMsg({ text: data.error || "Failed to disconnect integration", isError: true });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to disconnect integration";
      console.error("Failed to disconnect:", err);
      setSyncStatusMsg({ text: errorMessage, isError: true });
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Open Connect Wizard
  const openConnectWizard = (providerId: "TOAST" | "SQUARE" | "CLOVER") => {
    setConnectModalProvider(providerId);
    setWizardStep(1);
    setWizardEnvironment("PRODUCTION");
    if (outlets.length > 0 && !wizardOutletId) {
      setWizardOutletId(outlets[0].id);
    }
    setWizardCredentials(
      providerId === "TOAST"
        ? { clientId: "", clientSecret: "", restaurantGuid: "" }
        : providerId === "SQUARE"
          ? { accessToken: "", applicationId: "" }
          : { apiToken: "", merchantId: "", region: "NA" }
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to validate credentials";
      setWizardError(errorMessage);
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

      const targetOutletId = wizardOutletId || (outlets.length > 0 ? outlets[0].id : "");

      const res = await fetch("/api/restaurant/pos/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connectModalProvider,
          outletId: targetOutletId,
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect integration";
      setWizardError(errorMessage);
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

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
              <button
                onClick={() => setActiveTab(activeTab === "orders" ? "integrations" : "orders")}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${activeTab === "integrations"
                    ? "bg-slate-800 text-white border-slate-700 dark:bg-slate-700"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{activeTab === "integrations" ? "View Orders Stream" : "Manage Connections"}</span>
                {activeIntegrationsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs rounded-md bg-emerald-500/20 text-emerald-500 font-semibold">
                    {activeIntegrationsCount} Active
                  </span>
                )}
              </button>

              <button
                onClick={() => openConnectWizard("TOAST")}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Connect New POS</span>
              </button>
            </div>
          </div>

          {/* Sync Status Toast Bar */}
          {syncStatusMsg && (
            <div
              className={`mt-4 p-3 rounded-xl flex items-center justify-between text-sm ${syncStatusMsg.isError
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 truncate">Gross Volume</p>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 truncate">
                    ${Number(metrics.grossVolume || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">Total revenue recorded across POS providers</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 truncate">Net Sales</p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                    ${Number(metrics.netSales || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">Excludes sales tax & refunds</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 truncate">Orders Synced</p>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 truncate">
                    {(metrics.orderCount || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    AOV: ${Number(metrics.aov || 0).toFixed(2)} / order
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 truncate">Tips & Refunds</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <div>
                      <span className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        +${Number(metrics.totalTips || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Tips</span>
                    </div>
                    <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    <div>
                      <span className="text-base sm:text-lg font-bold text-rose-500 whitespace-nowrap">
                        -${Number(metrics.totalRefunds || 0).toFixed(2)}
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
                  <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0">
                      {/* Provider Tabs */}
                      <div className="inline-flex shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                        {["ALL", "TOAST", "SQUARE", "CLOVER"].map((prov) => (
                          <button
                            key={prov}
                            onClick={() => setSelectedProvider(prov)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${selectedProvider === prov
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
                        className="text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-slate-700 dark:text-slate-300 font-medium focus:ring-2 focus:ring-emerald-500 shrink-0"
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
                        className="text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-slate-700 dark:text-slate-300 font-medium focus:ring-2 focus:ring-emerald-500 shrink-0"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PENDING">Pending</option>
                        <option value="REFUNDED">Refunded</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>

                      {/* Date Range Picker Trigger */}
                      <button
                        type="button"
                        onClick={() => setIsDateModalOpen(true)}
                        className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200/60 dark:border-slate-700/60 shrink-0"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{getDateFilterLabel()}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full md:w-auto md:min-w-[240px]">
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

                  {/* Orders List Container: Desktop Table vs Mobile Cards */}
                  {(() => {
                    const displayOrders = orders.filter((o) => {
                      const itemCount = o.items?.length || 0;
                      const tot = Number(o.totalAmount || 0);
                      const tip = Number(o.tipAmount || 0);
                      const pId = String(o.providerOrderId || "");
                      if ((itemCount === 0 && tot === 0 && tip === 0) || pId.startsWith("ord_") || pId === "undefined" || !pId) {
                        return false;
                      }
                      return true;
                    });

                    if (displayOrders.length === 0) {
                      return (
                        <div className="px-6 py-12 text-center text-slate-500">
                          <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                          <p className="font-semibold text-slate-700 dark:text-slate-300">No orders found</p>
                          <p className="text-xs mt-1">
                            Adjust your filters or trigger a sync to pull recent transactions.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* 1. Mobile Cards View (< md screens) */}
                        <div className="block md:hidden p-3 space-y-3">
                          {displayOrders.map((order) => {
                            const provDef = POS_PROVIDERS.find((p) => p.id === order.provider);
                            let displayRef = order.orderNumber;
                            if (!displayRef.startsWith("TST-") && !displayRef.startsWith("ORD-") && !displayRef.startsWith("SQ-") && !displayRef.startsWith("CLV-")) {
                              displayRef = `TST-${displayRef}`;
                            }

                            return (
                              <div
                                key={order.id}
                                onClick={() => setSelectedOrderDetails(order)}
                                className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
                              >
                                {/* Card Header: Ref, Provider, Total */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                                      {displayRef}
                                    </span>
                                    <span
                                      className="px-2 py-0.5 rounded text-[10px] font-semibold"
                                      style={{
                                        backgroundColor: provDef?.accentBg || "rgba(100, 116, 139, 0.1)",
                                        color: provDef?.color || "#64748B",
                                      }}
                                    >
                                      {provDef?.name || order.provider || "Manual"}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                      ${Number(order.totalAmount || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                {/* Customer & Outlet Info */}
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                  <div>
                                    {order.customerName ? (
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {order.customerName}
                                      </span>
                                    ) : (
                                      <span className="italic text-slate-400">Anonymous / Walk-in</span>
                                    )}
                                    <span className="mx-1.5">•</span>
                                    <span className="font-medium text-slate-600 dark:text-slate-300">{order.outlet?.name}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 whitespace-nowrap">
                                    {new Date(order.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })},{" "}
                                    {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>

                                {/* Status, Items, Tip & Chevron */}
                                <div className="flex items-center justify-between text-xs pt-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${order.status === "COMPLETED"
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
                                    <span className="text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold">{order.items?.length || 0}</span> items
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {Number(order.tipAmount || 0) > 0 && (
                                      <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                        Tip: +${Number(order.tipAmount).toFixed(2)}
                                      </span>
                                    )}
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 2. Desktop Table View (>= md screens) */}
                        <div className="hidden md:block overflow-x-auto">
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
                                <th className="px-4 py-3 text-right">Tip</th>
                                <th className="px-5 py-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {displayOrders.map((order) => {
                                const provDef = POS_PROVIDERS.find((p) => p.id === order.provider);
                                let displayRef = order.orderNumber;
                                if (!displayRef.startsWith("TST-") && !displayRef.startsWith("ORD-") && !displayRef.startsWith("SQ-") && !displayRef.startsWith("CLV-")) {
                                  displayRef = `TST-${displayRef}`;
                                }

                                return (
                                  <tr
                                    key={order.id}
                                    onClick={() => setSelectedOrderDetails(order)}
                                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                                  >
                                    <td className="px-5 py-3.5">
                                      <div className="font-bold text-slate-900 dark:text-white">
                                        {displayRef}
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
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${order.status === "COMPLETED"
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

                                    <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap">
                                      {Number(order.tipAmount || 0) > 0 ? (
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                          +${Number(order.tipAmount).toFixed(2)}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">$0.00</span>
                                      )}
                                    </td>

                                    <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                                      ${Number(order.totalAmount || 0).toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}

                  {/* Pagination Footer */}
                  {totalOrders > 0 && (
                    <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
                        Showing{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {(currentPage - 1) * pageSize + 1}
                        </span>{" "}
                        to{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {Math.min(currentPage * pageSize, totalOrders)}
                        </span>{" "}
                        of{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {totalOrders.toLocaleString()}
                        </span>{" "}
                        orders
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span>Per page:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-200 font-semibold focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                          </select>
                        </div>

                        {/* Pagination Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            className="hidden sm:inline-flex px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            First
                          </button>

                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Prev
                          </button>

                          {/* Page Indicators */}
                          <div className="flex items-center px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap">
                            Page {currentPage} of {Math.ceil(totalOrders / pageSize) || 1}
                          </div>

                          <button
                            disabled={currentPage >= Math.ceil(totalOrders / pageSize)}
                            onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalOrders / pageSize), p + 1))}
                            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Next
                          </button>

                          <button
                            disabled={currentPage >= Math.ceil(totalOrders / pageSize)}
                            onClick={() => setCurrentPage(Math.ceil(totalOrders / pageSize))}
                            className="hidden sm:inline-flex px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Last
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${integ.status === "ACTIVE"
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
                              onClick={() => handleDisconnect(integ)}
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
                              ${(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}
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
                                  {Number(m.price || 0) > 0 && <span>+${Number(m.price || 0).toFixed(2)}</span>}
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
                          Number(selectedOrderDetails.totalAmount || 0) -
                          Number(selectedOrderDetails.taxAmount || 0) -
                          Number(selectedOrderDetails.tipAmount || 0) +
                          Number(selectedOrderDetails.discountAmount || 0)
                        ).toFixed(2)}
                      </span>
                    </div>

                    {Number(selectedOrderDetails.discountAmount || 0) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discounts Applied</span>
                        <span>-${Number(selectedOrderDetails.discountAmount || 0).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-500">
                      <span>Sales Tax</span>
                      <span>${Number(selectedOrderDetails.taxAmount || 0).toFixed(2)}</span>
                    </div>

                    {Number(selectedOrderDetails.tipAmount || 0) > 0 && (
                      <div className="flex justify-between text-indigo-500">
                        <span>Staff Gratuity / Tip</span>
                        <span>+${Number(selectedOrderDetails.tipAmount || 0).toFixed(2)}</span>
                      </div>
                    )}

                    {Number(selectedOrderDetails.refundAmount || 0) > 0 && (
                      <div className="flex justify-between text-rose-500 font-semibold">
                        <span>Refund Processed</span>
                        <span>-${Number(selectedOrderDetails.refundAmount || 0).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                      <span>Total Charged</span>
                      <span>${Number(selectedOrderDetails.totalAmount || 0).toFixed(2)}</span>
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

          {/* Modal Popup: Confirm Disconnect POS Integration */}
          {disconnectModalItem && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div
                className={`relative w-full max-w-md p-6 rounded-2xl shadow-2xl border transition-all ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                  }`}
              >
                <button
                  onClick={() => {
                    setDisconnectModalItem(null);
                    setDisconnectConfirmText("");
                  }}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">
                      Disconnect {disconnectModalItem.provider} POS
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Location: <span className="font-semibold">{disconnectModalItem.outletName}</span>
                    </p>
                  </div>
                </div>

                <p className={`text-xs leading-relaxed mb-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Are you sure you want to disconnect this POS integration? Previously imported orders will remain intact as read-only historical records, but new order synchronization will stop immediately.
                </p>

                <div className="space-y-2 mb-6">
                  <label className={`block text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    To confirm deletion, please type <span className="font-bold text-rose-600 dark:text-rose-400">DELETE</span> below:
                  </label>
                  <input
                    type="text"
                    value={disconnectConfirmText}
                    onChange={(e) => setDisconnectConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all ${isDark
                        ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                        : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDisconnectModalItem(null);
                      setDisconnectConfirmText("");
                    }}
                    disabled={isDisconnecting}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${isDark
                        ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                        : "border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmAndExecuteDisconnect}
                    disabled={
                      isDisconnecting ||
                      (disconnectConfirmText.trim().toUpperCase() !== "DELETE" &&
                        disconnectConfirmText.trim().toUpperCase() !== "DISCONNECT")
                    }
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {isDisconnecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {isDisconnecting ? "Disconnecting..." : "Disconnect Integration"}
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
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep === s.step
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

                  {/* Step 2: Credentials */}
                  {wizardStep === 2 && (
                    <div className="space-y-4">
                      {/* Toast Form */}
                      {connectModalProvider === "TOAST" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Toast Client ID <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={wizardCredentials.clientId || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, clientId: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="Enter your Toast Client ID"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Toast Client Secret <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="password"
                              value={wizardCredentials.clientSecret || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, clientSecret: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="Enter your Toast Client Secret"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Toast Restaurant External GUID <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={wizardCredentials.restaurantGuid || ""}
                              onChange={(e) =>
                                setWizardCredentials({ ...wizardCredentials, restaurantGuid: e.target.value })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                              placeholder="Enter your 36-character Toast Restaurant GUID"
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
                          { days: 30, label: "Last 30 Days", desc: "Monthly accounting" },
                          { days: 90, label: "Last 90 Days", desc: "Comprehensive quarter review" },
                          { days: 365, label: "Year to Date (YTD)", desc: "Full year order history to present" },
                        ].map((p) => (
                          <div
                            key={p.days}
                            onClick={() => setWizardImportPeriod(p.days)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${wizardImportPeriod === p.days
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
          {/* Calendar Style Date Range Filter Modal (Image 2 Layout with Restobird Emerald Theme) */}
          {isDateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Filter by
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsDateModalOpen(false)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                  {/* Presets Tab Bar (Image 2 Style) */}
                  <div className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1 text-xs font-semibold">
                    {[
                      { id: "day", label: "Day" },
                      { id: "week", label: "Week" },
                      { id: "month", label: "Month" },
                      { id: "year", label: "Year" },
                      { id: "custom", label: "Custom" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCalendarTab(tab.id as "day" | "week" | "month" | "year" | "custom")}
                        className={`flex-1 py-2 px-2.5 rounded-xl transition-all text-center ${calendarTab === tab.id
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Start & End Date Input Boxes (Image 2 Style) */}
                  {(calendarTab === "custom" || calendarTab === "day" || calendarTab === "week") && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPickingTarget("start")}
                        className={`p-3 rounded-2xl border text-left transition-all ${pickingTarget === "start"
                            ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          Start Date
                        </span>
                        <span className="text-xs font-bold block truncate">
                          {formatDateDisplay(customStartDate, "Select Start Date")}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPickingTarget("end")}
                        className={`p-3 rounded-2xl border text-left transition-all ${pickingTarget === "end"
                            ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          End Date
                        </span>
                        <span className="text-xs font-bold block truncate">
                          {formatDateDisplay(customEndDate, "Select End Date")}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Month & Year Navigation Header */}
                  {(calendarTab === "custom" || calendarTab === "day" || calendarTab === "week") && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (calendarViewMonth === 0) {
                              setCalendarViewMonth(11);
                              setCalendarViewYear(calendarViewYear - 1);
                            } else {
                              setCalendarViewMonth(calendarViewMonth - 1);
                            }
                          }}
                          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>

                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {MONTH_NAMES[calendarViewMonth]} {calendarViewYear}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (calendarViewMonth === 11) {
                              setCalendarViewMonth(0);
                              setCalendarViewYear(calendarViewYear + 1);
                            } else {
                              setCalendarViewMonth(calendarViewMonth + 1);
                            }
                          }}
                          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Days of Week Header */}
                      <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {["S", "M", "T", "W", "T", "F", "S"].map((dayStr, idx) => (
                          <div key={idx} className="py-1">
                            {dayStr}
                          </div>
                        ))}
                      </div>

                      {/* Interactive Calendar Days Grid */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {getCalendarGridDays(calendarViewYear, calendarViewMonth).map((cell, idx) => {
                          const isStart = isSameDay(cell.dateObj, customStartDate);
                          const isEnd = isSameDay(cell.dateObj, customEndDate);
                          const inRange = isDateInRange(cell.dateObj, customStartDate, customEndDate);
                          const isToday = isSameDay(cell.dateObj, new Date());

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleCalendarDateClick(cell.dateObj)}
                              className={`h-9 w-full rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${isStart || isEnd
                                  ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 rounded-full"
                                  : inRange
                                    ? "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 font-bold"
                                    : isToday
                                      ? "border border-emerald-500 text-emerald-600 font-bold"
                                      : cell.isCurrentMonth
                                        ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        : "text-slate-300 dark:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                }`}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Month Selection Grid (When 'Month' tab active) */}
                  {calendarTab === "month" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <button
                          type="button"
                          onClick={() => setCalendarViewYear(calendarViewYear - 1)}
                          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          Year {calendarViewYear}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCalendarViewYear(calendarViewYear + 1)}
                          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {MONTH_NAMES.map((mName, mIdx) => {
                          const isSelMonth =
                            customStartDate &&
                            customStartDate.getFullYear() === calendarViewYear &&
                            customStartDate.getMonth() === mIdx;

                          return (
                            <button
                              key={mName}
                              type="button"
                              onClick={() => {
                                const start = new Date(calendarViewYear, mIdx, 1, 0, 0, 0);
                                const end = new Date(calendarViewYear, mIdx + 1, 0, 23, 59, 59, 999);
                                setCustomStartDate(start);
                                setCustomEndDate(end);
                              }}
                              className={`py-3 px-2 rounded-xl text-xs font-semibold transition-all ${isSelMonth
                                  ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30"
                                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600"
                                }`}
                            >
                              {mName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Year Selection Grid (When 'Year' tab active) */}
                  {calendarTab === "year" && (
                    <div className="grid grid-cols-3 gap-2">
                      {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map((yr) => {
                        const isSelYear =
                          customStartDate && customStartDate.getFullYear() === yr;

                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              const start = new Date(yr, 0, 1, 0, 0, 0);
                              const end = new Date(yr, 11, 31, 23, 59, 59, 999);
                              setCustomStartDate(start);
                              setCustomEndDate(end);
                            }}
                            className={`py-3 px-2 rounded-xl text-xs font-semibold transition-all ${isSelYear
                                ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30"
                                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600"
                              }`}
                          >
                            {yr}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Range Shortcut Pills */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Quick Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {[
                        { id: "today", label: "Today" },
                        { id: "7d", label: "Last 7 Days" },
                        { id: "30d", label: "Last 30 Days" },
                        { id: "ytd", label: "YTD" },
                        { id: "all", label: "All History" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePresetSelect(p.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateRange === p.id && !customStartDate
                              ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Sticky Footer - Apply Button */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <button
                    type="button"
                    onClick={handleApplyCalendarFilter}
                    className="w-full py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Apply Filter
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ModuleAccessGuard>
  );
}
