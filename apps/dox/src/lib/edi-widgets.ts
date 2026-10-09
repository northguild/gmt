/**
 * Pure helpers shared by the two EDI timestamp widgets (INT-15): the DTM
 * Decoder and the X12 Time Reader.
 *
 * No gmt import: every function that calls the library takes an `EdiLib` — the
 * real classifiers, the per-kind parsers and formatters, `x12TimeCodeOffset`,
 * `x12TimeCodeZone`, `resolveLocal`, `classifyLocal`, `toOffsetInstant`,
 * `fromOffsetInstant`, `minUtc`, `maxUtc` and `diffUtcAsDuration` — loaded by the
 * mount from the real package (`edi-lib.ts`). That keeps this module free of gmt imports and lets the tests
 * inject the real library by module path.
 *
 * The widgets draw the library's results and compute none of them. Each tool
 * classifies the code first, then calls that kind's parser, and prints the call
 * it made and the result that came back. The site-side code only splits the text
 * a reader typed, picks the function a kind names, and formats a returned ISO 8601
 * duration as "15 h". Nothing here computes a result.
 *
 * Naming rule: strings in these widgets name codes and standards as data —
 * UN/EDIFACT data elements 2379 and 2380, the UN/EDIFACT syntax rules (UNTDID
 * Part 4, Chapter 2.2), UN/ECE Recommendation 7,
 * ANSI X12 data elements 1250 and 623, GS1 EPCIS 2.0 and ISO/IEC 19987, and the
 * codes themselves (`203`, `RD8`, `ET`). They name nothing beyond those
 * standards: no law, no rule-making body, no business event. Nothing maps a
 * place, port, partner or abbreviation to a time zone.
 */

import { CURATED_TIMEZONES } from "./curated-timezones";
import { escapeAttr, escapeHtml } from "./widget-ui";

export { callArgs, formatValue } from "./punctuality-widgets";
export { zoneOptionsHtml } from "./transport-widgets";

// ---------------------------------------------------------------------------
// The library, injected
// ---------------------------------------------------------------------------

/** A period or range: the start and the end, each a house value. */
export interface Interval {
  start: string;
  end: string;
}

/** What a parser returns: one house value, a period's two ends, or the sentinel
 *  (`""` for a value, `null` for a period). */
export type EdiHouse = string | Interval;

/** The kinds of value a UN/EDIFACT 2379 code states, as the classifier names them. */
export type EdifactKind =
  | "date"
  | "time"
  | "dateTime"
  | "offsetDateTime"
  | "datePeriod"
  | "dateTimePeriod";

export interface EdifactClass {
  kind: EdifactKind;
  format: string;
}

/** The kinds of value an X12 1250 qualifier states, as the classifier names them. */
export type X12Kind =
  | "date"
  | "time"
  | "dateTime"
  | "dateRange"
  | "dateTimeRange";

export interface X12Class {
  kind: X12Kind;
  format: string;
}

export interface X12TimeCodeClass {
  kind: "offset" | "zone";
  timeCode: string;
}

export interface X12Zone {
  zone: string;
  daylight: boolean | null;
}

export interface EdiLib {
  classifyEdifactDtmFormat(format: string): EdifactClass | null;
  parseEdifactDate(value: string, format: string): string;
  parseEdifactTime(value: string, format: string): string;
  parseEdifactDateTime(value: string, format: string): string;
  parseEdifactOffsetDateTime(value: string, format: string): string;
  parseEdifactDatePeriod(value: string, format: string): Interval | null;
  parseEdifactDateTimePeriod(value: string, format: string): Interval | null;
  formatEdifactDate(value: string, format: string): string;
  formatEdifactTime(value: string, format: string): string;
  formatEdifactDateTime(value: string, format: string): string;
  formatEdifactOffsetDateTime(value: string, format: string): string;
  formatEdifactDatePeriod(start: string, end: string, format: string): string;
  formatEdifactDateTimePeriod(
    start: string,
    end: string,
    format: string,
  ): string;

  classifyX12DateTimePeriodFormat(format: string): X12Class | null;
  /** Element 373 with `D8`, or a 1251 value under its qualifier. */
  parseX12Date(value: string, format: string): string;
  /** Element 337: every form with no `format`, exactly `HHMM` (`TM`) or `HHMMSS` (`TS`) with one. */
  parseX12Time(value: string, format?: string): string;
  parseX12DateTime(value: string, format: string): string;
  parseX12DateRange(value: string, format: string): Interval | null;
  parseX12DateTimeRange(value: string, format: string): Interval | null;
  /** Elements 373 and 337, as `AT7`, `G62` and `DTM` carry them side by side. */
  parseX12DateAndTime(date: string, time: string): string;
  formatX12Date(value: string, format: string): string;
  formatX12Time(value: string, format: string): string;
  /** Element 337 in the form the caller names by its mask: `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`. */
  formatX12TimeElement(value: string, form: string): string;
  formatX12DateTime(value: string, format: string): string;
  formatX12DateRange(start: string, end: string, format: string): string;
  formatX12DateTimeRange(start: string, end: string, format: string): string;

