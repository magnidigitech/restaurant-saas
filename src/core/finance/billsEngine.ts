import { prisma } from "@/core/database/client";
import { Prisma } from "@prisma/client";

export interface EvaluatedBill {
  id: string;
  title: string;
  category: string;
  vendorOrInstitution: string;
  accountLast4?: string | null;
  amount: number;
  adjustedAmount?: number | null;
  effectiveAmount: number;
  dueDate: string;
  reminderDaysBefore: number;
  status: "UPCOMING" | "DUE_SOON" | "OVERDUE" | "PAID" | "DEFERRED";
  daysUntilDue: number;
  isUrgentReminder: boolean;
  notes?: string | null;
  receiptOrInvoiceUrl?: string | null;
  autoConvertToExpense: boolean;
  isRecurring: boolean;
  recurringFrequency?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
  paymentMethod?: string | null;
  financialTxId?: string | null;
  outletName?: string | null;
}

export interface BillsRunwaySummary {
  totalPendingLiabilities: number;
  totalDueNext7Days: number;
  totalDueNext30Days: number;
  totalOverdue: number;
  totalPaidThisMonth: number;
  urgentAlertCount: number;
  bills: EvaluatedBill[];
}

/**
 * Maps a BillCategory to a FinancialCategory for the P&L Ledger.
 */
function mapBillCategoryToFinancialCategory(billCategory: string): string {
  switch (billCategory) {
    case "FOOD_BEVERAGE_SUPPLIERS":
    case "VENDOR_INVOICE":
      return "FOOD_BEVERAGE_SUPPLIERS";
    case "PACKAGING_CONSUMABLES":
      return "PACKAGING_CONSUMABLES";
    case "RENT_PROPERTY_LEASE":
    case "RENT_OCCUPANCY":
      return "RENT_PROPERTY_LEASE";
    case "UTILITIES":
    case "UTILITY":
      return "UTILITIES";
    case "STAFF_PAYROLL":
      return "STAFF_PAYROLL";
    case "EQUIPMENT_FINANCING_LEASE":
    case "LOAN_LEASE":
      return "EQUIPMENT_FINANCING_LEASE";
    case "MAINTENANCE_REPAIRS":
      return "MAINTENANCE_REPAIRS";
    case "CLEANING_HYGIENE":
      return "CLEANING_HYGIENE";
    case "TAXES_LICENSES":
    case "TAX_GOVERNMENT":
      return "TAXES_LICENSES";
    case "SAAS_TECHNOLOGY":
    case "SUBSCRIPTION":
      return "SAAS_TECHNOLOGY";
    case "MARKETING_ADVERTISING":
      return "MARKETING_ADVERTISING";
    case "INSURANCE":
      return "INSURANCE";
    case "BANKING_PAYMENT_PROCESSING":
    case "CREDIT_CARD":
      return "BANKING_PAYMENT_PROCESSING";
    case "DELIVERY_LOGISTICS":
      return "DELIVERY_LOGISTICS";
    case "OTHER_OPERATIONAL_EXPENSES":
    case "OTHER":
    default:
      return "OTHER_OPERATIONAL_EXPENSES";
  }
}

/**
 * Evaluates and returns all bills with live urgency alerts, day countdowns, and summary totals.
 */
