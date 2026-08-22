export interface StaffTipParticipant {
  employeeId: string;
  name: string;
  departmentName?: string;
  designationName?: string;
  isFoh: boolean; // True for Front of House (Servers, Bartenders), False for Back of House (Kitchen)
  hoursWorked: number;
  rolePointWeight?: number; // e.g. 1.0, 1.5, 0.75
}

export interface TipPoolRuleConfig {
  fohPercentage: number; // e.g. 70
  bohPercentage: number; // e.g. 30
  distributionMethod: "HOURS_WORKED" | "EQUAL_SPLIT" | "ROLE_POINT_SYSTEM";
  rolePoints?: Record<string, number>;
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
  tipAmount: number; // In dollars/currency (2 decimal places)
}

export interface TipPoolResult {
  totalCollectedTips: number;
  fohPoolAmount: number;
  bohPoolAmount: number;
  allocations: StaffTipAllocation[];
  totalDistributedTips: number;
  unallocatedCents: number;
}

/**
 * Calculates proportional tip distribution across FOH and BOH staff.
 */
export function calculateTipDistribution(
  totalTips: number,
  participants: StaffTipParticipant[],
  rule: TipPoolRuleConfig
): TipPoolResult {
  const safeTotalTips = Math.max(0, Number(totalTips.toFixed(2)));

  // If no participants or 0 tips, return zeroed allocations
  if (participants.length === 0 || safeTotalTips === 0) {
    return {
      totalCollectedTips: safeTotalTips,
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
      })),
      totalDistributedTips: 0,
      unallocatedCents: 0,
    };
  }

  // Calculate pool totals based on configured percentage
  const normalizedFohPct = rule.fohPercentage / (rule.fohPercentage + rule.bohPercentage);
  const normalizedBohPct = 1 - normalizedFohPct;

  const fohStaff = participants.filter((p) => p.isFoh && p.hoursWorked > 0);
  const bohStaff = participants.filter((p) => !p.isFoh && p.hoursWorked > 0);

  // If only FOH or only BOH exists, 100% goes to active group
  let effectiveFohPool = safeTotalTips * normalizedFohPct;
  let effectiveBohPool = safeTotalTips * normalizedBohPct;

  if (fohStaff.length === 0 && bohStaff.length > 0) {
    effectiveBohPool = safeTotalTips;
    effectiveFohPool = 0;
  } else if (bohStaff.length === 0 && fohStaff.length > 0) {
    effectiveFohPool = safeTotalTips;
    effectiveBohPool = 0;
  }

  const distributeGroup = (
    staffGroup: StaffTipParticipant[],
    poolAmount: number
  ): StaffTipAllocation[] => {
    if (staffGroup.length === 0 || poolAmount === 0) return [];

    let totalWeightSum = 0;
    const computedStaff = staffGroup.map((s) => {
      let weight = s.rolePointWeight || 1.0;
      if (rule.rolePoints && s.designationName && rule.rolePoints[s.designationName] !== undefined) {
        weight = rule.rolePoints[s.designationName];
      }

      let effectiveUnits = 0;
      if (rule.distributionMethod === "EQUAL_SPLIT") {
        effectiveUnits = 1.0;
      } else if (rule.distributionMethod === "ROLE_POINT_SYSTEM") {
        effectiveUnits = s.hoursWorked * weight;
      } else {
        // HOURS_WORKED
        effectiveUnits = s.hoursWorked;
      }

      totalWeightSum += effectiveUnits;
      return { staff: s, weight, effectiveUnits };
    });

    if (totalWeightSum === 0) {
      return staffGroup.map((s) => ({
        employeeId: s.employeeId,
        name: s.name,
        departmentName: s.departmentName,
        designationName: s.designationName,
        isFoh: s.isFoh,
        hoursWorked: s.hoursWorked,
        weight: s.rolePointWeight || 1.0,
        effectiveHoursOrPoints: 0,
        percentageOfPool: 0,
        tipAmount: 0,
      }));
    }

    return computedStaff.map(({ staff, weight, effectiveUnits }) => {
      const shareRatio = effectiveUnits / totalWeightSum;
      const rawTip = poolAmount * shareRatio;
      const tipAmount = Math.floor(rawTip * 100) / 100; // Round down to cents first

      return {
        employeeId: staff.employeeId,
        name: staff.name,
        departmentName: staff.departmentName,
        designationName: staff.designationName,
        isFoh: staff.isFoh,
        hoursWorked: staff.hoursWorked,
        weight,
        effectiveHoursOrPoints: Number(effectiveUnits.toFixed(2)),
        percentageOfPool: Number((shareRatio * 100).toFixed(2)),
        tipAmount,
      };
    });
  };

  const fohAllocations = distributeGroup(fohStaff, effectiveFohPool);
  const bohAllocations = distributeGroup(bohStaff, effectiveBohPool);

  const allAllocations = [...fohAllocations, ...bohAllocations];

  // Distribute any leftover sub-cent rounding pennies to highest hour earners
  const distributedSum = Number(allAllocations.reduce((acc, a) => acc + a.tipAmount, 0).toFixed(2));
  let remainderCents = Math.round((safeTotalTips - distributedSum) * 100);

  if (remainderCents > 0 && allAllocations.length > 0) {
    const sortedByHours = [...allAllocations].sort((a, b) => b.hoursWorked - a.hoursWorked);
    for (let i = 0; i < remainderCents; i++) {
      const target = sortedByHours[i % sortedByHours.length];
      const match = allAllocations.find((a) => a.employeeId === target.employeeId);
      if (match) {
        match.tipAmount = Number((match.tipAmount + 0.01).toFixed(2));
      }
    }
  }

  const finalDistributedTotal = Number(allAllocations.reduce((acc, a) => acc + a.tipAmount, 0).toFixed(2));

  return {
    totalCollectedTips: safeTotalTips,
    fohPoolAmount: Number(effectiveFohPool.toFixed(2)),
    bohPoolAmount: Number(effectiveBohPool.toFixed(2)),
    allocations: allAllocations,
    totalDistributedTips: finalDistributedTotal,
    unallocatedCents: Math.round((safeTotalTips - finalDistributedTotal) * 100),
  };
}
