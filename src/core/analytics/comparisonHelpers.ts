/**
 * Reusable Date Range and Percentage Change Helpers for Dashboard & Analytics
 * Supports timezone-aware start-inclusive/end-exclusive query boundaries,
 * comparison period calculations, edge-case handling, and display formatting.
 */

export interface DateRange {
  start: Date;
  endExclusive: Date;
  label: string;
}

export interface ComparisonPeriodResult {
  current: DateRange;
  previous: DateRange;
  comparisonLabel: string; // e.g. "vs yesterday", "vs last week", "vs last month", "vs 3 Sep - 9 Sep"
  isMultiDay: boolean;
}

export interface MetricComparison {
  currentValue: number;
  previousValue: number | null;
  percentageChange: number | null;
  direction: "up" | "down" | "flat" | "none";
  changeLabel: string;     // e.g. "↑ 20%", "↓ 12.5%", "0%", "N/A", "No comparison data"
  comparisonLabel: string; // e.g. "vs yesterday"
  displayText: string;     // e.g. "↑ 20% vs yesterday", "0% vs last month", "N/A vs yesterday"
  status: "positive" | "negative" | "neutral" | "none";
}

/**
 * Creates a UTC Date representing the exact local time (year, month, day, h, m, s, ms)
 * in the specified target timezone.
 */
export function createCustomZonedDate(
  year: number,
  month: number,
  day: number,
  h: number,
  m: number,
  s: number,
  ms: number,
  timezone: string
): Date {
  const targetTz = timezone?.trim() || "UTC";
  const candidate = new Date(Date.UTC(year, month - 1, day, h, m, s, ms));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: targetTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(candidate);

  const partMap: Record<string, string> = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });

  let localH = Number(partMap.hour);
  if (localH === 24) localH = 0;

  const localZoned = new Date(
    Date.UTC(
      Number(partMap.year),
      Number(partMap.month) - 1,
      Number(partMap.day),
      localH,
      Number(partMap.minute),
      Number(partMap.second)
    )
  );

  const diffMs = candidate.getTime() - localZoned.getTime();
  return new Date(candidate.getTime() + diffMs);
}

/**
 * Gets the start and end-exclusive bounds for a single calendar day with an offset in target timezone.
 */
export function getSingleDayBounds(timezone: string, dayOffset = 0): {
  start: Date;
  endExclusive: Date;
  year: number;
  month: number;
  day: number;
  formattedDate: string;
} {
  const targetTz = timezone?.trim() || "UTC";
  const refDate = new Date(Date.now() + dayOffset * 86400000);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: targetTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const ymd = formatter.format(refDate); // "YYYY-MM-DD"
  const [year, month, day] = ymd.split("-").map(Number);

  const start = createCustomZonedDate(year, month, day, 0, 0, 0, 0, targetTz);
  // Next day midnight in target timezone (start-inclusive, end-exclusive)
  const nextRef = new Date(Date.UTC(year, month - 1, day) + 86400000);
  const nextYmd = formatter.format(nextRef);
  const [ny, nm, nd] = nextYmd.split("-").map(Number);
  const endExclusive = createCustomZonedDate(ny, nm, nd, 0, 0, 0, 0, targetTz);

  const dObj = new Date(year, month - 1, day);
  const formattedDate = dObj.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return {
    start,
    endExclusive,
    year,
    month,
    day,
    formattedDate,
  };
}

/**
 * Computes the comparison period date ranges based on the user's selected filter:
 * - Today → Yesterday ("vs yesterday")
 * - Yesterday → Day before yesterday ("vs day before")
 * - This week → Last calendar week ("vs last week")
 * - This month → Last calendar month ("vs last month")
 * - Custom date range → Preceding range with same number of calendar days ("vs [dates]")
 */
