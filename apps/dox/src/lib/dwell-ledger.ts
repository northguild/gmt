/**
 * Pure helpers for the Dwell Ledger widget (TRAN-8).
 *
 * The ledger draws a dwell on a zone's real local-day grid: one cell per local
 * calendar day, as wide as that day actually is (a spring-forward day is 23
 * hours, a fall-back day 25), with the cells the dwell touches shaded. The count
 * it teaches is `dwellTime`'s `calendarDays`, and the widget never computes that
 * number itself: the mount calls the real function and prints what it returns.
 * The shading here is drawing, and a test asserts it agrees with the library.
 *
 * No DOM and no gmt import, mirroring `interval-visualizer.ts`: validators come
 * in from the mount, loaded from the real package.
 */

import { Temporal } from "@js-temporal/polyfill";
import { CURATED_TIMEZONES } from "./curated-timezones";

export interface DwellLedgerArgs {
  entry?: string;
  exit?: string;
  /** IANA zone the days are counted in. Empty means "use the entry's zone". */
  zone?: string;
  /** A second zone drawn under the first, on the same canvas. */
  compareZone?: string;
}

/** The picker's zones: the curated set plus the guide's Amsterdam comparison. */
export const LEDGER_ZONES: readonly string[] = [
  ...CURATED_TIMEZONES,
  "Europe/Amsterdam",
];

/** The zone select's first option: no `targetZone` argument at all. */
export const NO_ZONE = "";

export const CUSTOM_PRESET_ID = "custom";

export interface DwellPreset {
  id: string;
  label: string;
  description: string;
  entry: string;
  exit: string;
  zone: string;
  compareZone?: string;
}

/**
 * Every preset is one of `dwellTime`'s own JSDoc examples, so the result the
 * widget prints is a result the library documents. The mount test asserts each
 * one against the literal string.
 */
export const DWELL_PRESETS: readonly DwellPreset[] = [
  {
    id: "two-hours-two-days",
    label: "23:00 → 01:00: two hours, two days",
    description:
      "A container gates in at 23:00 and out at 01:00 in New York. Two hours elapsed, and it was there on two local dates.",
    entry: "2024-06-15T23:00:00-04:00[America/New_York]",
    exit: "2024-06-16T01:00:00-04:00[America/New_York]",
    zone: "America/New_York",
  },
  {
    id: "exit-at-midnight",
    label: "Exit exactly at midnight",
    description:
      "The dwell is half-open: an exit exactly at local midnight does not touch the new day, so six hours count as one day.",
    entry: "2024-06-15T22:00:00Z",
    exit: "2024-06-16T04:00:00Z",
    zone: "America/New_York",
  },
  {
    id: "spring-forward",
    label: "Across spring-forward: 7 hours, 1 day",
    description:
      "New York's 10 March 2024 had 23 hours. Seven elapsed hours across the jump are still one local day.",
    entry: "2024-03-10T05:00:00Z",
    exit: "2024-03-10T12:00:00Z",
    zone: "America/New_York",
  },
  {
    id: "london-vs-amsterdam",
    label: "Same instants, two zones",
    description:
      "The same two instants are two days in London and one in Amsterdam. The zone decides the count.",
    entry: "2024-06-15T22:30:00Z",
    exit: "2024-06-16T01:00:00Z",
    zone: "Europe/London",
    compareZone: "Europe/Amsterdam",
  },
  {
    id: "no-zone",
    label: "No zone given",
    description:
      "Two bare instants and no zone: there is no place to count days in, so dwellTime returns null.",
    entry: "2024-06-15T22:30:00Z",
    exit: "2024-06-16T01:00:00Z",
    zone: NO_ZONE,
  },
];

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The instant an ISO string names, or NaN. Accepts `Z`, an offset, or a bracketed zone. */
export function toEpochMs(iso: string): number {
  try {
    return Temporal.Instant.from(iso).epochMilliseconds;
  } catch {
    try {
      return Temporal.ZonedDateTime.from(iso).epochMilliseconds;
    } catch {
      return Number.NaN;
    }
  }
}

