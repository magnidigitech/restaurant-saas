export interface StaffTipParticipant {
  employeeId: string;
  name: string;
  departmentName?: string;
  designationName?: string;
  isFoh: boolean;
  hoursWorked: number;
  rolePointWeight?: number;
  isEligible?: boolean;
}

export interface TipPoolRuleConfig {
  fohPercentage: number;
  bohPercentage: number;
  distributionMethod: "HOURS_WORKED" | "EQUAL_SPLIT" | "ROLE_POINT_SYSTEM";
  rolePoints?: Record<string, number>;
  preserveEmptyGroupShare?: boolean;
}

export interface StaffTipAllocation {
  employeeId: string;
  name: string;
  departmentName?: string;
  designationName?: string;
  isFoh: boolean;
  hoursWorked: number;
  weight: number;
  effectiveHoursOrPoints: number;
  percentageOfPool: number;
  tipAmount: number;
  eligible: boolean;
  basisLabel: string;
  ineligibleReason?: string;
}

export interface TipPoolResult {
  totalCollectedTips: number;
  fohPoolAmount: number;
  bohPoolAmount: number;
  allocations: StaffTipAllocation[];
  totalDistributedTips: number;
  unallocatedCents: number;
  undistributedAmount: number;
  undistributedReason: string | null;
  flags: string[];
}

/**
 * Deterministic minor-unit (cents) tip distribution using largest-remainder allocation.
 * Reconciles totalDistributedTips + undistributedAmount === totalCollectedTips to the cent.
 */
