/**
 * Pure helpers for the DST Transition Inspector widget.
 *
 * Extracted from DstInspector.astro so they can be unit-tested without jsdom.
 */

import { Temporal } from "@js-temporal/polyfill";

export interface DstTransition {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

// ---------------------------------------------------------------------------
// Offset parsing
// ---------------------------------------------------------------------------

/**
 * Parse an ISO 8601 offset string ("+HH:MM" / "-HH:MM") into signed minutes.
 * Returns 0 for unrecognized input (never throws).
 */
export function parseOffsetMinutes(offset: string): number {
  const m = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

// ---------------------------------------------------------------------------
// Transition classification
// ---------------------------------------------------------------------------

/**
 * True if a transition is a spring-forward gap (offset increases, e.g. -05:00 → -04:00).
 */
export function isGap(t: DstTransition): boolean {
  return parseOffsetMinutes(t.offsetAfter) > parseOffsetMinutes(t.offsetBefore);
}

/**
 * True if a transition is a fall-back overlap (offset decreases, e.g. -04:00 → -05:00).
 */
export function isOverlap(t: DstTransition): boolean {
  return parseOffsetMinutes(t.offsetAfter) < parseOffsetMinutes(t.offsetBefore);
}

/**
 * Human-readable label for a transition type.
 */
export function transitionType(t: DstTransition): "gap" | "overlap" {
  return isGap(t) ? "gap" : "overlap";
}

// ---------------------------------------------------------------------------
// Local-hour computation (zone-aware, replaces UTC-only transitionHour)
// ---------------------------------------------------------------------------

/**
 * Get the local hour at which a transition occurs in the given zone.
 * Uses Temporal to convert the UTC instant to local wall-clock time.
 * Returns NaN for invalid input (never throws).
 */
export function localHourAtTransition(
  t: DstTransition,
  timeZone: string,
): number {
  try {
    const instant = Temporal.Instant.from(t.instant);
    const zdt = instant.toZonedDateTimeISO(timeZone);
    return zdt.hour;
  } catch {
    return NaN;
  }
}

/**
 * Get the local date (YYYY-MM-DD) of a transition in the given zone.
 * Returns null for invalid input.
 */
export function localDateAtTransition(
  t: DstTransition,
  timeZone: string,
): string | null {
  try {
    const instant = Temporal.Instant.from(t.instant);
    const zdt = instant.toZonedDateTimeISO(timeZone);
    return `${zdt.year}-${String(zdt.month).padStart(2, "0")}-${String(zdt.day).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

/**
 * Get the local minute-of-day (0-1439) at which a transition occurs in the
 * given zone. Returns NaN for invalid input (never throws).
 *
 * Minute precision matters: not every zone shifts by a whole hour (Lord Howe
 * Island shifts 30 minutes), so the hour-only reading loses the boundary.
 */
export function localMinuteOfDayAtTransition(
  t: DstTransition,
  timeZone: string,
): number {
  try {
    const instant = Temporal.Instant.from(t.instant);
    const zdt = instant.toZonedDateTimeISO(timeZone);
    return zdt.hour * 60 + zdt.minute;
  } catch {
    return NaN;
  }
}

/**
 * Get the UTC hour from a transition's instant.
 * Kept for backwards compatibility; prefer localHourAtTransition for visual positioning.
 */
export function transitionHour(t: DstTransition): number {
  return new Date(t.instant).getUTCHours();
}

/**
 * Format a minute-of-day as a zero-padded 24-hour "HH:MM" label.
 */
export function formatMinuteOfDay(minute: number): string {
  if (!Number.isFinite(minute)) return "--:--";
  const clamped = Math.max(0, Math.min(1439, Math.round(minute)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Ticker window (the scrubbable local-time range around a transition)
// ---------------------------------------------------------------------------

/**
 * The local-time range a ticker scrubs over, in minutes-of-day.
 *
 * The zone* pair bounds the local times that either never occur (gap) or occur
 * twice (overlap); the window* pair adds padding on both sides so the reader
 * can scrub in and out of that range.
 */
export interface TickerWindow {
  /** Start of the void/doubled zone (inclusive) */
  zoneStartMinutes: number;
  /** End of the void/doubled zone (exclusive) */
  zoneEndMinutes: number;
  /** Padded scrub range start */
  windowStartMinutes: number;
  /** Padded scrub range end */
  windowEndMinutes: number;
}

/**
 * Compute the scrubbable window around a transition.
 *
 * The zone width comes from the transition's real offset delta rather than a
 * hardcoded hour, so sub-hour DST shifts size correctly.
 *
 * Returns null if the instant/zone is unreadable, the offsets don't differ, or
 * clamping to a single calendar day collapses the zone.
 */
export function getTickerWindow(
  t: DstTransition,
  timeZone: string,
  paddingMinutes = 30,
): TickerWindow | null {
  const deltaMinutes =
    parseOffsetMinutes(t.offsetAfter) - parseOffsetMinutes(t.offsetBefore);
  if (deltaMinutes === 0) return null;

  const boundary = localMinuteOfDayAtTransition(t, timeZone);
  if (Number.isNaN(boundary)) return null;

  // A gap's skipped range runs backwards from the post-transition reading; an
  // overlap's repeated range runs forwards from it.
  const width = Math.abs(deltaMinutes);
  const zoneStartMinutes = deltaMinutes > 0 ? boundary - width : boundary;
  const zoneEndMinutes = zoneStartMinutes + width;

  const clampedStart = Math.max(0, zoneStartMinutes);
  const clampedEnd = Math.min(1439, zoneEndMinutes);
  if (clampedEnd <= clampedStart) return null;

  return {
    zoneStartMinutes: clampedStart,
    zoneEndMinutes: clampedEnd,
    windowStartMinutes: Math.max(0, clampedStart - paddingMinutes),
    windowEndMinutes: Math.min(1439, clampedEnd + paddingMinutes),
  };
}

/**
 * True if a local minute-of-day falls inside the void/doubled zone.
 * Start-inclusive, end-exclusive.
 */
export function isMinuteInZone(
  minuteOfDay: number,
  window: TickerWindow,
): boolean {
  return (
    minuteOfDay >= window.zoneStartMinutes &&
    minuteOfDay < window.zoneEndMinutes
  );
}

/**
 * Map a local minute-of-day to a 0-100 position within the ticker's window.
 */
export function minuteToTickerPercent(
  minuteOfDay: number,
  window: TickerWindow,
): number {
  const span = window.windowEndMinutes - window.windowStartMinutes;
  if (span <= 0) return 0;
  const pct = ((minuteOfDay - window.windowStartMinutes) / span) * 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Map a 0-100 ticker position back to a local minute-of-day, snapped to the
 * nearest step and clamped to the window.
 */
export function tickerPercentToMinute(
  percent: number,
  window: TickerWindow,
  stepMinutes = 5,
): number {
  const span = window.windowEndMinutes - window.windowStartMinutes;
  const clampedPct = Math.max(0, Math.min(100, percent));
  const raw = window.windowStartMinutes + (clampedPct / 100) * span;
  const snapped = Math.round(raw / stepMinutes) * stepMinutes;
  return Math.max(
    window.windowStartMinutes,
    Math.min(window.windowEndMinutes, snapped),
  );
}

/**
 * Tick spacing that keeps a ticker to a handful of readable labels.
 */
export function getTickerTickStepMinutes(window: TickerWindow): number {
  const span = window.windowEndMinutes - window.windowStartMinutes;
  return span <= 120 ? 15 : 30;
}

// ---------------------------------------------------------------------------
// Probe value builder
// ---------------------------------------------------------------------------

/**
 * Build a startOfZoned value string from an explicit local date and
 * minute-of-day.
 *
 * Returns "" for a malformed date or an out-of-range minute.
 */
export function buildZonedValueFromMinutes(
  zone: string,
  localDate: string,
  minuteOfDay: number,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return "";
  if (!Number.isFinite(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= 1440) {
    return "";
  }

  const rounded = Math.round(minuteOfDay);
  const h = String(Math.floor(rounded / 60)).padStart(2, "0");
  const m = String(rounded % 60).padStart(2, "0");
  return `${localDate}T${h}:${m}:00[${zone}]`;
}

// ---------------------------------------------------------------------------
// Probe result classification
// ---------------------------------------------------------------------------

/**
 * Result of classifying a startOfZoned probe result against a transition.
 */
export interface ProbeClassification {
  /** "gap" if the probe hour falls in a spring-forward gap, "overlap" for fall-back, "normal" otherwise */
  type: "gap" | "overlap" | "normal";
  /** Plain-language explanation of what happened */
  explanation: string;
}

/**
 * Classify a startOfZoned result to explain what the probe hour experienced.
 *
 * - If result is sentinel (""): checks whether disambiguation=reject or offset=prefer made it fail.
 * - If result is normal: determines whether the probe hour falls in a gap, overlap, or normal time
 *   by comparing the probe hour against each transition's local hour.
 */
export function classifyProbeResult(
  result: string,
  transitions: DstTransition[],
  probeHour: number,
  zone: string,
  options?: { disambiguation?: string; offset?: string },
): ProbeClassification {
  // Sentinel case: startOfZoned returned ""
  if (result === "") {
    const dis = options?.disambiguation ?? "compatible";
    const off = options?.offset ?? "ignore";

    // Find the closest transition within 1 hour of the probe hour
    let nearbyTransition: DstTransition | undefined;
    let bestDist = Infinity;
    for (const t of transitions) {
      const lh = localHourAtTransition(t, zone);
      const dist = Math.abs(lh - probeHour);
      if (dist <= 1 && dist < bestDist) {
        bestDist = dist;
        nearbyTransition = t;
      }
    }

    if (dis === "reject" && nearbyTransition) {
      const overlap = isOverlap(nearbyTransition);
      return {
        type: overlap ? "overlap" : "gap",
        explanation: `disambiguation="reject" caused the start-of-hour boundary to fail — the probe hour lands in a ${overlap ? "fall-back overlap" : "spring-forward gap"}.`,
      };
    }

    if (off === "prefer" && dis === "reject") {
      return {
        type: "normal",
        explanation: `offset:"prefer" makes disambiguation inert — the source offset is still valid after reset, so "reject" never fires. Try offset:"ignore" to see disambiguation take effect.`,
      };
    }

    return {
      type: "normal",
      explanation: `startOfZoned returned an empty result for this input.`,
    };
  }

  // Normal case: find the closest transition within 0.5 hour of the probe hour
  let closestT: DstTransition | undefined;
  let closestDist = Infinity;
  for (const t of transitions) {
    const lh = localHourAtTransition(t, zone);
    const dist = Math.abs(lh - probeHour);
    if (dist <= 0.5 && dist < closestDist) {
      closestDist = dist;
      closestT = t;
    }
  }
  if (closestT) {
    if (isGap(closestT)) {
      return {
        type: "gap",
        explanation: `The probe hour (${probeHour}:00) falls in the spring-forward gap. Local time jumps from ${closestT.offsetBefore} to ${closestT.offsetAfter} — that hour doesn't exist.`,
      };
    }
    if (isOverlap(closestT)) {
      return {
        type: "overlap",
        explanation: `The probe hour (${probeHour}:00) falls in the fall-back overlap. Local time ${probeHour}:00 happens twice — once with offset ${closestT.offsetBefore}, once with ${closestT.offsetAfter}.`,
      };
    }
  }

