import { prisma } from "@/core/database/client";

export interface PnLSummaryMetrics {
  grossRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalLabor: number;
  laborPercent: number;
  primeCost: number;
  primeCostPercent: number;
  primeCostStatus: "OPTIMAL" | "ACCEPTABLE" | "HIGH";
  totalOpex: number;
  opexPercent: number;
  totalExpenses: number;
  netOperatingIncome: number; // EBITDA
  netProfitMarginPercent: number;
}

export interface PnLCategoryBreakdown {
  category: string;
  displayName: string;
  type: "REVENUE" | "COGS" | "LABOR" | "OPEX";
  amount: number;
  percentageOfRevenue: number;
  percentageOfCategory: number;
  transactionCount: number;
}

export interface PnLStatementResult {
  restaurantId: string;
  outletId?: string;
  startDate: string;
  endDate: string;
  metrics: PnLSummaryMetrics;
  revenueStreams: PnLCategoryBreakdown[];
  cogsBreakdown: PnLCategoryBreakdown[];
  laborBreakdown: PnLCategoryBreakdown[];
  opexBreakdown: PnLCategoryBreakdown[];
  recentTransactions: any[];
}

/**
 * Generates an executive P&L statement by aggregating POS orders, Purchase Orders,
 * Payroll runs, Wastage logs, and manual financial ledger transactions.
 */
