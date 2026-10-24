import type { RecurrenceDay, RecurrenceRule } from "../types";
import {
  MAX_EPOCH_DAY,
  epochDayOf,
  isoFieldsOf,
  isoWeekdayOf,
} from "./epochDay";
import { nthWeekdayWithin } from "./nthWeekday";

/** A local wall time: an epoch day and the second of that day, 0 to 86399. */
export type LocalMoment = { day: number; second: number };

/**
 * Why `expandLocalMoments` returned: `"stopped"` when `visit` returned `false`, `"capped"` when
 * the work budget ran out, `"end"` when a pick fell after `lastDay` (default and ceiling:
 * `MAX_EPOCH_DAY`, the last Temporal date). The last period is evaluated in full, so `"end"` can
 * come partway through it.
 */
export type ExpansionStatus = "stopped" | "capped" | "end";

/**
 * Work units one expansion may spend: periods visited, years looked up, days evaluated while a
 * year of the day cache fills, and moments considered.
 */
export const RECURRENCE_WORK_CAP = 2_000_000;

/**
 * The proleptic Gregorian calendar repeats exactly every 400 years: 146,097 days (a whole 20,871
 * weeks), 4,800 months. The day filter reads only the calendar (month, month length, leap year,
 * day of year, ISO week of a year, weekday), so a day and the day 146,097 later give the same
 * answer. The day cache and the "nothing more can come" end rely on it.
 */
const CYCLE_YEARS = 400;
const CYCLE_DAYS = 146_097;
/** Periods in one cycle, by frequency, yearly to daily. */
const CYCLE_PERIODS = {
  yearly: CYCLE_YEARS,
  monthly: 4800,
  weekly: 20_871,
  daily: CYCLE_DAYS,
} as const;

const SECONDS_PER_DAY = 86_400;
const DAYS_PER_WEEK = 7;
const THURSDAY = 4;

/** Always non-negative, unlike `%`. */
function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/** The first day of the week that holds `day`, for weeks that start on ISO weekday `firstDayOfWeek`. */
function weekStart(day: number, firstDayOfWeek: number): number {
  return day - mod(isoWeekdayOf(day) - firstDayOfWeek, DAYS_PER_WEEK);
}

/** Start of week 1 of week-year `year`: the week holding January 4 (RFC 5545 §3.3.10, BYWEEKNO). */
function weekOneStart(year: number, firstDayOfWeek: number): number {
  return weekStart(epochDayOf(year, 1, 4), firstDayOfWeek);
}

/**
 * The week of `day` in its own week-year, with weeks starting on ISO weekday `firstDayOfWeek` and
 * week 1 the first week with at least four days in the year (RFC 5545 §3.3.10, BYWEEKNO).
 * With `firstDayOfWeek` 1 this is ISO 8601 `weekOfYear` and `yearOfWeek`.
 *
 * @example weekYearWeek(epochDayOf(2024, 12, 30), 1) // { weekYear: 2025, week: 1, weeks: 52 }
 */
export function weekYearWeek(
  day: number,
  firstDayOfWeek: number,
): { weekYear: number; week: number; weeks: number } {
  const start = weekStart(day, firstDayOfWeek);
  // The week belongs to the year that holds its fourth day.
  const weekYear = isoFieldsOf(start + 3)[0];
  const first = weekOneStart(weekYear, firstDayOfWeek);

  return {
    weekYear,
    week: (start - first) / DAYS_PER_WEEK + 1,
    weeks: (weekOneStart(weekYear + 1, firstDayOfWeek) - first) / DAYS_PER_WEEK,
  };
}

/** The rule with RFC 8984 §4.3.3.1 extra rule 3's implicit parts added and every list normalised. */
type PreparedRule = {
  frequency: RecurrenceRule["frequency"];
  interval: number;
  firstDayOfWeek: number;
  hours: number[] | undefined;
  minutes: number[] | undefined;
  /** Second 60 dropped: a PlainTime second is 0 to 59. */
  seconds: number[] | undefined;
  byMonth: ReadonlySet<number> | undefined;
  byYearDay: readonly number[] | undefined;
  byMonthDay: readonly number[] | undefined;
  byWeekNo: readonly number[] | undefined;
  byDay: readonly RecurrenceDay[] | undefined;
  setPositions: readonly number[] | undefined;
};

type Weekday = RecurrenceDay["day"];

/** RFC 8984 §4.3.3.1 extra rule 3, time parts: the start's time fills what the frequency leaves open. */
function impliedTimes(
  rule: RecurrenceRule,
  start: LocalMoment,
): Pick<RecurrenceRule, "byHour" | "byMinute" | "bySecond"> {
  const { frequency } = rule;
  const finer = frequency === "secondly";
  const fine = finer || frequency === "minutely";
  const coarse = fine || frequency === "hourly";

  return {
    bySecond: rule.bySecond ?? (finer ? undefined : [start.second % 60]),
    byMinute:
      rule.byMinute ??
      (fine ? undefined : [Math.floor((start.second % 3600) / 60)]),
    byHour:
      rule.byHour ?? (coarse ? undefined : [Math.floor(start.second / 3600)]),
  };
}

/** The yearly case of extra rule 3: which of month, month day and weekday the start fills in. */
function impliedYearlyDays(
  rule: RecurrenceRule,
  start: LocalMoment,
): Pick<RecurrenceRule, "byDay" | "byMonthDay" | "byMonth"> {
  const { byDay, byMonthDay, byYearDay, byWeekNo, byMonth } = rule;
  const [, month, dayOfMonth] = isoFieldsOf(start.day);
  const open = !byMonthDay && !byDay;

  if (byYearDay) {
    return { byDay, byMonthDay, byMonth };
  }
  if (byWeekNo) {
    return {
      byDay: open ? [{ day: isoWeekdayOf(start.day) as Weekday }] : byDay,
      byMonthDay,
      byMonth,
    };
  }

  return {
    byDay,
    byMonthDay: open ? [dayOfMonth] : byMonthDay,
    byMonth: !byMonth && (byMonthDay || !byDay) ? [month] : byMonth,
  };
}

