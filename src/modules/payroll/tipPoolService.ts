import { prisma } from "@/core/database/client";
import { TipDistributionMethod } from "@prisma/client";
import {
  calculateTipDistribution,
  StaffTipParticipant,
  TipPoolResult,
} from "@/core/payroll/tipPoolEngine";

export class TipPoolError extends Error {
  status: number;
  code: string;
  details?: Record<string, any>;

  constructor(
    message: string,
    status = 400,
    code = "TIP_POOL_ERROR",
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "TipPoolError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface TipPoolPreviewResponse {
  outletId: string;
  outletName: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  cashTipsAmount: number;
  cardTipsAmount: number;
  serviceChargesAmount: number;
  refundsAmount: number;
  adjustmentsAmount: number;
  eligiblePoolAmount: number;
  rule: {
    id: string | null;
    name: string;
    fohPercentage: number;
    bohPercentage: number;
    distributionMethod: TipDistributionMethod;
    includeCashTips: boolean;
    includeCardTips: boolean;
    includeServiceCharges: boolean;
    deductRefunds: boolean;
    rolePoints: Record<string, number>;
  };
  distribution: TipPoolResult;
  missingConfig: string[];
}

export const TipPoolService = {
  async getRules(restaurantId: string, outletId?: string) {
    return prisma.tipPoolRule.findMany({
      where: {
        restaurantId,
        isActive: true,
        ...(outletId ? { OR: [{ outletId }, { outletId: null }] } : {}),
      },
      orderBy: [{ outletId: "desc" }, { createdAt: "desc" }],
    });
  },

  async getRuns(
    restaurantId: string,
    filters?: { outletId?: string; accessibleOutletIds?: string[] | null }
  ) {
    const where: any = { restaurantId };
    if (filters?.outletId) {
      where.outletId = filters.outletId;
    } else if (filters?.accessibleOutletIds) {
      where.outletId = { in: filters.accessibleOutletIds };
    }

    return prisma.tipPoolRun.findMany({
      where,
      include: {
        rule: { select: { id: true, name: true, distributionMethod: true } },
        payrollRun: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async previewTipPool(
    restaurantId: string,
    params: {
      outletId: string;
      startDate: string;
      endDate: string;
      ruleId?: string;
      adjustmentsAmount?: number;
      fohPercentage?: number;
      bohPercentage?: number;
      distributionMethod?: TipDistributionMethod;
      rolePoints?: Record<string, number>;
      includeCashTips?: boolean;
      includeCardTips?: boolean;
      includeServiceCharges?: boolean;
      deductRefunds?: boolean;
    }
  ): Promise<TipPoolPreviewResponse> {
    const outlet = await prisma.restaurantOutlet.findFirst({
      where: { id: params.outletId, restaurantId },
      select: { id: true, name: true, currency: true },
    });
    if (!outlet) {
      throw new TipPoolError("Outlet not found", 404, "OUTLET_NOT_FOUND");
    }

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new TipPoolError("Invalid tip pool date range", 400, "INVALID_PERIOD");
    }

    const activeRule = params.ruleId
      ? await prisma.tipPoolRule.findFirst({
          where: { id: params.ruleId, restaurantId, isActive: true },
        })
      : await prisma.tipPoolRule.findFirst({
          where: {
            restaurantId,
            isActive: true,
            OR: [{ outletId: outlet.id }, { outletId: null }],
          },
          orderBy: [{ outletId: "desc" }, { createdAt: "desc" }],
        });

    const missingConfig: string[] = [];
    if (!activeRule) {
      missingConfig.push("No active TipPoolRule configured for this outlet; using explicit preview inputs.");
    }

    const fohPercentage = params.fohPercentage ?? activeRule?.fohPercentage ?? 70;
    const bohPercentage = params.bohPercentage ?? activeRule?.bohPercentage ?? 30;
    const distributionMethod =
      params.distributionMethod ?? activeRule?.distributionMethod ?? TipDistributionMethod.HOURS_WORKED;
    const includeCashTips = params.includeCashTips ?? activeRule?.includeCashTips ?? true;
    const includeCardTips = params.includeCardTips ?? activeRule?.includeCardTips ?? true;
    const includeServiceCharges =
      params.includeServiceCharges ?? activeRule?.includeServiceCharges ?? false;
    const deductRefunds = params.deductRefunds ?? activeRule?.deductRefunds ?? true;
    const rolePoints =
      params.rolePoints ??
      ((activeRule?.rolePointsJson as Record<string, number> | null) || {});

    // 1. Source tip records from PosOrder
    const orders = await prisma.posOrder.findMany({
      where: {
        restaurantId,
        outletId: outlet.id,
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      select: {
        tipAmount: true,
        refundAmount: true,
        serviceChargeAmount: true,
        paymentMethod: true,
        paymentsJson: true,
        status: true,
        rawPayload: true,
      },
    });

    let cashTipsCents = 0;
    let cardTipsCents = 0;
    let unattributedTipsCents = 0;
    let serviceChargesCents = 0;
    let refundsCents = 0;

    for (const o of orders) {
      const tipCents = Math.round(Number(o.tipAmount || 0) * 100);
      const refundCents = Math.round(Number(o.refundAmount || 0) * 100);
      const raw = (o.rawPayload as Record<string, any> | null) || {};
      const svcCents = Math.round(
        Number(o.serviceChargeAmount || raw.serviceCharge || raw.serviceChargeAmount || 0) * 100
      );

      const payments = Array.isArray(o.paymentsJson)
        ? (o.paymentsJson as Array<{ tenderType?: string; tipAmount?: number }>)
        : [];

      if (payments.length > 0) {
        let tenderTipSumCents = 0;
        for (const p of payments) {
          const pTipCents = Math.round(Number(p.tipAmount || 0) * 100);
          tenderTipSumCents += pTipCents;
          if (String(p.tenderType || "").toUpperCase() === "CASH") {
            cashTipsCents += pTipCents;
          } else {
            cardTipsCents += pTipCents;
          }
        }
        // If order tip exceeds itemized tender tips, record remainder as unattributed rather than guessing
        if (tipCents > tenderTipSumCents) {
          unattributedTipsCents += tipCents - tenderTipSumCents;
        }
      } else if ((o.paymentMethod || "").toUpperCase() === "CASH") {
        cashTipsCents += tipCents;
      } else if (
        o.paymentMethod &&
        (o.paymentMethod || "").toUpperCase() !== "SPLIT"
      ) {
        cardTipsCents += tipCents;
      } else if (tipCents > 0) {
        unattributedTipsCents += tipCents;
      }

      serviceChargesCents += svcCents;
      refundsCents += refundCents;
    }

    const adjustmentsCents = Math.round((params.adjustmentsAmount ?? 0) * 100);
    let eligibleCents = 0;
    if (includeCashTips) eligibleCents += cashTipsCents;
    if (includeCardTips) eligibleCents += cardTipsCents;
    if (includeCashTips && includeCardTips) eligibleCents += unattributedTipsCents;
    if (includeServiceCharges) eligibleCents += serviceChargesCents;
    if (deductRefunds) eligibleCents -= refundsCents;
    eligibleCents += adjustmentsCents;
    eligibleCents = Math.max(0, eligibleCents);

    // 2. Approved attendance records for outlet in period
    const approvedAtt = await prisma.attendanceRecord.findMany({
      where: {
        restaurantId,
        outletId: outlet.id,
        workDate: { gte: start, lte: end },
        isApproved: true,
      },
      include: {
        employee: {
          include: {
            employmentRecords: {
              where: { effectiveTo: null },
              include: { department: true, designation: true },
              take: 1,
            },
          },
        },
      },
    });

    const staffMap = new Map<string, { employee: any; totalMins: number }>();
    for (const r of approvedAtt) {
      if (!staffMap.has(r.employeeId)) {
        staffMap.set(r.employeeId, { employee: r.employee, totalMins: 0 });
      }
      staffMap.get(r.employeeId)!.totalMins += r.totalWorkMinutes;
    }

    // Include scheduled outlet staff with 0 approved hours so missing approved hours are flagged
    const scheduledStaff = await prisma.shiftAssignment.findMany({
      where: {
        restaurantId,
        outletId: outlet.id,
        shiftDate: { gte: start, lte: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      include: {
        employee: {
          include: {
            employmentRecords: {
              where: { effectiveTo: null },
              include: { department: true, designation: true },
              take: 1,
            },
          },
        },
      },
    });
    for (const s of scheduledStaff) {
      if (!staffMap.has(s.employeeId)) {
        staffMap.set(s.employeeId, { employee: s.employee, totalMins: 0 });
      }
    }

    const participants: StaffTipParticipant[] = Array.from(staffMap.values()).map(
      ({ employee, totalMins }) => {
        const rec = employee.employmentRecords?.[0];
        const deptName = rec?.department?.name || "";
        const desigName = rec?.designation?.name || "";
        const isFoh =
          deptName.toLowerCase().includes("front") ||
          deptName.toLowerCase().includes("service") ||
          deptName.toLowerCase().includes("bar") ||
          desigName.toLowerCase().includes("server") ||
          desigName.toLowerCase().includes("waiter") ||
          desigName.toLowerCase().includes("bartender") ||
          desigName.toLowerCase().includes("host");

        return {
          employeeId: employee.id,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          departmentName: deptName || undefined,
          designationName: desigName || undefined,
          isFoh,
          hoursWorked: Number((totalMins / 60).toFixed(2)),
          rolePointWeight: desigName && rolePoints[desigName] !== undefined ? rolePoints[desigName] : 1.0,
        };
      }
    );

    const distribution = calculateTipDistribution(eligibleCents / 100, participants, {
      fohPercentage,
      bohPercentage,
      distributionMethod,
      rolePoints,
    });

    return {
      outletId: outlet.id,
      outletName: outlet.name,
      currency: outlet.currency || "USD",
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      cashTipsAmount: Number((cashTipsCents / 100).toFixed(2)),
      cardTipsAmount: Number((cardTipsCents / 100).toFixed(2)),
      serviceChargesAmount: Number((serviceChargesCents / 100).toFixed(2)),
      refundsAmount: Number((refundsCents / 100).toFixed(2)),
      adjustmentsAmount: Number((adjustmentsCents / 100).toFixed(2)),
      eligiblePoolAmount: Number((eligibleCents / 100).toFixed(2)),
      rule: {
        id: activeRule?.id || null,
        name: activeRule?.name || "Ad-hoc Preview Policy",
        fohPercentage,
        bohPercentage,
        distributionMethod,
        includeCashTips,
        includeCardTips,
        includeServiceCharges,
        deductRefunds,
        rolePoints,
      },
      distribution,
      missingConfig,
    };
  },

  async saveOrFinalizeRun(
    restaurantId: string,
    params: {
      outletId: string;
      startDate: string;
      endDate: string;
      ruleId?: string;
      adjustmentsAmount?: number;
      fohPercentage?: number;
      bohPercentage?: number;
      distributionMethod?: TipDistributionMethod;
      rolePoints?: Record<string, number>;
      includeCashTips?: boolean;
      includeCardTips?: boolean;
      includeServiceCharges?: boolean;
      deductRefunds?: boolean;
      finalize?: boolean;
      actorUserId: string;
      actorEmail: string;
    }
  ) {
    const preview = await this.previewTipPool(restaurantId, params);

    const status = params.finalize ? "FINALIZED" : "DRAFT";
    const run = await prisma.tipPoolRun.create({
      data: {
        restaurantId,
        outletId: preview.outletId,
        ruleId: preview.rule.id,
        status,
        currency: preview.currency,
        periodStart: new Date(preview.periodStart),
        periodEnd: new Date(preview.periodEnd),
        totalCollectedTips: preview.eligiblePoolAmount,
        cashTipsAmount: preview.cashTipsAmount,
        cardTipsAmount: preview.cardTipsAmount,
        serviceChargesAmount: preview.serviceChargesAmount,
        refundsAmount: preview.refundsAmount,
        adjustmentsAmount: preview.adjustmentsAmount,
        eligiblePoolAmount: preview.eligiblePoolAmount,
        fohPoolAmount: preview.distribution.fohPoolAmount,
        bohPoolAmount: preview.distribution.bohPoolAmount,
        totalDistributedTips: preview.distribution.totalDistributedTips,
        undistributedAmount: preview.distribution.undistributedAmount,
        undistributedReason: preview.distribution.undistributedReason,
        distributionsJson: preview.distribution.allocations as any,
        finalizedBy: params.finalize ? params.actorUserId : null,
        finalizedAt: params.finalize ? new Date() : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurant: { connect: { id: restaurantId } },
        userId: params.actorUserId,
        userEmail: params.actorEmail,
        action: params.finalize ? "TIP_POOL_FINALIZED" : "TIP_POOL_SAVED",
        entityType: "TipPoolRun",
        entityId: run.id,
        newValues: JSON.stringify({
          outletId: preview.outletId,
          status,
          eligiblePoolAmount: preview.eligiblePoolAmount,
          totalDistributedTips: preview.distribution.totalDistributedTips,
          undistributedAmount: preview.distribution.undistributedAmount,
        }),
      },
    });

    return { run, preview };
  },

  async finalizeExistingRun(
    restaurantId: string,
    tipPoolRunId: string,
    actorUserId: string,
    actorEmail: string
  ) {
    const existing = await prisma.tipPoolRun.findFirst({
      where: { id: tipPoolRunId, restaurantId },
    });
    if (!existing) {
      throw new TipPoolError("Tip pool run not found", 404, "TIP_RUN_NOT_FOUND");
    }
    if (existing.status === "FINALIZED") {
      return { run: existing, alreadyFinalized: true };
    }

    const updated = await prisma.tipPoolRun.update({
      where: { id: existing.id },
      data: {
        status: "FINALIZED",
        finalizedBy: actorUserId,
        finalizedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurant: { connect: { id: restaurantId } },
        userId: actorUserId,
        userEmail: actorEmail,
        action: "TIP_POOL_FINALIZED",
        entityType: "TipPoolRun",
        entityId: existing.id,
        newValues: JSON.stringify({
          outletId: existing.outletId,
          status: "FINALIZED",
          totalDistributedTips: existing.totalDistributedTips,
        }),
      },
    });

    return { run: updated, alreadyFinalized: false };
  },
};