  classifyX12TimeCode(timeCode: string): X12TimeCodeClass | null;
  x12TimeCodeOffset(timeCode: string): string;
  x12TimeCodeZone(timeCode: string): X12Zone | null;

  resolveLocal(
    local: string,
    zone: string,
    options?: { disambiguation: string },
  ): string;
  classifyLocal(
    local: string,
    zone: string,
  ): "unique" | "ambiguous" | "nonexistent" | null;
  toOffsetInstant(
    value: string,
    zone?: string,
  ): { instant: string; offset: string; timeZone?: string } | null;
  fromOffsetInstant(pair: { instant: string; offset: string }): string;
  isValidTimeZone(zone: string): boolean;
  minUtc(instants: string[]): string | null;
  maxUtc(instants: string[]): string | null;
  diffUtcAsDuration(a: string, b: string, unit: string): string;
}

/** The disambiguation both widgets use, and say they use. */
export const REJECT = { disambiguation: "reject" } as const;

// ---------------------------------------------------------------------------
// Calls: the one function made, its arguments and its real result
// ---------------------------------------------------------------------------

/** One real library call: what was called, with what, and what came back. */
export interface EdiCall {
  fn: keyof EdiLib;
  args: unknown[];
  result: unknown;
}

/** Calls `lib[fn](...args)` and keeps all three, so what the widget prints is the call made. */
export function runCall(
  lib: EdiLib,
  fn: keyof EdiLib,
  ...args: unknown[]
): EdiCall {
  const f = lib[fn] as (...a: unknown[]) => unknown;
  return { fn, args, result: f(...args) };
}

/** Whether a parser returned the sentinel: `""` for a value, `null` for a period. */
export function isSentinel(result: unknown): boolean {
  return result === "" || result === null || result === undefined;
}

/** A period or range result. */
export function isInterval(result: unknown): result is Interval {
  return (
    typeof result === "object" &&
    result !== null &&
    "start" in result &&
    "end" in result
  );
}

/** The parser, formatter and kind-name word of each UN/EDIFACT kind. The kind names
 *  come from the classifier; this maps them to the function that reads them. */
export const EDIFACT_FUNCTIONS: Record<
  EdifactKind,
  { parse: keyof EdiLib; format: keyof EdiLib; period: boolean }
> = {
  date: {
    parse: "parseEdifactDate",
    format: "formatEdifactDate",
    period: false,
  },
  time: {
    parse: "parseEdifactTime",
    format: "formatEdifactTime",
    period: false,
  },
  dateTime: {
    parse: "parseEdifactDateTime",
    format: "formatEdifactDateTime",
    period: false,
  },
  offsetDateTime: {
    parse: "parseEdifactOffsetDateTime",
    format: "formatEdifactOffsetDateTime",
    period: false,
  },
  datePeriod: {
    parse: "parseEdifactDatePeriod",
    format: "formatEdifactDatePeriod",
    period: true,
  },
  dateTimePeriod: {
    parse: "parseEdifactDateTimePeriod",
    format: "formatEdifactDateTimePeriod",
    period: true,
  },
};

/** The same for the X12 1250 qualifiers. */
export const X12_FUNCTIONS: Record<
  X12Kind,
  { parse: keyof EdiLib; format: keyof EdiLib; period: boolean }
> = {
  date: { parse: "parseX12Date", format: "formatX12Date", period: false },
  time: { parse: "parseX12Time", format: "formatX12Time", period: false },
  dateTime: {
    parse: "parseX12DateTime",
    format: "formatX12DateTime",
    period: false,
  },
  dateRange: {
    parse: "parseX12DateRange",
    format: "formatX12DateRange",
    period: true,
  },
  dateTimeRange: {
    parse: "parseX12DateTimeRange",
    format: "formatX12DateTimeRange",
    period: true,
  },
};

/** The kind named in words, for the Kind row. */
export const KIND_WORDS: Record<string, string> = {
  date: "date",
  time: "time",
  dateTime: "local date-time",
  offsetDateTime: "date-time with offset",
  datePeriod: "date period",
  dateTimePeriod: "date-time period",
  dateRange: "date range",
  dateTimeRange: "date-time range",
};

/**
 * The read of one classified value: the parser called with the value and the
 * code the classifier returned. A period parser's two-argument form is the same
 * call, so the arguments are always `(value, format)`; `parseX12Time` takes the
 * narrowed `TM` or `TS` too, so a value with seconds under `TM` is the sentinel.
 */
