/**
 * The RFC 5545 §3.3.10 RECUR grammar and the rule validator behind `parseRecurrenceRule` and
 * `expandRecurrence` (CORE-84; see "Scoped exception: recurrence and cron grammars" in
 * `context/coding-standards.md`).
 *
 * `readRecurrenceRule` splits on `;`, `=` and `,`, matches every token whole against a fixed
 * regex or name table, builds a plain record, and hands it to `checkRecurrenceRule`. That
 * validator is the single place the §3.3.10 value ranges and MUST NOT sentences live, so a
 * hand-built rule meets the same rules as a parsed one. Names and enumerated values are
 * case-insensitive (RFC 5234 §2.3, quoted ABNF strings); `UNTIL`'s `T` and `Z` are capitals only
 * (RFC 5545 §3.3.5), and its second 60 is rejected (coding-standards: only `timescale/` and
 * `gnss/` read it). The `i` flag on a non-Unicode regex
 * never folds a non-ASCII letter onto an ASCII one, so the matched text is safe to upper-case.
 *
 * Every loop is bounded by the input length (one pass over the parts, one over each list).
 */
import type {
  IsoWeekday,
  RecurrenceDay,
  RecurrenceFrequency,
  RecurrenceRule,
} from "../types";
import { Temporal } from "./temporal";

const partName =
  /^(?:FREQ|UNTIL|COUNT|INTERVAL|BYSECOND|BYMINUTE|BYHOUR|BYDAY|BYMONTHDAY|BYYEARDAY|BYWEEKNO|BYMONTH|BYSETPOS|WKST)$/i;
const frequencyText =
  /^(?:YEARLY|MONTHLY|WEEKLY|DAILY|HOURLY|MINUTELY|SECONDLY)$/i;
const weekdayText = /^(?:MO|TU|WE|TH|FR|SA|SU)$/i;
const untilText = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;
const dayEntryText = /^(?:([+-]?)(\d{1,2}))?(MO|TU|WE|TH|FR|SA|SU)$/i;

/** RFC 5545 §3.3.10 `weekday` ABNF, mapped to `IsoWeekday`. */
const weekdayNumbers: Readonly<Record<string, IsoWeekday>> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

/** Digit-count grammars of the numeric parts (`1*2DIGIT`, `1*3DIGIT`, ...; `[+/-]` where signed). */
const listGrammar: Readonly<Record<string, RegExp>> = {
  BYSECOND: /^\d{1,2}$/,
  BYMINUTE: /^\d{1,2}$/,
  BYHOUR: /^\d{1,2}$/,
  BYMONTHDAY: /^[+-]?\d{1,2}$/,
  BYYEARDAY: /^[+-]?\d{1,3}$/,
  BYWEEKNO: /^[+-]?\d{1,2}$/,
  BYMONTH: /^\d{1,2}$/,
  BYSETPOS: /^[+-]?\d{1,3}$/,
};

const listMember: Readonly<Record<string, string>> = {
  BYSECOND: "bySecond",
  BYMINUTE: "byMinute",
  BYHOUR: "byHour",
  BYMONTHDAY: "byMonthDay",
  BYYEARDAY: "byYearDay",
  BYWEEKNO: "byWeekNo",
  BYMONTH: "byMonth",
  BYSETPOS: "bySetPosition",
};

type Range = readonly [min: number, max: number, signed: boolean];

/** RFC 5545 §3.3.10 value ranges. A signed range allows ±min..max and never 0. */
const listRanges: Readonly<Record<string, Range>> = {
  bySecond: [0, 60, false],
  byMinute: [0, 59, false],
  byHour: [0, 23, false],
  byMonthDay: [1, 31, true],
  byYearDay: [1, 366, true],
  byWeekNo: [1, 53, true],
  byMonth: [1, 12, false],
  bySetPosition: [1, 366, true],
};

const listOrder = [
  "bySecond",
  "byMinute",
  "byHour",
  "byDay",
  "byMonthDay",
  "byYearDay",
  "byWeekNo",
  "byMonth",
  "bySetPosition",
] as const;

