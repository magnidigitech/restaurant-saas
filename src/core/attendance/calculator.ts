export interface ShiftSchedule {
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  breakMinutes?: number;
}

export interface RawPunch {
  id?: string;
  punchType: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
  punchTime: Date | string;
}

export interface AttendanceCalculationResult {
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  grossHours: number;
  netHours: number;
  status: "PRESENT" | "LATE" | "ON_BREAK" | "EARLY_DEPARTURE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  clockInTime: Date | null;
  clockOutTime: Date | null;
  activePunchState: "NOT_CLOCKED_IN" | "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
}

/**
 * Parses "HH:mm" time string into minutes since midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  return hours * 60 + mins;
}

/**
 * Calculates work, break, overtime, and punctuality metrics from a list of time punches.
 */
export function calculateAttendanceMetrics(
  punches: RawPunch[],
  scheduledShift?: ShiftSchedule | null,
  workDateMidnight?: Date
): AttendanceCalculationResult {
  // Sort punches ascending by time
  const sorted = [...punches].sort(
    (a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()
  );

  let totalWorkMs = 0;
  let totalBreakMs = 0;

  let currentClockIn: number | null = null;
  let currentBreakStart: number | null = null;
  let firstClockIn: Date | null = null;
  let lastClockOut: Date | null = null;
  let activePunchState: AttendanceCalculationResult["activePunchState"] = "NOT_CLOCKED_IN";

  for (const punch of sorted) {
    const punchMs = new Date(punch.punchTime).getTime();

    switch (punch.punchType) {
      case "CLOCK_IN":
        if (currentClockIn === null) {
          currentClockIn = punchMs;
          if (!firstClockIn) firstClockIn = new Date(punch.punchTime);
          activePunchState = "CLOCKED_IN";
        }
        break;

      case "BREAK_START":
        if (currentClockIn !== null && currentBreakStart === null) {
          totalWorkMs += Math.max(0, punchMs - currentClockIn);
          currentClockIn = null;
          currentBreakStart = punchMs;
          activePunchState = "ON_BREAK";
        }
        break;

      case "BREAK_END":
        if (currentBreakStart !== null) {
          totalBreakMs += Math.max(0, punchMs - currentBreakStart);
          currentBreakStart = null;
          currentClockIn = punchMs;
          activePunchState = "CLOCKED_IN";
        }
        break;

      case "CLOCK_OUT":
        if (currentBreakStart !== null) {
          totalBreakMs += Math.max(0, punchMs - currentBreakStart);
          currentBreakStart = null;
        }
        if (currentClockIn !== null) {
          totalWorkMs += Math.max(0, punchMs - currentClockIn);
          currentClockIn = null;
        }
        lastClockOut = new Date(punch.punchTime);
        activePunchState = "CLOCKED_OUT";
        break;
    }
  }

  // If currently still on break or clocked in right now, we calculate accrued time up to now
  // but only if it's the current active day
  const totalWorkMinutes = Math.round(totalWorkMs / (1000 * 60));
  const totalBreakMinutes = Math.round(totalBreakMs / (1000 * 60));

  let lateMinutes = 0;
  let earlyExitMinutes = 0;
  let overtimeMinutes = 0;

  if (scheduledShift && firstClockIn) {
    const shiftStartMins = timeStringToMinutes(scheduledShift.startTime);
    const shiftEndMins = timeStringToMinutes(scheduledShift.endTime);
    const scheduledShiftDuration = shiftEndMins > shiftStartMins
      ? shiftEndMins - shiftStartMins
      : (shiftEndMins + 24 * 60) - shiftStartMins;

    const actualInMins = firstClockIn.getUTCHours() * 60 + firstClockIn.getUTCMinutes();
    if (actualInMins > shiftStartMins + 5) {
      // 5 min grace period
      lateMinutes = actualInMins - shiftStartMins;
    }

    if (lastClockOut) {
      const actualOutMins = lastClockOut.getUTCHours() * 60 + lastClockOut.getUTCMinutes();
      if (actualOutMins < shiftEndMins - 5) {
        earlyExitMinutes = shiftEndMins - actualOutMins;
      }
    }

    // Overtime is any time worked beyond the scheduled shift duration (minus scheduled break)
    const netScheduledMins = Math.max(0, scheduledShiftDuration - (scheduledShift.breakMinutes || 0));
    if (totalWorkMinutes > netScheduledMins) {
      overtimeMinutes = totalWorkMinutes - netScheduledMins;
    }
  } else {
    // If no scheduled shift, overtime kicks in after 8 hours (480 mins)
    if (totalWorkMinutes > 480) {
      overtimeMinutes = totalWorkMinutes - 480;
    }
  }

  // Determine overall status
  let status: AttendanceCalculationResult["status"] = "PRESENT";
  if (activePunchState === "ON_BREAK") {
    status = "ON_BREAK";
  } else if (lateMinutes > 15) {
    status = "LATE";
  } else if (earlyExitMinutes > 30 && activePunchState === "CLOCKED_OUT") {
    status = "EARLY_DEPARTURE";
  } else if (totalWorkMinutes > 0 && totalWorkMinutes < 240 && activePunchState === "CLOCKED_OUT") {
    status = "HALF_DAY";
  }

  const grossHours = Number(((totalWorkMinutes + totalBreakMinutes) / 60).toFixed(2));
  const netHours = Number((totalWorkMinutes / 60).toFixed(2));

  return {
    totalWorkMinutes,
    totalBreakMinutes,
    overtimeMinutes,
    lateMinutes,
    earlyExitMinutes,
    grossHours,
    netHours,
    status,
    clockInTime: firstClockIn,
    clockOutTime: lastClockOut,
    activePunchState,
  };
}
