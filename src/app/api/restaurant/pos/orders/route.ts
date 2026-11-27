import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { depleteOrderInventory } from "@/core/inventory/depletionEngine";
import { getUnifiedOrdersDashboard } from "@/modules/pos-integrations/service";
import {
  assertPosOutletInScope,
  getPosActorContext,
} from "@/modules/pos-integrations/authHelper";
import { z } from "zod";

const createOrderItemSchema = z.object({
  recipeId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
  notes: z.string().optional(),
});

const createPosOrderSchema = z.object({
  outletId: z.string(),
  tableNumber: z.string().optional(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).default("DINE_IN"),
  paymentMethod: z.string().default("CASH"),
  notes: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1),
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseOutletDateBound(dateStr: string, timeZone: string, endOfDay: boolean): Date {
  // If full ISO timestamp is already provided, use it directly
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(utcGuess);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = Number(p.value);
    }
    const tzHour = map.hour === 24 ? 0 : map.hour;
    const tzAsUtc = Date.UTC(map.year, map.month - 1, map.day, tzHour, map.minute, map.second);
    const offsetMs = tzAsUtc - utcGuess.getTime();
    return new Date(utcGuess.getTime() - offsetMs);
  } catch {
    return utcGuess;
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getPosActorContext({ requireView: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;
    const provider = searchParams.get("provider") || undefined;
    const status = searchParams.get("status") || undefined;
    const businessDate = searchParams.get("businessDate") || undefined;
    const search = searchParams.get("search") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(
      searchParams.get("pageSize") || searchParams.get("limit") || "100",
      10
    );

    if (outletId && outletId !== "ALL") {
      const scope = assertPosOutletInScope(auth.ctx, outletId);
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    let outletTimeZone = "UTC";
    if (outletId && outletId !== "ALL") {
      const outletRow = await prisma.restaurantOutlet.findFirst({
        where: { id: outletId, restaurantId: auth.ctx.restaurantId },
        select: { timezone: true },
      });
      if (outletRow?.timezone) outletTimeZone = outletRow.timezone;
    }

    const result = await getUnifiedOrdersDashboard(auth.ctx.restaurantId, {
      outletId,
      accessibleOutletIds: auth.ctx.accessibleOutletIds,
      provider,
      status,
      businessDate,
      search,
      startDate: startDate ? parseOutletDateBound(startDate, outletTimeZone, false) : undefined,
      endDate: endDate ? parseOutletDateBound(endDate, outletTimeZone, true) : undefined,
      page,
      pageSize,
    });

    return NextResponse.json(
      {
        success: true,
        orders: result.orders,
        pagination: result.pagination,
        totalsByCurrency: result.totalsByCurrency,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("List POS Orders Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = createPosOrderSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid order payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;
    const auth = await getPosActorContext({
      requireTakeOrders: true,
      outletId: data.outletId,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Verify outlet belongs to restaurant
    const outlet = await prisma.restaurantOutlet.findFirst({
      where: { id: data.outletId, restaurantId: auth.ctx.restaurantId },
    });

    if (!outlet) {
      return NextResponse.json({ error: "Invalid branch outlet" }, { status: 404 });
    }

    // Generate unique order number
    const countToday = await prisma.posOrder.count({
      where: {
        restaurantId: auth.ctx.restaurantId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderNumber = `ORD-${dateStr}-${(countToday + 1).toString().padStart(4, "0")}`;

    // Calculate totals
    const totalAmount = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const taxAmount = totalAmount * 0.05; // 5% default standard tax
    const finalAmount = totalAmount + taxAmount;

    // Create POS Order and line items
    const order = await prisma.posOrder.create({
      data: {
        restaurantId: auth.ctx.restaurantId,
        outletId: data.outletId,
        orderNumber,
        tableNumber: data.tableNumber,
        orderType: data.orderType,
        status: "COMPLETED",
        currency: outlet.currency || "USD",
        totalAmount,
        taxAmount,
        discountAmount: 0,
        finalAmount,
        paymentStatus: "PAID",
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        items: {
          create: data.items.map((i) => ({
            recipeId: i.recipeId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
            netSales: i.quantity * i.unitPrice,
            notes: i.notes,
          })),
        },
      },
      include: {
        items: true,
        outlet: true,
      },
    });

    // Execute automatic stock deduction engine
    const depletionResult = await depleteOrderInventory(order.id, auth.ctx.userId);

    return NextResponse.json(
      {
        success: true,
        order,
        depletion: depletionResult,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create POS Order Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
