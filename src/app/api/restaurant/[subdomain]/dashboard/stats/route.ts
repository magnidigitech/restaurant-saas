import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

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

    const restaurantId = session.activeRestaurantId;

    // Fetch primary outlet to obtain timezone and currency configuration
    const outlets = await prisma.restaurantOutlet.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
    });

    const primaryOutlet = outlets[0];
    const outletTimezone = primaryOutlet?.timezone?.trim() || "UTC";
    const outletCurrency = primaryOutlet?.currency?.trim() || "USD";

    // Helper to calculate start/end bounds for any given day in the outlet's timezone
    const getZonedBounds = (tz: string, dayOffset = 0) => {
      const targetTz = tz || "UTC";
      const refDate = new Date(Date.now() + dayOffset * 86400000);

      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: targetTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const ymd = formatter.format(refDate); // "YYYY-MM-DD"
      const [year, month, day] = ymd.split("-").map(Number);

      const createZonedDate = (h: number, m: number, s: number, ms: number) => {
        const candidate = new Date(Date.UTC(year, month - 1, day, h, m, s, ms));
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: targetTz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).formatToParts(candidate);

        const partMap: Record<string, string> = {};
        parts.forEach((p) => { partMap[p.type] = p.value; });

        let localH = Number(partMap.hour);
        if (localH === 24) localH = 0;

        const localZoned = new Date(
          Date.UTC(
            Number(partMap.year),
            Number(partMap.month) - 1,
            Number(partMap.day),
            localH,
            Number(partMap.minute),
            Number(partMap.second)
          )
        );

        const diffMs = candidate.getTime() - localZoned.getTime();
        return new Date(candidate.getTime() + diffMs);
      };

      const dObj = new Date(year, month - 1, day);
      const formattedDate = dObj.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });

      return {
        start: createZonedDate(0, 0, 0, 0),
        end: createZonedDate(23, 59, 59, 999),
        formattedDate,
        year,
        month,
        day,
      };
    };

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "today";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const todayBounds = getZonedBounds(outletTimezone, 0);
    const yesterdayBounds = getZonedBounds(outletTimezone, -1);

    const todayStart = todayBounds.start;
    const todayEnd = todayBounds.end;

    const yesterdayStart = yesterdayBounds.start;
    const yesterdayEnd = yesterdayBounds.end;

    // Start of current month in outlet's timezone
    const monthStart = getZonedBounds(outletTimezone, 0).start;
    monthStart.setUTCDate(1);

    let filterStart: Date = todayStart;
    let filterEnd: Date = todayEnd;
    let formattedTodayDate = todayBounds.formattedDate;

    if (startDateParam && endDateParam) {
      filterStart = new Date(startDateParam);
      filterEnd = new Date(endDateParam);
      if (isNaN(filterEnd.getTime())) {
        filterEnd = todayEnd;
      } else {
        filterEnd.setHours(23, 59, 59, 999);
      }
      const sStr = filterStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const eStr = filterEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      formattedTodayDate = `${sStr} - ${eStr}`;
    } else if (period === "yesterday") {
      filterStart = yesterdayStart;
      filterEnd = yesterdayEnd;
      formattedTodayDate = `Yesterday, ${yesterdayBounds.formattedDate}`;
    } else if (period === "week") {
      filterStart = getZonedBounds(outletTimezone, -6).start;
      filterEnd = todayEnd;
      formattedTodayDate = `This Week (${getZonedBounds(outletTimezone, -6).formattedDate} - ${todayBounds.formattedDate})`;
    } else if (period === "month") {
      filterStart = monthStart;
      filterEnd = todayEnd;
      formattedTodayDate = `This Month (${todayBounds.formattedDate})`;
    } else {
      filterStart = todayStart;
      filterEnd = todayEnd;
      formattedTodayDate = todayBounds.formattedDate;
    }

    // Parallel Database Queries for maximum speed
    const [
      todayOrders,
      yesterdayOrders,
      todayRevenueTxs,
      monthTxs,
      activeEmployeesCount,
      todayAttendance,
      lowStockItems,
      topPosItems,
      recentStockLogs,
      recentClosings,
      recentPayrolls,
      todayShifts,
      pendingSwaps,
      pendingOnboardings,
    ] = await Promise.all([
      // 1. Filtered POS Orders
      prisma.posOrder.findMany({
        where: {
          restaurantId,
          createdAt: { gte: filterStart, lte: filterEnd },
        },
        select: {
          id: true,
          totalAmount: true,
          orderType: true,
          status: true,
          createdAt: true,
        },
      }),

      // 2. Yesterday POS Orders (for comparison)
      prisma.posOrder.findMany({
        where: {
          restaurantId,
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
        select: { totalAmount: true },
      }),

      // 3. Filtered Revenue Transactions
      prisma.financialTransaction.findMany({
        where: {
          restaurantId,
          type: "REVENUE",
          transactionDate: { gte: filterStart, lte: filterEnd },
        },
        select: { amount: true },
      }),

      // 4. Month Financial Transactions
      prisma.financialTransaction.findMany({
        where: {
          restaurantId,
          transactionDate: { gte: monthStart },
        },
        select: { type: true, category: true, amount: true },
      }),

      // 5. Total Employees
      prisma.employee.count({
        where: { restaurantId },
      }),

      // 6. Today Attendance Records
      prisma.attendanceRecord.findMany({
        where: {
          restaurantId,
          workDate: { gte: todayStart, lte: todayEnd },
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

      // 8. Top Selling POS Order Items
      prisma.posOrderItem.groupBy({
        by: ["name"],
        where: {
          order: {
            restaurantId,
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
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

    // 1. Sales & Order Calculations
    const posSalesToday = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const ledgerSalesToday = todayRevenueTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const todaySales = posSalesToday > 0 ? posSalesToday : ledgerSalesToday;

    const posSalesYesterday = yesterdayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const yesterdaySales = posSalesYesterday > 0 ? posSalesYesterday : 0;

    const salesGrowth = yesterdaySales > 0
      ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 1000) / 10
      : (todaySales > 0 ? 100 : 0);

    const totalOrders = todayOrders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(todaySales / totalOrders) : 0;

    // Channels
    const dineInOrds = todayOrders.filter((o) => o.orderType === "DINE_IN");
    const deliveryOrds = todayOrders.filter((o) => o.orderType === "DELIVERY");
    const takeawayOrds = todayOrders.filter((o) => o.orderType === "TAKEAWAY");

    const dineInAmt = dineInOrds.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const deliveryAmt = deliveryOrds.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const takeawayAmt = takeawayOrds.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

    const totalPosAmt = todaySales || 1;

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

    // Fulfillment
    const completed = todayOrders.filter((o) => o.status === "COMPLETED" || (o.status as string) === "SETTLED").length;
    const inProgress = todayOrders.filter((o) => o.status === "PENDING" || o.status === "PREPARING").length;
    const cancelled = todayOrders.filter((o) => o.status === "CANCELLED").length;

    // 2. Hourly Sales Bars for today (10 AM to 10 PM)
    const hourlyMap: Record<number, { sales: number; orders: number }> = {};
    for (let h = 10; h <= 22; h++) {
      hourlyMap[h] = { sales: 0, orders: 0 };
    }

    todayOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      if (hourlyMap[h]) {
        hourlyMap[h].sales += Number(o.totalAmount || 0);
        hourlyMap[h].orders += 1;
      }
    });

    let maxHourlySales = 1;
    Object.values(hourlyMap).forEach((val) => {
      if (val.sales > maxHourlySales) maxHourlySales = val.sales;
    });

    const hourlyBars = [
      { time: "10 AM", sales: Math.round(hourlyMap[10].sales), orders: hourlyMap[10].orders, heightPct: Math.max(15, Math.round((hourlyMap[10].sales / maxHourlySales) * 100)) },
      { time: "", sales: Math.round(hourlyMap[11].sales), orders: hourlyMap[11].orders, heightPct: Math.max(15, Math.round((hourlyMap[11].sales / maxHourlySales) * 100)) },
      { time: "12 PM", sales: Math.round(hourlyMap[12].sales), orders: hourlyMap[12].orders, heightPct: Math.max(15, Math.round((hourlyMap[12].sales / maxHourlySales) * 100)) },
      { time: "", sales: Math.round(hourlyMap[13].sales), orders: hourlyMap[13].orders, heightPct: Math.max(15, Math.round((hourlyMap[13].sales / maxHourlySales) * 100)) },
      { time: "2 PM", sales: Math.round(hourlyMap[14].sales), orders: hourlyMap[14].orders, heightPct: Math.max(15, Math.round((hourlyMap[14].sales / maxHourlySales) * 100)) },
      { time: "", sales: Math.round(hourlyMap[15].sales), orders: hourlyMap[15].orders, heightPct: Math.max(15, Math.round((hourlyMap[15].sales / maxHourlySales) * 100)) },
      { time: "4 PM", sales: Math.round(hourlyMap[16].sales), orders: hourlyMap[16].orders, heightPct: Math.max(15, Math.round((hourlyMap[16].sales / maxHourlySales) * 100)) },
      { time: "", sales: Math.round(hourlyMap[17].sales), orders: hourlyMap[17].orders, heightPct: Math.max(15, Math.round((hourlyMap[17].sales / maxHourlySales) * 100)) },
      { time: "6 PM", sales: Math.round(hourlyMap[18].sales), orders: hourlyMap[18].orders, heightPct: Math.max(15, Math.round((hourlyMap[18].sales / maxHourlySales) * 100)) },
      { time: "", sales: Math.round(hourlyMap[19].sales), orders: hourlyMap[19].orders, heightPct: Math.max(15, Math.round((hourlyMap[19].sales / maxHourlySales) * 100)) },
      { time: "8 PM", sales: Math.round(hourlyMap[20].sales), orders: hourlyMap[20].orders, heightPct: Math.max(15, Math.round((hourlyMap[20].sales / maxHourlySales) * 100)) },
      { time: "", sales: Math.round(hourlyMap[21].sales), orders: hourlyMap[21].orders, heightPct: Math.max(15, Math.round((hourlyMap[21].sales / maxHourlySales) * 100)) },
      { time: "10 PM", sales: Math.round(hourlyMap[22].sales), orders: hourlyMap[22].orders, heightPct: Math.max(15, Math.round((hourlyMap[22].sales / maxHourlySales) * 100)) },
    ];

    // 3. Finance & Profit
    let totalMonthRev = 0;
    let totalMonthExp = 0;
    let totalCogs = 0;

    monthTxs.forEach((t) => {
      const amt = Number(t.amount || 0);
      if (t.type === "REVENUE") {
        totalMonthRev += amt;
      } else if (t.type === "EXPENSE") {
        totalMonthExp += amt;
        if (t.category === "FOOD_BEVERAGE_SUPPLIERS" || t.category === "COGS_INVENTORY") {
          totalCogs += amt;
        }
      }
    });

    const grossProfit = totalMonthRev - totalCogs;
    const profitMargin = totalMonthRev > 0 ? Math.round((grossProfit / totalMonthRev) * 1000) / 10 : 0;
    const foodCostPct = totalMonthRev > 0 ? Math.round((totalCogs / totalMonthRev) * 1000) / 10 : 0;

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

    // 8. Top Selling Dishes
    const dishIcons = ["🍗", "🧀", "🍚", "🫓", "🥘"];
    const topSellingDishes = topPosItems.map((item, idx) => ({
      id: idx + 1,
      name: item.name,
      qty: item._sum?.quantity || 0,
      revenue: Math.round(Number(item._sum?.totalPrice || 0)),
      icon: dishIcons[idx % dishIcons.length],
    }));

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
      formattedTodayDate: todayBounds.formattedDate,
      liveOps: {
        todaySales,
        yesterdaySales,
        salesGrowth,
        totalOrders,
        ordersGrowth: 0,
        avgOrderValue,
        aovGrowth: 0,
        grossProfit,
        profitMargin,
        profitGrowth: 0,
        foodCostPct,
        staffOnDuty,
        lowStockAlerts: lowStockItems.length,
        pendingActions: needsAttentionList.length,
        channelBreakdown,
        fulfillment: {
          completed,
          inProgress,
          cancelled,
        },
      },
      hourlyBars,
      criticalInventoryList,
      todayShiftsData,
      needsAttentionList,
      topSellingDishes,
      recentActivities: recentActivities.slice(0, 6),
    });
  } catch (error: any) {
    console.error("Get Dashboard Stats Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
