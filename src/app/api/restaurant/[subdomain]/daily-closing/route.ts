import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createDailyClosingSchema = z.object({
  outletId: z.string().min(1, "Outlet ID is required"),
  closingDate: z.string().min(1, "Closing date is required"),
  openingTillCash: z.number().min(0, "Opening till cash cannot be negative"),
  cashSales: z.number().min(0, "Cash sales cannot be negative"),
  actualCashCount: z.number().min(0, "Actual cash count is required"),
  tomorrowOpeningCash: z.number().min(0, "Tomorrow opening cash cannot be negative"),
  notes: z.string().optional(),
  receiptUrls: z.array(z.string()).optional(),
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { restaurantId: session.activeRestaurantId };

    if (outletId) where.outletId = outletId;

    if (startDate && endDate) {
      where.closingDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.closingDate = { gte: new Date(startDate) };
    }

    const closings = await prisma.dailyCashClosing.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true } },
        adjustments: true,
      },
      orderBy: { closingDate: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, closings });
  } catch (error: any) {
    console.error("Get Daily Cash Closings Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
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
    const result = createDailyClosingSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid daily closing payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const dateObj = new Date(data.closingDate);
    const dayStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
    const dayEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

    // Fetch cash adjustments recorded for this outlet & date
    const adjustments = await prisma.cashAdjustment.findMany({
      where: {
        restaurantId: session.activeRestaurantId,
        outletId: data.outletId,
        adjustmentDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    let cashInTotal = 0;
    let cashOutTotal = 0;

    for (const adj of adjustments) {
      const amt = Number(adj.amount);
      if (adj.adjustmentType === "CASH_IN") {
        cashInTotal += amt;
      } else if (adj.adjustmentType === "CASH_OUT") {
        cashOutTotal += amt;
      }
    }

    // Formulas:
    // Expected Cash = Opening Till Cash + Today's Cash Sales + Cash In - Cash Out
    // Cash Difference = Actual Cash Count - Expected Cash
    // Safe Deposit = Actual Cash Count - Tomorrow Opening Cash
    const expectedCash = data.openingTillCash + data.cashSales + cashInTotal - cashOutTotal;
    const cashDifference = data.actualCashCount - expectedCash;
    const safeDeposit = data.actualCashCount - data.tomorrowOpeningCash;

    // Enforce note requirement for shortages or overages
    if (Math.abs(cashDifference) > 0.01 && (!data.notes || data.notes.trim() === "")) {
      return NextResponse.json(
        {
          error: `A note/explanation is required for cash discrepancy of $${cashDifference.toFixed(
            2
          )} (Expected: $${expectedCash.toFixed(2)}, Counted: $${data.actualCashCount.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    const closing = await prisma.dailyCashClosing.upsert({
      where: {
        restaurantId_outletId_closingDate: {
          restaurantId: session.activeRestaurantId,
          outletId: data.outletId,
          closingDate: dayStart,
        },
      },
      update: {
        openingTillCash: data.openingTillCash,
        cashSales: data.cashSales,
        cashInTotal,
        cashOutTotal,
        expectedCash,
        actualCashCount: data.actualCashCount,
        cashDifference,
        tomorrowOpeningCash: data.tomorrowOpeningCash,
        safeDeposit,
        notes: data.notes || null,
        receiptUrls: data.receiptUrls || undefined,
        status: "SUBMITTED",
        closedBy: session.userId,
      },
      create: {
        restaurantId: session.activeRestaurantId,
        outletId: data.outletId,
        closingDate: dayStart,
        openingTillCash: data.openingTillCash,
        cashSales: data.cashSales,
        cashInTotal,
        cashOutTotal,
        expectedCash,
        actualCashCount: data.actualCashCount,
        cashDifference,
        tomorrowOpeningCash: data.tomorrowOpeningCash,
        safeDeposit,
        notes: data.notes || null,
        receiptUrls: data.receiptUrls || undefined,
        status: "SUBMITTED",
        closedBy: session.userId,
      },
    });

    // Link the cash adjustments to this closing record
    if (adjustments.length > 0) {
      await prisma.cashAdjustment.updateMany({
        where: {
          id: { in: adjustments.map((a) => a.id) },
        },
        data: {
          dailyClosingId: closing.id,
        },
      });
    }

    return NextResponse.json({ success: true, closing }, { status: 201 });
  } catch (error: any) {
    console.error("Create Daily Cash Closing Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
