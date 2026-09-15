import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const outletId = searchParams.get("outletId");

    const where: any = {
      restaurantId: session.activeRestaurantId,
      type: "EXPENSE",
    };

    if (outletId) where.outletId = outletId;

    if (startDate && endDate) {
      where.transactionDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.transactionDate = { gte: new Date(startDate) };
    }

    const expenseTxs = await prisma.financialTransaction.findMany({
      where,
      select: {
        id: true,
        title: true,
        vendorOrPayer: true,
        transactionDate: true,
        amount: true,
        subtotal: true,
        gstAmount: true,
        otherFeesAmount: true,
        otherFeeType: true,
        category: true,
        receiptUrl: true,
        outlet: { select: { name: true } },
      },
      orderBy: { transactionDate: "desc" },
    });

    let totalGstPaid = 0;
    let totalSubtotal = 0;
    let totalOtherFees = 0;
    let totalExpenseAmount = 0;

    const feesByType: Record<string, number> = {};

    for (const tx of expenseTxs) {
      const gst = Number(tx.gstAmount || 0);
      const sub = Number(tx.subtotal || 0);
      const fee = Number(tx.otherFeesAmount || 0);
      const total = Number(tx.amount || 0);

      totalGstPaid += gst;
      totalSubtotal += sub;
      totalOtherFees += fee;
      totalExpenseAmount += total;

      if (fee > 0) {
        const feeType = tx.otherFeeType || "Unspecified Fee";
        feesByType[feeType] = (feesByType[feeType] || 0) + fee;
      }
    }

    const feesBreakdown = Object.entries(feesByType).map(([feeType, amount]) => ({
      feeType,
      amount,
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalExpenseAmount,
        totalSubtotal,
        totalGstPaid,
        totalOtherFees,
        transactionCount: expenseTxs.length,
      },
      feesBreakdown,
      transactions: expenseTxs,
    });
  } catch (error: any) {
    console.error("Get GST & Fee Report Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