export function calculateTipDistribution(
  totalTips: number,
  participants: StaffTipParticipant[],
  rule: TipPoolRuleConfig
): TipPoolResult {
  const totalCents = Math.max(0, Math.round(totalTips * 100));
  const safeTotalTips = Number((totalCents / 100).toFixed(2));
  const flags: string[] = [];

  if (totalCents === 0) {
    return {
      totalCollectedTips: 0,
      fohPoolAmount: 0,
      bohPoolAmount: 0,
      allocations: participants.map((p) => ({
        employeeId: p.employeeId,
        name: p.name,
        departmentName: p.departmentName,
        designationName: p.designationName,
        isFoh: p.isFoh,
        hoursWorked: p.hoursWorked,
        weight: p.rolePointWeight || 1.0,
        effectiveHoursOrPoints: 0,
        percentageOfPool: 0,
        tipAmount: 0,
        eligible: false,
        basisLabel: "No eligible pool amount",
      })),
      totalDistributedTips: 0,
      unallocatedCents: 0,
      undistributedAmount: 0,
      undistributedReason: null,
      flags: totalTips <= 0 ? ["Eligible tip pool amount is zero."] : [],
    };
  }

  const pctSum = rule.fohPercentage + rule.bohPercentage;
  const normalizedFohPct = pctSum > 0 ? rule.fohPercentage / pctSum : 0.7;
  let fohPoolCents = Math.round(totalCents * normalizedFohPct);
  let bohPoolCents = totalCents - fohPoolCents;

  const isParticipantEligible = (p: StaffTipParticipant) => {
    if (p.isEligible === false) return false;
    if (rule.distributionMethod === "EQUAL_SPLIT") return p.hoursWorked >= 0;
    return p.hoursWorked > 0;
  };

  const fohEligible = participants.filter((p) => p.isFoh && isParticipantEligible(p));
  const bohEligible = participants.filter((p) => !p.isFoh && isParticipantEligible(p));
  const ineligible = participants.filter((p) => !isParticipantEligible(p));

  for (const p of participants) {
    if (p.hoursWorked <= 0 && rule.distributionMethod !== "EQUAL_SPLIT") {
      flags.push(`${p.name}: missing approved hours for ${rule.distributionMethod.toLowerCase()} split.`);
    }
  }

  const undistributedReasons: string[] = [];
  let undistributedCents = 0;

  if (fohPoolCents > 0 && fohEligible.length === 0) {
    if (rule.preserveEmptyGroupShare || bohEligible.length === 0) {
      undistributedCents += fohPoolCents;
      const msg = `Empty eligible FOH group: ${(fohPoolCents / 100).toFixed(2)} FOH share undistributed.`;
      undistributedReasons.push(msg);
      flags.push(msg);
    } else {
      flags.push(`Empty eligible FOH group: ${(fohPoolCents / 100).toFixed(2)} FOH share redistributed to active BOH group.`);
      bohPoolCents = totalCents;
      fohPoolCents = 0;
    }
  }
  if (bohPoolCents > 0 && bohEligible.length === 0) {
    if (rule.preserveEmptyGroupShare || fohEligible.length === 0) {
      undistributedCents += bohPoolCents;
      const msg = `Empty eligible BOH group: ${(bohPoolCents / 100).toFixed(2)} BOH share undistributed.`;
      undistributedReasons.push(msg);
      flags.push(msg);
    } else {
      flags.push(`Empty eligible BOH group: ${(bohPoolCents / 100).toFixed(2)} BOH share redistributed to active FOH group.`);
      fohPoolCents = totalCents;
      bohPoolCents = 0;
    }
  }

  const distributeGroupCents = (
    staffGroup: StaffTipParticipant[],
    poolCents: number
  ): StaffTipAllocation[] => {
    if (staffGroup.length === 0 || poolCents === 0) return [];

    let totalWeightSum = 0;
    const computed = staffGroup.map((s) => {
      let weight = s.rolePointWeight || 1.0;
      if (
        rule.rolePoints &&
        s.designationName &&
        rule.rolePoints[s.designationName] !== undefined
      ) {
        weight = rule.rolePoints[s.designationName];
      }

      let effectiveUnits = 0;
      let basisLabel = "";
      if (rule.distributionMethod === "EQUAL_SPLIT") {
        effectiveUnits = 1.0;
        basisLabel = `Equal split (1/${staffGroup.length})`;
      } else if (rule.distributionMethod === "ROLE_POINT_SYSTEM") {
        effectiveUnits = s.hoursWorked * weight;
        basisLabel = `${s.hoursWorked.toFixed(2)}h × ${weight} pts`;
      } else {
        effectiveUnits = s.hoursWorked;
        basisLabel = `${s.hoursWorked.toFixed(2)} approved hrs`;
      }

      totalWeightSum += effectiveUnits;
      return { staff: s, weight, effectiveUnits, basisLabel };
    });

    if (totalWeightSum <= 0) {
      undistributedCents += poolCents;
      undistributedReasons.push("Total allocation weight is zero.");
      return [];
    }

    // Largest-remainder method in integer cents
    const shares = computed.map((c) => {
      const exactCents = (poolCents * c.effectiveUnits) / totalWeightSum;
      const flooredCents = Math.floor(exactCents);
      return {
        ...c,
        flooredCents,
        remainder: exactCents - flooredCents,
        shareRatio: c.effectiveUnits / totalWeightSum,
      };
    });

    let remainderCents =
      poolCents - shares.reduce((acc, s) => acc + s.flooredCents, 0);

    const orderedForRemainder = [...shares].sort((a, b) => {
      if (Math.abs(b.remainder - a.remainder) > 1e-9) {
        return b.remainder - a.remainder;
      }
      if (b.staff.hoursWorked !== a.staff.hoursWorked) {
        return b.staff.hoursWorked - a.staff.hoursWorked;
      }
      return a.staff.employeeId.localeCompare(b.staff.employeeId);
    });

    const bonusMap = new Map<string, number>();
    for (let i = 0; i < remainderCents; i++) {
      const target = orderedForRemainder[i % orderedForRemainder.length];
      bonusMap.set(
        target.staff.employeeId,
        (bonusMap.get(target.staff.employeeId) || 0) + 1
      );
    }

    return shares.map((s) => {
      const finalCents = s.flooredCents + (bonusMap.get(s.staff.employeeId) || 0);
      return {
        employeeId: s.staff.employeeId,
        name: s.staff.name,
        departmentName: s.staff.departmentName,
        designationName: s.staff.designationName,
        isFoh: s.staff.isFoh,
        hoursWorked: s.staff.hoursWorked,
        weight: s.weight,
        effectiveHoursOrPoints: Number(s.effectiveUnits.toFixed(2)),
        percentageOfPool: Number((s.shareRatio * 100).toFixed(2)),
        tipAmount: Number((finalCents / 100).toFixed(2)),
        eligible: true,
        basisLabel: s.basisLabel,
      };
    });
  };

  const fohAllocations = distributeGroupCents(fohEligible, fohPoolCents);
  const bohAllocations = distributeGroupCents(bohEligible, bohPoolCents);
  const ineligibleAllocations: StaffTipAllocation[] = ineligible.map((p) => ({
    employeeId: p.employeeId,
    name: p.name,
    departmentName: p.departmentName,
    designationName: p.designationName,
    isFoh: p.isFoh,
    hoursWorked: p.hoursWorked,
    weight: p.rolePointWeight || 1.0,
    effectiveHoursOrPoints: 0,
    percentageOfPool: 0,
    tipAmount: 0,
    eligible: false,
    basisLabel: "0.00 hrs",
    ineligibleReason:
      p.isEligible === false
        ? "Excluded by eligibility policy"
        : "Missing approved hours",
  }));

  const allAllocations = [
    ...fohAllocations,
    ...bohAllocations,
    ...ineligibleAllocations,
  ];

  const totalDistributedCents = allAllocations.reduce(
    (acc, a) => acc + Math.round(a.tipAmount * 100),
    0
  );

  return {
    totalCollectedTips: safeTotalTips,
    fohPoolAmount: Number((fohPoolCents / 100).toFixed(2)),
    bohPoolAmount: Number((bohPoolCents / 100).toFixed(2)),
    allocations: allAllocations,
    totalDistributedTips: Number((totalDistributedCents / 100).toFixed(2)),
    unallocatedCents: undistributedCents,
    undistributedAmount: Number((undistributedCents / 100).toFixed(2)),
    undistributedReason:
      undistributedReasons.length > 0 ? undistributedReasons.join(" ") : null,
    flags,
  };
}
