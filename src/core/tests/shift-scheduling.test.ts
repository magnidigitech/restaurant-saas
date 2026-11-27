import {
  getShiftInterval,
  doIntervalsOverlap,
  getWorkweekBounds,
  getShiftPaidHoursInWindow,
} from "../../modules/shifts/timeUtils";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function assertClose(actual: number, expected: number, message: string, tol = 0.01) {
  assert(Math.abs(actual - expected) <= tol, `${message} (got ${actual}, expected ${expected})`);
}

async function run() {
  console.log("=========================================================");
  console.log("  Shift Scheduling, Timezone, DST & Workweek Test Suite");
  console.log("=========================================================\n");

  console.log("── Section 1: Overnight Paid Hours & Break Math ──");
  const normalNight = getShiftInterval("2026-06-15", "22:00", "04:00", 30, "America/New_York");
  assert(normalNight.isOvernight === true, "22:00–04:00 is detected as overnight");
  assert(normalNight.endDateKey === "2026-06-16", "Overnight shift ends on next calendar day");
  assertClose(normalNight.paidHours, 5.5, "22:00–04:00 with 30m unpaid break = 5.5 paid hours");

  console.log("\n── Section 2: Daylight Saving Time Transitions (America/New_York) ──");
  // Spring forward 2026-03-08: 02:00 jumps to 03:00 (1 hour shorter night)
  const springForward = getShiftInterval("2026-03-07", "22:00", "04:00", 30, "America/New_York");
  assertClose(springForward.grossMinutes, 300, "Spring forward 22:00–04:00 is 300 gross minutes (5h)");
  assertClose(springForward.paidHours, 4.5, "Spring forward 22:00–04:00 with 30m break = 4.5 paid hours");

  // Fall back 2026-11-01: 01:00–02:00 repeats (1 hour longer night)
  const fallBack = getShiftInterval("2026-10-31", "22:00", "04:00", 30, "America/New_York");
  assertClose(fallBack.grossMinutes, 420, "Fall back 22:00–04:00 is 420 gross minutes (7h)");
  assertClose(fallBack.paidHours, 6.5, "Fall back 22:00–04:00 with 30m break = 6.5 paid hours");

  console.log("\n── Section 3: Cross-Date & Cross-Outlet Overnight Overlap Detection ──");
  const day1Overnight = getShiftInterval("2026-06-15", "22:00", "04:00", 0, "America/New_York");
  const day2Early = getShiftInterval("2026-06-16", "02:00", "08:00", 0, "America/New_York");
  const day2Later = getShiftInterval("2026-06-16", "04:00", "10:00", 0, "America/New_York");
  assert(
    doIntervalsOverlap(day1Overnight.startUtc, day1Overnight.endUtc, day2Early.startUtc, day2Early.endUtc),
    "Day 1 22:00–04:00 overlaps Day 2 02:00–08:00"
  );
  assert(
    !doIntervalsOverlap(day1Overnight.startUtc, day1Overnight.endUtc, day2Later.startUtc, day2Later.endUtc),
    "Day 1 22:00–04:00 does NOT overlap Day 2 04:00–10:00 (exact boundary)"
  );

  // Cross-timezone overlap: Outlet A in New York (EDT UTC-4) 18:00–22:00 = 22:00–02:00 UTC;
  // Outlet B in Los Angeles (PDT UTC-7) 14:00–18:00 = 21:00–01:00 UTC -> OVERLAPS!
  const nyShift = getShiftInterval("2026-06-15", "18:00", "22:00", 0, "America/New_York");
  const laShift = getShiftInterval("2026-06-15", "14:00", "18:00", 0, "America/Los_Angeles");
  assert(
    doIntervalsOverlap(nyShift.startUtc, nyShift.endUtc, laShift.startUtc, laShift.endUtc),
    "Cross-timezone overlap detected between NY 18:00–22:00 and LA 14:00–18:00"
  );

  console.log("\n── Section 4: Workweek Boundary Splitting ──");
  // Monday-start workweek: Week 1 is 2026-06-08..2026-06-14, Week 2 starts 2026-06-15 00:00
  const week1Bounds = getWorkweekBounds("2026-06-14", 1, "America/New_York");
  const week2Bounds = getWorkweekBounds("2026-06-15", 1, "America/New_York");
  assert(week1Bounds.weekStartKey === "2026-06-08", "Week 1 starts Monday 2026-06-08");
  assert(week2Bounds.weekStartKey === "2026-06-15", "Week 2 starts Monday 2026-06-15");

  const sundayOvernight = getShiftInterval("2026-06-14", "22:00", "04:00", 0, "America/New_York");
  const hrsInWeek1 = getShiftPaidHoursInWindow(sundayOvernight, week1Bounds.weekStartUtc, week1Bounds.weekEndUtc);
  const hrsInWeek2 = getShiftPaidHoursInWindow(sundayOvernight, week2Bounds.weekStartUtc, week2Bounds.weekEndUtc);
  assertClose(hrsInWeek1, 2.0, "Sunday 22:00–04:00 attributes 2.0h to Week 1");
  assertClose(hrsInWeek2, 4.0, "Sunday 22:00–04:00 attributes 4.0h to Week 2");

  console.log("\n=========================================================");
  console.log(`  Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("=========================================================");
  if (failed > 0) process.exit(1);
}

run();
