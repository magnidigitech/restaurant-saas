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

    const targetRestaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
      select: { id: true },
    });
    const restaurantId = targetRestaurant?.id || session.activeRestaurantId;

    // Fetch primary outlet to obtain timezone and currency
    const outlets = await prisma.restaurantOutlet.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
    });

    const primaryOutlet = outlets[0];
    const outletTimezone = primaryOutlet?.timezone?.trim() || "UTC";
    const outletCurrency = primaryOutlet?.currency?.trim() || "USD";

    // Helper to calculate zoned dates in the outlet's timezone
    const createCustomZonedDate = (year: number, month: number, day: number, h: number, m: number, s: number, ms: number) => {
      const candidate = new Date(Date.UTC(year, month - 1, day, h, m, s, ms));
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: outletTimezone,
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

    const getZonedBounds = (tz: string, dayOffset = 0) => {
      const targetTz = tz || "UTC";
      const refDate = new Date(Date.now() + dayOffset * 86400000);

      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: targetTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const ymd = formatter.format(refDate);
      const [year, month, day] = ymd.split("-").map(Number);

      const dObj = new Date(year, month - 1, day);
      const formattedDate = dObj.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });

      return {
        start: createCustomZonedDate(year, month, day, 0, 0, 0, 0),
        end: createCustomZonedDate(year, month, day, 23, 59, 59, 999),
        formattedDate,
        year,
        month,
        day,
      };
    };

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const period = searchParams.get("period") || "all";
    const outletId = searchParams.get("outletId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "quantity"; // quantity | revenue | orders | name
    const sortOrder = searchParams.get("sortOrder") || "desc"; // asc | desc

    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;
    let formattedPeriod = "All Time";

    const todayBounds = getZonedBounds(outletTimezone, 0);
    const yesterdayBounds = getZonedBounds(outletTimezone, -1);

    if (startDateParam) {
      const [sy, sm, sd] = startDateParam.split("-").map(Number);
      const [ey, em, ed] = (endDateParam || startDateParam).split("-").map(Number);

      const filterStart = createCustomZonedDate(sy, sm, sd, 0, 0, 0, 0);
      const filterEnd = createCustomZonedDate(ey, em, ed, 23, 59, 59, 999);
      dateFilter = { gte: filterStart, lte: filterEnd };

      const sStr = new Intl.DateTimeFormat("en-GB", { timeZone: outletTimezone, day: "numeric", month: "short" }).format(filterStart);
      const eStr = new Intl.DateTimeFormat("en-GB", { timeZone: outletTimezone, day: "numeric", month: "short" }).format(filterEnd);
      formattedPeriod = sStr === eStr ? sStr : `${sStr} - ${eStr}`;
    } else if (period === "today") {
      dateFilter = { gte: todayBounds.start, lte: todayBounds.end };
      formattedPeriod = `Today, ${todayBounds.formattedDate}`;
    } else if (period === "yesterday") {
      dateFilter = { gte: yesterdayBounds.start, lte: yesterdayBounds.end };
      formattedPeriod = `Yesterday, ${yesterdayBounds.formattedDate}`;
    } else if (period === "week") {
      const weekStart = getZonedBounds(outletTimezone, -6).start;
      dateFilter = { gte: weekStart, lte: todayBounds.end };
      formattedPeriod = `This Week (${getZonedBounds(outletTimezone, -6).formattedDate} - ${todayBounds.formattedDate})`;
    } else if (period === "month") {
      const monthStart = createCustomZonedDate(todayBounds.year, todayBounds.month, 1, 0, 0, 0, 0);
      dateFilter = { gte: monthStart, lte: todayBounds.end };
      formattedPeriod = `This Month (${todayBounds.formattedDate})`;
    }

    const [posItems, latestIntegration] = await Promise.all([
      prisma.posOrderItem.findMany({
        where: {
          order: {
            restaurantId,
            ...(outletId && outletId !== "all" ? { outletId } : {}),
            ...(dateFilter ? { createdAt: dateFilter } : {}),
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
      prisma.posIntegration.findFirst({
        where: {
          restaurantId,
          ...(outletId && outletId !== "all" ? { outletId } : {}),
        },
        orderBy: { lastSyncAt: "desc" },
        select: { lastSyncAt: true },
      }),
    ]);

    const groupedMap = new Map<string, {
      posMenuItemId: string | null;
      name: string;
      quantity: number;
      netSales: number;
      orderIds: Set<string>;
    }>();

    let totalQuantity = 0;
    let totalRevenue = 0;

    posItems.forEach((item) => {
      const key = item.posMenuItemId || item.name.toLowerCase().trim();
      const q = Number(item.quantity || 1);
      const netSalesNum = Number(item.netSales || 0);
      const totalNum = Number(item.totalPrice || 0);
      const unitNum = Number(item.unitPrice || 0);
      const net = netSalesNum > 0 ? netSalesNum : (totalNum > 0 ? totalNum : (unitNum * q));

      totalQuantity += q;
      totalRevenue += net;

      const existing = groupedMap.get(key);
      if (existing) {
        existing.quantity += q;
        existing.netSales += net;
        existing.orderIds.add(item.orderId);
      } else {
        groupedMap.set(key, {
          posMenuItemId: item.posMenuItemId || null,
          name: item.name,
          quantity: q,
          netSales: net,
          orderIds: new Set([item.orderId]),
        });
      }
    });

    let itemsList = Array.from(groupedMap.values()).map((g, idx) => {
      const netRounded = Math.round(g.netSales * 100) / 100;
      const avgPrice = g.quantity > 0 ? Math.round((g.netSales / g.quantity) * 100) / 100 : 0;
      const sharePct = totalRevenue > 0 ? Math.round((g.netSales / totalRevenue) * 1000) / 10 : 0;

      return {
        id: idx + 1,
        posMenuItemId: g.posMenuItemId,
        name: g.name,
        quantity: g.quantity,
        netSales: netRounded,
        ordersCount: g.orderIds.size,
        avgPrice,
        sharePct,
      };
    });

    if (search) {
      itemsList = itemsList.filter((item) => item.name.toLowerCase().includes(search));
    }

    // Sort items
    itemsList.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "revenue") {
        comparison = b.netSales - a.netSales;
      } else if (sortBy === "orders") {
        comparison = b.ordersCount - a.ordersCount;
      } else if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else {
        // default quantity
        comparison = b.quantity - a.quantity;
      }
      return sortOrder === "asc" ? -comparison : comparison;
    });

    const topItem = itemsList.length > 0 ? itemsList[0].name : "N/A";

    return NextResponse.json({
      success: true,
      outletCurrency,
      outletTimezone,
      formattedPeriod,
      lastSyncAt: latestIntegration?.lastSyncAt || null,
      summary: {
        totalUniqueItems: groupedMap.size,
        totalQuantitySold: totalQuantity,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        topItem,
      },
      items: itemsList,
    });
  } catch (error: any) {
    console.error("List POS All Items Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
