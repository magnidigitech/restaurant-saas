export interface ShiftSchedule {
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  breakMinutes?: number;
  shiftDate?: Date | string; // "YYYY-MM-DD" or midnight UTC Date
  timezone?: string; // e.g. "America/Toronto"
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
  status:
    | "PRESENT"
    | "LATE"
    | "ON_BREAK"
    | "EARLY_DEPARTURE"
    | "HALF_DAY"
    | "ABSENT"
    | "ON_LEAVE";
  clockInTime: Date | null;
  clockOutTime: Date | null;
  activePunchState:
    | "NOT_CLOCKED_IN"
    | "CLOCKED_IN"
    | "ON_BREAK"
    | "CLOCKED_OUT";
}

export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  return hours * 60 + mins;
}

export function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = parseInt(p.value, 10);
    }
    const asUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      map.hour,
      map.minute,
      map.second
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

export function localDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offset1 = getTimezoneOffsetMinutes(utcGuess, timeZone);
  const candidate1 = new Date(utcGuess.getTime() - offset1 * 60000);
  const offset2 = getTimezoneOffsetMinutes(candidate1, timeZone);
  return offset2 !== offset1
    ? new Date(utcGuess.getTime() - offset2 * 60000)
    : candidate1;
}

export function formatUtcToLocalDateKey(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Calculates work, break, overtime, and punctuality metrics from a list of time punches.
 * Supports overnight shifts and DST transitions when timezone + shiftDate are provided.
 */
export function calculateAttendanceMetrics(
  punches: RawPunch[],
  scheduledShift?: ShiftSchedule | null,
  workDateMidnight?: Date
): AttendanceCalculationResult {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()
  );

  let totalWorkMs = 0;
  let totalBreakMs = 0;

  let currentClockIn: number | null = null;
  let currentBreakStart: number | null = null;
  let firstClockIn: Date | null = null;
  let lastClockOut: Date | null = null;
  let activePunchState: AttendanceCalculationResult["activePunchState"] =
    "NOT_CLOCKED_IN";

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

  const totalWorkMinutes = Math.round(totalWorkMs / (1000 * 60));
  const totalBreakMinutes = Math.round(totalBreakMs / (1000 * 60));

  let lateMinutes = 0;
  let earlyExitMinutes = 0;
  let overtimeMinutes = 0;

  if (scheduledShift && firstClockIn) {
    const tz = scheduledShift.timezone || "UTC";
    const baseDateObj =
      scheduledShift.shiftDate
        ? new Date(scheduledShift.shiftDate)
        : workDateMidnight || new Date(firstClockIn);
    const dateKey = baseDateObj.toISOString().slice(0, 10);

    const startMins = timeStringToMinutes(scheduledShift.startTime);
    const endMins = timeStringToMinutes(scheduledShift.endTime);
    const isOvernight = endMins <= startMins;

    const scheduledStartUtc = localDateTimeToUtc(
      dateKey,
      scheduledShift.startTime,
      tz
    );
    const nextDayObj = new Date(`${dateKey}T00:00:00Z`);
    nextDayObj.setUTCDate(nextDayObj.getUTCDate() + 1);
    const endDateKey = isOvernight
      ? nextDayObj.toISOString().slice(0, 10)
      : dateKey;
    const scheduledEndUtc = localDateTimeToUtc(
      endDateKey,
      scheduledShift.endTime,
      tz
    );

    const scheduledShiftDuration = Math.max(
      0,
      Math.round((scheduledEndUtc.getTime() - scheduledStartUtc.getTime()) / 60000)
    );

    const lateDiff = Math.round(
      (firstClockIn.getTime() - scheduledStartUtc.getTime()) / 60000
    );
    if (lateDiff > 5) {
      lateMinutes = lateDiff;
    }

    if (lastClockOut) {
      const earlyDiff = Math.round(
        (scheduledEndUtc.getTime() - lastClockOut.getTime()) / 60000
      );
      if (earlyDiff > 5) {
        earlyExitMinutes = earlyDiff;
      }
    }

    const netScheduledMins = Math.max(
      0,
      scheduledShiftDuration - (scheduledShift.breakMinutes || 0)
    );
    if (totalWorkMinutes > netScheduledMins) {
      overtimeMinutes = totalWorkMinutes - netScheduledMins;
    }
  } else {
    if (totalWorkMinutes > 480) {
      overtimeMinutes = totalWorkMinutes - 480;
    }
  }

  let status: AttendanceCalculationResult["status"] = "PRESENT";
  if (activePunchState === "ON_BREAK") {
    status = "ON_BREAK";
  } else if (lateMinutes > 15) {
    status = "LATE";
  } else if (earlyExitMinutes > 30 && activePunchState === "CLOCKED_OUT") {
    status = "EARLY_DEPARTURE";
  } else if (
    totalWorkMinutes > 0 &&
    totalWorkMinutes < 240 &&
    activePunchState === "CLOCKED_OUT"
  ) {
    status = "HALF_DAY";
  }

  const grossHours = Number(
    ((totalWorkMinutes + totalBreakMinutes) / 60).toFixed(2)
  );
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
