/**
 * Pure helpers for the Interval Algebra Visualizer widget.
 *
 * Extracted from IntervalVisualizer.astro so they can be unit-tested without
 * jsdom, mirroring dst-inspector.ts.
 *
 * Deliberately does NOT duplicate the library's own validation
 * (isValidZonedDateTime / isValidZonedRange) — the widget loads those from
 * the real gmt package (zoned/validate) so the sentinel-vs-empty distinction
 * can never drift from the actual gate the interval functions use. This
 * module is timeline math, presets, and display formatting only.
 */

import { Temporal } from "@js-temporal/polyfill";

export interface ZonedInterval {
  start: string;
  end: string;
}

// ---------------------------------------------------------------------------
// Fixed timeline window
// ---------------------------------------------------------------------------

const ZONE = "UTC";
export const TIMELINE_START = "2024-01-01T00:00:00+00:00[UTC]";
export const TIMELINE_END = "2024-12-31T23:59:59+00:00[UTC]";

/**
 * Parse any valid zoned ISO string to an `Instant`.
 *
 * `Temporal.Instant.from` is deliberately stricter than this widget needs: an
 * Instant must be unambiguous, so it requires an offset (or `Z`) and rejects
 * `2024-10-24T09:00:00[UTC]`. That string is nonetheless a perfectly valid
 * `ZonedDateTime` — the zone determines the offset — and it is exactly what
 * `isValidZonedDateTime` accepts.
 *
 * The gap between those two facts was a real bug: a reader could type a value
 * this widget validated as good, watch it pass validation, and then see an
 * empty timeline and a false "one of the intervals is reversed" message,
 * because every `Instant.from` behind the scenes had thrown. Going through
 * `ZonedDateTime` closes it — the zone resolves the offset, and an already
 * offset-bearing string is unaffected.
 *
 * (`isValidZonedDateTime` is not at fault here and was not changed. It answers
 * "is this a valid ZonedDateTime?", and the answer was correct; this module was
 * asking a stricter question than it meant to.)
 */
function toInstant(iso: string): Temporal.Instant {
  try {
    return Temporal.Instant.from(iso);
  } catch {
    return Temporal.ZonedDateTime.from(iso).toInstant();
  }
}

const START_MS = Temporal.Instant.from(TIMELINE_START).epochMilliseconds;
const END_MS = Temporal.Instant.from(TIMELINE_END).epochMilliseconds;
const SPAN_MS = END_MS - START_MS;

/**
 * Map a zoned ISO instant to a 0-100 position on the fixed 2024 timeline.
 * Clamped to the window. Returns NaN for unparseable input (never throws).
 */
export function instantToPercent(iso: string): number {
  try {
    const ms = toInstant(iso).epochMilliseconds;
    return Math.max(0, Math.min(100, ((ms - START_MS) / SPAN_MS) * 100));
  } catch {
    return NaN;
  }
}

/**
 * Map a 0-100 timeline position back to a zoned ISO instant, snapped to the
 * nearest stepMinutes (default: whole days) and clamped to the window.
 */
export function percentToInstant(percent: number, stepMinutes = 1440): string {
  const clampedPct = Math.max(0, Math.min(100, percent));
  const rawMs = START_MS + (clampedPct / 100) * SPAN_MS;
  const stepMs = stepMinutes * 60 * 1000;
  const snappedMs = Math.round(rawMs / stepMs) * stepMs;
  const clampedMs = Math.max(START_MS, Math.min(END_MS, snappedMs));
  return Temporal.Instant.fromEpochMilliseconds(clampedMs)
    .toZonedDateTimeISO(ZONE)
    .toString();
}

/**
 * Step a zoned ISO instant by a whole number of days (negative to go back),
 * clamped to the timeline window. Returns the input unchanged if unparseable.
 */