/** RFC 8984 §4.3.3.1 extra rule 3, day parts: the start's day fills what the frequency leaves open. */
function impliedDays(
  rule: RecurrenceRule,
  start: LocalMoment,
): Pick<RecurrenceRule, "byDay" | "byMonthDay" | "byMonth"> {
  const { frequency, byDay, byMonthDay, byMonth } = rule;

  if (frequency === "yearly") {
    return impliedYearlyDays(rule, start);
  }
  if (frequency === "weekly" && !byDay) {
    return {
      byDay: [{ day: isoWeekdayOf(start.day) as Weekday }],
      byMonthDay,
      byMonth,
    };
  }
  if (frequency === "monthly" && !byDay && !byMonthDay) {
    return { byDay, byMonthDay: [isoFieldsOf(start.day)[2]], byMonth };
  }

  return { byDay, byMonthDay, byMonth };
}

function prepare(rule: RecurrenceRule, start: LocalMoment): PreparedRule {
  const times = impliedTimes(rule, start);
  const days = impliedDays(rule, start);

  return {
    frequency: rule.frequency,
    interval: rule.interval,
    firstDayOfWeek: rule.firstDayOfWeek,
    hours: times.byHour && sortedUnique(times.byHour),
    minutes: times.byMinute && sortedUnique(times.byMinute),
    seconds:
      times.bySecond && sortedUnique(times.bySecond.filter((s) => s !== 60)),
    byMonth: days.byMonth && new Set(days.byMonth),
    byYearDay: rule.byYearDay,
    byMonthDay: days.byMonthDay,
    byWeekNo: rule.byWeekNo,
    byDay: days.byDay,
    setPositions: rule.bySetPosition,
  };
}

/** A negative list entry counts back from the end of a list of `size` (`-1` is the last). */
function fromEnd(entry: number, size: number): number {
  return entry > 0 ? entry : entry + size + 1;
}