/**
 * The zone the grid is drawn in: the chosen zone, else the entry's own
 * bracketed zone (which is what `dwellTime` falls back to), else none.
 * `Temporal.ZonedDateTime.from` is the judge of whether the entry names a zone:
 * it throws when no bracket does (RFC 9557 §4.1).
 */
export function gridZone(entry: string, zone: string): string | null {
  if (zone !== NO_ZONE) return isKnownZone(zone) ? zone : null;
  try {
    return Temporal.ZonedDateTime.from(entry).timeZoneId;
  } catch {
    return null;
  }
}

function isKnownZone(zone: string): boolean {
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone);
    return true;
  } catch {
    return false;
  }
}

/** A trailing `Z` or numeric offset, before any bracketed annotation. */
const HAS_OFFSET =
  /(?:Z|[+-]\d{2}:?\d{2}(?::\d{2}(?:\.\d+)?)?)(?:\[[^\]]*\])*$/i;

/**
 * A wall time with no offset (`2024-06-15T23:00:00`), read in `zone`.
 *
 * What a chat model sends when a reader says "23:00 in New York". It is not an
 * instant, so `dwellTime` would refuse it; reading it in the stated zone is what
 * the reader meant. `reject`, not `compatible`: a wall time inside a skipped
 * hour is left as typed, and the widget's sentinel says why, rather than being
 * moved silently. Anything that already names an instant is returned unchanged.
 */