export function stepInstant(iso: string, deltaDays: number): string {
  try {
    const instant = toInstant(iso);
    const stepped = instant.add({ hours: deltaDays * 24 });
    const clampedMs = Math.max(
      START_MS,
      Math.min(END_MS, stepped.epochMilliseconds),
    );
    return Temporal.Instant.fromEpochMilliseconds(clampedMs)
      .toZonedDateTimeISO(ZONE)
      .toString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Data-fitted timeline scale
// ---------------------------------------------------------------------------

/**
 * The canvas the six rows are drawn on.
 *
 * **Why this exists.** The timeline was a fixed calendar-2024 window, and that
 * is exactly right for the relationship presets: they are authored against it,
 * and holding the frame of reference still is what makes switching between them
 * legible — `disjoint` occupying only the left two-thirds is information, not a
 * layout accident. Refitting per preset would destroy that.
 *
 * It is exactly wrong for values that arrive from outside. DOX-C3b let the chat
 * seed four arbitrary instants, and a three-hour meeting on a one-year axis maps
 * to a 0.02%-wide bar: every handle lands on the same pixel and the widget looks
 * broken while being, arithmetically, perfectly correct.
 *
 * So the canvas is a value rather than a constant. Presets restore
 * `FIXED_YEAR_SCALE`; seeded and typed values call `fitTimelineScale`.
 *
 * Drag snapping and keyboard stepping derive from the span rather than being
 * fixed at a day, which is what keeps the fixed-year case byte-identical to the
 * old constants (366 days / 200 lands on the 1-day rung) while giving a
 * three-hour canvas a one-minute step instead of an unusable one-day one.
 */
export interface TimelineScale {
  readonly startMs: number;
  readonly endMs: number;
  /** Drag snap and single keyboard step. Derived from the span. */
  readonly snapMinutes: number;
  toPercent(iso: string): number;
  fromPercent(percent: number): string;
  /** Move `iso` by `steps` snap units, clamped to the canvas. */
  step(iso: string, steps: number): string;
  /** The three axis labels: start, midpoint, end. */
  labels(): [string, string, string];
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/* Rungs a reader can reason about. Anything finer than a minute is noise at
   these track widths; anything coarser than a week outruns the presets. */
const SNAP_LADDER_MINUTES = [1, 5, 15, 30, 60, 180, 360, 720, 1440, 10_080];

const MONTH_NAMES = [
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

/** Largest ladder rung at or below span/200, so a full drag is ~200 steps. */
function snapMinutesFor(spanMs: number): number {
  const target = spanMs / 200 / MINUTE_MS;
  let chosen = SNAP_LADDER_MINUTES[0]!;
  for (const rung of SNAP_LADDER_MINUTES) {
    if (rung <= target) chosen = rung;
  }
  return chosen;
}

/* Granularity follows the span: months across a year, days across a week,
   clock time within a day. The year case must render "Jan 2024" / "Jul" /
   "Dec" — those were hard-coded in the template and are pinned by tests. */
function formatTick(ms: number, spanMs: number, withYear: boolean): string {
  const zdt = Temporal.Instant.fromEpochMilliseconds(
    Math.round(ms),
  ).toZonedDateTimeISO(ZONE);
  if (spanMs >= 60 * DAY_MS) {
    const month = MONTH_NAMES[zdt.month - 1]!;
    return withYear ? `${month} ${zdt.year}` : month;
  }
  if (spanMs >= 2 * DAY_MS) {
    return `${zdt.day} ${MONTH_NAMES[zdt.month - 1]!}`;
  }
  const hh = String(zdt.hour).padStart(2, "0");
  const mm = String(zdt.minute).padStart(2, "0");
  return `${hh}:${mm}`;
}

function msToZoned(ms: number): string {
  return Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(ZONE)
    .toString();
}

export function createTimelineScale(
  startMs: number,
  endMs: number,
): TimelineScale {
  const spanMs = Math.max(1, endMs - startMs);
  const snapMinutes = snapMinutesFor(spanMs);
  const snapMs = snapMinutes * MINUTE_MS;
  const clamp = (ms: number) => Math.max(startMs, Math.min(endMs, ms));

  return {
    startMs,
    endMs,
    snapMinutes,

    toPercent(iso) {
      try {
        const ms = toInstant(iso).epochMilliseconds;
        return Math.max(0, Math.min(100, ((ms - startMs) / spanMs) * 100));
      } catch {
        return NaN;
      }
    },

    fromPercent(percent) {
      const pct = Math.max(0, Math.min(100, percent));
      const rawMs = startMs + (pct / 100) * spanMs;
      return msToZoned(clamp(Math.round(rawMs / snapMs) * snapMs));
    },

    step(iso, steps) {
      try {
        const ms = toInstant(iso).epochMilliseconds + steps * snapMs;
        return msToZoned(clamp(ms));
      } catch {
        return iso;
      }
    },

    labels() {
      return [
        formatTick(startMs, spanMs, true),
        formatTick(startMs + spanMs / 2, spanMs, false),
        formatTick(endMs, spanMs, false),
      ];
    },
  };
}

/** The presets' canvas, and the widget's default. */
export const FIXED_YEAR_SCALE = createTimelineScale(START_MS, END_MS);

/** Breathing room each side of fitted data, so handles are draggable. */
const FIT_PADDING = 0.1;

/**
 * A canvas that comfortably holds `values`, or `null` when there is not enough
 * parseable input to fit one — in which case the caller keeps the canvas it has
 * rather than showing an arbitrary one.
 */
export function fitTimelineScale(
  values: readonly string[],
): TimelineScale | null {
  const stamps: number[] = [];
  for (const value of values) {
    try {
      stamps.push(toInstant(value).epochMilliseconds);
    } catch {
      /* An unparseable field shouldn't stop the others from framing the view. */
    }
  }
  if (stamps.length < 2) return null;

  const min = Math.min(...stamps);
  const max = Math.max(...stamps);
  const rawSpan = max - min;
  // Four identical instants still need a canvas with width.
  const pad = rawSpan === 0 ? 30 * MINUTE_MS : rawSpan * FIT_PADDING;
  return createTimelineScale(min - pad, max + pad);
}

// ---------------------------------------------------------------------------
// Relationship presets — set positions only; results always come from the
// real library, never from a hand-computed expected value (that's exactly
// what drifted in the packages/gmt JSDoc @examples).
// ---------------------------------------------------------------------------

export type RelationshipPreset =
  | "overlapping"
  | "disjoint"
  | "a-contains-b"
  | "identical"
  | "adjacent";

export interface RelationshipPresetInfo {
  type: RelationshipPreset;
  label: string;
  description: string;
}

export const RELATIONSHIP_PRESETS: RelationshipPresetInfo[] = [
  {
    type: "overlapping",
    label: "Partial overlap",
    description: "A and B overlap in the middle, each extends past the other.",
  },
  {
    type: "disjoint",
    label: "Disjoint (no overlap)",
    description: "A and B share no time at all.",
  },
  {
    type: "a-contains-b",
    label: "A contains B",
    description: "B sits entirely inside A.",
  },
  {
    type: "identical",
    label: "Identical intervals",
    description: "A and B are the exact same span.",
  },
  {
    type: "adjacent",
    label: "Adjacent (touching)",
    description:
      "A ends the instant B starts — they share one instant but don't overlap.",
  },
];

function isoDate(date: string): string {
  return `${date}T00:00:00+00:00[UTC]`;
}

/** Build the four ISO endpoints for a relationship preset. */
export function buildRelationshipPreset(preset: RelationshipPreset): {
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
} {
  switch (preset) {
    case "overlapping":
      return {
        aStart: isoDate("2024-01-01"),
        aEnd: isoDate("2024-06-30"),
        bStart: isoDate("2024-04-01"),
        bEnd: isoDate("2024-12-31"),
      };
    case "disjoint":
      return {
        aStart: isoDate("2024-01-01"),
        aEnd: isoDate("2024-03-01"),
        bStart: isoDate("2024-06-01"),
        bEnd: isoDate("2024-09-01"),
      };
    case "a-contains-b":
      return {
        aStart: isoDate("2024-01-01"),
        aEnd: isoDate("2024-12-31"),
        bStart: isoDate("2024-04-01"),
        bEnd: isoDate("2024-06-01"),
      };
    case "identical":
      return {
        aStart: isoDate("2024-01-01"),
        aEnd: isoDate("2024-12-31"),
        bStart: isoDate("2024-01-01"),
        bEnd: isoDate("2024-12-31"),
      };
    case "adjacent":
      return {
        aStart: isoDate("2024-01-01"),
        aEnd: isoDate("2024-07-01"),
        bStart: isoDate("2024-07-01"),
        bEnd: isoDate("2024-12-31"),
      };
  }
}

// ---------------------------------------------------------------------------
// Relationship classification — geometric only (instant comparisons), never
// asserts a specific numeric result. Used to drive the explanation aside.
// ---------------------------------------------------------------------------

export type RelationshipKind =
  | "invalid"
  | "identical"
  | "disjoint"
  | "adjacent"
  | "a-contains-b"
  | "b-contains-a"
  | "overlapping";

/**
 * Classify the geometric relationship between two intervals by comparing
 * instants only — never by predicting what a specific interval function
 * would return, so this can't drift the way the library's JSDoc examples did.
 */
export function classifyRelationship(
  a: ZonedInterval,
  b: ZonedInterval,
): RelationshipKind {
  let aS: Temporal.Instant,
    aE: Temporal.Instant,
    bS: Temporal.Instant,
    bE: Temporal.Instant;
  try {
    aS = toInstant(a.start);
    aE = toInstant(a.end);
    bS = toInstant(b.start);
    bE = toInstant(b.end);
  } catch {
    return "invalid";
  }

  const cmp = Temporal.Instant.compare;
  if (cmp(aS, aE) > 0 || cmp(bS, bE) > 0) return "invalid";

  if (cmp(aS, bS) === 0 && cmp(aE, bE) === 0) return "identical";
  if (cmp(bS, aS) >= 0 && cmp(bE, aE) <= 0) return "a-contains-b";
  if (cmp(aS, bS) >= 0 && cmp(aE, bE) <= 0) return "b-contains-a";
  if (cmp(aE, bS) < 0 || cmp(bE, aS) < 0) return "disjoint";
  if (cmp(aE, bS) === 0 || cmp(bE, aS) === 0) return "adjacent";
  return "overlapping";
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * Human-readable rendering of a zoned instant: "2024-04-01 00:00:00", with a
 * trimmed fractional-second suffix only when one is present (the interior
 * boundaries difference/xor compute are ±1ns — that precision matters when
 * it's there, and is noise when it isn't).
 */
export function formatInstant(iso: string): string {
  try {
    const zdt = toInstant(iso).toZonedDateTimeISO(ZONE);
    const base = `${pad(zdt.year, 4)}-${pad(zdt.month, 2)}-${pad(zdt.day, 2)} ${pad(zdt.hour, 2)}:${pad(zdt.minute, 2)}:${pad(zdt.second, 2)}`;
    const ns =
      zdt.millisecond * 1_000_000 + zdt.microsecond * 1_000 + zdt.nanosecond;
    if (ns === 0) return base;
    const frac = pad(ns, 9).replace(/0+$/, "");
    return `${base}.${frac}`;
  } catch {
    return iso;
  }
}

export function formatInterval(v: ZonedInterval | null): string {
  if (!v) return "";
  return `${formatInstant(v.start)} → ${formatInstant(v.end)}`;
}

export function formatIntervalList(list: ZonedInterval[]): string {
  return list.map(formatInterval).join("\n");
}

// ---------------------------------------------------------------------------
// Operation metadata
// ---------------------------------------------------------------------------

export type IntervalOperationId =
  | "intersection"
  | "union"
  | "difference"
  | "xor";

export interface IntervalOperationInfo {
  id: IntervalOperationId;
  label: string;
  fnName: string;
  /** Whether the real function returns an array (difference/xor) vs a single value-or-null. */
  isArray: boolean;
}

export const INTERVAL_OPERATIONS: IntervalOperationInfo[] = [
  {
    id: "intersection",
    label: "Intersection",
    fnName: "intervalIntersectionZoned",
    isArray: false,
  },
  { id: "union", label: "Union", fnName: "intervalUnionZoned", isArray: false },
  {
    id: "difference",
    label: "Difference (A − B)",
    fnName: "intervalDifferenceZoned",
    isArray: true,
  },
  {
    id: "xor",
    label: "Symmetric difference (XOR)",
    fnName: "intervalXorZoned",
    isArray: true,
  },
];
