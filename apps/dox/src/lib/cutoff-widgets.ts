/**
 * Pure helpers shared by the three cut-off widgets (TRAN-10): the Cut-off
 * Stack (`cutoffSchedule`), the Cut-off Ruler (`cutoffAt`) and the Cut-off
 * Countdown (`isPastCutoff` / `timeToCutoff`).
 *
 * No gmt import: every widget-facing function here takes a `CutoffLib` — the
 * real `cutoffAt`, `cutoffSchedule`, `isPastCutoff`, `timeToCutoff`,
 * `etaAtZone`, `rollDate`, `isValidTimeZone`, `isValidDateTime` and
 * `getUtcNow` — as an argument, loaded by the mount from the real package
 * (`cutoff-lib.ts`). That keeps this module free of gmt imports and lets the
 * tests inject the real library by module path.
 *
 * `@js-temporal/polyfill` is imported for drawing only — turning a zoned
 * string the library already returned into a weekday label or a month name,
 * axis positions, day-column bounds. Every cut-off instant, every rolled or
 * unrolled position, every "moved" flag, every closed day, every hours-before
 * figure and every past-or-not verdict shown by any of the three widgets
 * comes from a real `CutoffLib` call.
 *
 * GMT tracks no law: no string here names a law, a standard, a regulator or
 * an industry body. "VGM", "gate-in" and "documents" are cut-off names, used
 * as the library's JSDoc uses them.
 */

import { Temporal } from "@js-temporal/polyfill";
import { isZonelessDeparture } from "./transport-widgets";
import { escapeHtml } from "./widget-ui";

export {
  TRANSPORT_ZONES,
  zoneOptionsHtml,
  minutesText,
  epochMs,
} from "./transport-widgets";

// ---------------------------------------------------------------------------
// The library, injected
// ---------------------------------------------------------------------------

/** The shape `cutoffAt` and `cutoffSchedule` take as options. */
export interface CutoffCalendar {
  weekend: number[];
  holidays: string[];
  timeZone: string;
}

export interface CutoffAtOptions {
  timeZone: string;
  atLocalTime?: string;
  calendar?: CutoffCalendar;
  roll?: string;
}

export interface CutoffScheduleOptions {
  timeZone: string;
  calendar?: CutoffCalendar;
  roll?: string;
}

export interface CutoffEntry {
  name: string;
  offset: string;
  atLocalTime?: string;
}

export interface CutoffTime {
  name: string;
  at: string;
}

/** The nine real functions every cut-off widget needs, loaded at module
 *  granularity by `cutoff-lib.ts`. Injected so this module stays free of gmt
 *  imports and the tests can supply the real library by module path. */
export interface CutoffLib {
  cutoffAt(anchor: string, offset: string, options: CutoffAtOptions): string;
  cutoffSchedule(
    anchor: string,
    cutoffs: readonly CutoffEntry[],
    options: CutoffScheduleOptions,
  ): CutoffTime[];
  isPastCutoff(now: string, cutoff: string): boolean;
  timeToCutoff(now: string, cutoff: string): string;
  etaAtZone(instant: string, zone: string): string;
  rollDate(date: string, roll: string, calendar: CutoffCalendar): string;
  isValidTimeZone(value: string): boolean;
  isValidDateTime(value: string): boolean;
  getUtcNow(): string;
}

/** Every roll convention `cutoffAt` accepts, in the order the widgets offer
 *  it. `"endOfMonth"` is left out: the JSDoc calls it `rollDate`'s schedule
 *  tool, not a cut-off convention. */
export const ROLL_OPTIONS: readonly string[] = [
  "preceding",
  "following",
  "modifiedPreceding",
  "modifiedFollowing",
  "none",
];

/** ISO weekday numbers 1..7 with Mon..Sun labels, as `BusinessCalendar.weekend`
 *  numbers them. */
export const WEEKDAYS: readonly { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

// ---------------------------------------------------------------------------
// Reading a zoned string the library returned — never recomputing it
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ZONED_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)([+-]\d{2}:\d{2}|Z)\[([^\]]+)]$/;

export interface LocalParts {
  date: string;
  weekday: string;
  time: string;
  offset: string;
  zone: string;
}

