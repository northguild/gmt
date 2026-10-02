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
// Local-time computation (zone-aware)
// ---------------------------------------------------------------------------

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
 * The middle of the void/doubled zone, as a local minute-of-day: 02:30 for a
 * 02:00 to 03:00 gap. Where a probe starts, so it starts inside the zone.
 */
export function zoneMidpointMinutes(window: TickerWindow): number {
  return Math.floor((window.zoneStartMinutes + window.zoneEndMinutes) / 2);
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

/** Steps a ticker may thin to, in minutes, finest first. */
const TICK_STEPS = [15, 30, 60, 120, 240, 360, 720, 1440];

/**
 * The minutes that get a tick label, thinned so that no two labels collide.
 *
 * Starts from `getTickerTickStepMinutes` and coarsens through 30, 60, 120 ...
 * minutes until neighbouring ticks are at least `minPitchPx` apart on a track
 * `trackPx` wide (the default fits a `HH:MM` label at 12px mono, plus a gap).
 * Ticks stay on multiples of the step, so the labels read as round times. With
 * an unmeasured track (`trackPx <= 0`, e.g. before layout) the base step is
 * used. A window with no multiple of the chosen step still gets one tick, at
 * its start, so the ticker is never unlabelled.
 */
export function selectTickMinutes(
  window: TickerWindow,
  trackPx: number,
  minPitchPx = 48,
): number[] {
  const span = window.windowEndMinutes - window.windowStartMinutes;
  const base = getTickerTickStepMinutes(window);
  let step = base;
  if (trackPx > 0 && span > 0) {
    step =
      TICK_STEPS.find((s) => s >= base && (s / span) * trackPx >= minPitchPx) ??
      TICK_STEPS[TICK_STEPS.length - 1]!;
  }
  const ticks: number[] = [];
  for (
    let m = Math.ceil(window.windowStartMinutes / step) * step;
    m <= window.windowEndMinutes;
    m += step
  ) {
    ticks.push(m);
  }
  return ticks.length > 0 ? ticks : [window.windowStartMinutes];
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

/**
 * Strip a `[zone]` suffix and any embedded UTC offset from a zoned value
 * string, leaving the plain local wall-clock time (`YYYY-MM-DDTHH:MM:SS`).
 *
 * `convertPlainDateTimeToZoned` takes a *plain* datetime with no offset — it
 * resolves the wall time itself via `disambiguation`. Handing it a string that
 * already carries an offset or `[zone]` is not the widget's probe shape (that
 * belongs to `Temporal.ZonedDateTime.from`), so this always removes both
 * regardless of which one is present.
 */
export function toPlainLocalDateTime(value: string): string {
  const withoutZone = value.replace(/\[[^\]]*\]$/, "");
  return withoutZone.replace(/(?:Z|[+-]\d{2}:\d{2})$/, "");
}

/**
 * What a probe's plain wall time (`YYYY-MM-DDTHH:MM[:SS]`) sits next to: the
 * transitions on its local date, and its local time in hours (2.5 is 02:30).
 *
 * Any probe can land in a transition's range, not only a scrubbed one. In the
 * southern hemisphere the "Exact transition instant" preset reads the
 * fall-back's own wall time, which is the start of the repeated hour, so a
 * preset cannot be assumed normal. `probeHour` is NaN for a value that is not a
 * plain wall time.
 */
export function probeContext(
  plainValue: string,
  transitions: DstTransition[],
  zone: string,
): { onDate: DstTransition[]; probeHour: number } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(plainValue);
  if (!m) return { onDate: [], probeHour: NaN };
  return {
    onDate: transitions.filter((t) => localDateAtTransition(t, zone) === m[1]),
    probeHour: Number(m[2]) + Number(m[3]) / 60,
  };
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
 * Classify a `convertPlainDateTimeToZoned` result to explain what the probe
 * wall time experienced.
 *
 * `transitions` are the transitions on the probed date, and `probeHour` is the
 * probed local time in hours, fractions allowed (2.5 is 02:30). The time is in
 * a gap or an overlap when it falls inside that transition's skipped or
 * repeated range, start included and end excluded: New York's spring-forward
 * skips 02:00 up to 03:00, so 02:59 is in the gap and 03:00 is not.
 *
 * - If result is sentinel (""): `disambiguation: "reject"` refused a time that
 *   is in a gap or an overlap.
 * - If result is normal: says whether the time was in a gap, an overlap or
 *   neither.
 */
export function classifyProbeResult(
  result: string,
  transitions: DstTransition[],
  probeHour: number,
  zone: string,
  options?: { disambiguation?: string },
): ProbeClassification {
  const probeMinute = Math.round(probeHour * 60);
  const hit = transitions.find((t) => {
    const window = getTickerWindow(t, zone);
    return window !== null && isMinuteInZone(probeMinute, window);
  });
  const probed = Number.isFinite(probeMinute)
    ? formatMinuteOfDay(probeMinute)
    : "";

  // Sentinel case: convertPlainDateTimeToZoned returned ""
  if (result === "") {
    const dis = options?.disambiguation ?? "compatible";

    if (dis === "reject" && hit) {
      const overlap = isOverlap(hit);
      return {
        type: overlap ? "overlap" : "gap",
        explanation: overlap
          ? `disambiguation="reject" rejected this wall time — it is ambiguous (a fall-back overlap: the same local time happens twice).`
          : `disambiguation="reject" rejected this wall time — it does not exist (a spring-forward gap: that local time is skipped).`,
      };
    }

    return {
      type: "normal",
      explanation: `convertPlainDateTimeToZoned returned an empty result for this input.`,
    };
  }

  if (hit && isGap(hit)) {
    return {
      type: "gap",
      explanation: `${probed} falls in the spring-forward gap. Local time jumps from ${hit.offsetBefore} to ${hit.offsetAfter}, so that time does not exist.`,
    };
  }
  if (hit && isOverlap(hit)) {
    return {
      type: "overlap",
      explanation: `${probed} falls in the fall-back overlap. It happens twice: once with offset ${hit.offsetBefore}, once with ${hit.offsetAfter}.`,
    };
  }

  return {
    type: "normal",
    explanation: `${probed || "This"} is normal wall-clock time — no DST transition affects it.`,
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
      const [y, m, d] = firstDate.split("-").map(Number) as [
        number,
        number,
        number,
      ];
      const nextDate = Temporal.PlainDate.from({
        year: y,
        month: m,
        day: d,
      }).add({ days: 14 });
      return `${nextDate.toString()}T12:00:00[${zone}]`;
    }

    case "gap": {
      // Find the spring-forward transition and use the middle of the skipped
      // range on its date. The transition's own local reading (03:00 in New
      // York) is the first time that exists again, not a skipped one.
      const gapTrans = transitions.find(isGap);
      const refTrans = gapTrans ?? first;
      const dateStr = localDateAtTransition(refTrans, zone) ?? firstDate;
      if (!gapTrans) {
        // Fallback: use hour 3 (common for US zones)
        return `${dateStr}T03:00:00[${zone}]`;
      }
      const gapWindow = getTickerWindow(gapTrans, zone);
      if (!gapWindow) return `${dateStr}T03:00:00[${zone}]`;
      return buildZonedValueFromMinutes(
        zone,
        dateStr,
        zoneMidpointMinutes(gapWindow),
      );
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
