import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import {
  getComparisonDateRanges,
  calculatePercentageChange,
  getSingleDayBounds,
} from "@/core/analytics/comparisonHelpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { subdomain } = await params;

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const targetRestaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
      select: { id: true },
    });
    const restaurantId = targetRestaurant?.id || session.activeRestaurantId;

    // Fetch primary outlet to obtain timezone and currency configuration
    const outlets = await prisma.restaurantOutlet.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
    });

    const primaryOutlet = outlets[0];
    const outletTimezone = primaryOutlet?.timezone?.trim() || "UTC";
    const outletCurrency = primaryOutlet?.currency?.trim() || "USD";

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "today";
    const outletId = searchParams.get("outletId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Seamless comparison ranges with timezone-aware start-inclusive/end-exclusive boundaries
    const comparisonRanges = getComparisonDateRanges(
      period,
      outletTimezone,
      startDateParam,
      endDateParam
    );

    const filterStart = comparisonRanges.current.start;
    const filterEndExclusive = comparisonRanges.current.endExclusive;
    const prevStart = comparisonRanges.previous.start;
    const prevEndExclusive = comparisonRanges.previous.endExclusive;

    const formattedTodayDate = comparisonRanges.current.label;

    const todayBounds = getSingleDayBounds(outletTimezone, 0);
    const todayStart = todayBounds.start;
    const todayEnd = todayBounds.endExclusive;

    // Parallel Database Queries for maximum performance
    const [
      currentOrders,
      previousOrders,
      currentRevenueTxs,
      currentPeriodTxs,
      previousPeriodTxs,
      earliestOrder,
      restaurantInfo,
      activeEmployeesCount,
      todayAttendance,
      lowStockItems,
      topPosItems,
      latestIntegration,
      recentStockLogs,
      recentClosings,
      recentPayrolls,
      todayShifts,
      pendingSwaps,
      pendingOnboardings,
    ] = await Promise.all([
      // 1. Current Period Filtered POS Orders
      prisma.posOrder.findMany({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
          createdAt: { gte: filterStart, lt: filterEndExclusive },
        },
        select: {
          id: true,
          totalAmount: true,
          orderType: true,
          status: true,
          createdAt: true,
        },
      }),

      // 2. Previous Period POS Orders (for exact comparison)
      prisma.posOrder.findMany({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
          createdAt: { gte: prevStart, lt: prevEndExclusive },
        },
        select: {
          id: true,
          totalAmount: true,
          orderType: true,
          status: true,
          createdAt: true,
        },
      }),

      // 3. Current Filtered Revenue Transactions
      prisma.financialTransaction.findMany({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
          type: "REVENUE",
          transactionDate: { gte: filterStart, lt: filterEndExclusive },
        },
        select: { amount: true },
      }),

      // 4. Current Period Financial Transactions (Revenue & COGS)
      prisma.financialTransaction.findMany({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
          transactionDate: { gte: filterStart, lt: filterEndExclusive },
        },
        select: { type: true, category: true, amount: true },
      }),

      // 4b. Previous Period Financial Transactions (Revenue & COGS)
      prisma.financialTransaction.findMany({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
          transactionDate: { gte: prevStart, lt: prevEndExclusive },
        },
        select: { type: true, category: true, amount: true },
      }),

      // 4c. Earliest Order check to identify genuinely missing historical data
      prisma.posOrder.findFirst({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),

      // 4d. Restaurant creation date
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { createdAt: true },
      }),

      // 5. Total Employees
      prisma.employee.count({
        where: { restaurantId },
      }),

      // 6. Today Attendance Records
      prisma.attendanceRecord.findMany({
        where: {
          restaurantId,
          workDate: { gte: todayStart, lt: todayEnd },
        },
        select: { status: true },
      }),

      // 7. Low Stock Inventory Items
      prisma.inventoryItem.findMany({
        where: { restaurantId },
        orderBy: { reorderPoint: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          reorderPoint: true,
          parLevel: true,
          unitOfMeasure: true,
        },
      }),

      // 8. Top Selling POS Order Items with date and outlet filters
      prisma.posOrderItem.findMany({
        where: {
          order: {
            restaurantId,
            ...(outletId && outletId !== "all" ? { outletId } : {}),
            createdAt: { gte: filterStart, lt: filterEndExclusive },
            status: "COMPLETED",
          },
          isVoided: false,
        },
        select: {
          id: true,
          orderId: true,
          posMenuItemId: true,
          name: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          netSales: true,
        },
      }),

      // 8b. Latest POS Integration sync timestamp
      prisma.posIntegration.findFirst({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
        },
        orderBy: { lastSyncAt: "desc" },
        select: { lastSyncAt: true },
      }),

      // 9. Recent Stock Ledger logs
      prisma.stockLedger.findMany({
        where: { restaurantId },
        include: { item: { select: { name: true, unitOfMeasure: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),

      // 10. Recent Daily Closings
      prisma.dailyCashClosing.findMany({
        where: { restaurantId },
        orderBy: { closingDate: "desc" },
        take: 2,
      }),

      // 11. Recent Payroll Runs
      prisma.payrollRun.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),

      // 12. Today Shift Assignments
      prisma.shiftAssignment.findMany({
        where: {
          restaurantId,
          shiftDate: { gte: todayStart, lte: todayEnd },
        },
        select: {
          startTime: true,
          endTime: true,
          status: true,
        },
      }),

      // 13. Pending Shift Swaps
      prisma.shiftSwapRequest.count({
        where: {
          restaurantId,
          status: "PENDING",
        },
      }),

      // 14. Pending Employee Onboardings
      prisma.employeeOnboarding.count({
        where: {
          restaurantId,
          status: "PENDING",
        },
      }),
    ]);

    // 1. Sales & Order Calculations for Current & Previous Periods
    const posSalesCurrent = currentOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const ledgerSalesCurrent = currentRevenueTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const currentSales = posSalesCurrent > 0 ? posSalesCurrent : ledgerSalesCurrent;

    // Determine whether comparison historical data genuinely exists for previous period
    const earliestDataDate = earliestOrder?.createdAt || restaurantInfo?.createdAt || new Date();
    const isPreviousDataMissing =
      prevEndExclusive.getTime() < earliestDataDate.getTime() &&
      previousOrders.length === 0 &&
      previousPeriodTxs.length === 0;

    let previousSales: number | null = null;
    let previousOrdersCount: number | null = null;
    let previousAov: number | null = null;
    let previousGrossProfit: number | null = null;
    let previousFoodCostPct: number | null = null;
    let previousCancelled: number | null = null;

    if (!isPreviousDataMissing) {
      const posSalesPrevious = previousOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const ledgerSalesPrevious = previousPeriodTxs
        .filter((t) => t.type === "REVENUE")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      previousSales = posSalesPrevious > 0 ? posSalesPrevious : ledgerSalesPrevious;
      previousOrdersCount = previousOrders.length;
      previousAov = previousOrdersCount > 0 ? Math.round(previousSales / previousOrdersCount) : 0;
      previousCancelled = previousOrders.filter((o) => o.status === "CANCELLED").length;
    }

    const currentTotalOrders = currentOrders.length;
    const currentAov = currentTotalOrders > 0 ? Math.round(currentSales / currentTotalOrders) : 0;

    // Dynamic Percentage Changes based on selected filter & comparison period
    const salesComparison = calculatePercentageChange(
      currentSales,
      previousSales,
      comparisonRanges.comparisonLabel,
      true
    );

    const ordersComparison = calculatePercentageChange(
      currentTotalOrders,
      previousOrdersCount,
      comparisonRanges.comparisonLabel,
      true
    );

    const aovComparison = calculatePercentageChange(
      currentAov,
      previousAov,
      comparisonRanges.comparisonLabel,
      true
    );

    // Channels (Current Period)
    const dineInOrds = currentOrders.filter((o) => o.orderType === "DINE_IN");
    const deliveryOrds = currentOrders.filter((o) => o.orderType === "DELIVERY");
    const takeawayOrds = currentOrders.filter((o) => o.orderType === "TAKEAWAY");

    const dineInAmt = dineInOrds.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const deliveryAmt = deliveryOrds.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const takeawayAmt = takeawayOrds.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

    const totalPosAmt = currentSales || 1;

    const channelBreakdown = {
      dineIn: {
        count: dineInOrds.length,
        percentage: Math.round((dineInAmt / totalPosAmt) * 1000) / 10,
        amount: Math.round(dineInAmt),
      },
      delivery: {
        count: deliveryOrds.length,
        percentage: Math.round((deliveryAmt / totalPosAmt) * 1000) / 10,
        amount: Math.round(deliveryAmt),
      },
      takeaway: {
        count: takeawayOrds.length,
        percentage: Math.round((takeawayAmt / totalPosAmt) * 1000) / 10,
        amount: Math.round(takeawayAmt),
      },
    };

    // Fulfillment (Current Period)
    const completed = currentOrders.filter((o) => o.status === "COMPLETED" || (o.status as string) === "SETTLED").length;
    const inProgress = currentOrders.filter((o) => o.status === "PENDING" || o.status === "PREPARING").length;
    const currentCancelled = currentOrders.filter((o) => o.status === "CANCELLED").length;

    const cancellationComparison = calculatePercentageChange(
      currentCancelled,
      previousCancelled,
      comparisonRanges.comparisonLabel,
      false // Lower cancellations is better
    );

    // 2. Sales Chart Bars Aggregation (Date-wise for Week/Month/Multi-day vs Hourly for Single Day)
    const isMultiDay = comparisonRanges.isMultiDay;

    let hourlyBars: Array<{
      time: string;
      sales: number;
      orders: number;
      heightPct: number;
      isPeak?: boolean;
    }> = [];

    if (isMultiDay) {
      // Date-wise sales aggregation
      const dailyMap: Record<string, { label: string; sales: number; orders: number }> = {};
      const currentCursor = new Date(filterStart);

      while (currentCursor < filterEndExclusive) {
        const ymd = new Intl.DateTimeFormat("en-CA", {
          timeZone: outletTimezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(currentCursor);

        const shortLabel = new Intl.DateTimeFormat("en-GB", {
          timeZone: outletTimezone,
          day: "numeric",
          month: "short",
        }).format(currentCursor);

        if (!dailyMap[ymd]) {
          dailyMap[ymd] = { label: shortLabel, sales: 0, orders: 0 };
        }
        currentCursor.setUTCDate(currentCursor.getUTCDate() + 1);
      }

      currentOrders.forEach((o) => {
        const ymd = new Intl.DateTimeFormat("en-CA", {
          timeZone: outletTimezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(o.createdAt));

        if (dailyMap[ymd]) {
          dailyMap[ymd].sales += Number(o.totalAmount || 0);
          dailyMap[ymd].orders += 1;
        }
      });

      let rawBars = Object.values(dailyMap).map((item) => ({
        time: item.label,
        sales: Math.round(item.sales),
        orders: item.orders,
      }));

      // Strip leading and trailing 0 sales days dynamically if sales exist
      let firstNonZero = rawBars.findIndex((b) => b.sales > 0);
      let lastNonZero = rawBars.length - 1;
      while (lastNonZero >= 0 && rawBars[lastNonZero].sales === 0) {
        lastNonZero--;
      }

      if (firstNonZero !== -1 && lastNonZero >= firstNonZero) {
        const startIdx = Math.max(0, firstNonZero - 1);
        const endIdx = Math.min(rawBars.length - 1, lastNonZero + 1);
        rawBars = rawBars.slice(startIdx, endIdx + 1);
      }

      let maxDailySales = 0;
      rawBars.forEach((b) => {
        if (b.sales > maxDailySales) maxDailySales = b.sales;
      });

      hourlyBars = rawBars.map((item) => ({
        time: item.time,
        sales: item.sales,
        orders: item.orders,
        heightPct: maxDailySales > 0 && item.sales > 0 ? Math.max(12, Math.round((item.sales / maxDailySales) * 100)) : 0,
        isPeak: maxDailySales > 0 && item.sales === maxDailySales,
      }));
    } else {
      // Single-day hourly sales aggregation (10 AM to 10 PM default window) in outlet timezone
      let minHour = 10;
      let maxHour = 22;

      // Scan current orders to ensure all active order hours are captured
      currentOrders.forEach((o) => {
        const hStr = new Intl.DateTimeFormat("en-US", {
          timeZone: outletTimezone,
          hour: "numeric",
          hour12: false,
        }).format(new Date(o.createdAt));
        const h = Number(hStr);
        if (!isNaN(h)) {
          if (h < minHour) minHour = Math.max(0, h);
          if (h > maxHour) maxHour = Math.min(23, h);
        }
      });

      const hourlyMap: Record<number, { sales: number; orders: number }> = {};
      for (let h = minHour; h <= maxHour; h++) {
        hourlyMap[h] = { sales: 0, orders: 0 };
      }

      currentOrders.forEach((o) => {
        const hStr = new Intl.DateTimeFormat("en-US", {
          timeZone: outletTimezone,
          hour: "numeric",
          hour12: false,
        }).format(new Date(o.createdAt));
        const h = Number(hStr);

        if (hourlyMap[h] !== undefined) {
          hourlyMap[h].sales += Number(o.totalAmount || 0);
          hourlyMap[h].orders += 1;
        }
      });

      const helperFormatTime = (h: number) => {
        if (h === 0) return "12 AM";
        if (h < 12) return `${h} AM`;
        if (h === 12) return "12 PM";
        return `${h - 12} PM`;
      };

      let rawBars = Object.keys(hourlyMap)
        .map((hKey) => Number(hKey))
        .sort((a, b) => a - b)
        .map((h) => ({
          hour: h,
          time: helperFormatTime(h),
          sales: Math.round(hourlyMap[h].sales),
          orders: hourlyMap[h].orders,
        }));

      // Dynamically strip leading and trailing zero sales hours if sales exist
      let firstNonZero = rawBars.findIndex((b) => b.sales > 0);
      let lastNonZero = rawBars.length - 1;
      while (lastNonZero >= 0 && rawBars[lastNonZero].sales === 0) {
        lastNonZero--;
      }

      if (firstNonZero !== -1 && lastNonZero >= firstNonZero) {
        const startIdx = Math.max(0, firstNonZero - 1);
        const endIdx = Math.min(rawBars.length - 1, lastNonZero + 1);
        rawBars = rawBars.slice(startIdx, endIdx + 1);
      }

      let maxHourlySales = 0;
      rawBars.forEach((b) => {
        if (b.sales > maxHourlySales) maxHourlySales = b.sales;
      });

      hourlyBars = rawBars.map((item) => ({
        time: item.time,
        sales: item.sales,
        orders: item.orders,
        heightPct: maxHourlySales > 0 && item.sales > 0 ? Math.max(12, Math.round((item.sales / maxHourlySales) * 100)) : 0,
        isPeak: maxHourlySales > 0 && item.sales === maxHourlySales,
      }));
    }

    // 3. Finance & Profit
    let currentCogs = 0;
    currentPeriodTxs.forEach((t) => {
      const amt = Number(t.amount || 0);
      if (t.type === "EXPENSE") {
        if (t.category === "FOOD_BEVERAGE_SUPPLIERS" || t.category === "COGS_INVENTORY") {
          currentCogs += amt;
        }
      }
    });

    const grossProfit = currentSales - currentCogs;
    const profitMargin = currentSales > 0 ? Math.round((grossProfit / currentSales) * 1000) / 10 : 0;
    const foodCostPct = currentSales > 0 ? Math.round((currentCogs / currentSales) * 1000) / 10 : 0;

    if (!isPreviousDataMissing && previousSales !== null) {
      let prevCogs = 0;
      previousPeriodTxs.forEach((t) => {
        const amt = Number(t.amount || 0);
        if (t.type === "EXPENSE") {
          if (t.category === "FOOD_BEVERAGE_SUPPLIERS" || t.category === "COGS_INVENTORY") {
            prevCogs += amt;
          }
        }
      });
      previousGrossProfit = previousSales - prevCogs;
      previousFoodCostPct = previousSales > 0 ? Math.round((prevCogs / previousSales) * 1000) / 10 : 0;
    }

    const grossProfitComparison = calculatePercentageChange(
      grossProfit,
      previousGrossProfit,
      comparisonRanges.comparisonLabel,
      true
    );

    const foodCostComparison = calculatePercentageChange(
      foodCostPct,
      previousFoodCostPct,
      comparisonRanges.comparisonLabel,
      false // Lower food cost % is better
    );

    // 4. Attendance
    const presentCount = todayAttendance.filter((a) => a.status === "PRESENT" || a.status === "ON_BREAK").length;
    const lateCount = todayAttendance.filter((a) => a.status === "LATE").length;
    const absentCount = todayAttendance.filter((a) => a.status === "ABSENT").length;

    const staffOnDuty = {
      present: presentCount + lateCount,
      total: activeEmployeesCount || 1,
      late: lateCount,
      absent: absentCount,
    };

    // 5. Critical Inventory List
    const criticalInventoryList = lowStockItems.map((item) => {
      const reorder = Number(item.reorderPoint || 0);
      const isCritical = reorder > 0;
      return {
        name: item.name,
        qty: `Reorder <= ${reorder} ${item.unitOfMeasure || "units"}`,
        status: isCritical ? "critical" : "low",
        dotColor: isCritical ? "bg-rose-500" : "bg-amber-500",
      };
    });

    // 6. Today's Shifts Computation
    const morningShifts = todayShifts.filter((s) => (s.startTime || "") < "12:00");
    const afternoonShifts = todayShifts.filter((s) => (s.startTime || "") >= "12:00" && (s.startTime || "") < "16:00");
    const eveningShifts = todayShifts.filter((s) => (s.startTime || "") >= "16:00");

    const todayShiftsData = {
      openPositions: todayShifts.length === 0 ? 0 : todayShifts.filter((s) => s.status === "SCHEDULED").length,
      morning: {
        filled: morningShifts.filter((s) => s.status === "SCHEDULED" || (s.status as string) === "COMPLETED").length,
        total: morningShifts.length,
      },
      afternoon: {
        filled: afternoonShifts.filter((s) => s.status === "SCHEDULED" || (s.status as string) === "COMPLETED").length,
        total: afternoonShifts.length,
      },
      evening: {
        filled: eveningShifts.filter((s) => s.status === "SCHEDULED" || (s.status as string) === "COMPLETED").length,
        total: eveningShifts.length,
      },
    };

    // 7. Dynamic Needs Attention List
    const needsAttentionList = [];

    if (lowStockItems.length > 0) {
      const itemNames = lowStockItems.slice(0, 2).map((i) => i.name).join(", ");
      const extraCount = lowStockItems.length > 2 ? ` and ${lowStockItems.length - 2} more items.` : ".";
      needsAttentionList.push({
        id: "low_stock",
        type: "inventory",
        title: `${lowStockItems.length} inventory items are below minimum reorder point`,
        desc: `${itemNames}${extraCount}`,
        actionText: "Review Stock",
        actionPath: "/inventory/alerts",
        iconBg: "bg-rose-500/10",
        iconColor: "text-rose-600",
        timeText: "Live Alert",
      });
    }

    if (pendingSwaps > 0) {
      needsAttentionList.push({
        id: "shift_swaps",
        type: "shifts",
        title: `${pendingSwaps} shift swap requests pending manager approval`,
        desc: "Staff members have requested shift trades that require review.",
        actionText: "Assign Staff",
        actionPath: "/shifts/rosters",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-600",
        timeText: "Pending Action",
      });
    }

    const latestPayroll = recentPayrolls[0];
    if (!latestPayroll || latestPayroll.status !== "PAID") {
      needsAttentionList.push({
        id: "payroll_cycle",
        type: "payroll",
        title: `Payroll cycle status is ${latestPayroll ? latestPayroll.status : "NOT_INITIATED"}`,
        desc: "Ensure timesheets are verified before cycle approval.",
        actionText: "Run Payroll",
        actionPath: "/payroll/runs",
        iconBg: "bg-slate-500/10",
        iconColor: "text-slate-600 dark:text-slate-300",
        timeText: "Cycle Pending",
      });
    }

    if (pendingOnboardings > 0) {
      needsAttentionList.push({
        id: "onboarding",
        type: "hr",
        title: `${pendingOnboardings} employee onboardings require document verification`,
        desc: "New team members submitted identity and tax forms.",
        actionText: "Review HR",
        actionPath: "/workforce/employees",
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-600",
        timeText: "HR Verification",
      });
    }

    // 8. Top Selling Dishes (grouped by menu item ID / dish name)
    const groupedDishesMap = new Map<string, {
      posMenuItemId: string | null;
      name: string;
      quantity: number;
      netSales: number;
      orderIds: Set<string>;
    }>();

    (topPosItems || []).forEach((item: any) => {
      const key = item.posMenuItemId || item.name.toLowerCase().trim();
      const existing = groupedDishesMap.get(key);
      const q = Number(item.quantity || 1);
      const netSalesNum = Number(item.netSales || 0);
      const totalNum = Number(item.totalPrice || 0);
      const unitNum = Number(item.unitPrice || 0);
      const net = netSalesNum > 0 ? netSalesNum : (totalNum > 0 ? totalNum : (unitNum * q));

      if (existing) {
        existing.quantity += q;
        existing.netSales += net;
        existing.orderIds.add(item.orderId);
      } else {
        groupedDishesMap.set(key, {
          posMenuItemId: item.posMenuItemId || null,
          name: item.name,
          quantity: q,
          netSales: net,
          orderIds: new Set([item.orderId]),
        });
      }
    });

    const aggregatedList = Array.from(groupedDishesMap.values()).map((g, idx) => ({
      id: idx + 1,
      name: g.name,
      qty: g.quantity,
      netSales: Math.round(g.netSales * 100) / 100,
      revenue: Math.round(g.netSales),
      ordersCount: g.orderIds.size,
    }));

    const topSellingDishes = [...aggregatedList].sort((a, b) => b.qty - a.qty).slice(0, 10);
    const topByRevenueDishes = [...aggregatedList].sort((a, b) => b.netSales - a.netSales).slice(0, 10);
    const lastSyncAt = latestIntegration?.lastSyncAt || null;

    // 9. Recent Activities Log
    const recentActivities: Array<{
      time: string;
      title: string;
      desc: string;
      author: string;
      badge: string;
      dot: string;
    }> = [];

    recentStockLogs.forEach((st) => {
      const qty = Number(st.quantity || 0);
      recentActivities.push({
        time: new Date(st.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        title: "Inventory Stock Ledger Entry",
        desc: `${st.movementType.replace(/_/g, " ")}: ${st.item?.name} (${qty} ${st.item?.unitOfMeasure || "units"})`,
        author: st.notes || "Inventory System",
        badge: `${qty > 0 ? "+" : ""}${qty}`,
        dot: qty < 0 ? "bg-rose-500" : "bg-emerald-500",
      });
    });

    recentClosings.forEach((c) => {
      recentActivities.push({
        time: new Date(c.closingDate).toLocaleDateString(),
        title: "Daily Register Closing",
        desc: `Till count: $${Number(c.actualCashCount).toFixed(2)}, Safe drop: $${Number(c.safeDeposit).toFixed(2)}`,
        author: "Cash Register Audit",
        badge: c.status,
        dot: "bg-amber-500",
      });
    });

    recentPayrolls.forEach((pr) => {
      recentActivities.push({
        time: new Date(pr.createdAt).toLocaleDateString(),
        title: "Payroll Run",
        desc: `Pay run period ending ${new Date(pr.periodEnd).toLocaleDateString()}`,
        author: "Finance Desk",
        badge: pr.status,
        dot: "bg-[#0071E3]",
      });
    });

    return NextResponse.json({
      success: true,
      outletTimezone,
      outletCurrency,
      formattedTodayDate,
      liveOps: {
        todaySales: currentSales,
        yesterdaySales: previousSales ?? 0,
        salesGrowth: salesComparison.percentageChange ?? 0,
        salesComparison,
        totalOrders: currentTotalOrders,
        ordersGrowth: ordersComparison.percentageChange ?? 0,
        ordersComparison,
        avgOrderValue: currentAov,
        aovGrowth: aovComparison.percentageChange ?? 0,
        aovComparison,
        grossProfit,
        profitMargin,
        profitGrowth: grossProfitComparison.percentageChange ?? 0,
        grossProfitComparison,
        foodCostPct,
        foodCostComparison,
        cancellationComparison,
        staffOnDuty,
        lowStockAlerts: lowStockItems.length,
        pendingActions: needsAttentionList.length,
        channelBreakdown,
        fulfillment: {
          completed,
          inProgress,
          cancelled: currentCancelled,
        },
      },
      hourlyBars,
      criticalInventoryList,
      todayShiftsData,
      needsAttentionList,
      topSellingDishes,
      topByRevenueDishes,
      lastSyncAt,
      recentActivities: recentActivities.slice(0, 6),
    });
  } catch (error: any) {
    console.error("Get Dashboard Stats Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
