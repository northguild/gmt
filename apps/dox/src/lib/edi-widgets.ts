/**
 * Pure helpers shared by the two EDI timestamp widgets (INT-15): the DTM
 * Decoder and the X12 Time Reader.
 *
 * No gmt import: every function that calls the library takes an `EdiLib` — the
 * real `parseEdifactDtm`, `formatEdifactDtm`, `parseX12DateTime`,
 * `parseX12DateTimePeriod`, `formatX12DateTimePeriod`, `x12TimeCode`, the validators, `resolveLocal`,
 * `classifyLocal`, `toOffsetInstant`, `fromOffsetInstant`, `minUtc`, `maxUtc`
 * and `diffUtcAsDuration` — loaded by the mount from the real package
 * (`edi-lib.ts`). That keeps this module free of gmt imports and lets the tests
 * inject the real library by module path.
 *
 * The widgets draw the library's results and compute none of them. The
 * site-side code only splits and joins the text a reader typed, builds the ISO
 * string a formatter takes from the members a parser returned (`isoOf`), and
 * formats a returned ISO 8601 duration as "15 h". Nothing here computes a result.
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
import { escapeAttr, escapeHtml, labelTextHtml } from "./widget-ui";

export { callArgs, formatValue } from "./punctuality-widgets";
export { zoneOptionsHtml } from "./transport-widgets";

// ---------------------------------------------------------------------------
// The library, injected
// ---------------------------------------------------------------------------

/** The century option every two-digit-year code takes. */
export interface YearWindowOptions {
  yearWindow?: "rolling" | number;
}

/** The period end of a result: `local`, else `date`, else `time`. */
export interface EdiPeriodEndResult {
  date?: string;
  time?: string;
  local?: string;
}

/** `EdiDateTime`, mirrored: every member optional. */
export interface EdiResult {
  date?: string;
  time?: string;
  local?: string;
  instant?: string;
  offset?: string;
  zone?: string;
  /** Present exactly when `zone` is, on a result of `parseX12DateTime`. */
  daylight?: boolean | null;
  dayOfYear?: number;
  yearDigit?: number;
  periodEnd?: EdiPeriodEndResult;
}

export type X12TimeMeaning =
  | { offset: string }
  | { zone: string; daylight: boolean | null };

export interface EdiLib {
  parseEdifactDtm(
    value: string,
    format: string,
    options?: YearWindowOptions,
  ): EdiResult | null;
  formatEdifactDtm(
    value: string,
    format: string,
    options?: YearWindowOptions,
  ): string;
  isValidEdifactDtm(
    value: string,
    format: string,
    options?: YearWindowOptions,
  ): boolean;
  isValidEdifactDtmFormat(format: unknown): boolean;
  /** Elements 373, 337 and 623, as `AT7`, `G62` and `DTM-02`/`03`/`04` carry them. */
  parseX12DateTime(
    date?: string,
    time?: string,
    timeCode?: string,
  ): EdiResult | null;
  /** Element 1251 against its 1250 qualifier, as a `DTP` carries them. */
  parseX12DateTimePeriod(
    value: string,
    format: string,
    options?: YearWindowOptions,
  ): EdiResult | null;
  formatX12DateTimePeriod(
    value: string,
    format: string,
    options?: YearWindowOptions,
  ): string;
  isValidX12DateTimePeriod(
    value: string,
    format: string,
    options?: YearWindowOptions,
  ): boolean;
  isValidX12DateTimePeriodFormat(format: unknown): boolean;
  x12TimeCode(code: string): X12TimeMeaning | null;
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
// Two-digit years
// ---------------------------------------------------------------------------

/** The year-window select's "no window" value. */
const YEAR_WINDOW_NONE = "none";

/**
 * The `options` argument for a year window as typed. A blank or `none` gives
 * `undefined`, so the call is made — and printed — with no third argument.
 * `rolling` passes the library's own name for the hundred years around the
 * current UTC year. Anything else is passed as a number exactly as read, even
 * `NaN` or `9901`, so the printed call is the real call.
 */
export function yearWindowOptions(text: string): YearWindowOptions | undefined {
  const t = text.trim();
  if (t === "" || t === YEAR_WINDOW_NONE) return undefined;
  if (t === "rolling") return { yearWindow: "rolling" };
  return { yearWindow: Number(t) };
}

/** What the year-window select and the start-year input hold, from the state's
 *  one string: `""`, `"rolling"` or a year as text. */
export function yearWindowControls(yearWindow: string): {
  mode: "none" | "rolling" | "fixed";
  start: string;
} {
  const t = yearWindow.trim();
  if (t === "" || t === YEAR_WINDOW_NONE) return { mode: "none", start: "" };
  if (t === "rolling") return { mode: "rolling", start: "" };
  return { mode: "fixed", start: t };
}

/** The state's one year-window string, from the two controls. */
export function yearWindowFromControls(mode: string, start: string): string {
  if (mode === "rolling") return "rolling";
  if (mode === "fixed") return start.trim();
  return "";
}

const SAMPLES = [
  "2024-06-15",
  "2024-06-15T14:30",
  "2024-06-15T14:30:00+02:00",
  "14:30",
  "14:30:00+02:00",
  "+02:00",
  "2024-06-15/2024-06-20",
  "2024-06-15T14:30/2024-06-20T16:00",
  "2024-06-15/2024-06-20T16:00",
  "2024-06-15T14:30/2024-06-20",
  "09:00/17:00",
] as const;

/**
 * Whether a code has a two-digit year, found by probing the formatter, so the
 * site holds no copy of the library's code table. A code needs a window when
 * every sample comes back `""` with no options and at least one comes back
 * non-empty once a window is given.
 */
export function needsYearWindow(
  format: (value: string, code: string, options?: YearWindowOptions) => string,
  code: string,
): boolean {
  if (SAMPLES.some((sample) => format(sample, code) !== "")) return false;
  return SAMPLES.some((sample) => format(sample, code, { yearWindow: 2000 }) !== "");
}

/** The window a state names, in words: `rolling window`, `window starting in
 *  2000`, or `""` for none. */
export function yearWindowWords(yearWindow: string): string {
  const { mode, start } = yearWindowControls(yearWindow);
  if (mode === "rolling") return "rolling window";
  if (mode === "fixed") return `window starting in ${start}`;
  return "";
}

/** The words for which window read a two-digit year, or that none was given. */
export function yearWindowNote(
  yearWindow: string,
  read: string | undefined,
): string {
  const words = yearWindowWords(yearWindow);
  if (words === "") {
    return "Two-digit year: no window was given, so the century is not read.";
  }
  return read === undefined
    ? `Two-digit year: ${words}.`
    : `Two-digit year, read as ${read.slice(0, 4)} by the ${words}.`;
}

/** The clauses after a picture's fields in its spoken line: `no offset`, then the
 *  window note. */
export function figureTail(closing: string, note: string): string {
  return [closing, note.replace(/\.$/, "")].filter((t) => t !== "").join("; ");
}

/** Markup for the two year-window controls. Always rendered, so a code change
 *  never adds or removes a row; `disabled` when the code reads no window. */
export function yearWindowFieldsHtml(
  yearWindow: string,
  disabled: boolean,
): string {
  const { mode, start } = yearWindowControls(yearWindow);
  const off = disabled ? " disabled" : "";
  const option = (value: string, label: string): string =>
    `<option value="${value}"${mode === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
  return (
    `<label class="gmt-label">${labelTextHtml("Year window")}` +
    `<select class="gmt-select" data-role="year-window"${off}>` +
    option("none", "No window") +
    option("rolling", "Rolling") +
    option("fixed", "From a start year") +
    `</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Window starts in")}` +
    `<input class="gmt-input" data-role="year-start" type="number" min="0" max="9900" step="1" inputmode="numeric" value="${escapeAttr(start)}"${mode === "fixed" && !disabled ? "" : " disabled"}></label>`
  );
}

