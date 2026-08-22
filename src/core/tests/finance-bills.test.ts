import { getUpcomingBillsSummary, updateUpcomingBill, markBillAsPaid } from "../finance/billsEngine";
import { prisma } from "../database/client";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runUpcomingBillsTests() {
  console.log("\n=========================================================");
  console.log("  Upcoming Payment Bills & Early Reminder System Tests");
  console.log("=========================================================\n");

  let totalTests = 0;

  const testRest = await prisma.restaurant.findFirst();
  if (!testRest) {
    console.log("No test restaurant found in DB, skipping live db tests.");
    return;
  }
  const restaurantId = testRest.id;

  console.log("── Section 1: Create Bills with Early Reminders & Due Dates ──");

  // 1. Credit Card Bill due in 3 days (Reminder set to 5 days -> DUE_SOON)
  const ccDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const bill1 = await (prisma as any).upcomingBill.create({
    data: {
      restaurantId,
      title: "Amex Platinum Corporate Statement",
      category: "BANKING_PAYMENT_PROCESSING",
      vendorOrInstitution: "American Express",
      accountLast4: "4921",
      amount: 3450.0,
      dueDate: ccDueDate,
      reminderDaysBefore: 5,
      notes: "July monthly business expenses statement",
      autoConvertToExpense: true,
    },
  });
  assert(!!bill1.id, `Created credit card bill with ID: ${bill1.id}`);
  totalTests++;

  // 2. Overdue Utility Bill (due 2 days ago -> OVERDUE)
  const utilDueDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const bill2 = await (prisma as any).upcomingBill.create({
    data: {
      restaurantId,
      title: "Commercial Gas & Electric",
      category: "UTILITIES",
      vendorOrInstitution: "ConEdison",
      amount: 850.0,
      dueDate: utilDueDate,
      reminderDaysBefore: 3,
      notes: "Kitchen high-pressure gas line monthly bill",
      autoConvertToExpense: true,
    },
  });
  assert(!!bill2.id, `Created overdue utility bill with ID: ${bill2.id}`);
  totalTests++;

  console.log("\n── Section 2: Evaluate Urgency Alerts & Countdown Runways ──");
  const summary = await getUpcomingBillsSummary(restaurantId);

  const evalBill1 = summary.bills.find((b) => b.id === bill1.id);
  assert(evalBill1?.status === "DUE_SOON", `Amex card flagged as DUE_SOON (status: ${evalBill1?.status})`);
  totalTests++;

  assert(evalBill1?.isUrgentReminder === true, "Amex card triggered early manager reminder");
  totalTests++;

  const evalBill2 = summary.bills.find((b) => b.id === bill2.id);
  assert(evalBill2?.status === "OVERDUE", `ConEdison utility flagged as OVERDUE (status: ${evalBill2?.status})`);
  totalTests++;

  assert(summary.urgentAlertCount >= 2, `Urgent alert count accurate: ${summary.urgentAlertCount}`);
  totalTests++;

  assert(summary.totalDueNext7Days >= 3450.0, `Total due in next 7 days tracked: $${summary.totalDueNext7Days}`);
  totalTests++;

  console.log("\n── Section 3: Manager Amount Adjustment Before Settlement ──");
  // Manager reviews statement and adjusts amount to $3,200.00 (e.g. after cashback / credits)
  await updateUpcomingBill(bill1.id, restaurantId, {
    adjustedAmount: 3200.0,
    notes: "Applied $250 statement credit refund",
  });

  const updatedSummary = await getUpcomingBillsSummary(restaurantId);
  const adjustedEval = updatedSummary.bills.find((b) => b.id === bill1.id);
  assert(adjustedEval?.adjustedAmount === 3200.0, `Adjusted amount saved: $${adjustedEval?.adjustedAmount}`);
  totalTests++;

  assert(adjustedEval?.effectiveAmount === 3200.0, `Effective settlement amount updated to $${adjustedEval?.effectiveAmount}`);
  totalTests++;

  console.log("\n── Section 4: Settle Bill & Auto-Convert to Expense Ledger ──");
  const settlement = await markBillAsPaid(bill1.id, restaurantId, {
    paymentMethod: "CORPORATE_CHECKING",
  });

  assert(settlement.success === true, "Bill settled successfully");
  totalTests++;

  assert(!!settlement.financialTxId, `Auto-converted to FinancialTransaction expense ID: ${settlement.financialTxId}`);
  totalTests++;

  // Verify created FinancialTransaction in accounting ledger
  const createdTx = await prisma.financialTransaction.findFirst({
    where: { id: settlement.financialTxId! },
  });
  assert(createdTx !== null, "FinancialTransaction exists in DB");
  totalTests++;

  assert(Number(createdTx?.amount) === 3200.0, `FinancialTransaction amount matches adjusted amount ($${createdTx?.amount})`);
  totalTests++;

  // Cleanup test records
  if (settlement.financialTxId) {
    await prisma.financialTransaction.deleteMany({ where: { id: settlement.financialTxId } });
  }
  await (prisma as any).upcomingBill.deleteMany({
    where: { id: { in: [bill1.id, bill2.id] } },
  });

  console.log("\n=========================================================");
  console.log(`  Test Results: ${totalTests} Passed, 0 Failed`);
  console.log("=========================================================\n");
}

runUpcomingBillsTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