const frequencies: ReadonlySet<string> = new Set([
  "yearly",
  "monthly",
  "weekly",
  "daily",
  "hourly",
  "minutely",
  "secondly",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function signedInteger(token: string): number {
  return Number(token.startsWith("+") ? token.slice(1) : token);
}

function readList(name: string, value: string): number[] | null {
  const grammar = listGrammar[name] as RegExp;
  const out: number[] = [];
  for (const item of value.split(",")) {
    if (!grammar.test(item)) return null;
    out.push(signedInteger(item));
  }
  return out;
}

function readDayEntry(item: string): RecurrenceDay | null {
  const match = dayEntryText.exec(item);
  if (match === null) return null;
  const day = weekdayNumbers[(match[3] as string).toUpperCase()] as IsoWeekday;
  if (match[2] === undefined) return { day };
  const ordinal = Number(match[2]) * (match[1] === "-" ? -1 : 1);
  return { day, nthOfPeriod: ordinal };
}

function readByDay(value: string): RecurrenceDay[] | null {
  const out: RecurrenceDay[] = [];
  for (const item of value.split(",")) {
    const entry = readDayEntry(item);
    if (entry === null) return null;
    out.push(entry);
  }
  return out;
}

/** Rebuild an `UNTIL` value as ISO and let Temporal read it whole; null when it is not real. */
function readUntil(value: string): string | null {
  const match = untilText.exec(value);
  if (match === null) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const date = `${year}-${month}-${day}`;
  if (hour === undefined) return canonicalUntil(date);
  if (second === "60") return null;
  const iso = `${date}T${hour}:${minute}:${second}`;
  return canonicalUntil(zone === undefined ? iso : `${iso}Z`);
}

/**
 * Temporal's canonical string for an ISO `UNTIL` form, or null when Temporal rejects it.
 * Second 60 is refused by the caller first: Temporal would clamp it to 59.
 */
function canonicalUntil(iso: string): string | null {
  try {
    const canonical = iso.endsWith("Z")
      ? Temporal.Instant.from(iso).toString()
      : iso.includes("T")
        ? Temporal.PlainDateTime.from(iso, { overflow: "reject" }).toString()
        : Temporal.PlainDate.from(iso, { overflow: "reject" }).toString();
    return canonical;
  } catch {
    return null;
  }
}

/** The one `Temporal` read of a canonical `until`: true when the string is a real, canonical form. */
function isCanonicalUntil(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z?)?$/.test(value)) return false;
  return canonicalUntil(value) === value;
}

function readPositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

/** Store `value` under `key` and report whether it read; an unread value is stored as absent. */
function keep<T>(
  record: Record<string, unknown>,
  key: string,
  read: T | null,
): boolean {
  record[key] = read ?? undefined;
  return read !== null;
}

function storeScalarPart(
  record: Record<string, unknown>,
  name: string,
  value: string,
): boolean {
  switch (name) {
    case "FREQ":
      return keep(
        record,
        "frequency",
        frequencyText.test(value) ? value.toLowerCase() : null,
      );
    case "WKST":
      return keep(
        record,
        "firstDayOfWeek",
        weekdayText.test(value)
          ? (weekdayNumbers[value.toUpperCase()] as IsoWeekday)
          : null,
      );
    case "UNTIL":
      return keep(record, "until", readUntil(value));
    case "COUNT":
      return keep(record, "count", readPositiveInteger(value));
    default:
      return keep(record, "interval", readPositiveInteger(value));
  }
}

/** Store one `NAME=VALUE` part in `record`; false when the value breaks the part's grammar. */
function storePart(
  record: Record<string, unknown>,
  name: string,
  value: string,
): boolean {
  if (name === "BYDAY") return keep(record, "byDay", readByDay(value));
  const member = listMember[name];
  if (member !== undefined) return keep(record, member, readList(name, value));
  return storeScalarPart(record, name, value);
}

/**
 * Read a RECUR value (the text after `RRULE:`) into a checked rule, or null when the text breaks
 * the grammar or a §3.3.10 rule. Never reads a part twice, never accepts whitespace or an empty
 * part.
 */
export function readRecurrenceRule(text: string): RecurrenceRule | null {
  if (typeof text !== "string") return null;
  const record: Record<string, unknown> = { interval: 1, firstDayOfWeek: 1 };
  const seen = new Set<string>();
  for (const part of text.split(";")) {
    const equals = part.indexOf("=");
    if (equals < 0) return null;
    const rawName = part.slice(0, equals);
    if (!partName.test(rawName)) return null;
    const name = rawName.toUpperCase();
    if (seen.has(name)) return null;
    seen.add(name);
    if (!storePart(record, name, part.slice(equals + 1))) return null;
  }
  return checkRecurrenceRule(record);
}

function sortedUnique(values: readonly number[]): number[] {
  // `+ 0` turns -0 into 0 so a hand-built list reads the same as a parsed one.
  return [...new Set(values.map((value) => value + 0))].sort((a, b) => a - b);
}

function checkedList(
  value: unknown,
  [min, max, signed]: Range,
): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (const item of value as unknown[]) {
    if (typeof item !== "number" || !Number.isInteger(item)) return null;
    const magnitude = signed ? Math.abs(item) : item;
    if (magnitude < min || magnitude > max) return null;
  }
  return sortedUnique(value as number[]);
}

function isWeekday(value: unknown): value is IsoWeekday {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 7
  );
}

function checkedDay(value: unknown): RecurrenceDay | null {
  if (!isRecord(value) || !isWeekday(value["day"])) return null;
  const nth = value["nthOfPeriod"];
  if (nth === undefined) return { day: value["day"] };
  // RFC 5545 §3.3.10 `ordwk = 1*2DIGIT` with value 1 to 53, optionally signed.
  if (
    typeof nth !== "number" ||
    !Number.isInteger(nth) ||
    nth === 0 ||
    Math.abs(nth) > 53
  ) {
    return null;
  }
  return { day: value["day"], nthOfPeriod: nth };
}