export function resolveWallTime(value: string, zone: string): string {
  const trimmed = value.trim();
  if (trimmed === "" || HAS_OFFSET.test(trimmed) || zone === NO_ZONE) {
    return trimmed;
  }
  try {
    return Temporal.PlainDateTime.from(trimmed)
      .toZonedDateTime(zone, { disambiguation: "reject" })
      .toString();
  } catch {
    return trimmed;
  }
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export interface LedgerCanvas {
  readonly startMs: number;
  readonly endMs: number;
  /** Drag snap and single keyboard step, in minutes. */
  readonly snapMinutes: number;
  toPercent(ms: number): number;
  /** The snapped instant at a track position, clamped to the canvas. */
  fromPercent(percent: number): number;
  /** Move `ms` by `steps` snap units, clamped to the canvas. */
  step(ms: number, steps: number): number;
}

/** Quarter-hours up to a week, hours beyond: dwells run from hours to days. */
function snapMinutesFor(spanMs: number): number {
  return spanMs <= 7 * DAY_MS ? 15 : 60;
}

export function createLedgerCanvas(
  startMs: number,
  endMs: number,
): LedgerCanvas {
  const spanMs = Math.max(1, endMs - startMs);
  const snapMinutes = snapMinutesFor(spanMs);
  const snapMs = snapMinutes * MINUTE_MS;
  const clamp = (ms: number) => Math.max(startMs, Math.min(endMs, ms));
  return {
    startMs,
    endMs,
    snapMinutes,
    toPercent: (ms) =>
      Number.isNaN(ms)
        ? Number.NaN
        : Math.max(0, Math.min(100, ((ms - startMs) / spanMs) * 100)),
    fromPercent: (percent) => {
      const pct = Math.max(0, Math.min(100, percent));
      const raw = startMs + (pct / 100) * spanMs;
      return clamp(Math.round(raw / snapMs) * snapMs);
    },
    step: (ms, steps) =>
      clamp(Math.round(ms / snapMs) * snapMs + steps * snapMs),
  };
}

function startOfLocalDay(ms: number, zone: string): number {
  return Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(zone)
    .startOfDay().epochMilliseconds;
}

function nextLocalMidnight(ms: number, zone: string): number {
  const start = startOfLocalDay(ms, zone);
  if (start === ms) return ms;
  return Temporal.Instant.fromEpochMilliseconds(start)
    .toZonedDateTimeISO(zone)
    .add({ days: 1 })
    .startOfDay().epochMilliseconds;
}

/** Breathing room each side of the dwell, so both handles can be grabbed. */
const FIT_PADDING = 0.1;
const MIN_PAD_MS = 30 * MINUTE_MS;

/**
 * A canvas for a dwell: the dwell padded 10% each side, then widened out to the
 * nearest local midnights in every zone given, so the days the dwell touches
 * are drawn whole. With two zones one grid's edge cells can be partial, because
 * their midnights are different instants. `null` when either end is unparseable
 * or the zones cannot be read.
 */
export function fitLedgerCanvas(
  entryMs: number,
  exitMs: number,
  zones: readonly string[],
): LedgerCanvas | null {
  if (Number.isNaN(entryMs) || Number.isNaN(exitMs)) return null;
  const lo = Math.min(entryMs, exitMs);
  const hi = Math.max(entryMs, exitMs);
  const pad = Math.max(MIN_PAD_MS, (hi - lo) * FIT_PADDING);
  let startMs = lo - pad;
  let endMs = hi + pad;
  try {
    for (const zone of zones) {
      startMs = Math.min(startMs, startOfLocalDay(lo - pad, zone));
      endMs = Math.max(endMs, nextLocalMidnight(hi + pad, zone));
    }
  } catch {
    return null;
  }
  return createLedgerCanvas(startMs, endMs);
}

// ---------------------------------------------------------------------------
// Day cells
// ---------------------------------------------------------------------------

export interface DayCell {
  /** The local day's real bounds, which may extend past the canvas. */
  startMs: number;
  endMs: number;
  /** Local date, `YYYY-MM-DD`. */
  date: string;
  /** Length of the local day in hours: 24, or 23 / 25 around a DST change. */
  hours: number;
  /** Whether the half-open dwell `[entry, exit)` touches this day. */
  touched: boolean;
}

/** More days than this and cells would be slivers; the grid is not drawn. */
export const MAX_CELLS = 120;

/**
 * The local days in `zone` that cover the canvas.
 *
 * Bounds come from Temporal's `startOfDay()`, the same boundary `floorToZone`
 * uses, so a 23- or 25-hour day is one cell of its real width. `touched` is the
 * half-open rule `dwellTime` counts with: a day is touched when it overlaps
 * `[entry, exit)`, and a zero-length dwell touches the day it sits on.
 */
export function dayCells(
  canvas: LedgerCanvas,
  zone: string,
  entryMs: number,
  exitMs: number,
): DayCell[] {
  const cells: DayCell[] = [];
  try {
    let day = Temporal.Instant.fromEpochMilliseconds(canvas.startMs)
      .toZonedDateTimeISO(zone)
      .startOfDay();
    while (day.epochMilliseconds < canvas.endMs) {
      if (cells.length >= MAX_CELLS) return [];
      const next = day.add({ days: 1 }).startOfDay();
      const startMs = day.epochMilliseconds;
      const endMs = next.epochMilliseconds;
      const touched =
        entryMs === exitMs
          ? startMs <= entryMs && entryMs < endMs
          : startMs < exitMs && endMs > entryMs;
      cells.push({
        startMs,
        endMs,
        date: day.toPlainDate().toString(),
        hours: Math.round(((endMs - startMs) / HOUR_MS) * 100) / 100,
        touched,
      });
      day = next;
    }
  } catch {
    return [];
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const MONTHS = [
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

/** `15 Jun 23:00` in `zone`. */
export function formatLocal(ms: number, zone: string): string {
  try {
    const z = Temporal.Instant.fromEpochMilliseconds(
      Math.round(ms),
    ).toZonedDateTimeISO(zone);
    const hh = String(z.hour).padStart(2, "0");
    const mm = String(z.minute).padStart(2, "0");
    return `${z.day} ${MONTHS[z.month - 1]} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

/** `15 Jun` for a `YYYY-MM-DD` date. */
export function formatDayLabel(date: string): string {
  try {
    const d = Temporal.PlainDate.from(date);
    return `${d.day} ${MONTHS[d.month - 1]}`;
  } catch {
    return date;
  }
}

/** Start, middle and end of the canvas, in `zone` (UTC when there is none). */
export function axisLabels(
  canvas: LedgerCanvas,
  zone: string | null,
): [string, string, string] {
  const z = zone ?? "UTC";
  return [
    formatLocal(canvas.startMs, z),
    formatLocal((canvas.startMs + canvas.endMs) / 2, z),
    formatLocal(canvas.endMs, z),
  ];
}

/**
 * The string a dragged handle writes back: zoned in the grid zone when there
 * is one, so the reader sees the local time they dragged to, else a `Z` instant.
 */
export function formatHandleValue(ms: number, zone: string | null): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(ms);
  if (zone === null) return instant.toString();
  try {
    return instant.toZonedDateTimeISO(zone).toString();
  } catch {
    return instant.toString();
  }
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type NullReason =
  | "invalid-entry"
  | "invalid-exit"
  | "unknown-zone"
  | "no-zone"
  | "inverted";

export const NULL_REASON_TEXT: Record<NullReason, string> = {
  "invalid-entry":
    "The entry is not an instant. It needs a Z, an offset, or an offset with a bracketed zone.",
  "invalid-exit":
    "The exit is not an instant. It needs a Z, an offset, or an offset with a bracketed zone.",
  "unknown-zone": "The zone is not an IANA time zone this browser knows.",
  "no-zone":
    "There is no place to count days in. Both ends are bare instants and no zone was given, and an offset is not a zone.",
  inverted:
    "The exit is before the entry. An inverted dwell is a data error, not a negative stay.",
};

export interface NullValidators {
  isValidInstant(value: string): boolean;
  isValidTimeZone(value: string): boolean;
  isValidZonedDateTime(value: string): boolean;
}

/**
 * Why `dwellTime` returned `null`, checked in the order `dwellTime` checks, so
 * the reason shown is the one that actually stopped it. `null` when none of
 * these applies.
 */
export function explainNull(
  entry: string,
  exit: string,
  zone: string,
  v: NullValidators,
): NullReason | null {
  if (!v.isValidInstant(entry)) return "invalid-entry";
  if (!v.isValidInstant(exit)) return "invalid-exit";
  if (zone !== NO_ZONE) {
    if (!v.isValidTimeZone(zone)) return "unknown-zone";
  } else if (!v.isValidZonedDateTime(entry)) {
    return "no-zone";
  }
  if (toEpochMs(entry) > toEpochMs(exit)) return "inverted";
  return null;
}

/** The preset whose inputs match these values, or `custom`. */
export function matchPreset(
  entry: string,
  exit: string,
  zone: string,
  compareZone: string,
): string {
  const hit = DWELL_PRESETS.find(
    (p) =>
      p.entry === entry &&
      p.exit === exit &&
      p.zone === zone &&
      (p.compareZone ?? "") === compareZone,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** What `dwellTime` returns, as a reader would write it: one key per line. */
export interface DwellResult {
  duration: string;
  enter: string;
  exit: string;
  calendarDays: number;
}

export function formatDwell(d: DwellResult): string {
  return (
    `{ duration: ${JSON.stringify(d.duration)},\n` +
    `  enter: ${JSON.stringify(d.enter)},\n` +
    `  exit: ${JSON.stringify(d.exit)},\n` +
    `  calendarDays: ${d.calendarDays} }`
  );
}

/** `2 local days`, `1 local day`. */
export function dayCountText(n: number): string {
  return `${n} local ${n === 1 ? "day" : "days"}`;
}
