/**
 * Timezone, DST, and Workweek-aware utilities for Shift Scheduling.
 * Uses native Intl.DateTimeFormat with zero external dependencies.
 */

export function toDateKey(input: Date | string): string {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }
  return input.toISOString().slice(0, 10);
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function getDayOfWeekFromKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
}

export function getTodayKeyInTimezone(timeZone: string): string {
  const tz = timeZone?.trim() || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Resolves a wall-clock dateKey (YYYY-MM-DD) and time (HH:mm) in an IANA timeZone
 * to the exact UTC Date instant, accounting for Daylight Saving Time transitions.
 */
export function zonedDateTimeToUtc(
  dateKey: string,
  timeHHmm: string,
  timeZone: string = "UTC"
): Date {
  const tz = timeZone?.trim() || "UTC";
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeHHmm.split(":").map(Number);

  if (tz === "UTC") {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  }

  // Start with a UTC guess matching the wall clock numbers
  const utcGuessMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  const getOffsetMs = (instantMs: number): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(instantMs));

    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") {
        map[p.type] = parseInt(p.value, 10);
      }
    }
    const h = map.hour === 24 ? 0 : map.hour;
    const zonedAsUtcMs = Date.UTC(map.year, map.month - 1, map.day, h, map.minute, map.second, 0);
    return zonedAsUtcMs - instantMs;
  };

  try {
    // Two-pass refinement accurately resolves DST spring-forward and fall-back boundaries
    const offset1 = getOffsetMs(utcGuessMs);
    const candidate1 = utcGuessMs - offset1;
    const offset2 = getOffsetMs(candidate1);
    return new Date(utcGuessMs - offset2);
  } catch {
    return new Date(utcGuessMs);
  }
}

export interface ShiftInterval {
  dateKey: string;
  endDateKey: string;
  startUtc: Date;
  endUtc: Date;
  isOvernight: boolean;
  grossMinutes: number;
  paidMinutes: number;
  paidHours: number;
}

export function getShiftInterval(
  dateKey: string,
  startTime: string,
  endTime: string,
  breakMinutes: number = 0,
  timeZone: string = "UTC"
): ShiftInterval {
  const isOvernight = endTime <= startTime;
  const endDateKey = isOvernight ? addDaysToKey(dateKey, 1) : dateKey;
  const startUtc = zonedDateTimeToUtc(dateKey, startTime, timeZone);
  const endUtc = zonedDateTimeToUtc(endDateKey, endTime, timeZone);

  const grossMinutes = Math.max(0, Math.round((endUtc.getTime() - startUtc.getTime()) / 60000));
  const paidMinutes = Math.max(0, grossMinutes - Math.max(0, breakMinutes));
  const paidHours = Math.round((paidMinutes / 60) * 100) / 100;

  return {
    dateKey,
    endDateKey,
    startUtc,
    endUtc,
    isOvernight,
    grossMinutes,
    paidMinutes,
    paidHours,
  };
}

export function doIntervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function getWorkweekBounds(
  dateKey: string,
  workweekStartDay: number = 1, // 0=Sun, 1=Mon
  timeZone: string = "UTC"
) {
  const dow = getDayOfWeekFromKey(dateKey);
  const diff = (dow - workweekStartDay + 7) % 7;
  const weekStartKey = addDaysToKey(dateKey, -diff);
  const nextWeekStartKey = addDaysToKey(weekStartKey, 7);
  const weekEndKeyInclusive = addDaysToKey(weekStartKey, 6);

  const weekStartUtc = zonedDateTimeToUtc(weekStartKey, "00:00", timeZone);
  const weekEndUtc = zonedDateTimeToUtc(nextWeekStartKey, "00:00", timeZone);

  return {
    weekStartKey,
    weekEndKeyInclusive,
    weekStartUtc,
    weekEndUtc,
  };
}

/**
 * Calculates how many paid hours of a shift fall inside a specific [windowStartUtc, windowEndUtc) boundary.
 * Handles shifts that cross midnight across the workweek boundary.
 */
export function getShiftPaidHoursInWindow(
  interval: ShiftInterval,
  windowStartUtc: Date,
  windowEndUtc: Date
): number {
  const overlapStart = Math.max(interval.startUtc.getTime(), windowStartUtc.getTime());
  const overlapEnd = Math.min(interval.endUtc.getTime(), windowEndUtc.getTime());
  if (overlapEnd <= overlapStart || interval.grossMinutes <= 0) return 0;

  const overlapGrossMinutes = (overlapEnd - overlapStart) / 60000;
  const paidRatio = interval.paidMinutes / interval.grossMinutes;
  return (overlapGrossMinutes * paidRatio) / 60;
}