export async function generatePnLStatement(
  restaurantId: string,
  startDate: Date,
  endDate: Date,
  outletId?: string
): Promise<PnLStatementResult> {
  const dateFilter = {
    gte: startDate,
    lte: new Date(endDate.getTime() + 1000), // Inclusive buffer for millisecond precision
  };

  // ── 1. POS Orders (Automated Revenue) ─────────────────────────
  const posWhere: any = {
    restaurantId,
    createdAt: dateFilter,
    status: "COMPLETED",
  };
  if (outletId) posWhere.outletId = outletId;

  const posOrders = await prisma.posOrder.findMany({
    where: posWhere,
    select: {
      id: true,
      orderType: true,
      totalAmount: true,
      taxAmount: true,
      finalAmount: true,
    },
  });

  let posDineInSales = 0;
  let posTakeawaySales = 0;
  let posDeliverySales = 0;

  for (const o of posOrders) {
    const amt = Number(o.finalAmount || o.totalAmount || 0);
    if (o.orderType === "DINE_IN") posDineInSales += amt;
    else if (o.orderType === "TAKEAWAY") posTakeawaySales += amt;
    else if (o.orderType === "DELIVERY") posDeliverySales += amt;
    else posDineInSales += amt;
  }

  // ── 2. Purchase Orders (Automated COGS) ────────────────────────
  const poWhere: any = {
    restaurantId,
    createdAt: dateFilter,
    status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] as any },
  };
  if (outletId) poWhere.outletId = outletId;

  let autoPoCost = 0;
  let poCount = 0;
  try {
    const pos = await prisma.purchaseOrder.findMany({
      where: poWhere,
      select: { grandTotal: true, totalAmount: true },
    });
    poCount = pos.length;
    autoPoCost = pos.reduce((sum, p) => sum + Number(p.grandTotal || p.totalAmount || 0), 0);
  } catch {
    autoPoCost = 0;
  }

  // ── 3. Inventory Wastage (Automated COGS) ──────────────────────
  let autoWastageCost = 0;
  let wastageCount = 0;
  try {
    const wastageWhere: any = {
      restaurantId,
      createdAt: dateFilter,
    };
    if (outletId) wastageWhere.outletId = outletId;

    const wastages = await prisma.wastageLog.findMany({
      where: wastageWhere,
      include: {
        item: { select: { costPerUnit: true } },
      },
    });
    wastageCount = wastages.length;
    autoWastageCost = wastages.reduce((sum, w) => {
      const unitCost = Number(w.item?.costPerUnit || 0);
      const qty = Number(w.quantity || 0);
      return sum + unitCost * qty;
    }, 0);
  } catch {
    autoWastageCost = 0;
  }

  // ── 4. Payroll Runs (Automated Labor) ──────────────────────────
  const payrollWhere: any = {
    restaurantId,
    periodStart: { gte: startDate },
    periodEnd: { lte: endDate },
    status: { in: ["APPROVED", "PAID", "CALCULATING"] as any },
  };
  if (outletId) payrollWhere.outletId = outletId;

  let autoPayrollLabor = 0;
  let payrollRunCount = 0;
  try {
    const runs = await prisma.payrollRun.findMany({
      where: payrollWhere,
      select: { totalGross: true },
    });
    payrollRunCount = runs.length;
    autoPayrollLabor = runs.reduce((sum, r) => sum + Number(r.totalGross || 0), 0);
  } catch {
    autoPayrollLabor = 0;
  }

  // ── 5. Manual Financial Transactions ───────────────────────────
  const txWhere: any = {
    restaurantId,
    transactionDate: dateFilter,
  };
  if (outletId) txWhere.outletId = outletId;

  let manualTxs: any[] = [];
  try {
    if ((prisma as any).financialTransaction) {
      manualTxs = await (prisma as any).financialTransaction.findMany({
        where: txWhere,
        include: {
          outlet: { select: { name: true } },
          costCenter: { select: { name: true } },
        },
        orderBy: { transactionDate: "desc" },
      });
    }
  } catch {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, type, category, source, title, description, amount, tax_amount as "taxAmount",
                net_amount as "netAmount", transaction_date as "transactionDate", vendor_or_payer as "vendorOrPayer",
                payment_method as "paymentMethod", receipt_url as "receiptUrl"
         FROM financial_transactions
         WHERE restaurant_id = $1 AND transaction_date >= $2 AND transaction_date <= $3
         ORDER BY transaction_date DESC`,
        restaurantId,
        dateFilter.gte,
        dateFilter.lte
      );
      manualTxs = rows;
    } catch {
      manualTxs = [];
    }
  }

  // Group manual transactions by category
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const tx of manualTxs) {
    const cat = tx.category;
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { total: 0, count: 0 });
    }
    const item = categoryMap.get(cat)!;
    item.total += Number(tx.amount || 0);
    item.count += 1;
  }

  const getCat = (key: string) => categoryMap.get(key)?.total || 0;
  const getCount = (key: string) => categoryMap.get(key)?.count || 0;

  // ── 6. Aggregate Revenue ───────────────────────────────────────
  const posTotalSales = posDineInSales + posTakeawaySales + posDeliverySales;
  const manualCatering = getCat("CATERING_EVENTS");
  const manualThirdParty = getCat("THIRD_PARTY_DELIVERY");
  const manualMerchandise = getCat("MERCHANDISE");
  const manualRebates = getCat("REBATES_CREDITS");
  const manualOtherIncome = getCat("OTHER_INCOME") + getCat("POS_SALES");

  const grossRevenue = Number(
    (posTotalSales + manualCatering + manualThirdParty + manualMerchandise + manualRebates + manualOtherIncome).toFixed(2)
  );

  const calcRevPct = (amount: number) =>
    grossRevenue > 0 ? Number(((amount / grossRevenue) * 100).toFixed(1)) : 0;

  const calcCatPct = (amount: number, sectionTotal: number) =>
    sectionTotal > 0 ? Number(((amount / sectionTotal) * 100).toFixed(1)) : 0;

  const revenueStreams: PnLCategoryBreakdown[] = [
    {
      category: "POS_DINE_IN",
      displayName: "POS Dine-In Sales",
      type: "REVENUE",
      amount: Number(posDineInSales.toFixed(2)),
      percentageOfRevenue: calcRevPct(posDineInSales),
      percentageOfCategory: calcCatPct(posDineInSales, grossRevenue),
      transactionCount: posOrders.filter((o) => o.orderType === "DINE_IN").length,
    },
    {
      category: "POS_TAKEAWAY",
      displayName: "POS Takeaway & Pickup",
      type: "REVENUE",
      amount: Number(posTakeawaySales.toFixed(2)),
      percentageOfRevenue: calcRevPct(posTakeawaySales),
      percentageOfCategory: calcCatPct(posTakeawaySales, grossRevenue),
      transactionCount: posOrders.filter((o) => o.orderType === "TAKEAWAY").length,
    },
    {
      category: "POS_DELIVERY",
      displayName: "POS Direct Delivery",
      type: "REVENUE",
      amount: Number(posDeliverySales.toFixed(2)),
      percentageOfRevenue: calcRevPct(posDeliverySales),
      percentageOfCategory: calcCatPct(posDeliverySales, grossRevenue),
      transactionCount: posOrders.filter((o) => o.orderType === "DELIVERY").length,
    },
    {
      category: "CATERING_EVENTS",
      displayName: "Catering & Events",
      type: "REVENUE",
      amount: Number(manualCatering.toFixed(2)),
      percentageOfRevenue: calcRevPct(manualCatering),
      percentageOfCategory: calcCatPct(manualCatering, grossRevenue),
      transactionCount: getCount("CATERING_EVENTS"),
    },
    {
      category: "THIRD_PARTY_DELIVERY",
      displayName: "Third-Party Delivery Platforms",
      type: "REVENUE",
      amount: Number(manualThirdParty.toFixed(2)),
      percentageOfRevenue: calcRevPct(manualThirdParty),
      percentageOfCategory: calcCatPct(manualThirdParty, grossRevenue),
      transactionCount: getCount("THIRD_PARTY_DELIVERY"),
    },
    {
      category: "OTHER_INCOME",
      displayName: "Merchandise, Rebates & Other Income",
      type: "REVENUE",
      amount: Number((manualMerchandise + manualRebates + manualOtherIncome).toFixed(2)),
      percentageOfRevenue: calcRevPct(manualMerchandise + manualRebates + manualOtherIncome),
      percentageOfCategory: calcCatPct(manualMerchandise + manualRebates + manualOtherIncome, grossRevenue),
      transactionCount: getCount("MERCHANDISE") + getCount("REBATES_CREDITS") + getCount("OTHER_INCOME") + getCount("POS_SALES"),
    },
  ];

  // ── 7. Aggregate COGS (Food & Beverage + Packaging + Wastage) ─
  const manualFb = getCat("FOOD_BEVERAGE_SUPPLIERS") + getCat("COGS_INVENTORY");
  const totalFb = autoPoCost + manualFb;
  const manualPackaging = getCat("PACKAGING_CONSUMABLES");
  const manualWastage = getCat("WASTAGE");
  const totalWastage = autoWastageCost + manualWastage;
  const totalCogs = Number((totalFb + manualPackaging + totalWastage).toFixed(2));

  const cogsBreakdown: PnLCategoryBreakdown[] = [
    {
      category: "FOOD_BEVERAGE_SUPPLIERS",
      displayName: "Food & Beverage Suppliers",
      type: "COGS",
      amount: Number(totalFb.toFixed(2)),
      percentageOfRevenue: calcRevPct(totalFb),
      percentageOfCategory: calcCatPct(totalFb, totalCogs),
      transactionCount: poCount + getCount("FOOD_BEVERAGE_SUPPLIERS") + getCount("COGS_INVENTORY"),
    },
    {
      category: "PACKAGING_CONSUMABLES",
      displayName: "Packaging & Consumables",
      type: "COGS",
      amount: Number(manualPackaging.toFixed(2)),
      percentageOfRevenue: calcRevPct(manualPackaging),
      percentageOfCategory: calcCatPct(manualPackaging, totalCogs),
      transactionCount: getCount("PACKAGING_CONSUMABLES"),
    },
    {
      category: "WASTAGE",
      displayName: "Kitchen Spoilage & Wastage",
      type: "COGS",
      amount: Number(totalWastage.toFixed(2)),
      percentageOfRevenue: calcRevPct(totalWastage),
      percentageOfCategory: calcCatPct(totalWastage, totalCogs),
      transactionCount: wastageCount + getCount("WASTAGE"),
    },
  ];

  // ── 8. Aggregate Labor (Staff & Payroll) ──────────────────────
  const manualStaff = getCat("STAFF_PAYROLL") + getCat("PAYROLL_LABOR");
  const totalLabor = Number((autoPayrollLabor + manualStaff).toFixed(2));

  const laborBreakdown: PnLCategoryBreakdown[] = [
    {
      category: "STAFF_PAYROLL",
      displayName: "Staff & Payroll",
      type: "LABOR",
      amount: totalLabor,
      percentageOfRevenue: calcRevPct(totalLabor),
      percentageOfCategory: calcCatPct(totalLabor, totalLabor),
      transactionCount: payrollRunCount + getCount("STAFF_PAYROLL") + getCount("PAYROLL_LABOR"),
    },
  ];

  // ── 9. Aggregate 11 Operating Overhead Categories (OPEX) ─────
  const rent = getCat("RENT_PROPERTY_LEASE") + getCat("RENT_OCCUPANCY");
  const utilities = getCat("UTILITIES");
  const equipmentFinancing = getCat("EQUIPMENT_FINANCING_LEASE");
  const maintenance = getCat("MAINTENANCE_REPAIRS") + getCat("EQUIPMENT_MAINTENANCE");
  const cleaning = getCat("CLEANING_HYGIENE");
  const taxesLicenses = getCat("TAXES_LICENSES");
  const saasTech = getCat("SAAS_TECHNOLOGY") + getCat("SOFTWARE_SUBSCRIPTION");
  const marketing = getCat("MARKETING_ADVERTISING");
  const insurance = getCat("INSURANCE");
  const banking = getCat("BANKING_PAYMENT_PROCESSING");
  const deliveryLogistics = getCat("DELIVERY_LOGISTICS");
  const otherOpex = getCat("OTHER_OPERATIONAL_EXPENSES") + getCat("MISC_EXPENSE");

  const totalOpex = Number(
    (
      rent +
      utilities +
      equipmentFinancing +
      maintenance +
      cleaning +
      taxesLicenses +
      saasTech +
      marketing +
      insurance +
      banking +
      deliveryLogistics +
      otherOpex
    ).toFixed(2)
  );

  const opexBreakdown: PnLCategoryBreakdown[] = [
    {
      category: "RENT_PROPERTY_LEASE",
      displayName: "Rent & Property Lease",
      type: "OPEX",
      amount: Number(rent.toFixed(2)),
      percentageOfRevenue: calcRevPct(rent),
      percentageOfCategory: calcCatPct(rent, totalOpex),
      transactionCount: getCount("RENT_PROPERTY_LEASE") + getCount("RENT_OCCUPANCY"),
    },
    {
      category: "UTILITIES",
      displayName: "Utilities",
      type: "OPEX",
      amount: Number(utilities.toFixed(2)),
      percentageOfRevenue: calcRevPct(utilities),
      percentageOfCategory: calcCatPct(utilities, totalOpex),
      transactionCount: getCount("UTILITIES"),
    },
    {
      category: "EQUIPMENT_FINANCING_LEASE",
      displayName: "Equipment Financing & Lease",
      type: "OPEX",
      amount: Number(equipmentFinancing.toFixed(2)),
      percentageOfRevenue: calcRevPct(equipmentFinancing),
      percentageOfCategory: calcCatPct(equipmentFinancing, totalOpex),
      transactionCount: getCount("EQUIPMENT_FINANCING_LEASE"),
    },
    {
      category: "MAINTENANCE_REPAIRS",
      displayName: "Maintenance & Repairs",
      type: "OPEX",
      amount: Number(maintenance.toFixed(2)),
      percentageOfRevenue: calcRevPct(maintenance),
      percentageOfCategory: calcCatPct(maintenance, totalOpex),
      transactionCount: getCount("MAINTENANCE_REPAIRS") + getCount("EQUIPMENT_MAINTENANCE"),
    },
    {
      category: "CLEANING_HYGIENE",
      displayName: "Cleaning & Hygiene",
      type: "OPEX",
      amount: Number(cleaning.toFixed(2)),
      percentageOfRevenue: calcRevPct(cleaning),
      percentageOfCategory: calcCatPct(cleaning, totalOpex),
      transactionCount: getCount("CLEANING_HYGIENE"),
    },
    {
      category: "TAXES_LICENSES",
      displayName: "Taxes & Licenses",
      type: "OPEX",
      amount: Number(taxesLicenses.toFixed(2)),
      percentageOfRevenue: calcRevPct(taxesLicenses),
      percentageOfCategory: calcCatPct(taxesLicenses, totalOpex),
      transactionCount: getCount("TAXES_LICENSES"),
    },
    {
      category: "SAAS_TECHNOLOGY",
      displayName: "SaaS & Technology",
      type: "OPEX",
      amount: Number(saasTech.toFixed(2)),
      percentageOfRevenue: calcRevPct(saasTech),
      percentageOfCategory: calcCatPct(saasTech, totalOpex),
      transactionCount: getCount("SAAS_TECHNOLOGY") + getCount("SOFTWARE_SUBSCRIPTION"),
    },
    {
      category: "MARKETING_ADVERTISING",
      displayName: "Marketing & Advertising",
      type: "OPEX",
      amount: Number(marketing.toFixed(2)),
      percentageOfRevenue: calcRevPct(marketing),
      percentageOfCategory: calcCatPct(marketing, totalOpex),
      transactionCount: getCount("MARKETING_ADVERTISING"),
    },
    {
      category: "INSURANCE",
      displayName: "Insurance",
      type: "OPEX",
      amount: Number(insurance.toFixed(2)),
      percentageOfRevenue: calcRevPct(insurance),
      percentageOfCategory: calcCatPct(insurance, totalOpex),
      transactionCount: getCount("INSURANCE"),
    },
    {
      category: "BANKING_PAYMENT_PROCESSING",
      displayName: "Banking & Payment Processing",
      type: "OPEX",
      amount: Number(banking.toFixed(2)),
      percentageOfRevenue: calcRevPct(banking),
      percentageOfCategory: calcCatPct(banking, totalOpex),
      transactionCount: getCount("BANKING_PAYMENT_PROCESSING"),
    },
    {
      category: "DELIVERY_LOGISTICS",
      displayName: "Delivery & Logistics",
      type: "OPEX",
      amount: Number(deliveryLogistics.toFixed(2)),
      percentageOfRevenue: calcRevPct(deliveryLogistics),
      percentageOfCategory: calcCatPct(deliveryLogistics, totalOpex),
      transactionCount: getCount("DELIVERY_LOGISTICS"),
    },
    {
      category: "OTHER_OPERATIONAL_EXPENSES",
      displayName: "Other Operational Expenses",
      type: "OPEX",
      amount: Number(otherOpex.toFixed(2)),
      percentageOfRevenue: calcRevPct(otherOpex),
      percentageOfCategory: calcCatPct(otherOpex, totalOpex),
      transactionCount: getCount("OTHER_OPERATIONAL_EXPENSES") + getCount("MISC_EXPENSE"),
    },
  ];

  // ── 10. Financial Health & Key Performance Indicators ─────────
  const grossProfit = Number((grossRevenue - totalCogs).toFixed(2));
  const grossMarginPercent = calcRevPct(grossProfit);

  const primeCost = Number((totalCogs + totalLabor).toFixed(2));
  const primeCostPercent = calcRevPct(primeCost);

  let primeCostStatus: PnLSummaryMetrics["primeCostStatus"] = "OPTIMAL";
  if (grossRevenue > 0) {
    if (primeCostPercent > 65) primeCostStatus = "HIGH";
    else if (primeCostPercent >= 58) primeCostStatus = "ACCEPTABLE";
    else primeCostStatus = "OPTIMAL";
  } else {
    primeCostStatus = "OPTIMAL";
  }

  const totalExpenses = Number((totalCogs + totalLabor + totalOpex).toFixed(2));
  const netOperatingIncome = Number((grossRevenue - totalExpenses).toFixed(2));
  const netProfitMarginPercent = calcRevPct(netOperatingIncome);

  const metrics: PnLSummaryMetrics = {
    grossRevenue,
    totalCogs,
    grossProfit,
    grossMarginPercent,
    totalLabor,
    laborPercent: calcRevPct(totalLabor),
    primeCost,
    primeCostPercent,
    primeCostStatus,
    totalOpex,
    opexPercent: calcRevPct(totalOpex),
    totalExpenses,
    netOperatingIncome,
    netProfitMarginPercent,
  };

  return {
    restaurantId,
    outletId,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    metrics,
    revenueStreams,
    cogsBreakdown,
    laborBreakdown,
    opexBreakdown,
    recentTransactions: manualTxs.slice(0, 50),
  };
}

/**
 * 1-Click Sync of completed Purchase Orders, Payroll Runs, and POS receipts into FinancialTransaction ledger.
 */
export async function syncAutomatedTransactions(
  restaurantId: string,
  startDate: Date,
  endDate: Date
) {
  let createdCount = 0;

  // 1. Sync completed POs
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      restaurantId,
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] as any },
    },
    include: { vendor: true },
  });

  for (const po of pos) {
    const existing = await prisma.financialTransaction.findFirst({
      where: { restaurantId, sourceReferenceId: po.id },
    });
    const cost = Number(po.grandTotal || po.totalAmount || 0);
    if (!existing && cost > 0) {
      await prisma.financialTransaction.create({
        data: {
          restaurantId,
          outletId: po.outletId,
          type: "EXPENSE",
          category: "FOOD_BEVERAGE_SUPPLIERS",
          source: "AUTOMATIC_PO",
          sourceReferenceId: po.id,
          title: `PO #${po.poNumber} - ${po.vendor.name}`,
          description: `Food & beverage ingredient procurement (${po.vendor.contactPerson || "Vendor"})`,
          amount: cost,
          transactionDate: po.receivedAt || po.createdAt,
          vendorOrPayer: po.vendor.name,
          paymentMethod: "INVOICE",
        },
      });
      createdCount++;
    }
  }

  // 2. Sync Payroll Runs
  const payrollRuns = await prisma.payrollRun.findMany({
    where: {
      restaurantId,
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ["APPROVED", "PAID"] as any },
    },
  });

  for (const run of payrollRuns) {
    const existing = await prisma.financialTransaction.findFirst({
      where: { restaurantId, sourceReferenceId: run.id },
    });
    if (!existing && Number(run.totalGross) > 0) {
      await prisma.financialTransaction.create({
        data: {
          restaurantId,
          outletId: run.outletId,
          type: "EXPENSE",
          category: "STAFF_PAYROLL",
          source: "AUTOMATIC_PAYROLL",
          sourceReferenceId: run.id,
          title: `Payroll: ${run.title}`,
          description: `Disbursed staff wages & payroll disbursements`,
          amount: run.totalGross,
          transactionDate: run.paymentDate || run.periodEnd,
          vendorOrPayer: "Staff Payroll",
          paymentMethod: "DIRECT_DEPOSIT",
        },
      });
      createdCount++;
    }
  }

  return { success: true, createdCount };
}
