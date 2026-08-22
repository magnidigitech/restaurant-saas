import { calculateTipDistribution, StaffTipParticipant, TipPoolRuleConfig } from "../payroll/tipPoolEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runTipPoolTests() {
  console.log("\n=========================================================");
  console.log("  Automated Tip Pooling & Distribution Engine Tests");
  console.log("=========================================================\n");

  let totalTests = 0;

  // 1. Standard 70/30 FOH/BOH Split by Hours Worked
  console.log("── Section 1: Standard 70/30 Hours-Weighted Tip Pool ──");
  const participants: StaffTipParticipant[] = [
    { employeeId: "1", name: "Alice Server", isFoh: true, hoursWorked: 40, designationName: "Server" },
    { employeeId: "2", name: "Bob Bartender", isFoh: true, hoursWorked: 40, designationName: "Bartender" },
    { employeeId: "3", name: "Charlie Cook", isFoh: false, hoursWorked: 40, designationName: "Line Cook" },
    { employeeId: "4", name: "Diana Dish", isFoh: false, hoursWorked: 20, designationName: "Dishwasher" },
  ];

  const standardRule: TipPoolRuleConfig = {
    fohPercentage: 70,
    bohPercentage: 30,
    distributionMethod: "HOURS_WORKED",
  };

  const totalTips = 1000.0;
  const res = calculateTipDistribution(totalTips, participants, standardRule);

  assert(res.totalCollectedTips === 1000.0, "Total collected tips preserved at $1000.00");
  totalTests++;

  assert(res.fohPoolAmount === 700.0, "FOH pool allocated $700.00 (70%)");
  totalTests++;

  assert(res.bohPoolAmount === 300.0, "BOH pool allocated $300.00 (30%)");
  totalTests++;

  // FOH: 80 total hours. Alice has 40 hrs (50%) -> $350. Bob has 40 hrs (50%) -> $350.
  const alice = res.allocations.find((a) => a.employeeId === "1");
  const bob = res.allocations.find((a) => a.employeeId === "2");
  assert(alice?.tipAmount === 350.0, `Alice receives $350.00 [got $${alice?.tipAmount}]`);
  totalTests++;
  assert(bob?.tipAmount === 350.0, `Bob receives $350.00 [got $${bob?.tipAmount}]`);
  totalTests++;

  // BOH: 60 total hours. Charlie (40 hrs = 66.67%) -> $200.00. Diana (20 hrs = 33.33%) -> $100.00.
  const charlie = res.allocations.find((a) => a.employeeId === "3");
  const diana = res.allocations.find((a) => a.employeeId === "4");
  assert(charlie?.tipAmount === 200.0, `Charlie receives $200.00 [got $${charlie?.tipAmount}]`);
  totalTests++;
  assert(diana?.tipAmount === 100.0, `Diana receives $100.00 [got $${diana?.tipAmount}]`);
  totalTests++;

  assert(res.totalDistributedTips === 1000.0, `Exact 100% distribution preserved: $${res.totalDistributedTips}`);
  totalTests++;

  // 2. Sub-Cent Penny Rounding Preservation Test
  console.log("\n── Section 2: Exact Penny & Odd-Cents Rounding Preservation ──");
  const oddTips = 333.33;
  const oddRes = calculateTipDistribution(oddTips, participants, standardRule);

  assert(oddRes.totalDistributedTips === 333.33, `Distributed sum matches odd total $333.33 exactly [got $${oddRes.totalDistributedTips}]`);
  totalTests++;
  assert(oddRes.unallocatedCents === 0, "Zero unallocated cents remainder");
  totalTests++;

  // 3. Role Point Multiplier System (e.g. Lead Bartender = 1.5x, Busser = 0.5x)
  console.log("\n── Section 3: Role-Point Weighted Tip Pool ──");
  const weightedStaff: StaffTipParticipant[] = [
    { employeeId: "10", name: "Lead Bartender", isFoh: true, hoursWorked: 10, designationName: "Lead Bartender" },
    { employeeId: "11", name: "Junior Server", isFoh: true, hoursWorked: 10, designationName: "Server" },
  ];

  const pointRule: TipPoolRuleConfig = {
    fohPercentage: 100,
    bohPercentage: 0,
    distributionMethod: "ROLE_POINT_SYSTEM",
    rolePoints: {
      "Lead Bartender": 2.0, // 2x weight
      Server: 1.0,           // 1x weight
    },
  };

  // Lead has 10 hrs * 2.0 = 20 pts (66.67%). Server has 10 hrs * 1.0 = 10 pts (33.33%).
  const pointRes = calculateTipDistribution(300.0, weightedStaff, pointRule);
  const lead = pointRes.allocations.find((a) => a.employeeId === "10");
  const server = pointRes.allocations.find((a) => a.employeeId === "11");

  assert(lead?.tipAmount === 200.0, `Lead Bartender with 2x weight receives $200.00 [got $${lead?.tipAmount}]`);
  totalTests++;
  assert(server?.tipAmount === 100.0, `Junior Server with 1x weight receives $100.00 [got $${server?.tipAmount}]`);
  totalTests++;

  // 4. Edge Cases: Only FOH, Only BOH, 0 Tips
  console.log("\n── Section 4: Edge Cases (Single Pool, Zero Tips) ──");
  const fohOnlyStaff: StaffTipParticipant[] = [
    { employeeId: "20", name: "Sole Server", isFoh: true, hoursWorked: 35 },
  ];
  const fohOnlyRes = calculateTipDistribution(250.0, fohOnlyStaff, standardRule);
  assert(fohOnlyRes.allocations[0].tipAmount === 250.0, "Sole FOH employee receives 100% of tips even on 70/30 rule");
  totalTests++;

  const zeroTipsRes = calculateTipDistribution(0, participants, standardRule);
  assert(zeroTipsRes.totalDistributedTips === 0, "Zero tips produces zero distribution cleanly");
  totalTests++;

  console.log("\n=========================================================");
  console.log(`  Test Results: ${totalTests} Passed, 0 Failed`);
  console.log("=========================================================\n");
}

runTipPoolTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
