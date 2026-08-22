import { generatePnLStatement, syncAutomatedTransactions } from "../finance/pnlEngine";
import { prisma } from "../database/client";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runFinanceTests() {
  console.log("\n=========================================================");
  console.log("  Financial Ledger & Executive P&L Engine Tests");
  console.log("=========================================================\n");

  let totalTests = 0;

  // 1. Fetch or create a test restaurant
  const testRest = await prisma.restaurant.findFirst();
  if (!testRest) {
    console.log("No test restaurant found in DB, skipping live db tests.");
    return;
  }

  const restaurantId = testRest.id;
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 60 * 1000);

  console.log("── Section 1: Real-Time Executive P&L Calculation ──");
  const pnl = await generatePnLStatement(restaurantId, start, end);

  assert(typeof pnl.metrics.grossRevenue === "number", "Computed Gross Revenue numeric metric");
  totalTests++;

  assert(typeof pnl.metrics.totalCogs === "number", "Computed Total COGS numeric metric");
  totalTests++;

  assert(typeof pnl.metrics.totalLabor === "number", "Computed Total Labor numeric metric");
  totalTests++;

  assert(typeof pnl.metrics.totalOpex === "number", "Computed Total OPEX numeric metric");
  totalTests++;

  assert(
    pnl.metrics.grossProfit === Number((pnl.metrics.grossRevenue - pnl.metrics.totalCogs).toFixed(2)),
    `Gross Profit is Revenue minus COGS ($${pnl.metrics.grossProfit})`
  );
  totalTests++;

  assert(
    pnl.metrics.primeCost === Number((pnl.metrics.totalCogs + pnl.metrics.totalLabor).toFixed(2)),
    `Prime Cost correctly sums COGS + Labor ($${pnl.metrics.primeCost})`
  );
  totalTests++;

  assert(
    ["OPTIMAL", "ACCEPTABLE", "HIGH"].includes(pnl.metrics.primeCostStatus),
    `Prime Cost status classified accurately: ${pnl.metrics.primeCostStatus}`
  );
  totalTests++;

  console.log("\n── Section 2: Manual Financial Transaction Ledger ──");
  const testTx = await prisma.financialTransaction.create({
    data: {
      restaurantId,
      type: "EXPENSE",
      category: "RENT_PROPERTY_LEASE",
      source: "MANUAL_ENTRY",
      title: "Monthly Dining Hall Rent",
      description: "Property lease payment",
      amount: 4500.0,
      taxAmount: 0,
      netAmount: 4500.0,
      transactionDate: new Date(),
      vendorOrPayer: "Prime Commercial Real Estate LLC",
      paymentMethod: "BANK_TRANSFER",
    },
  });

  assert(!!testTx.id, `Created manual expense entry with ID: ${testTx.id}`);
  totalTests++;

  const testRev = await prisma.financialTransaction.create({
    data: {
      restaurantId,
      type: "REVENUE",
      category: "CATERING_EVENTS",
      source: "MANUAL_ENTRY",
      title: "Corporate Banquet Catering Deposit",
      description: "50-guest corporate dinner package",
      amount: 3200.0,
      taxAmount: 200.0,
      netAmount: 3000.0,
      transactionDate: new Date(),
      vendorOrPayer: "Apex Tech Inc.",
      paymentMethod: "CREDIT_CARD",
    },
  });

  assert(!!testRev.id, `Created manual revenue entry with ID: ${testRev.id}`);
  totalTests++;

  console.log("\n── Section 3: Re-evaluation with Ingested Transactions ──");
  const updatedPnl = await generatePnLStatement(restaurantId, start, end);
  assert(
    updatedPnl.revenueStreams.some((r) => r.category === "CATERING_EVENTS" && r.amount >= 3200.0),
    "Updated P&L statement accurately reflects manual Catering revenue"
  );
  totalTests++;

  assert(
    updatedPnl.opexBreakdown.some((o) => o.category === "RENT_PROPERTY_LEASE" && o.amount >= 4500.0),
    "Updated P&L statement accurately reflects manual Rent expense"
  );
  totalTests++;

  // Clean up test transactions
  await prisma.financialTransaction.deleteMany({
    where: { id: { in: [testTx.id, testRev.id] } },
  });

  console.log("\n=========================================================");
  console.log(`  Test Results: ${totalTests} Passed, 0 Failed`);
  console.log("=========================================================\n");
}

runFinanceTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
