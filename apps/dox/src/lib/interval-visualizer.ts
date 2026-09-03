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

const START_MS = Temporal.Instant.from(TIMELINE_START).epochMilliseconds;
const END_MS = Temporal.Instant.from(TIMELINE_END).epochMilliseconds;
const SPAN_MS = END_MS - START_MS;

/**
 * Map a zoned ISO instant to a 0-100 position on the fixed 2024 timeline.
 * Clamped to the window. Returns NaN for unparseable input (never throws).
 */
export function instantToPercent(iso: string): number {
  try {
    const ms = Temporal.Instant.from(iso).epochMilliseconds;
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
    const instant = Temporal.Instant.from(iso);
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
    aS = Temporal.Instant.from(a.start);
    aE = Temporal.Instant.from(a.end);
    bS = Temporal.Instant.from(b.start);
    bE = Temporal.Instant.from(b.end);
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
    const zdt = Temporal.Instant.from(iso).toZonedDateTimeISO(ZONE);
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