// ---------------------------------------------------------------------------
// Reading a result back into the string a formatter takes
// ---------------------------------------------------------------------------

/** One half of a period, or a single value: `local`, else `date`, else `time`. */
function half(part: EdiPeriodEndResult): string | null {
  return part.local ?? part.date ?? part.time ?? null;
}

/**
 * The one ISO 8601 string a formatter takes, built from the members a parser
 * returned (the `formatEdifactDtm` JSDoc: "Takes what `parseEdifactDtm`
 * returns"). `null` when nothing can be written back: a day of the year with
 * no year (`TC`, `EH`).
 */
export function isoOf(result: EdiResult, lib: EdiLib): string | null {
  if (result.periodEnd) {
    const start = half(result);
    const end = half(result.periodEnd);
    return start !== null && end !== null ? `${start}/${end}` : null;
  }
  if (result.instant !== undefined && result.offset !== undefined) {
    return lib.fromOffsetInstant({
      instant: result.instant,
      offset: result.offset,
    });
  }
  if (result.time !== undefined && result.offset !== undefined) {
    return `${result.time}${result.offset}`;
  }
  if (result.local !== undefined) return result.local;
  // `TU` holds a date and a day of the year: the date is the whole value.
  // `TC` and `EH` hold a day of the year (and a year digit) and no date.
  if (result.date === undefined && (result.dayOfYear !== undefined || result.yearDigit !== undefined)) {
    return null;
  }
  return result.date ?? result.time ?? result.offset ?? null;
}

/**
 * One sentence saying how `isoOf` built the string a formatter was given, so the
 * site-side step is stated on screen. Blank when the result's own string is
 * passed unchanged.
 */
export function isoNote(result: EdiResult): string {
  if (result.periodEnd) {
    return "The start and the end are joined with a slash, the form the formatter takes.";
  }
  if (result.instant !== undefined && result.offset !== undefined) {
    return "The instant and the offset are joined first with fromOffsetInstant.";
  }
  if (result.time !== undefined && result.offset !== undefined) {
    return "The time and the offset are joined, the form the formatter takes.";
  }
  return "";
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
export function readoutRowsHtml(
  rows: readonly MemberRow<string>[],
): string {
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
export function resolveReason(local: string, zone: string, lib: EdiLib): string {
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