function daysInMonthOf(year: number, month: number): number {
  if (month === 2) {
    return isLeap(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** First and last day of the month, or of the year when `month` is 0. */
function scopeDays(year: number, month: number): [number, number] {
  if (month === 0) {
    return [epochDayOf(year, 1, 1), epochDayOf(year + 1, 1, 1) - 1];
  }

  return [
    epochDayOf(year, month, 1),
    epochDayOf(year, month, daysInMonthOf(year, month)),
  ];
}

/**
 * Days the ordinal `BYDAY` entries pick, one scope at a time and cached: RFC 5545 §3.3.10 Note 2
 * and §3.6.5 scope an ordinal to the month for MONTHLY and for YEARLY with BYMONTH, and to the
 * year otherwise. The count includes days outside Temporal's date range: positions in a period count
 * its whole span, and the dates a PlainDate cannot hold are dropped afterwards.
 */
function ordinalPicker(
  rule: PreparedRule,
  ordinals: readonly { day: number; nth: number }[],
): (day: number, year: number, month: number) => boolean {
  const monthScoped =
    rule.frequency === "monthly" ||
    (rule.frequency === "yearly" && rule.byMonth !== undefined);
  let scopeKey = Number.NaN;
  let hits: (number | null)[] = [];

  return (day, year, month) => {
    const scopeMonth = monthScoped ? month : 0;
    const key = year * 13 + scopeMonth;

    if (key !== scopeKey) {
      scopeKey = key;
      const [first, last] = scopeDays(year, scopeMonth);
      hits = ordinals.map((o) => nthWeekdayWithin(first, last, o.day, o.nth));
    }

    return hits.includes(day);
  };
}

type DayPart = (
  day: number,
  year: number,
  month: number,
  dom: number,
) => boolean;

/** The day filter of step 2 as one predicate per present day part. */
function dayParts(rule: PreparedRule): DayPart[] {
  const { byMonth, byYearDay, byMonthDay, byWeekNo, byDay } = rule;
  const parts: DayPart[] = [];

  if (byMonth) {
    parts.push((_day, _year, month) => byMonth.has(month));
  }
  if (byYearDay) {
    parts.push((day, year) => {
      const size = isLeap(year) ? 366 : 365;

      return byYearDay.some(
        (k) => fromEnd(k, size) === day - epochDayOf(year, 1, 1) + 1,
      );
    });
  }
  if (byMonthDay) {
    // A day that does not exist is never a candidate (RFC 5545 §3.3.10, Erratum 4271).
    parts.push((_day, year, month, dom) => {
      const size = daysInMonthOf(year, month);

      return byMonthDay.some((k) => fromEnd(k, size) === dom);
    });
  }
  if (byWeekNo) {
    parts.push((day) => {
      const { week, weeks } = weekYearWeek(day, rule.firstDayOfWeek);

      return byWeekNo.some((k) => fromEnd(k, weeks) === week);
    });
  }
  if (byDay) {
    const plain = new Set<number>(
      byDay.filter((e) => e.nthOfPeriod === undefined).map((e) => e.day),
    );
    const ordinals = byDay.flatMap((e) =>
      e.nthOfPeriod === undefined ? [] : [{ day: e.day, nth: e.nthOfPeriod }],
    );
    const picked = ordinalPicker(rule, ordinals);

    parts.push(
      (day, year, month) =>
        plain.has(isoWeekdayOf(day)) ||
        (ordinals.length > 0 && picked(day, year, month)),
    );
  }

  return parts;
}

/** The day filter of step 2: true when every present day part matches `day`; `undefined` with no part. */
function dayFilter(rule: PreparedRule): ((day: number) => boolean) | undefined {
  const parts = dayParts(rule);

  if (parts.length === 0) {
    return undefined;
  }

  return (day) => {
    const [year, month, dom] = isoFieldsOf(day);

    return parts.every((part) => part(day, year, month, dom));
  };
}

/** Period index of the period holding `day`, for yearly to daily rules. */
function periodIndexOfDay(rule: PreparedRule, day: number): number {
  switch (rule.frequency) {
    case "yearly":
      return isoFieldsOf(day)[0];
    case "monthly": {
      const [year, month] = isoFieldsOf(day);
      return year * 12 + month - 1;
    }
    case "weekly":
      return Math.floor((day - weekAnchor(rule)) / DAYS_PER_WEEK);
    default:
      return day;
  }
}

/** The epoch day, modulo 7, on which a week starts: epoch day 0 is a Thursday, ISO weekday 4. */
function weekAnchor(rule: PreparedRule): number {
  return mod(rule.firstDayOfWeek - THURSDAY, DAYS_PER_WEEK);
}

/** First and last day of period `index`, for yearly to daily rules. */
function periodDays(rule: PreparedRule, index: number): [number, number] {
  switch (rule.frequency) {
    case "yearly":
      return scopeDays(index, 0);
    case "monthly": {
      const year = Math.floor(index / 12);
      return scopeDays(year, index - year * 12 + 1);
    }
    case "weekly": {
      const first = index * DAYS_PER_WEEK + weekAnchor(rule);
      return [first, first + DAYS_PER_WEEK - 1];
    }
    default:
      return [index, index];
  }
}

/** Index of the first aligned period (`origin + k x interval`) that is at least `target`. */
function alignedAtLeast(
  origin: number,
  interval: number,
  target: number,
): number {
  return target <= origin
    ? origin
    : origin + Math.ceil((target - origin) / interval) * interval;
}

/** Positions of `bySetPosition` as sorted, unique indices into a list of length `size`. */
function setIndices(positions: readonly number[], size: number): number[] {
  const indices = new Set<number>();

  for (const k of positions) {
    const index = k > 0 ? k - 1 : size + k;
    if (index >= 0 && index < size) {
      indices.add(index);
    }
  }

  return [...indices].sort((a, b) => a - b);
}

/** State of one expansion: the work spent so far and what to report to. */
type Run = {
  spent: number;
  budget: number;
  /** The last epoch day a pick may fall on, read afresh each time; never above `MAX_EPOCH_DAY`. */
  lastDay: () => number;
  start: LocalMoment;
  visit: (moment: LocalMoment) => boolean;
  setPositions: readonly number[] | undefined;
  /** True once any period or sub-daily step has had a pick to consider (kept, dropped or past `lastDay`). */
  picked: boolean;
};

/** Records that a period or step had `count` picks to consider. */
function markPicked(run: Run, count: number): void {
  run.picked = run.picked || count > 0;
}

/** True when the candidate is DTSTART or earlier (step 4): DTSTART was visited already. */
function notAfterStart(run: Run, day: number, second: number): boolean {
  const { start } = run;

  return day < start.day || (day === start.day && second <= start.second);
}

/**
 * Visits the picked candidates of one period, `dayAt(i / timeCount)` at `timeAt(i % timeCount)`,
 * without building the list. Returns a status when the expansion ends inside the period.
 */
function emit(
  run: Run,
  dayCount: number,
  timeCount: number,
  dayAt: (index: number) => number,
  timeAt: (index: number) => number,
): ExpansionStatus | undefined {
  const size = dayCount * timeCount;
  const picks = run.setPositions
    ? setIndices(run.setPositions, size)
    : undefined;
  const count = picks ? picks.length : size;

  markPicked(run, count);
  for (let n = 0; n < count; n++) {
    if (run.spent >= run.budget) {
      return "capped";
    }
    run.spent++;

    const index = picks ? picks[n] : n;
    const day = dayAt(Math.floor(index / timeCount));
    const second = timeAt(index % timeCount);

    // Picks ascend, so once one is past `lastDay` the rest are too.
    if (day > run.lastDay()) {
      return "end";
    }

    if (!notAfterStart(run, day, second) && !run.visit({ day, second })) {
      return "stopped";
    }
  }

  return undefined;
}

/** Sub-daily periods per day, and seconds per period. */
const SUB_DAILY_UNIT = { hourly: 3600, minutely: 60, secondly: 1 } as const;

/** Steps per day of a daily or sub-daily rule: 1 for `DAILY`, 24, 1,440 or 86,400 below it. */
function stepsPerDay(rule: PreparedRule): number {
  return rule.frequency === "daily"
    ? 1
    : SECONDS_PER_DAY /
        SUB_DAILY_UNIT[rule.frequency as keyof typeof SUB_DAILY_UNIT];
}

/**
 * Where a walk starts: `origin`, the index of the period or sub-daily step that holds DTSTART, and
 * `first`, the first aligned one (`origin + k x interval`) that does not end before `fromDay`.
 * A daily rule's step and period are the same day.
 */
function walkStart(
  rule: PreparedRule,
  start: LocalMoment,
  fromDay: number,
): { origin: number; first: number } {
  if (!(rule.frequency in SUB_DAILY_UNIT)) {
    const origin = periodIndexOfDay(rule, start.day);

    return {
      origin,
      first: alignedAtLeast(
        origin,
        rule.interval,
        periodIndexOfDay(rule, fromDay),
      ),
    };
  }
  const perDay = stepsPerDay(rule);
  const origin =
    start.day * perDay + Math.floor(start.second / (SECONDS_PER_DAY / perDay));

  return {
    origin,
    first: alignedAtLeast(origin, rule.interval, fromDay * perDay),
  };
}

/** Emits the minutes and seconds of one hourly period that starts at second `base` of `day`. */
function emitHour(
  run: Run,
  rule: PreparedRule,
  day: number,
  base: number,
): ExpansionStatus | undefined {
  const { hours, minutes = [], seconds = [] } = rule;

  if (hours && !hours.includes(Math.floor(base / 3600))) {
    return undefined;
  }

  return emit(
    run,
    1,
    minutes.length * seconds.length,
    () => day,
    (i) =>
      base +
      minutes[Math.floor(i / seconds.length)] * 60 +
      seconds[i % seconds.length],
  );
}

/** Emits the seconds of one minutely period that starts at second `base` of `day`. */
function emitMinute(
  run: Run,
  rule: PreparedRule,
  day: number,
  base: number,
): ExpansionStatus | undefined {
  const { minutes, seconds = [] } = rule;

  if (minutes && !minutes.includes(Math.floor((base % 3600) / 60))) {
    return undefined;
  }

  return emit(
    run,
    1,
    seconds.length,
    () => day,
    (i) => base + seconds[i],
  );
}

/** Emits the candidates of one sub-daily period that starts at second `base` of `day`. */
function emitSubDaily(
  run: Run,
  rule: PreparedRule,
  day: number,
  base: number,
): ExpansionStatus | undefined {
  if (rule.frequency === "hourly") {
    return emitHour(run, rule, day, base);
  }
  if (rule.frequency === "minutely") {
    return emitMinute(run, rule, day, base);
  }

  return rule.seconds && !rule.seconds.includes(base % 60)
    ? undefined
    : emit(
        run,
        1,
        1,
        () => day,
        () => base,
      );
}

/** `byHour x byMinute x bySecond` as seconds of the day, ascending (step 2, daily and coarser). */
function timesOfDay(rule: PreparedRule): number[] {
  const times: number[] = [];

  for (const h of rule.hours ?? []) {
    for (const m of rule.minutes ?? []) {
      for (const s of rule.seconds ?? []) {
        times.push(h * 3600 + m * 60 + s);
      }
    }
  }

  return times;
}

/** Index of the first entry of the ascending `values` that is at least `target`: O(log n). */
function firstAtLeast(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const middle = (low + high) >> 1;

    if (values[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Steps after which a walk that has picked nothing never will: the least common multiple of the
 * interval and `cycle` (the number of steps in 400 years). The filter repeats every `cycle` steps
 * and the aligned steps repeat every `interval`, so after `lcm` steps every combination has been
 * seen. `Infinity` when it is not a safe integer: the work budget ends such a walk.
 */
function stepsToRepeat(interval: number, cycle: number): number {
  const span = (interval / gcd(interval, cycle)) * cycle;

  return Number.isSafeInteger(span) ? span : Number.POSITIVE_INFINITY;
}

/** The passing days of the rule, found a year at a time and cached. */
type DayCache = {
  /** Passing days in `[first, last]`, ascending; `undefined` when the budget ran out. */
  between: (first: number, last: number) => number[] | undefined;
  /** Whether `day` passes; `undefined` when the budget ran out. */
  has: (day: number) => boolean | undefined;
  /**
   * First passing day at or after `day`; `Infinity` when none comes in 400 years (so none ever),
   * a day past `lastDay` as soon as the search reaches one; `undefined` when the budget ran out.
   */
  nextFrom: (day: number) => number | undefined;
};

/**
 * The passing days of `year` as offsets from 1 January, one unit per day evaluated and one for a
 * whole month outside `byMonth`; `undefined` when the budget ran out.
 */
function fillYear(
  run: Run,
  passes: (day: number) => boolean,
  byMonth: ReadonlySet<number> | undefined,
  year: number,
): number[] | undefined {
  const offsets: number[] = [];
  const [jan1, dec31] = scopeDays(year, 0);

  // At most 366 days, each charged, or a month at a time: bounded by the budget.
  for (let day = jan1; day <= dec31; day++) {
    if (run.spent >= run.budget) {
      return undefined;
    }
    run.spent++;

    const [, month] = isoFieldsOf(day);
    if (byMonth !== undefined && !byMonth.has(month)) {
      // Jump to the month's last day; the loop step then lands on the next month's first.
      day = scopeDays(year, month)[1];
    } else if (passes(day)) {
      offsets.push(day - jan1);
    }
  }

  return offsets;
}

/**
 * The day cache. `passes` is the day filter and `byMonth` the rule's months, if any.
 *
 * A year's passing days are kept as offsets from 1 January, under `year mod 400` (see
 * `CYCLE_DAYS`: a year and the one 400 years on have the same offsets). Filling an entry costs one
 * unit per day evaluated, and with `BYMONTH` one unit for a whole month outside it, so a whole call
 * fills at most 146,097 units. Every lookup then costs one unit per year it touches, whatever the
 * year holds: a rule that matches one day a year pays one unit a year, not 365.
 * A rule with no day part passes every day and skips the cache.
 */
function createDayCache(
  run: Run,
  passes: ((day: number) => boolean) | undefined,
  byMonth: ReadonlySet<number> | undefined,
): DayCache {
  const years = new Map<number, number[]>();

  /** Passing days of `year` as offsets from 1 January, filling the entry if it is new. */
  function offsetsOf(year: number): number[] | undefined {
    if (run.spent >= run.budget) {
      return undefined;
    }
    run.spent++;

    const key = mod(year, CYCLE_YEARS);
    const known = years.get(key);
    if (known !== undefined || passes === undefined) {
      return known ?? [];
    }

    const offsets = fillYear(run, passes, byMonth, year);
    if (offsets === undefined) {
      return undefined;
    }
    years.set(key, offsets);

    return offsets;
  }

  return {
    between(first, last) {
      if (passes === undefined) {
        return Array.from(
          { length: Math.max(last - first + 1, 0) },
          (_, i) => first + i,
        );
      }
      const days: number[] = [];

      // One iteration per year the span touches, each charged.
      for (let year = isoFieldsOf(first)[0]; ; year++) {
        const [jan1, dec31] = scopeDays(year, 0);
        if (jan1 > last) {
          return days;
        }
        const offsets = offsetsOf(year);
        if (offsets === undefined) {
          return undefined;
        }
        // Bounded by the passing days of the year, at most 366.
        for (
          let i = firstAtLeast(offsets, first - jan1);
          i < offsets.length && jan1 + offsets[i] <= Math.min(last, dec31);
          i++
        ) {
          days.push(jan1 + offsets[i]);
        }
      }
    },
    has(day) {
      if (passes === undefined) {
        return true;
      }
      const [year] = isoFieldsOf(day);
      const offsets = offsetsOf(year);

      if (offsets === undefined) {
        return undefined;
      }
      const offset = day - scopeDays(year, 0)[0];

      return offsets[firstAtLeast(offsets, offset)] === offset;
    },
    nextFrom(day) {
      if (passes === undefined) {
        return day;
      }
      const [first] = isoFieldsOf(day);

      // At most 401 years, each charged: they cover the 146,097 days from `day`, after which
      // the filter repeats.
      for (let year = first; year <= first + CYCLE_YEARS; year++) {
        const [jan1] = scopeDays(year, 0);
        if (jan1 > run.lastDay()) {
          return jan1;
        }
        const offsets = offsetsOf(year);
        if (offsets === undefined) {
          return undefined;
        }
        const i = firstAtLeast(offsets, day - jan1);
        if (i < offsets.length) {
          return jan1 + offsets[i];
        }
      }

      return Number.POSITIVE_INFINITY;
    },
  };
}

/** True when `steps` steps have gone by with nothing picked, the point of no return (see `stepsToRepeat`). */
function repeated(run: Run, steps: number, repeatAfter: number): boolean {
  return !run.picked && steps >= repeatAfter;
}

/** `days.has` for the sub-daily walk, remembering the answer while the walk stays on one day. */
function dayMemo(days: DayCache): (day: number) => boolean | undefined {
  let checkedDay = Number.NaN;
  let dayPasses = false;

  return (day) => {
    if (day !== checkedDay) {
      const answer = days.has(day);
      if (answer === undefined) {
        return undefined;
      }
      checkedDay = day;
      dayPasses = answer;
    }

    return dayPasses;
  };
}

/** Whether the sub-daily period that starts at second `base` of its day passes the rule's time parts. */
function timesPass(rule: PreparedRule, base: number): boolean {
  const { frequency, hours, minutes, seconds } = rule;

  return (
    (!hours || hours.includes(Math.floor(base / 3600))) &&
    (frequency === "hourly" ||
      !minutes ||
      minutes.includes(Math.floor((base % 3600) / 60))) &&
    (frequency !== "secondly" || !seconds || seconds.includes(base % 60))
  );
}

/** How many candidates one sub-daily period holds, the `size` that `bySetPosition` counts over. */
function subDailyPeriodSize(rule: PreparedRule): number {
  if (rule.frequency === "hourly") {
    return (rule.minutes?.length ?? 0) * (rule.seconds?.length ?? 0);
  }

  return rule.frequency === "minutely" ? (rule.seconds?.length ?? 0) : 1;
}

/**
 * True when a sub-daily period can hold no pick: it has no candidate (an `HOURLY` or `MINUTELY`
 * rule whose only `BYSECOND` is 60), or `bySetPosition` picks none. Every period holds the same number.
 */
function picksNothing(rule: PreparedRule): boolean {
  const size = subDailyPeriodSize(rule);

  return (
    size === 0 ||
    (rule.setPositions !== undefined &&
      setIndices(rule.setPositions, size).length === 0)
  );
}

/** True when the rule has a time part, or a `bySetPosition`, that some sub-daily period can fail. */
function hasTimeFilter(rule: PreparedRule): boolean {
  const { frequency, hours, minutes, seconds } = rule;

  return Boolean(
    hours ||
    (frequency !== "hourly" && minutes) ||
    (frequency === "secondly" && seconds) ||
    picksNothing(rule),
  );
}

/**
 * The aligned steps `k` in `[0, K)` whose period can ever hold a pick, ascending, where
 * `K = perDay / gcd(perDay, interval)` is how many steps go by before the period within the day
 * repeats. `undefined` when no step is ruled out by its time (so every step is a hit), `"capped"`
 * when the budget ran out. The day is not looked at: only the time of day, which depends on
 * `k mod K` alone.
 */
function subDailyHits(
  rule: PreparedRule,
  run: Run,
  perDay: number,
  origin: number,
): number[] | "capped" | undefined {
  if (!hasTimeFilter(rule)) {
    return undefined;
  }
  if (picksNothing(rule)) {
    return [];
  }
  const unit = SECONDS_PER_DAY / perDay;
  const step = rule.interval % perDay;
  const cycle = perDay / gcd(perDay, step);
  const hits: number[] = [];
  let period = mod(origin, perDay);

  // At most 86,400 steps, each charged.
  for (let k = 0; k < cycle; k++) {
    if (run.spent >= run.budget) {
      return "capped";
    }
    run.spent++;

    if (timesPass(rule, period * unit)) {
      hits.push(k);
    }
    period = (period + step) % perDay;
  }

  return hits;
}

/** The first hit step at or after `k`: `hits` repeat every `cycle` steps, so it may be in a later block. */
function nextHit(hits: readonly number[], cycle: number, k: number): number {
  const block = Math.floor(k / cycle);
  const i = firstAtLeast(hits, k - block * cycle);

  return i < hits.length
    ? block * cycle + hits[i]
    : (block + 1) * cycle + hits[0];
}

/** After a hit on a failing `day`: the first aligned step on the next passing day, or the status that ends the walk. */
function stepOfNextDay(
  run: Run,
  days: DayCache,
  day: number,
  rule: PreparedRule,
  origin: number,
): number | ExpansionStatus {
  const perDay = stepsPerDay(rule);
  const next = days.nextFrom(day + 1);

  if (next === undefined) {
    return "capped";
  }

  return next > run.lastDay()
    ? "end"
    : Math.ceil((next * perDay - origin) / rule.interval);
}

/**
 * One pass of the sub-daily walk at aligned step `k`, a hit: the step to try next (`k + 1` after
 * emitting it, or the first step of the next passing day when its day fails), or the status that
 * ends the walk.
 */
function subDailyPass(
  rule: PreparedRule,
  run: Run,
  days: DayCache,
  passesOnDay: (day: number) => boolean | undefined,
  origin: number,
  k: number,
): number | ExpansionStatus {
  const unit = SUB_DAILY_UNIT[rule.frequency as keyof typeof SUB_DAILY_UNIT];
  const perDay = SECONDS_PER_DAY / unit;
  const index = origin + k * rule.interval;
  const day = Math.floor(index / perDay);

  if (day > run.lastDay()) {
    return "end";
  }
  const dayPasses = passesOnDay(day);
  if (dayPasses === undefined) {
    return "capped";
  }
  if (!dayPasses) {
    return stepOfNextDay(run, days, day, rule, origin);
  }

  return emitSubDaily(run, rule, day, (index - day * perDay) * unit) ?? k + 1;
}

/**
 * Hourly, minutely and secondly: aligned step `k` is period `origin + k x interval`. The walk goes
 * from hit to hit (see `subDailyHits`) and from passing day to passing day, so its cost follows the
 * hits and the days passed, not the steps in between.
 */
function expandSubDaily(
  rule: PreparedRule,
  run: Run,
  days: DayCache,
  fromDay: number,
): ExpansionStatus {
  const { interval } = rule;
  const perDay = stepsPerDay(rule);
  const { origin, first } = walkStart(rule, run.start, fromDay);
  const hits = subDailyHits(rule, run, perDay, origin);

  if (hits === "capped") {
    return "capped";
  }
  if (hits?.length === 0) {
    return "end";
  }
  const cycle = perDay / gcd(perDay, interval % perDay);
  // Nothing picked in this many steps from `first` means nothing ever will (see stepsToRepeat).
  const repeatAfter = stepsToRepeat(interval, perDay * CYCLE_DAYS);
  const passesOnDay = dayMemo(days);
  let k = Math.round((first - origin) / interval);

  // Each pass spends one unit, so the budget bounds the loop; `repeatAfter` ends a walk with no
  // pick after at most `repeatAfter / interval` passes, and `lastDay` ends it at the last date.
  for (;;) {
    if (run.spent >= run.budget) {
      return "capped";
    }
    run.spent++;

    const next = subDailyPass(
      rule,
      run,
      days,
      passesOnDay,
      origin,
      hits ? nextHit(hits, cycle, k) : k,
    );
    if (typeof next === "string") {
      return next;
    }
    k = next;
    if (repeated(run, origin + k * interval - first, repeatAfter)) {
      return "end";
    }
  }
}

/** Where an empty period sends the walk: the next aligned period index, or how it ends. */
function jumpPastEmpty(
  rule: PreparedRule,
  run: Run,
  days: DayCache,
  origin: number,
  lastDay: number,
): number | ExpansionStatus {
  if (lastDay >= run.lastDay()) {
    return "end";
  }
  // The aligned period at or after the next passing day: the periods between hold none.
  const day = days.nextFrom(lastDay + 1);
  if (day === undefined) {
    return "capped";
  }

  return day > run.lastDay()
    ? "end"
    : alignedAtLeast(origin, rule.interval, periodIndexOfDay(rule, day));
}

/** Yearly to daily: one period per step, its passing days times the rule's times of day. */
function expandPeriods(
  rule: PreparedRule,
  run: Run,
  days: DayCache,
  fromDay: number,
): ExpansionStatus {
  const times = timesOfDay(rule);
  const { interval } = rule;
  const { origin, first } = walkStart(rule, run.start, fromDay);
  // Nothing picked in this many periods from `first` means nothing ever will (see stepsToRepeat).
  const repeatAfter = stepsToRepeat(
    interval,
    CYCLE_PERIODS[rule.frequency as keyof typeof CYCLE_PERIODS],
  );
  let index = first;

  // Each pass spends one unit, so the budget bounds the loop; `repeatAfter` ends a walk with no
  // pick after at most `repeatAfter / interval` passes, and `lastDay` ends it at the last date.
  for (;;) {
    if (run.spent >= run.budget) {
      return "capped";
    }
    run.spent++;

    const [firstDay, lastDay] = periodDays(rule, index);
    if (firstDay > run.lastDay()) {
      return "end";
    }

    // The whole period is evaluated, past `lastDay` too: BYSETPOS counts positions
    // over the full period (RFC 5545 §3.3.10, RFC 8984 §4.3.3.1 step 3), and emit drops the rest.
    const passing = days.between(firstDay, lastDay);
    if (passing === undefined) {
      return "capped";
    }

    const next =
      passing.length === 0
        ? jumpPastEmpty(rule, run, days, origin, lastDay)
        : (emitPeriod(run, passing, times, lastDay) ?? index + interval);
    if (typeof next === "string") {
      return next;
    }
    index = next;
    if (repeated(run, index - first, repeatAfter)) {
      return "end";
    }
  }
}

/** Emits one period's candidates; a status when the expansion ends in or at the end of it. */
function emitPeriod(
  run: Run,
  passing: readonly number[],
  times: readonly number[],
  lastDay: number,
): ExpansionStatus | undefined {
  const status = emit(
    run,
    passing.length,
    times.length,
    (i) => passing[i],
    (i) => times[i],
  );

  return status ?? (lastDay >= run.lastDay() ? "end" : undefined);
}

/** Charges `units` at once; false, with the budget spent, when it cannot cover them. */
function spend(run: Run, units: number): boolean {
  if (run.spent + units > run.budget) {
    run.spent = run.budget;
    return false;
  }
  run.spent += units;

  return true;
}

/** How many of a period's `size` candidates, from index `from` on, `setPositions` picks (all of them with none). */
function picksFrom(
  setPositions: readonly number[] | undefined,
  size: number,
  from: number,
): number {
  if (setPositions === undefined) {
    return Math.max(size - from, 0);
  }
  const picks = setIndices(setPositions, size);

  return picks.length - firstAtLeast(picks, from);
}

/** Seconds from the start of a daily or sub-daily step to each of its candidates, ascending. */
function stepOffsets(rule: PreparedRule): number[] {
  const { minutes = [], seconds = [] } = rule;

  switch (rule.frequency) {
    case "hourly":
      return minutes.flatMap((m) => seconds.map((s) => m * 60 + s));
    case "minutely":
      return seconds;
    case "secondly":
      return [0];
    default:
      return timesOfDay(rule);
  }
}

/**
 * Counts passing days along a progression with stride `stride`: the returned `(x, q)` is how many
 * of `x, x + stride, ..., x + (q - 1) x stride` pass, in O(1). The filter repeats every
 * `CYCLE_DAYS`, so a day answers as its residue does, and the residues a progression visits go round
 * an orbit of `CYCLE_DAYS / g` of them, `g = gcd(CYCLE_DAYS, stride)`: `q` terms are whole orbits
 * and a run of one, read from running counts. Building it costs one unit per day of a cycle, and
 * fills the day cache; `undefined` when the budget ran out.
 */
function progressionCounter(
  run: Run,
  days: DayCache,
  stride: number,
): ((x: number, q: number) => number) | undefined {
  const step = stride % CYCLE_DAYS;
  const orbits = gcd(CYCLE_DAYS, step);
  const length = CYCLE_DAYS / orbits;
  const passing = days.between(run.start.day, run.start.day + CYCLE_DAYS - 1);

  if (passing === undefined || !spend(run, CYCLE_DAYS)) {
    return undefined;
  }
  const passes = new Uint8Array(CYCLE_DAYS);
  for (const day of passing) {
    passes[mod(day, CYCLE_DAYS)] = 1;
  }
  // Orbit `o` holds the residues `o mod orbits`; its running counts start at `o x (length + 1)`.
  const position = new Int32Array(CYCLE_DAYS);
  const sums = new Int32Array(CYCLE_DAYS + orbits);
  for (let o = 0; o < orbits; o++) {
    const base = o * (length + 1);
    let residue = o;
    for (let i = 0; i < length; i++) {
      position[residue] = i;
      sums[base + i + 1] = sums[base + i] + passes[residue];
      residue = (residue + step) % CYCLE_DAYS;
    }
  }

  return (x, q) => {
    const residue = mod(x, CYCLE_DAYS);
    const base = (residue % orbits) * (length + 1);
    const at = position[residue];
    const whole = Math.floor(q / length);
    const end = at + q - whole * length;
    const orbit = sums[base + length];
    const rest =
      end <= length
        ? sums[base + end] - sums[base + at]
        : orbit - sums[base + at] + sums[base + end - length];

    return whole * orbit + rest;
  };
}

/**
 * Hit steps `k < steps` (see `subDailyHits`; every step of a `DAILY` rule) whose day passes. A
 * `steps` span shorter than a cycle reads its passing days, one unit each. A longer one sums, per
 * hit `h < K`, the passing days of `h, h + K, h + 2K, ...`: those are days `D(h) + b x m`, with
 * `m = K x interval / perDay`, a progression `progressionCounter` counts at once.
 */
function passingHits(
  rule: PreparedRule,
  run: Run,
  days: DayCache,
  filtered: boolean,
  origin: number,
  steps: number,
  hits: readonly number[] | undefined,
): number | undefined {
  const { interval } = rule;
  const perDay = stepsPerDay(rule);
  const cycle = perDay / gcd(perDay, interval % perDay);
  const hitsBelow = (k: number): number =>
    hits === undefined
      ? k
      : Math.floor(k / cycle) * hits.length + firstAtLeast(hits, k % cycle);

  if (!filtered) {
    return hitsBelow(steps);
  }
  const lastDay = Math.floor((origin + (steps - 1) * interval) / perDay);
  if (lastDay - run.start.day < CYCLE_DAYS) {
    const passing = days.between(run.start.day, lastDay);
    if (passing === undefined || !spend(run, passing.length)) {
      return undefined;
    }
    const stepAt = (day: number): number =>
      Math.min(
        steps,
        Math.max(0, Math.ceil((day * perDay - origin) / interval)),
      );

    return passing.reduce(
      (total, day) =>
        total + hitsBelow(stepAt(day + 1)) - hitsBelow(stepAt(day)),
      0,
    );
  }
  const counter = progressionCounter(
    run,
    days,
    interval / gcd(perDay, interval),
  );
  if (counter === undefined) {
    return undefined;
  }
  const below = Math.min(steps, cycle);
  const count = hits === undefined ? below : firstAtLeast(hits, below);
  let total = 0;

  // At most `K` (86,400) hits, each charged.
  for (let i = 0; i < count; i++) {
    if (!spend(run, 1)) {
      return undefined;
    }
    const h = hits === undefined ? i : hits[i];

    total += counter(
      Math.floor((origin + h * interval) / perDay),
      Math.floor((steps - 1 - h) / cycle) + 1,
    );
  }

  return total;
}

/** Daily and sub-daily: the candidates after DTSTART in the first `steps` aligned steps. */
function countSteps(
  rule: PreparedRule,
  run: Run,
  days: DayCache,
  filtered: boolean,
  origin: number,
  steps: number,
): number | undefined {
  const perDay = stepsPerDay(rule);
  const hits =
    rule.frequency === "daily"
      ? undefined
      : subDailyHits(rule, run, perDay, origin);

  if (hits === "capped") {
    return undefined;
  }
  const total = passingHits(rule, run, days, filtered, origin, steps, hits);
  // Step 0 holds DTSTART: its candidates at or before DTSTART are not visited.
  const startCounts =
    hits === undefined || hits[0] === 0 ? days.has(run.start.day) : false;
  if (total === undefined || startCounts === undefined) {
    return undefined;
  }
  const offsets = stepOffsets(rule);
  const perStep = picksFrom(rule.setPositions, offsets.length, 0);
  const base = (origin - run.start.day * perDay) * (SECONDS_PER_DAY / perDay);
  const atOrBefore = firstAtLeast(offsets, run.start.second - base + 1);

  return (
    total * perStep -
    (startCounts
      ? perStep - picksFrom(rule.setPositions, offsets.length, atOrBefore)
      : 0)
  );
}

/**
 * Yearly to weekly: the candidates after DTSTART in the first `steps` aligned periods. Period
 * `origin + j x interval` looks as period `j mod B` does, `B = cycle / gcd(cycle, interval)` for
 * the periods in a 400-year cycle, so at most `B` periods (4,800 months, 20,871 weeks) are read.
 */
function countPeriods(
  rule: PreparedRule,
  run: Run,
  days: DayCache,
  origin: number,
  steps: number,
): number | undefined {
  const times = timesOfDay(rule);
  const { interval, setPositions } = rule;
  const cycle = CYCLE_PERIODS[rule.frequency as keyof typeof CYCLE_PERIODS];
  const block = cycle / gcd(cycle, interval % cycle);
  const whole = Math.floor(steps / block);
  const rest = steps - whole * block;
  let sum = 0;
  let partial = 0;
  let notVisited = 0;

  for (let j = 0; j < Math.min(steps, block); j++) {
    if (!spend(run, 1)) {
      return undefined;
    }
    const passing = days.between(...periodDays(rule, origin + j * interval));
    if (passing === undefined) {
      return undefined;
    }
    const size = passing.length * times.length;

    if (j === rest) {
      partial = sum;
    }
    sum += picksFrom(setPositions, size, 0);
    if (j === 0) {
      // DTSTART's period: its candidates at or before DTSTART are not visited.
      const i = firstAtLeast(passing, run.start.day);
      const atOrBefore =
        i * times.length +
        (passing[i] === run.start.day
          ? firstAtLeast(times, run.start.second + 1)
          : 0);
      notVisited = sum - picksFrom(setPositions, size, atOrBefore);
    }
  }

  return (steps <= block ? sum : whole * sum + partial) - notVisited;
}

/**
 * How many candidates an expansion from DTSTART visits, after `start` itself, before the first
 * one an expansion from `fromDay` visits: the ones in the aligned periods or steps the
 * fast-forward skips. `COUNT` counts from DTSTART, so a `COUNT` rule needs this to expand from
 * `fromDay`. From the first visit on, both expansions visit the same candidates.
 *
 * Its cost does not follow the distance. A daily or sub-daily step's time of day repeats every
 * `K` steps, at most 86,400, and the day filter every 400 years: the count reads the `K` steps once,
 * then the passing days in the span, or, for a span of 400 years or more, every day of one cycle.
 * Yearly to weekly periods repeat once the 400-year cycle and the interval line up, after at most
 * 20,871 periods, which it reads once. So the whole is bounded by a few hundred thousand units.
 *
 * @returns the count and the units spent, or `undefined` when `budget` ran out.
 *
 * @example
 * const rule = { frequency: "daily", interval: 1, firstDayOfWeek: 1 } as const;
 * countMomentsBefore(rule, { day: 0, second: 0 }, 1_000_000); // { count: 999999, spent: 0 }
 */
export function countMomentsBefore(
  rule: RecurrenceRule,
  start: LocalMoment,
  fromDay: number,
  budget: number = RECURRENCE_WORK_CAP,
): { count: number; spent: number } | undefined {
  const prepared = prepare(rule, start);
  const { origin, first } = walkStart(prepared, start, fromDay);
  const steps = Math.round((first - origin) / prepared.interval);

  if (steps === 0) {
    return { count: 0, spent: 0 };
  }
  const run: Run = {
    spent: 0,
    budget,
    lastDay: () => MAX_EPOCH_DAY,
    start,
    visit: () => true,
    setPositions: prepared.setPositions,
    picked: false,
  };
  const passes = dayFilter(prepared);
  const days = createDayCache(run, passes, prepared.byMonth);
  const count =
    prepared.frequency in CYCLE_PERIODS && prepared.frequency !== "daily"
      ? countPeriods(prepared, run, days, origin, steps)
      : countSteps(prepared, run, days, passes !== undefined, origin, steps);

  return count === undefined ? undefined : { count, spent: run.spent };
}

/**
 * Expands a recurrence rule over local wall times (RFC 8984 §4.3.3.1, RFC 5545 §3.3.10) and
 * calls `visit` with each candidate in strictly ascending order. No zone is involved: the caller
 * resolves each moment, and applies `UNTIL`, `COUNT` and windows.
 *
 * `rule` has already passed `checkRecurrenceRule`. `start` is DTSTART's wall time and is visited
 * first, always, even when it does not match the rule (RFC 8984 §4.3.3.1 extra rule 1). Every
 * later visit is a candidate strictly after `start`. `fromDay` is a fast-forward floor: periods
 * that end before it are skipped in closed form, so the cost depends on the window, not on the
 * distance from DTSTART; a caller that applies `COUNT` counts the skipped moments with
 * {@link countMomentsBefore}. The first period visited may still yield moments
 * before `fromDay`; the caller filters them. Pass `start.day` to expand from DTSTART.
 *
 * Complexity: `O(P + Y + F + R)` for the periods visited (skip jumps included), the years looked
 * up (one unit each, whatever the year holds), the days evaluated while the day cache fills and
 * the moments considered. The day filter repeats every 400 years (146,097 days), so each year of
 * the cycle is evaluated once, at one unit a day (a month outside `BYMONTH` is one unit): `F` is
 * at most 146,097 for the whole call. A day or period that fails the filter jumps to the next
 * passing day, found in at most 400 years' lookups; none in 400 years means none ever. The sum is
 * bounded by `budget` (default {@link RECURRENCE_WORK_CAP}).
 *
 * A walk that has had nothing to pick after `lcm(interval, periods in 400 years)` steps from its
 * first one ends as `"end"`, because the filter and the alignment have both repeated. So a rule
 * that never matches again, such as February 30, or an interval that never lines up, such as every
 * 7th day on Mondays from a Tuesday, ends as `"end"` and not `"capped"`. `"capped"` is left for a
 * budget too small for that.
 *
 * The sub-daily walk (`HOURLY`, `MINUTELY`, `SECONDLY`) does not visit every aligned step. The time
 * of day of step `k` repeats every `K = perDay / gcd(perDay, interval)` steps (at most 86,400), so
 * with a `BYHOUR`, `BYMINUTE`, `BYSECOND` or `BYSETPOS` the `K` steps are scanned once, one unit
 * each, for the ones that can ever hit. The walk then goes from hit to hit, and a hit on a failing
 * day jumps to the next passing day. Its cost is `O(K + H + D)` for the scan, the hits visited and
 * the passing days jumped to, however large the interval or however rarely the steps hit. No hit at
 * all in `K` steps ends as `"end"` after that one scan.
 *
 * `lastDay` (epoch day, default and ceiling `MAX_EPOCH_DAY`) ends the expansion: no pick after it
 * is visited. It may be a function, read at every period, so `visit` can bring the end forward
 * once it has what it needs. The period holding `lastDay` is still evaluated in full, so a rule
 * that never matches ends as `"end"` once the periods pass `lastDay`, not as `"capped"`.
 *
 * @returns `"stopped"` when `visit` returned `false`, `"capped"` when the budget ran out,
 * `"end"` when a pick fell after `lastDay`.
 *
 * @example
 * const days: number[] = [];
 * const rule = { frequency: "daily", interval: 1, firstDayOfWeek: 1 } as const;
 * expandLocalMoments(rule, { day: 0, second: 0 }, 0, (m) => days.push(m.day) < 3); // "stopped"
 * // days is [0, 1, 2]
 */
export function expandLocalMoments(
  rule: RecurrenceRule,
  start: LocalMoment,
  fromDay: number,
  visit: (moment: LocalMoment) => boolean,
  budget: number = RECURRENCE_WORK_CAP,
  lastDay: number | (() => number) = MAX_EPOCH_DAY,
): ExpansionStatus {
  if (!visit(start)) {
    return "stopped";
  }

  const prepared = prepare(rule, start);
  const run: Run = {
    spent: 0,
    budget,
    lastDay: () =>
      Math.min(
        typeof lastDay === "function" ? lastDay() : lastDay,
        MAX_EPOCH_DAY,
      ),
    start,
    visit,
    setPositions: prepared.setPositions,
    picked: false,
  };
  const days = createDayCache(run, dayFilter(prepared), prepared.byMonth);

  return prepared.frequency in SUB_DAILY_UNIT
    ? expandSubDaily(prepared, run, days, fromDay)
    : expandPeriods(prepared, run, days, fromDay);
}
