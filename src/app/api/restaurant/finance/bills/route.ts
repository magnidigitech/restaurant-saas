import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { getUpcomingBillsSummary, updateUpcomingBill, markBillAsPaid } from "@/core/finance/billsEngine";
import { z } from "zod";

const createBillSchema = z.object({
  title: z.string().min(1),
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
    "CREDIT_CARD",
    "VENDOR_INVOICE",
    "RENT_OCCUPANCY",
    "UTILITY",
    "LOAN_LEASE",
    "TAX_GOVERNMENT",
    "SUBSCRIPTION",
    "OTHER",
  ]),
  vendorOrInstitution: z.string().min(1),
  accountLast4: z.string().optional(),
  amount: z.number().min(0.01),
  adjustedAmount: z.number().optional().nullable(),
  dueDate: z.string().min(1),
  reminderDaysBefore: z.number().int().min(1).max(60).default(5),
  notes: z.string().optional(),
  receiptOrInvoiceUrl: z.string().optional(),
  autoConvertToExpense: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.string().optional(),
  outletId: z.string().optional(),
});

const patchBillSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["ADJUST_AMOUNT", "MARK_PAID", "UPDATE_DETAILS"]).default("UPDATE_DETAILS"),
  adjustedAmount: z.number().optional().nullable(),
  amount: z.number().optional(),
  title: z.string().optional(),
  dueDate: z.string().optional(),
  reminderDaysBefore: z.number().int().optional(),
  notes: z.string().optional(),
  paidAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  paidAt: z.string().optional(),
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
    const outletId = searchParams.get("outletId") || undefined;

    const summary = await getUpcomingBillsSummary(session.activeRestaurantId, outletId);

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error("Get Upcoming Bills Error:", error);
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
    const result = createBillSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid bill payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const bill = await (prisma as any).upcomingBill.create({
      data: {
        restaurantId: session.activeRestaurantId,
        outletId: data.outletId || null,
        title: data.title,
        category: data.category,
        vendorOrInstitution: data.vendorOrInstitution,
        accountLast4: data.accountLast4 || null,
        amount: data.amount,
        adjustedAmount: data.adjustedAmount !== undefined && data.adjustedAmount !== null ? data.adjustedAmount : null,
        dueDate: new Date(data.dueDate),
        reminderDaysBefore: data.reminderDaysBefore,
        notes: data.notes || null,
        receiptOrInvoiceUrl: data.receiptOrInvoiceUrl || null,
        autoConvertToExpense: data.autoConvertToExpense,
        isRecurring: data.isRecurring,
        recurringFrequency: data.recurringFrequency || null,
        createdBy: session.userId,
      },
    });

    return NextResponse.json({ success: true, bill }, { status: 201 });
  } catch (error: any) {
    console.error("Create Upcoming Bill Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create bill" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    const result = patchBillSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid patch payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { id, action, adjustedAmount, amount, title, dueDate, reminderDaysBefore, notes, paidAmount, paymentMethod, paidAt } =
      result.data;

    if (action === "MARK_PAID") {
      const res = await markBillAsPaid(id, session.activeRestaurantId, {
        paidAmount,
        paymentMethod,
        paidAt: paidAt ? new Date(paidAt) : undefined,
        userId: session.userId,
      });
      return NextResponse.json(res);
    }

    // Default: update details or adjust amount
    const updated = await updateUpcomingBill(id, session.activeRestaurantId, {
      adjustedAmount,
      amount,
      title,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      reminderDaysBefore,
      notes,
    });

    return NextResponse.json({ success: true, bill: updated });
  } catch (error: any) {
    console.error("Update Upcoming Bill Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update bill" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const billId = searchParams.get("id");
    if (!billId) {
      return NextResponse.json({ error: "Bill ID is required" }, { status: 400 });
    }

    await (prisma as any).upcomingBill.deleteMany({
      where: { id: billId, restaurantId: session.activeRestaurantId },
    });

    return NextResponse.json({ success: true, message: "Bill dismissed successfully" });
  } catch (error: any) {
    console.error("Delete Upcoming Bill Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete bill" }, { status: 500 });
  }
}