export function parseClassified(
  lib: EdiLib,
  functions: { parse: keyof EdiLib },
  value: string,
  format: string,
): EdiCall {
  return runCall(lib, functions.parse, value, format);
}

/**
 * The written-back call for a house value: the kind's formatter, with the period's
 * start and end as two arguments. `null` when there is no house value.
 */
export function formatClassified(
  lib: EdiLib,
  functions: { format: keyof EdiLib },
  house: EdiHouse,
  format: string,
): EdiCall {
  return isInterval(house)
    ? runCall(lib, functions.format, house.start, house.end, format)
    : runCall(lib, functions.format, house, format);
}

/** The one or two ISO strings of a house value, start first. */
export function houseEnds(house: EdiHouse): string[] {
  return isInterval(house) ? [house.start, house.end] : [house];
}

/** The text of a house value for a table cell: the string, or `start / end`. */
export function houseText(house: EdiHouse): string {
  return isInterval(house) ? `${house.start} / ${house.end}` : house;
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

/** The zone picker's options across both EDI widgets. */
export const EDI_ZONES: readonly string[] = [
  ...CURATED_TIMEZONES,
  "Europe/Amsterdam",
  "Asia/Singapore",
  // Ontario on Eastern standard time all year, which the ET example reads beside New York.
  "America/Atikokan",
];

// ---------------------------------------------------------------------------
// Codes the library does not read
// ---------------------------------------------------------------------------

/**
 * A two-digit-year code the library does not read, and the pattern the pattern
 * parsers read the same digits with. The library has no function that says why a
 * code is unread, so this advisory list names the legacy two-digit-year codes
 * and, where the guide gives one, their pattern. A test asserts every code here is
 * one the classifiers return `null` for, so a code the library starts reading
 * cannot stay on this list.
 */
export const TWO_DIGIT_YEAR_CODES: Readonly<
  Record<string, string | undefined>
> = {
  // UN/EDIFACT 2379
  "101": "yyMMdd",
  "201": "yyMMddHHmm",
  "202": "yyMMddHHmmss",
  "206": undefined,
  "207": undefined,
  "301": undefined,
  "302": undefined,
  "713": undefined,
  "717": undefined,
  // X12 1250
  D6: "yyMMdd",
  TT: "MMddyy",
  TR: "ddMMyyHHmm",
  RD6: undefined,
  TU: undefined,
};

/** The pattern parser a two-digit-year value is read with, for the sentinel's sentence. */
function patternAdvice(code: string): string {
  const pattern = TWO_DIGIT_YEAR_CODES[code];
  return pattern === undefined
    ? "Read it with the pattern parsers (parseDateWithPattern or parseDateTimeWithPattern) and a yearWindow."
    : `Read it with parseDateWithPattern or parseDateTimeWithPattern: the pattern ${pattern} and a yearWindow, which states the century you choose.`;
}

/**
 * The one sentence saying why the classifier returned `null` for a code: a
 * two-digit-year code (with what to use instead) or a code the library does not
 * read.
 */
export function unreadCodeText(
  code: string,
  standard: "edifact" | "x12",
): string {
  if (Object.prototype.hasOwnProperty.call(TWO_DIGIT_YEAR_CODES, code)) {
    return `Code ${code} has a two-digit year. No standard says which century it belongs to, so the EDI functions do not read it. ${patternAdvice(code)}`;
  }
  return standard === "edifact"
    ? `${code} is not a format code the library reads. A partial value, a weekday period, a quantity or an unstructured value is not a date, time or period, and a code is never guessed.`
    : `${code} is not a qualifier the library reads. A partial value, a day of the year, a month-name form or an unstructured value is not a complete date or time, and a code is never guessed.`;
}

// ---------------------------------------------------------------------------
// Drawing text
// ---------------------------------------------------------------------------

const DURATION = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

/** `PT15H` as `15 h`, `PT9H30M` as `9 h 30 min`, `PT0S` as `0 h`. A regular
 *  expression over the returned string; no arithmetic. */
export function durationText(iso: string): string {
  const m = DURATION.exec(iso);
  if (!m) return iso;
  const [, h, min, s] = m;
  const parts: string[] = [];
  if (h !== undefined) parts.push(`${h} h`);
  if (min !== undefined) parts.push(`${min} min`);
  if (s !== undefined && (parts.length > 0 || s !== "0")) parts.push(`${s} s`);
  return parts.length > 0 ? parts.join(" ") : "0 h";
}

/** The text of a `<dd>` member row. */
export type MemberRow<K extends string> = {
  key: K;
  role: string;
  label: string;
};

/** The `<dl>` rows of a readout block, all always present. */
export function readoutRowsHtml(rows: readonly MemberRow<string>[]): string {
  return rows
    .map(
      (r) =>
        `<div class="gmt-edi-row"><dt>${escapeHtml(r.label)}</dt><dd data-role="${escapeAttr(r.role)}" data-state="none">no result</dd></div>`,
    )
    .join("");
}

export const ABSENT_MEMBER_TEXT = "not stated";
export const NO_RESULT_TEXT = "no result";

/** What one readout row shows and which state it is in. */
export function readoutOf(
  text: string | null,
  hasResult: boolean,
): { text: string; state: "value" | "absent" | "none" } {
  if (!hasResult) return { text: NO_RESULT_TEXT, state: "none" };
  if (text === null) return { text: ABSENT_MEMBER_TEXT, state: "absent" };
  return { text, state: "value" };
}

/**
 * Why `resolveLocal(local, zone, { disambiguation: "reject" })` returned `""`,
 * decided by `classifyLocal`, never guessed.
 */
export function resolveReason(
  local: string,
  zone: string,
  lib: EdiLib,
): string {
  const time = local.slice(11, 16);
  switch (lib.classifyLocal(local, zone)) {
    case "ambiguous":
      return `The ${time} time happens twice in ${zone} on that date. With disambiguation: "reject", resolveLocal does not pick one.`;
    case "nonexistent":
      return `The ${time} time never happens in ${zone} on that date: the clock skipped it. With disambiguation: "reject", resolveLocal does not pick another time.`;
    case null:
      return `${zone} is not a time zone this browser knows.`;
    default:
      return `${local} could not be resolved in ${zone}.`;
  }
}

/** The polite line every NO SIGNAL aside opens with. */
export const NO_RESULT_TITLE = "No result";

// ---------------------------------------------------------------------------
// The strip: the same local time read in the zones the reader chose
// ---------------------------------------------------------------------------

/** One zone slot of the strip, before a tool adds its own last column. */
export interface ZoneResolution {
  zone: string;
  instant: string;
  /** The offset in force at the instant, `""` when there is no instant. */
  offset: string;
  /** Why `resolveLocal` returned `""`, else `""`. */
  reason: string;
}

/**
 * One strip row's shared part: `resolveLocal(local, zone, { disambiguation:
 * "reject" })`, then `toOffsetInstant(instant, zone).offset`. A blank slot is
 * `{ zone: "" }`; a refused time carries its reason, from `classifyLocal`.
 */
export function resolveInZone(
  local: string,
  rawZone: string,
  lib: EdiLib,
): ZoneResolution {
  const zone = rawZone.trim();
  const row: ZoneResolution = { zone, instant: "", offset: "", reason: "" };
  if (zone === "") return row;
  const instant = lib.resolveLocal(local, zone, REJECT);
  if (instant === "") {
    row.reason = resolveReason(local, zone, lib);
    return row;
  }
  row.instant = instant;
  row.offset = lib.toOffsetInstant(instant, zone)?.offset ?? "";
  return row;
}

export interface WidestGap {
  /** The ISO 8601 duration `diffUtcAsDuration` returned. */
  duration: string;
  /** The line shown: `Widest gap: 15 h, between A and B`. */
  text: string;
  earliest: string;
  latest: string;
}

/** The distance between the earliest and the latest resolved instant, from
 *  `minUtc`, `maxUtc` and `diffUtcAsDuration`. `null` with fewer than two. */
export function widestGap(
  rows: readonly { zone: string; instant: string }[],
  lib: EdiLib,
): WidestGap | null {
  const resolved = rows.filter((r) => r.instant !== "");
  if (resolved.length < 2) return null;
  const instants = resolved.map((r) => r.instant);
  const min = lib.minUtc(instants);
  const max = lib.maxUtc(instants);
  if (min === null || max === null) return null;
  const duration = lib.diffUtcAsDuration(min, max, "hours");
  const earliest = resolved.find((r) => r.instant === min)!.zone;
  const latest = (
    resolved.find((r) => r.instant === max && r.zone !== earliest) ??
    resolved.find((r) => r.instant === max)!
  ).zone;
  return {
    duration,
    text: `Widest gap: ${durationText(duration)}, between ${earliest} and ${latest}`,
    earliest,
    latest,
  };
}

/** A stand-in as wide as the longest zone name in the pickers (30 characters), for
 *  the hidden sizers that reserve a region's height. It is not a zone. */
export const LONGEST_ZONE = "Zonename/Wwwwwwwwwwwwwwwwwwwww";

/** The width of a typical long zone name (22 characters), for a sizer. */
export const SHORT_ZONE = "Zonename/Wwwwwwwwwwwww";

export const GAP_PROMPT =
  "Choose two zones to see how far apart the answers are.";