/** Trims a `:00` seconds group with no fraction; keeps everything else
 *  (a nonzero second, or any fraction) exactly as printed. */
function trimZeroSeconds(time: string): string {
  const m = /^(\d{2}:\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(time);
  if (!m) return time;
  const [, hm, sec] = m;
  if (sec === undefined || sec === "00") return hm!;
  return `${hm}:${sec}`;
}

/** `{ date, weekday, time, offset, zone }` parsed from a zoned string the
 *  library returned — the weekday label is the one thing not literally in
 *  the string, and it is read from the date with the polyfill (drawing, not
 *  computing a result). An unparseable string gives every field `""`. */
export function localParts(zoned: string): LocalParts {
  const m = ZONED_PATTERN.exec(zoned);
  if (!m) return { date: "", weekday: "", time: "", offset: "", zone: "" };
  const [, date, time, offset, zone] = m;
  const weekday =
    WEEKDAY_LABELS[Temporal.PlainDate.from(date!).dayOfWeek - 1] ?? "";
  return {
    date: date!,
    weekday,
    time: trimZeroSeconds(time!),
    offset: offset!,
    zone: zone!,
  };
}

/** `"Fri 14 Jun 17:00"` from `localParts`. `""` when the string does not
 *  parse. */
export function localLabel(zoned: string): string {
  const p = localParts(zoned);
  if (p.date === "") return "";
  const [, month, day] = p.date.split("-");
  const monthLabel = MONTH_LABELS[Number(month) - 1] ?? "";
  return `${p.weekday} ${Number(day)} ${monthLabel} ${p.time}`;
}

// ---------------------------------------------------------------------------
// Axis ticks — for drawing only, never a library result
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `"14:00"`. */
export function hourTickLabel(z: Temporal.ZonedDateTime): string {
  return `${pad2(z.hour)}:00`;
}

/** `"14:15"`. */
export function minuteTickLabel(z: Temporal.ZonedDateTime): string {
  return `${pad2(z.hour)}:${pad2(z.minute)}`;
}

/** `"14 Jun"`. */
export function dayTickLabel(z: Temporal.ZonedDateTime): string {
  return `${z.day} ${MONTH_LABELS[z.month - 1]}`;
}

/** `"Jun 2024"`. */
export function monthTickLabel(z: Temporal.ZonedDateTime): string {
  return `${MONTH_LABELS[z.month - 1]} ${z.year}`;
}

export interface AxisTick {
  ms: number;
  label: string;
}

/**
 * Walks local-time ticks from `startMs` to `endMs` in `zone`, one every
 * `step` of `unit`, aligned to the unit's own boundary (the hour, the local
 * midnight, or the first of the month) at or before `startMs`. Positions and
 * labels only — every axis this draws is a picture of values the library
 * already returned, never a computed result of its own. `[]` on an
 * unresolvable zone or instant.
 */
export function walkTicks(
  startMs: number,
  endMs: number,
  zone: string,
  unit: "minutes" | "hours" | "days" | "months",
  step: number,
  label: (z: Temporal.ZonedDateTime) => string,
): AxisTick[] {
  if (endMs <= startMs) return [];
  try {
    const startZ =
      Temporal.Instant.fromEpochMilliseconds(startMs).toZonedDateTimeISO(zone);
    let cur =
      unit === "hours" || unit === "minutes"
        ? startZ.round({ smallestUnit: "hour", roundingMode: "floor" })
        : unit === "days"
          ? startZ.startOfDay()
          : startZ.with({ day: 1 }).startOfDay();
    const out: AxisTick[] = [];
    // A generous but finite bound: this only ever walks a widget's own axis
    // window, never an unbounded range.
    for (
      let guard = 0;
      guard < 2000 && cur.epochMilliseconds <= endMs;
      guard++
    ) {
      if (cur.epochMilliseconds >= startMs) {
        out.push({ ms: cur.epochMilliseconds, label: label(cur) });
      }
      cur =
        unit === "minutes"
          ? cur.add({ minutes: step })
          : unit === "hours"
            ? cur.add({ hours: step })
            : unit === "days"
              ? cur.add({ days: step }).startOfDay()
              : cur.add({ months: step }).with({ day: 1 }).startOfDay();
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

const DURATION_PATTERN = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/;

/**
 * A returned ISO duration as words, sign dropped — the caller words the
 * direction ("late by", "left"). The library's largest unit is hours, so this
 * never folds into days. `""` (no cut-off to compare) stays `""`.
 */
export function durationText(iso: string): string {
  if (iso === "") return "";
  const body = iso.startsWith("-") ? iso.slice(1) : iso;
  const m = DURATION_PATTERN.exec(body);
  if (!m) return "";
  const [, h, min, s] = m;
  const parts: string[] = [];
  if (h !== undefined && Number(h) !== 0) parts.push(`${h} h`);
  if (min !== undefined && Number(min) !== 0) parts.push(`${min} min`);
  if (s !== undefined && Number(s) !== 0) parts.push(`${s} s`);
  return parts.length === 0 ? "0 min" : parts.join(" ");
}

/** Whether a returned duration is negative — `isPastCutoff` reads the same
 *  sign as "late", never recomputed. */
export function isNegative(iso: string): boolean {
  return iso.startsWith("-");
}

// ---------------------------------------------------------------------------
// Zoneless text
// ---------------------------------------------------------------------------

/** `lib.isValidDateTime(text)` and the text has no `Z`, no numeric offset and
 *  no `[` — a wall time with no zone to read it in. Reuses the check
 *  `transport-widgets.ts` keeps for its own diagnosis, exported unchanged. */
export function isZoneless(
  text: string,
  lib: Pick<CutoffLib, "isValidDateTime">,
): boolean {
  return isZonelessDeparture(text, lib);
}

// ---------------------------------------------------------------------------
// The real call, as source text
// ---------------------------------------------------------------------------

const ENTRY_KEY_ORDER = ["name", "offset", "atLocalTime"];
const CALENDAR_KEY_ORDER = ["weekend", "holidays", "timeZone"];
const OPTIONS_KEY_ORDER = ["timeZone", "atLocalTime", "calendar", "roll"];

function keyOrderFor(obj: Record<string, unknown>): readonly string[] {
  if ("name" in obj && "offset" in obj) return ENTRY_KEY_ORDER;
  if ("weekend" in obj && "holidays" in obj) return CALENDAR_KEY_ORDER;
  return OPTIONS_KEY_ORDER;
}

function renderValue(value: unknown, str: (s: string) => string): string {
  if (typeof value === "string") return str(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => renderValue(v, str)).join(", ")}]`;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = keyOrderFor(obj)
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${k}: ${renderValue(obj[k], str)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return String(value);
}

/**
 * `[html, plain]` for `renderCallLine`, in the JSDoc spelling: unquoted keys,
 * double-quoted strings, numbers and arrays bare, key order always the
 * JSDoc's (an entry is `name, offset, atLocalTime`; options are `timeZone,
 * atLocalTime, calendar, roll`; a calendar is `weekend, holidays, timeZone`).
 * An absent optional key is omitted, never printed as `undefined`. `fn` is
 * the function name the caller is about to render — not read here, since the
 * shape of each argument identifies its own key order, but kept in the
 * signature so a call site reads like the call it prints.
 */
export function callSource(
  fn: string,
  args: readonly unknown[],
): [string, string] {
  void fn;
  const htmlStr = (s: string) =>
    `<span class="gmt-code-str">${escapeHtml(JSON.stringify(s))}</span>`;
  const plainStr = (s: string) => JSON.stringify(s);
  const html = args.map((a) => renderValue(a, htmlStr)).join(", ");
  const plain = args.map((a) => renderValue(a, plainStr)).join(", ");
  return [html, plain];
}

// ---------------------------------------------------------------------------
// Formatting a stack
// ---------------------------------------------------------------------------

/** `[{ name: "documents", at: "…" },\n  { name: "gate-in", at: "…" }]`;
 *  replacing each `\n` plus its indent with one space gives the JSDoc result
 *  literal. `[]` for an empty result. */
export function formatStack(result: readonly CutoffTime[]): string {
  if (result.length === 0) return "[]";
  return `[${result
    .map(
      (r) => `{ name: ${JSON.stringify(r.name)}, at: ${JSON.stringify(r.at)} }`,
    )
    .join(",\n  ")}]`;
}