export function getComparisonDateRanges(
  period: string,
  timezone: string,
  startDateParam?: string | null,
  endDateParam?: string | null
): ComparisonPeriodResult {
  const targetTz = timezone?.trim() || "UTC";

  const todayInfo = getSingleDayBounds(targetTz, 0);
  const yesterdayInfo = getSingleDayBounds(targetTz, -1);
  const dayBeforeYesterdayInfo = getSingleDayBounds(targetTz, -2);

  // 1. Custom Date Range
  if (startDateParam) {
    const [sy, sm, sd] = startDateParam.split("-").map(Number);
    const [ey, em, ed] = (endDateParam || startDateParam).split("-").map(Number);

    const currentStart = createCustomZonedDate(sy, sm, sd, 0, 0, 0, 0, targetTz);

    // End-exclusive boundary: 00:00:00.000 of the day following endDate
    const nextDayObj = new Date(Date.UTC(ey, em - 1, ed + 1));
    const eny = nextDayObj.getUTCFullYear();
    const enm = nextDayObj.getUTCMonth() + 1;
    const end = nextDayObj.getUTCDate();
    const currentEndExclusive = createCustomZonedDate(eny, enm, end, 0, 0, 0, 0, targetTz);

    // Number of calendar days
    const currentStartUtc = Date.UTC(sy, sm - 1, sd);
    const currentEndUtc = Date.UTC(ey, em - 1, ed);
    const daysCount = Math.max(1, Math.round((currentEndUtc - currentStartUtc) / 86400000) + 1);

    // Preceding range: same number of days immediately preceding currentStart
    const prevEndUtc = currentStartUtc - 86400000;
    const prevStartUtc = prevEndUtc - (daysCount - 1) * 86400000;

    const prevStartDateObj = new Date(prevStartUtc);
    const prevEndDateObj = new Date(prevEndUtc);

    const psy = prevStartDateObj.getUTCFullYear();
    const psm = prevStartDateObj.getUTCMonth() + 1;
    const psd = prevStartDateObj.getUTCDate();

    const pey = prevEndDateObj.getUTCFullYear();
    const pem = prevEndDateObj.getUTCMonth() + 1;
    const ped = prevEndDateObj.getUTCDate();

    const prevStart = createCustomZonedDate(psy, psm, psd, 0, 0, 0, 0, targetTz);
    const prevEndExclusive = currentStart; // Seamless start of current range!

    const curSStr = new Date(Date.UTC(sy, sm - 1, sd)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
    const curEStr = new Date(Date.UTC(ey, em - 1, ed)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

    const prevSStr = new Date(Date.UTC(psy, psm - 1, psd)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
    const prevEStr = new Date(Date.UTC(pey, pem - 1, ped)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

    const currentLabel = curSStr === curEStr ? curSStr : `${curSStr} - ${curEStr}`;
    const previousLabel = prevSStr === prevEStr ? prevSStr : `${prevSStr} - ${prevEStr}`;
    const comparisonLabel = `vs ${previousLabel}`;

    return {
      current: {
        start: currentStart,
        endExclusive: currentEndExclusive,
        label: currentLabel,
      },
      previous: {
        start: prevStart,
        endExclusive: prevEndExclusive,
        label: previousLabel,
      },
      comparisonLabel,
      isMultiDay: daysCount > 1,
    };
  }

  // 2. Yesterday
  if (period === "yesterday") {
    return {
      current: {
        start: yesterdayInfo.start,
        endExclusive: yesterdayInfo.endExclusive,
        label: `Yesterday, ${yesterdayInfo.formattedDate}`,
      },
      previous: {
        start: dayBeforeYesterdayInfo.start,
        endExclusive: dayBeforeYesterdayInfo.endExclusive,
        label: dayBeforeYesterdayInfo.formattedDate,
      },
      comparisonLabel: "vs day before",
      isMultiDay: false,
    };
  }

  // 3. This Week (Monday to current, compared with full previous calendar week)
  if (period === "week") {
    // Determine day of week in outlet timezone (1 = Mon, ..., 7 = Sun)
    const nowUtc = new Date();
    const dayOfWeekStr = new Intl.DateTimeFormat("en-US", {
      timeZone: targetTz,
      weekday: "short",
    }).format(nowUtc);

    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const dayOfWeek = weekdayMap[dayOfWeekStr] || 1;

    // Start of this calendar week (Monday 00:00:00)
    const daysSinceMonday = dayOfWeek - 1;
    const thisWeekMonday = getSingleDayBounds(targetTz, -daysSinceMonday);
    const currentStart = thisWeekMonday.start;
    const currentEndExclusive = todayInfo.endExclusive;

    // Full previous calendar week: Monday 00:00:00 to Sunday 23:59:59.999 (7 full days before this week Monday)
    const lastWeekMonday = getSingleDayBounds(targetTz, -daysSinceMonday - 7);
    const lastWeekSunday = getSingleDayBounds(targetTz, -daysSinceMonday - 1);
    const prevStart = lastWeekMonday.start;
    const prevEndExclusive = thisWeekMonday.start; // Seamless boundary!

    const currentLabel = `This Week (${thisWeekMonday.formattedDate} - ${todayInfo.formattedDate})`;
    const previousLabel = `${lastWeekMonday.formattedDate} - ${lastWeekSunday.formattedDate}`;

    return {
      current: {
        start: currentStart,
        endExclusive: currentEndExclusive,
        label: currentLabel,
      },
      previous: {
        start: prevStart,
        endExclusive: prevEndExclusive,
        label: previousLabel,
      },
      comparisonLabel: "vs last week",
      isMultiDay: true,
    };
  }

  // 4. This Month (1st of month to today, compared with full previous calendar month)
  if (period === "month") {
    const curYear = todayInfo.year;
    const curMonth = todayInfo.month;

    // Start of this month (1st 00:00:00)
    const currentStart = createCustomZonedDate(curYear, curMonth, 1, 0, 0, 0, 0, targetTz);
    const currentEndExclusive = todayInfo.endExclusive;

    // Full previous calendar month (1st of prev month to 1st of cur month)
    const prevYear = curMonth === 1 ? curYear - 1 : curYear;
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevStart = createCustomZonedDate(prevYear, prevMonth, 1, 0, 0, 0, 0, targetTz);
    const prevEndExclusive = currentStart; // Seamless start of current month!

    const prevMonthName = new Date(Date.UTC(prevYear, prevMonth - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
    });

    const currentLabel = `This Month (${todayInfo.formattedDate})`;
    const previousLabel = `${prevMonthName} ${prevYear}`;

    return {
      current: {
        start: currentStart,
        endExclusive: currentEndExclusive,
        label: currentLabel,
      },
      previous: {
        start: prevStart,
        endExclusive: prevEndExclusive,
        label: previousLabel,
      },
      comparisonLabel: "vs last month",
      isMultiDay: true,
    };
  }

  // 5. Default: Today (compared with full yesterday)
  return {
    current: {
      start: todayInfo.start,
      endExclusive: todayInfo.endExclusive,
      label: `Today, ${todayInfo.formattedDate}`,
    },
    previous: {
      start: yesterdayInfo.start,
      endExclusive: yesterdayInfo.endExclusive,
      label: yesterdayInfo.formattedDate,
    },
    comparisonLabel: "vs yesterday",
    isMultiDay: false,
  };
}

/**
 * Calculates percentage change between current and previous values with strict edge-case handling:
 * - Both values zero: 0%
 * - Previous value zero and current value nonzero: N/A
 * - Missing comparison data: "No comparison data"
 * - Never NaN or Infinity
 * - Metric-appropriate polarity (higherIsBetter = false for cancellations/food cost)
 * - Rounds only for display to at most 1 decimal place
 */
export function calculatePercentageChange(
  current: number,
  previous: number | null | undefined,
  comparisonLabel = "vs yesterday",
  higherIsBetter = true
): MetricComparison {
  const currentVal = Number(current || 0);

  if (previous === null || previous === undefined || isNaN(Number(previous))) {
    return {
      currentValue: currentVal,
      previousValue: null,
      percentageChange: null,
      direction: "none",
      changeLabel: "No comparison data",
      comparisonLabel,
      displayText: "No comparison data",
      status: "none",
    };
  }

  const prevVal = Number(previous);

  // Edge case 1: Both values zero
  if (currentVal === 0 && prevVal === 0) {
    return {
      currentValue: currentVal,
      previousValue: prevVal,
      percentageChange: 0,
      direction: "flat",
      changeLabel: "0%",
      comparisonLabel,
      displayText: `0% ${comparisonLabel}`,
      status: "neutral",
    };
  }

  // Edge case 2: Previous value zero and current value nonzero
  if (prevVal === 0 && currentVal !== 0) {
    return {
      currentValue: currentVal,
      previousValue: prevVal,
      percentageChange: null,
      direction: "none",
      changeLabel: "N/A",
      comparisonLabel,
      displayText: `N/A ${comparisonLabel}`,
      status: "none",
    };
  }

  // Full precision calculation
  const rawChange = ((currentVal - prevVal) / prevVal) * 100;
  if (!isFinite(rawChange) || isNaN(rawChange)) {
    return {
      currentValue: currentVal,
      previousValue: prevVal,
      percentageChange: null,
      direction: "none",
      changeLabel: "N/A",
      comparisonLabel,
      displayText: `N/A ${comparisonLabel}`,
      status: "none",
    };
  }

  const roundedChange = Math.round(rawChange * 10) / 10;
  const isZero = roundedChange === 0 || Math.abs(roundedChange) < 0.05;

  if (isZero) {
    return {
      currentValue: currentVal,
      previousValue: prevVal,
      percentageChange: 0,
      direction: "flat",
      changeLabel: "0%",
      comparisonLabel,
      displayText: `0% ${comparisonLabel}`,
      status: "neutral",
    };
  }

  const isUp = roundedChange > 0;
  const arrow = isUp ? "↑" : "↓";
  const absValStr = Math.abs(roundedChange).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

  const changeLabel = `${arrow} ${absValStr}%`;
  const displayText = `${changeLabel} ${comparisonLabel}`;

  const status = isUp
    ? (higherIsBetter ? "positive" : "negative")
    : (higherIsBetter ? "negative" : "positive");

  return {
    currentValue: currentVal,
    previousValue: prevVal,
    percentageChange: roundedChange,
    direction: isUp ? "up" : "down",
    changeLabel,
    comparisonLabel,
    displayText,
    status,
  };
}