/** Ascending by weekday, then by ordinal, an absent ordinal first; duplicates dropped. */
function checkedDays(value: unknown): RecurrenceDay[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const days: RecurrenceDay[] = [];
  for (const item of value as unknown[]) {
    const day = checkedDay(item);
    if (day === null) return null;
    days.push(day);
  }
  const order = (entry: RecurrenceDay): number =>
    entry.day * 1000 +
    (entry.nthOfPeriod === undefined ? 0 : entry.nthOfPeriod + 100);
  const unique = new Map(days.map((entry) => [order(entry), entry]));
  return [...unique.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, entry]) => entry);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** The four rule-wide members, or null when any is missing or out of range. */
function checkedScalars(
  rule: Record<string, unknown>,
): Pick<RecurrenceRule, "frequency" | "interval" | "firstDayOfWeek"> | null {
  const frequency = rule["frequency"];
  const { interval, firstDayOfWeek } = rule;
  if (typeof frequency !== "string" || !frequencies.has(frequency)) return null;
  if (!isPositiveSafeInteger(interval) || !isWeekday(firstDayOfWeek))
    return null;
  return {
    frequency: frequency as RecurrenceFrequency,
    interval,
    firstDayOfWeek,
  };
}

/** `until` and `count`, at most one (§3.3.10: "UNTIL or COUNT ... MUST NOT occur in the same"). */
function checkedEnd(
  rule: Record<string, unknown>,
): { until?: string; count?: number } | null {
  const { until, count } = rule;
  if (until !== undefined && count !== undefined) return null;
  if (until !== undefined) return isCanonicalUntil(until) ? { until } : null;
  if (count !== undefined)
    return isPositiveSafeInteger(count) ? { count } : null;
  return {};
}

/** The nine BYxxx members, checked and normalised; null when any is invalid. */
function checkedParts(
  rule: Record<string, unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const member of listOrder) {
    const value = rule[member];
    if (value === undefined) continue;
    const checked =
      member === "byDay"
        ? checkedDays(value)
        : checkedList(value, listRanges[member] as Range);
    if (checked === null) return null;
    out[member] = checked;
  }
  return out;
}

/** BYDAY: a numeric value only with MONTHLY or YEARLY, and not with BYWEEKNO when YEARLY. */
function respectsByDay(rule: RecurrenceRule): boolean {
  const { frequency, byDay, byWeekNo } = rule;
  if (byDay?.some((entry) => entry.nthOfPeriod !== undefined) !== true)
    return true;
  if (frequency !== "monthly" && frequency !== "yearly") return false;
  return !(frequency === "yearly" && byWeekNo !== undefined);
}

/** The BYMONTHDAY, BYYEARDAY and BYWEEKNO "MUST NOT" sentences of §3.3.10. */
function respectsDayParts(rule: RecurrenceRule): boolean {
  const { frequency, byMonthDay, byYearDay, byWeekNo } = rule;
  // BYMONTHDAY: "MUST NOT be specified when the FREQ rule part is set to WEEKLY".
  if (byMonthDay !== undefined && frequency === "weekly") return false;
  // BYYEARDAY: "MUST NOT be specified when the FREQ rule part is set to DAILY, WEEKLY, or MONTHLY".
  if (
    byYearDay !== undefined &&
    ["daily", "weekly", "monthly"].includes(frequency)
  ) {
    return false;
  }
  // BYWEEKNO: "This rule part MUST NOT be used when the FREQ rule part is set to anything other than YEARLY".
  return byWeekNo === undefined || frequency === "yearly";
}

/** The §3.3.10 "MUST NOT" and "only" sentences that tie a BYxxx member to `FREQ`. */
function respectsFrequency(rule: RecurrenceRule): boolean {
  if (!respectsByDay(rule) || !respectsDayParts(rule)) return false;
  // BYSETPOS: "MUST only be used in conjunction with another BYxxx rule part".
  return (
    rule.bySetPosition === undefined ||
    listOrder.some(
      (member) => member !== "bySetPosition" && rule[member] !== undefined,
    )
  );
}

/**
 * Check a rule against RFC 5545 §3.3.10 and return a fresh, frozen, normalised record (lists
 * sorted ascending and deduplicated, `byDay` ordered by weekday then ordinal), or null. The input
 * is never mutated. Never throws.
 */
export function checkRecurrenceRule(rule: unknown): RecurrenceRule | null {
  try {
    if (!isRecord(rule)) return null;
    const scalars = checkedScalars(rule);
    const end = checkedEnd(rule);
    const parts = checkedParts(rule);
    if (scalars === null || end === null || parts === null) return null;
    const checked = { ...scalars, ...end, ...parts } as RecurrenceRule;
    if (!respectsFrequency(checked)) return null;
    return deepFreeze(checked);
  } catch {
    return null;
  }
}

function deepFreeze(rule: RecurrenceRule): RecurrenceRule {
  for (const member of listOrder) {
    const list = rule[member];
    if (list === undefined) continue;
    for (const entry of list)
      if (typeof entry === "object") Object.freeze(entry);
    Object.freeze(list);
  }
  return Object.freeze(rule);
}
