import { calculateAttendanceMetrics, timeStringToMinutes } from "../attendance/calculator";
import { hashPin, verifyPin } from "../attendance/punchService";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runAttendanceTests() {
  console.log("\n=========================================================");
  console.log("  Staff Attendance & Time-Tracking Engine Test Suite");
  console.log("=========================================================\n");

  let totalTests = 0;

  // 1. PIN Hashing & Verification
  console.log("── Section 1: Kiosk 4-Digit PIN Security & Verification ──");
  const testPin = "4829";
  const hashed = hashPin(testPin);
  assert(hashed.length === 64, "Generated 64-character SHA-256 PIN hash");
  totalTests++;

  assert(verifyPin("4829", hashed) === true, "Valid PIN verified correctly");
  totalTests++;

  assert(verifyPin("0000", hashed) === false, "Invalid PIN rejected securely");
  totalTests++;

  // 2. Time String to Minutes
  console.log("\n── Section 2: Time Parser & Duration Utilities ──");
  assert(timeStringToMinutes("09:00") === 540, "Parsed 09:00 to 540 minutes");
  totalTests++;

  assert(timeStringToMinutes("17:30") === 1050, "Parsed 17:30 to 1050 minutes");
  totalTests++;

  assert(timeStringToMinutes("00:00") === 0, "Parsed 00:00 to 0 minutes");
  totalTests++;

  // 3. Simple Single Shift (09:00 - 17:00 with 1 hour break)
  console.log("\n── Section 3: Standard Shift & Break Calculations ──");
  const baseDate = new Date(Date.UTC(2026, 7, 16, 0, 0, 0)); // Aug 16, 2026

  const punches = [
    { punchType: "CLOCK_IN" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 9, 0, 0)) },
    { punchType: "BREAK_START" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 13, 0, 0)) },
    { punchType: "BREAK_END" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 14, 0, 0)) },
    { punchType: "CLOCK_OUT" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 17, 0, 0)) },
  ];

  const shiftSchedule = {
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 60,
  };

  const metrics = calculateAttendanceMetrics(punches, shiftSchedule, baseDate);

  assert(metrics.totalWorkMinutes === 420, `Total work minutes is 420 (7 hrs) [got ${metrics.totalWorkMinutes}]`);
  totalTests++;

  assert(metrics.totalBreakMinutes === 60, `Total break minutes is 60 (1 hr) [got ${metrics.totalBreakMinutes}]`);
  totalTests++;

  assert(metrics.netHours === 7.0, `Net payable hours is 7.0 [got ${metrics.netHours}]`);
  totalTests++;

  assert(metrics.grossHours === 8.0, `Gross on-site hours is 8.0 [got ${metrics.grossHours}]`);
  totalTests++;

  assert(metrics.lateMinutes === 0, "On-time arrival (0 late minutes)");
  totalTests++;

  assert(metrics.earlyExitMinutes === 0, "Standard departure (0 early exit minutes)");
  totalTests++;

  assert(metrics.overtimeMinutes === 0, "No overtime on standard shift");
  totalTests++;

  assert(metrics.activePunchState === "CLOCKED_OUT", "Final state is CLOCKED_OUT");
  totalTests++;

  // 4. Tardiness & Overtime Calculation
  console.log("\n── Section 4: Tardiness & Overtime Detection ──");
  const lateAndOtPunches = [
    { punchType: "CLOCK_IN" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 9, 25, 0)) }, // 25 mins late
    { punchType: "BREAK_START" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 13, 0, 0)) },
    { punchType: "BREAK_END" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 13, 30, 0)) }, // 30 min break
    { punchType: "CLOCK_OUT" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 18, 30, 0)) }, // 1.5 hrs past 17:00
  ];

  const lateMetrics = calculateAttendanceMetrics(lateAndOtPunches, shiftSchedule, baseDate);

  assert(lateMetrics.lateMinutes === 25, `Detected 25 minutes late arrival [got ${lateMetrics.lateMinutes}]`);
  totalTests++;

  assert(lateMetrics.status === "LATE", `Flagged status as LATE [got ${lateMetrics.status}]`);
  totalTests++;

  assert(lateMetrics.totalWorkMinutes === 515, `Calculated 515 total work minutes [got ${lateMetrics.totalWorkMinutes}]`);
  totalTests++;

  assert(lateMetrics.overtimeMinutes === 95, `Detected 95 minutes overtime [got ${lateMetrics.overtimeMinutes}]`);
  totalTests++;

  // 5. Active Live Break State
  console.log("\n── Section 5: Real-Time Active Floor State Tracking ──");
  const activeBreakPunches = [
    { punchType: "CLOCK_IN" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 8, 55, 0)) },
    { punchType: "BREAK_START" as const, punchTime: new Date(Date.UTC(2026, 7, 16, 12, 10, 0)) },
  ];

  const breakMetrics = calculateAttendanceMetrics(activeBreakPunches, shiftSchedule, baseDate);

  assert(breakMetrics.activePunchState === "ON_BREAK", "Active state correctly identified as ON_BREAK");
  totalTests++;

  assert(breakMetrics.status === "ON_BREAK", "Attendance status is ON_BREAK");
  totalTests++;

  console.log("\n=========================================================");
  console.log(`  Test Results: ${totalTests} Passed, 0 Failed`);
  console.log("=========================================================\n");
}

runAttendanceTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