  return {
    type: "normal",
    explanation: `The probe hour (${probeHour}:00) is normal wall-clock time — no DST transition affects it.`,
  };
}

// ---------------------------------------------------------------------------
// Value preset generators for startOfZoned
// ---------------------------------------------------------------------------

/**
 * Preset value types for the startOfZoned value dropdown.
 */
export type ValuePreset = "normal" | "gap" | "overlap" | "transition";

/**
 * Metadata about a value preset for display purposes.
 */
export interface ValuePresetInfo {
  /** The preset type identifier */
  type: ValuePreset;
  /** Display label for the dropdown */
  label: string;
  /** Description of what this preset demonstrates */
  description: string;
}

/**
 * All available value preset definitions.
 */
export const VALUE_PRESETS: ValuePresetInfo[] = [
  {
    type: "normal",
    label: "Normal time (non-transition)",
    description:
      "A regular date/time with no DST transition — always resolves successfully.",
  },
  {
    type: "gap",
    label: "Gap hour (nonexistent)",
    description:
      "A local hour that was skipped during spring-forward — requires disambiguation.",
  },
  {
    type: "overlap",
    label: "Overlap hour (ambiguous)",
    description:
      "A local hour that occurs twice during fall-back — ambiguous without disambiguation.",
  },
  {
    type: "transition",
    label: "Exact transition instant",
    description:
      "The UTC instant of the DST transition itself — edge case for offset handling.",
  },
];

