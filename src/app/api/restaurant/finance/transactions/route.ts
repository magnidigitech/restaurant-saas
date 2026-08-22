import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createTransactionSchema = z.object({
  type: z.enum(["EXPENSE", "REVENUE"]),
  category: z.enum([
    "FOOD_BEVERAGE_SUPPLIERS",
    "PACKAGING_CONSUMABLES",
    "RENT_PROPERTY_LEASE",
    "UTILITIES",
    "STAFF_PAYROLL",
    "EQUIPMENT_FINANCING_LEASE",
    "MAINTENANCE_REPAIRS",
    "CLEANING_HYGIENE",
    "TAXES_LICENSES",
    "SAAS_TECHNOLOGY",
    "MARKETING_ADVERTISING",
    "INSURANCE",
    "BANKING_PAYMENT_PROCESSING",
    "DELIVERY_LOGISTICS",
    "OTHER_OPERATIONAL_EXPENSES",
    "COGS_INVENTORY",
    "PAYROLL_LABOR",
    "RENT_OCCUPANCY",
    "EQUIPMENT_MAINTENANCE",
    "SOFTWARE_SUBSCRIPTION",
    "WASTAGE",
    "MISC_EXPENSE",
    "POS_SALES",
    "POS_DINE_IN",
    "POS_TAKEAWAY",
    "POS_DELIVERY",
    "CATERING_EVENTS",
    "THIRD_PARTY_DELIVERY",
    "MERCHANDISE",
    "REBATES_CREDITS",
    "OTHER_INCOME",
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().min(0.01),
  taxAmount: z.number().min(0).default(0),
  transactionDate: z.string().min(1),
  vendorOrPayer: z.string().optional(),
  paymentMethod: z.string().optional(),
  receiptUrl: z.string().optional(),
  outletId: z.string().optional(),
  costCenterId: z.string().optional(),
  isRecurring: z.boolean().default(false),
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
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const outletId = searchParams.get("outletId");
    const search = searchParams.get("search");

    const where: any = { restaurantId: session.activeRestaurantId };

    if (type) where.type = type;
    if (category) where.category = category;
    if (outletId) where.outletId = outletId;

    if (startDate && endDate) {
      where.transactionDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.transactionDate = { gte: new Date(startDate) };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { vendorOrPayer: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true, code: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    console.error("Get Financial Transactions Error:", error);
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
    const result = createTransactionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid transaction payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const netAmount = data.amount - data.taxAmount;

    const transaction = await prisma.financialTransaction.create({
      data: {
        restaurantId: session.activeRestaurantId,
        outletId: data.outletId || null,
        costCenterId: data.costCenterId || null,
        type: data.type,
        category: data.category,
        source: "MANUAL_ENTRY",
        title: data.title,
        description: data.description || null,
        amount: data.amount,
        taxAmount: data.taxAmount,
        netAmount,
        transactionDate: new Date(data.transactionDate),
        vendorOrPayer: data.vendorOrPayer || null,
        paymentMethod: data.paymentMethod || "CASH",
        receiptUrl: data.receiptUrl || null,
        isRecurring: data.isRecurring,
        createdBy: session.userId,
      },
    });

    return NextResponse.json({ success: true, transaction }, { status: 201 });
  } catch (error: any) {
    console.error("Create Financial Transaction Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