export async function getUpcomingBillsSummary(
  restaurantId: string,
  outletId?: string
): Promise<BillsRunwaySummary> {
  const where: any = { restaurantId };
  if (outletId) where.outletId = outletId;

  let rawBills: any[] = [];
  try {
    if ((prisma as any).upcomingBill) {
      rawBills = await (prisma as any).upcomingBill.findMany({
        where,
        include: { outlet: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      });
    }
  } catch {
    rawBills = [];
  }

  const now = new Date();
  const nowMs = now.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  let totalPendingLiabilities = 0;
  let totalDueNext7Days = 0;
  let totalDueNext30Days = 0;
  let totalOverdue = 0;
  let totalPaidThisMonth = 0;
  let urgentAlertCount = 0;

  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const evaluatedBills: EvaluatedBill[] = rawBills.map((b) => {
    const rawAmt = Number(b.amount || 0);
    const adjAmt = b.adjustedAmount !== null && b.adjustedAmount !== undefined ? Number(b.adjustedAmount) : null;
    const effectiveAmt = adjAmt !== null ? adjAmt : rawAmt;

    const due = new Date(b.dueDate);
    const diffMs = due.getTime() - nowMs;
    const daysUntilDue = Math.ceil(diffMs / msPerDay);

    let status: "UPCOMING" | "DUE_SOON" | "OVERDUE" | "PAID" | "DEFERRED" = b.status;
    let isUrgentReminder = false;

    if (b.status === "PAID") {
      status = "PAID";
      if (b.paidAt && new Date(b.paidAt) >= currentMonthStart) {
        totalPaidThisMonth += Number(b.paidAmount || effectiveAmt);
      }
    } else if (b.status === "DEFERRED") {
      status = "DEFERRED";
    } else {
      // Live calculation of status
      if (daysUntilDue < 0) {
        status = "OVERDUE";
        isUrgentReminder = true;
        totalOverdue += effectiveAmt;
        urgentAlertCount++;
      } else if (daysUntilDue <= (b.reminderDaysBefore || 5)) {
        status = "DUE_SOON";
        isUrgentReminder = true;
        urgentAlertCount++;
      } else {
        status = "UPCOMING";
      }

      totalPendingLiabilities += effectiveAmt;

      if (daysUntilDue >= 0 && daysUntilDue <= 7) {
        totalDueNext7Days += effectiveAmt;
      }
      if (daysUntilDue >= 0 && daysUntilDue <= 30) {
        totalDueNext30Days += effectiveAmt;
      }
    }

    return {
      id: b.id,
      title: b.title,
      category: b.category,
      vendorOrInstitution: b.vendorOrInstitution,
      accountLast4: b.accountLast4,
      amount: rawAmt,
      adjustedAmount: adjAmt,
      effectiveAmount: effectiveAmt,
      dueDate: due.toISOString().split("T")[0],
      reminderDaysBefore: b.reminderDaysBefore || 5,
      status,
      daysUntilDue,
      isUrgentReminder,
      notes: b.notes,
      receiptOrInvoiceUrl: b.receiptOrInvoiceUrl,
      autoConvertToExpense: b.autoConvertToExpense,
      isRecurring: b.isRecurring,
      recurringFrequency: b.recurringFrequency,
      paidAt: b.paidAt ? new Date(b.paidAt).toISOString() : null,
      paidAmount: b.paidAmount ? Number(b.paidAmount) : null,
      paymentMethod: b.paymentMethod,
      financialTxId: b.financialTxId,
      outletName: b.outlet?.name || null,
    };
  });

  return {
    totalPendingLiabilities: Number(totalPendingLiabilities.toFixed(2)),
    totalDueNext7Days: Number(totalDueNext7Days.toFixed(2)),
    totalDueNext30Days: Number(totalDueNext30Days.toFixed(2)),
    totalOverdue: Number(totalOverdue.toFixed(2)),
    totalPaidThisMonth: Number(totalPaidThisMonth.toFixed(2)),
    urgentAlertCount,
    bills: evaluatedBills,
  };
}

/**
 * Adjusts the upcoming bill amount and/or reminder threshold.
 */
export async function updateUpcomingBill(
  billId: string,
  restaurantId: string,
  updates: {
    adjustedAmount?: number | null;
    amount?: number;
    title?: string;
    dueDate?: Date;
    reminderDaysBefore?: number;
    notes?: string;
    vendorOrInstitution?: string;
    accountLast4?: string;
    category?: any;
    status?: any;
  }
) {
  const data: any = {};
  if (updates.adjustedAmount !== undefined) {
    data.adjustedAmount = updates.adjustedAmount !== null ? new Prisma.Decimal(updates.adjustedAmount) : null;
  }
  if (updates.amount !== undefined) {
    data.amount = new Prisma.Decimal(updates.amount);
  }
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.dueDate !== undefined) data.dueDate = updates.dueDate;
  if (updates.reminderDaysBefore !== undefined) data.reminderDaysBefore = updates.reminderDaysBefore;
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.vendorOrInstitution !== undefined) data.vendorOrInstitution = updates.vendorOrInstitution;
  if (updates.accountLast4 !== undefined) data.accountLast4 = updates.accountLast4;
  if (updates.category !== undefined) data.category = updates.category;
  if (updates.status !== undefined) data.status = updates.status;

  return await (prisma as any).upcomingBill.update({
    where: { id: billId, restaurantId },
    data,
  });
}

/**
 * Settles a bill as PAID, recording final paid amount and automatically logging
 * a corresponding FinancialTransaction expense in the accounting ledger.
 */
export async function markBillAsPaid(
  billId: string,
  restaurantId: string,
  params: {
    paidAmount?: number;
    paymentMethod?: string;
    paidAt?: Date;
    userId?: string;
  }
) {
  const bill = await (prisma as any).upcomingBill.findFirst({
    where: { id: billId, restaurantId },
  });

  if (!bill) {
    throw new Error("Bill not found");
  }

  const finalPaidAmount =
    params.paidAmount !== undefined
      ? params.paidAmount
      : bill.adjustedAmount !== null && bill.adjustedAmount !== undefined
      ? Number(bill.adjustedAmount)
      : Number(bill.amount);

  const settlementDate = params.paidAt || new Date();
  const paymentMethod = params.paymentMethod || bill.paymentMethod || "BANK_TRANSFER";

  let financialTxId: string | null = bill.financialTxId;

  // Auto-convert to expense transaction if enabled
  if (bill.autoConvertToExpense && !financialTxId) {
    const finCat = mapBillCategoryToFinancialCategory(bill.category);
    const tx = await prisma.financialTransaction.create({
      data: {
        restaurantId,
        outletId: bill.outletId,
        type: "EXPENSE",
        category: finCat as any,
        source: "MANUAL_ENTRY",
        sourceReferenceId: bill.id,
        title: `Bill Settled: ${bill.title} (${bill.vendorOrInstitution})`,
        description: bill.notes || `Settlement of ${bill.category.replace(/_/g, " ")} bill`,
        amount: finalPaidAmount,
        taxAmount: 0,
        netAmount: finalPaidAmount,
        transactionDate: settlementDate,
        vendorOrPayer: bill.vendorOrInstitution,
        paymentMethod,
        receiptUrl: bill.receiptOrInvoiceUrl,
        createdBy: params.userId,
      },
    });
    financialTxId = tx.id;
  }

  const updatedBill = await (prisma as any).upcomingBill.update({
    where: { id: billId },
    data: {
      status: "PAID",
      paidAt: settlementDate,
      paidAmount: new Prisma.Decimal(finalPaidAmount),
      paymentMethod,
      financialTxId,
    },
  });

  return { success: true, bill: updatedBill, financialTxId };
}
