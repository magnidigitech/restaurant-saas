import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { syncAutomatedTransactions } from "@/core/finance/pnlEngine";
import { z } from "zod";

const syncSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

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

    const body = await req.json().catch(() => ({}));
    const result = syncSchema.safeParse(body);
    
    const effectiveStartDate = result.success && result.data.startDate
      ? new Date(result.data.startDate)
      : new Date(Date.now() - 90 * 86400000);

    const effectiveEndDate = result.success && result.data.endDate
      ? new Date(result.data.endDate)
      : new Date(Date.now() + 60 * 86400000);

    const res = await syncAutomatedTransactions(
      session.activeRestaurantId,
      effectiveStartDate,
      effectiveEndDate
    );

    // Also sync Purchase Orders into UpcomingBill reminders
    let billsCreated = 0;
    try {
      const allPOs = await prisma.purchaseOrder.findMany({
        where: {
          restaurantId: session.activeRestaurantId,
          createdAt: { gte: effectiveStartDate, lte: effectiveEndDate },
        },
        include: { vendor: true },
      });

      for (const po of allPOs) {
        const billTitle = `PO #${po.poNumber} - ${po.vendor?.name || "Supplier"}`;
        const existingBill = await prisma.upcomingBill.findFirst({
          where: {
            restaurantId: session.activeRestaurantId,
            title: billTitle,
          },
        });

        const poCost = Number(po.grandTotal || po.totalAmount || 0);
        if (!existingBill && poCost > 0) {
          const dueDate = po.expectedDeliveryDate || new Date(new Date(po.createdAt).getTime() + 30 * 86400000);
          await prisma.upcomingBill.create({
            data: {
              restaurantId: session.activeRestaurantId,
              outletId: po.outletId,
              title: billTitle,
              category: "FOOD_BEVERAGE_SUPPLIERS",
              vendorOrInstitution: po.vendor?.name || "Supplier",
              amount: poCost,
              dueDate: new Date(dueDate),
              reminderDaysBefore: 5,
              status: po.status === "RECEIVED" ? "PAID" : "UPCOMING",
              notes: `PO Ref: PO-${po.poNumber} | Terms: Net 30 | Auto-Synced`,
              autoConvertToExpense: true,
            },
          });
          billsCreated++;
        }
      }
    } catch (poErr) {
      console.warn("PO bill sync warning:", poErr);
    }

    return NextResponse.json({
      success: true,
      message: `Reconciled ${res.createdCount} automated transactions and ${billsCreated} PO bill reminders.`,
      result: { ...res, billsCreated },
    });
  } catch (error: any) {
    console.error("Sync Automated Transactions Error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync transactions" }, { status: 400 });
  }
}
