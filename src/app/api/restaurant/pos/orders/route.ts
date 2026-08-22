import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { depleteOrderInventory } from "@/core/inventory/depletionEngine";
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

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const limit = parseInt(searchParams.get("limit") || "30");

    const whereClause: any = {
      restaurantId: session.activeRestaurantId,
    };

    if (outletId) {
      whereClause.outletId = outletId;
    }

    const orders = await prisma.posOrder.findMany({
      where: whereClause,
      include: {
        outlet: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error("List POS Orders Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = createPosOrderSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid order payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Verify outlet belongs to restaurant
    const outlet = await prisma.restaurantOutlet.findFirst({
      where: { id: data.outletId, restaurantId: session.activeRestaurantId },
    });

    if (!outlet) {
      return NextResponse.json({ error: "Invalid branch outlet" }, { status: 404 });
    }

    // Generate unique order number
    const countToday = await prisma.posOrder.count({
      where: {
        restaurantId: session.activeRestaurantId,
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
        restaurantId: session.activeRestaurantId,
        outletId: data.outletId,
        orderNumber,
        tableNumber: data.tableNumber,
        orderType: data.orderType,
        status: "COMPLETED",
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
    const depletionResult = await depleteOrderInventory(order.id, session.userId);

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
