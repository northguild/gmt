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

/** Work units one expansion may spend: periods visited, days evaluated and moments considered. */
export const RECURRENCE_WORK_CAP = 2_000_000;

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

/** The day filter of step 2: true when every present day part matches `day`. */
function dayFilter(rule: PreparedRule): (day: number) => boolean {
  const parts = dayParts(rule);

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
};

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

/**
 * For a sub-daily period whose hour or minute is excluded, the first period index worth trying
 * instead (the next hour, or for `secondly` the next minute); `undefined` when nothing is excluded.
 */
function subDailySkipTarget(
  rule: PreparedRule,
  day: number,
  second: number,
): number | undefined {
  const { frequency, hours, minutes } = rule;
  const perDay =
    SECONDS_PER_DAY /
    SUB_DAILY_UNIT[rule.frequency as keyof typeof SUB_DAILY_UNIT];
  const hour = Math.floor(second / 3600);

  if (frequency !== "hourly" && hours && !hours.includes(hour)) {
    return day * perDay + (hour + 1) * (perDay / 24);
  }
  const minute = Math.floor((second % 3600) / 60);
  if (frequency === "secondly" && minutes && !minutes.includes(minute)) {
    return day * perDay + hour * 3600 + (minute + 1) * 60;
  }

  return undefined;
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

/**
 * The day filter for the sub-daily walk: it charges one unit and evaluates a day once, then
 * remembers the answer while the walk stays on that day. `undefined` when the budget ran out.
 */
function chargedDayFilter(
  run: Run,
  passes: (day: number) => boolean,
): (day: number) => boolean | undefined {
  let checkedDay = Number.NaN;
  let dayPasses = false;

  return (day) => {
    if (day === checkedDay) {
      return dayPasses;
    }
    if (run.spent >= run.budget) {
      return undefined;
    }
    run.spent++;
    checkedDay = day;
    dayPasses = passes(day);

    return dayPasses;
  };
}

/** Hourly, minutely and secondly: one period per unit, skipping to the next candidate day or hour. */
function expandSubDaily(
  rule: PreparedRule,
  run: Run,
  passes: (day: number) => boolean,
  fromDay: number,
): ExpansionStatus {
  const { interval } = rule;
  const unit = SUB_DAILY_UNIT[rule.frequency as keyof typeof SUB_DAILY_UNIT];
  const perDay = SECONDS_PER_DAY / unit;
  const origin = run.start.day * perDay + Math.floor(run.start.second / unit);
  let index = alignedAtLeast(origin, interval, fromDay * perDay);
  const passesOnDay = chargedDayFilter(run, passes);

  for (;;) {
    if (run.spent >= run.budget) {
      return "capped";
    }
    run.spent++;

    const day = Math.floor(index / perDay);
    if (day > run.lastDay()) {
      return "end";
    }
    const dayPasses = passesOnDay(day);
    if (dayPasses === undefined) {
      return "capped";
    }

    const base = (index - day * perDay) * unit;
    const skipTo = dayPasses
      ? subDailySkipTarget(rule, day, base)
      : (day + 1) * perDay;
    if (skipTo !== undefined) {
      index = alignedAtLeast(origin, interval, skipTo);
      continue;
    }

    const status = emitSubDaily(run, rule, day, base);
    if (status !== undefined) {
      return status;
    }
    index += interval;
  }
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

/**
 * The days of `[first, last]` that pass the day filter, ascending; each day evaluated costs one
 * unit. With `BYMONTH`, a month outside it costs one unit as a whole and its days are not
 * evaluated, so a yearly rule for one month does not pay for the other eleven. `undefined` when
 * the budget ran out first.
 */
function passingDays(
  run: Run,
  first: number,
  last: number,
  passes: (day: number) => boolean,
  byMonth: ReadonlySet<number> | undefined,
): number[] | undefined {
  const days: number[] = [];

  for (let day = first; day <= last; day++) {
    if (run.spent >= run.budget) {
      return undefined;
    }
    run.spent++;

    if (byMonth !== undefined) {
      const [year, month] = isoFieldsOf(day);

      if (!byMonth.has(month)) {
        // Jump to the month's last day; the loop step then lands on the next month's first.
        day = epochDayOf(year, month, daysInMonthOf(year, month));
        continue;
      }
    }
    if (passes(day)) {
      days.push(day);
    }
  }

  return days;
}

/** Yearly to daily: one period per step, its passing days times the rule's times of day. */
function expandPeriods(
  rule: PreparedRule,
  run: Run,
  passes: (day: number) => boolean,
  fromDay: number,
): ExpansionStatus {
  const times = timesOfDay(rule);
  const origin = periodIndexOfDay(rule, run.start.day);
  let index = alignedAtLeast(
    origin,
    rule.interval,
    periodIndexOfDay(rule, fromDay),
  );

  for (;;) {
    if (run.spent >= run.budget) {
      return "capped";
    }
    run.spent++;

    const [first, last] = periodDays(rule, index);
    if (first > run.lastDay()) {
      return "end";
    }

    // The whole period is evaluated, past `lastDay` too: BYSETPOS counts positions
    // over the full period (RFC 5545 §3.3.10, RFC 8984 §4.3.3.1 step 3), and emit drops the rest.
    const days = passingDays(run, first, last, passes, rule.byMonth);
    if (days === undefined) {
      return "capped";
    }

    const status = emit(
      run,
      days.length,
      times.length,
      (i) => days[i],
      (i) => times[i],
    );
    if (status !== undefined) {
      return status;
    }
    if (last >= run.lastDay()) {
      return "end";
    }
    index += rule.interval;
  }
}

/**
 * Expands a recurrence rule over local wall times (RFC 8984 §4.3.3.1, RFC 5545 §3.3.10) and
 * calls `visit` with each candidate in strictly ascending order. No zone is involved: the caller
 * resolves each moment, and applies `UNTIL`, `COUNT` and windows.
 *
 * `rule` has already passed `checkRecurrenceRule`. `start` is DTSTART's wall time and is visited
 * first, always, even when it does not match the rule (RFC 8984 §4.3.3.1 extra rule 1). Every
 * later visit is a candidate strictly after `start`. `fromDay` is a fast-forward floor: periods
 * that end before it are skipped in closed form, so with no `COUNT` the cost depends on the
 * window, not on the distance from DTSTART. The first period visited may still yield moments
 * before `fromDay`; the caller filters them. Pass `start.day` to expand from DTSTART.
 *
 * Complexity: `O(P + D + R)` for the periods visited (skip jumps included), the days evaluated
 * (at most 366 per period) and the moments considered. Their sum is bounded by `budget`
 * (default {@link RECURRENCE_WORK_CAP}), so a rule that never matches, such as February 30,
 * ends as `"capped"` rather than looping.
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
  };
  const passes = dayFilter(prepared);

  return prepared.frequency in SUB_DAILY_UNIT
    ? expandSubDaily(prepared, run, passes, fromDay)
    : expandPeriods(prepared, run, passes, fromDay);
}