/**
 * Build a startOfZoned value string based on the preset type, zone, and transitions.
 *
 * - "normal": picks a date 2 weeks after the first transition (always valid)
 * - "gap": uses the local hour that gets skipped during spring-forward
 * - "overlap": uses the local hour that occurs twice during fall-back
 * - "transition": uses the UTC instant of the first transition
 *
 * Returns "" if no transitions exist or the preset cannot be generated.
 */
export function buildValuePreset(
  preset: ValuePreset,
  zone: string,
  transitions: DstTransition[],
): string {
  if (transitions.length === 0) return "";

  const first = transitions[0];
  const firstDate = localDateAtTransition(first, zone);
  if (!firstDate) return "";

  switch (preset) {
    case "normal": {
      // Pick a date 14 days after the first transition's local date
      const [y, m, d] = firstDate.split("-").map(Number);
      const nextDate = new Date(Date.UTC(y, m - 1, d + 14));
      const padded = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
      return `${padded}T12:00:00[${zone}]`;
    }

    case "gap": {
      // Find the spring-forward transition and use the skipped hour on its date
      const gapTrans = transitions.find(isGap);
      const refTrans = gapTrans ?? first;
      const dateStr = localDateAtTransition(refTrans, zone) ?? firstDate;
      if (!gapTrans) {
        // Fallback: use hour 3 (common for US zones)
        return `${dateStr}T03:00:00[${zone}]`;
      }
      const gapMinute = localMinuteOfDayAtTransition(gapTrans, zone);
      if (Number.isNaN(gapMinute)) return `${dateStr}T03:00:00[${zone}]`;
      return buildZonedValueFromMinutes(zone, dateStr, gapMinute);
    }

    case "overlap": {
      // Find the fall-back transition and use the ambiguous hour on its date
      const overlapTrans = transitions.find(isOverlap);
      const refTrans = overlapTrans ?? first;
      const dateStr = localDateAtTransition(refTrans, zone) ?? firstDate;
      if (!overlapTrans) {
        // Fallback: use hour 1 (common for US zones)
        return `${dateStr}T01:00:00[${zone}]`;
      }
      const overlapMinute = localMinuteOfDayAtTransition(overlapTrans, zone);
      if (Number.isNaN(overlapMinute)) return `${dateStr}T01:00:00[${zone}]`;
      return buildZonedValueFromMinutes(zone, dateStr, overlapMinute);
    }

    case "transition": {
      // Use the UTC instant of the first transition
      try {
        const instant = Temporal.Instant.from(first.instant);
        const zdt = instant.toZonedDateTimeISO(zone);
        return zdt.toString();
      } catch {
        return `${firstDate}T00:00:00[${zone}]`;
      }
    }

    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Sentinel detection
// ---------------------------------------------------------------------------

/**
 * Detect if a startOfZoned result is the sentinel (empty string = invalid/reject).
 */
export function isSentinel(result: string): boolean {
  return result === "";
}
