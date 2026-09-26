/**
 * Pure helpers for the Crossing Clock widget (TRAN-9): `crossingTime`'s exact
 * elapsed hours, beside the naive wall-clock subtraction that is an hour off
 * across a DST transition.
 *
 * The one naive value here is `naiveWallDifference`: the printed `HH:MM` at
 * either end, subtracted with no zone and no DST — the reading a paper
 * logbook would give. Every elapsed duration, every ruler tick's local time
 * and every DST-transition read comes from the real `crossingTime` and the
 * polyfill's zoned rendering, never from arithmetic of its own.
 *
 * No DOM and no gmt import: `TransportLib` comes in from the mount.
 */

import { Temporal } from "@js-temporal/polyfill";
import { formatDayLabel } from "./dwell-ledger";
import {
  TRANSPORT_ZONES,
  epochMs,
  minutesText,
  type Crossing,
  type TransportLib,
} from "./transport-widgets";
import { escapeHtml } from "./widget-ui";

/** Fixed offsets, offered only here: the one widget that specifically
 *  teaches that a fixed offset observes no DST. */
export const FIXED_OFFSET_ZONES: readonly string[] = ["+02:00", "-05:00"];

export const CROSSING_ZONES: readonly string[] = [
  ...TRANSPORT_ZONES,
  ...FIXED_OFFSET_ZONES,
];

export interface CrossingState {
  entry: string;
  exit: string;
  targetZone: string;
}

export interface CrossingClockArgs {
  entry?: string;
  exit?: string;
  targetZone?: string;
}

export const CUSTOM_PRESET_ID = "custom";

export interface CrossingPreset {
  id: string;
  label: string;
  description: string;
  state: CrossingState;
}

/** Every preset is a section 9 row, so the result the widget shows is a
 *  verified value. The two clock-change cases lead (owner review — a
 *  skipped or repeated hour is the tool's main lesson, and the first one
 *  is the widget's default, unseeded state), each opening its description
 *  by naming the lesson rather than the numbers. */
export const CROSSING_PRESETS: readonly CrossingPreset[] = [
  {
    id: "spring-forward",
    label: "Skipped hour: seven hours across New York's spring-forward",
    description:
      "The clocks jump from 02:00 to 03:00 during this crossing, skipping an hour entirely. Seven hours actually pass; subtracting the wall clocks (00:00 to 08:00) says eight.",
    state: {
      entry: "2024-03-10T05:00:00Z",
      exit: "2024-03-10T12:00:00Z",
      targetZone: "America/New_York",
    },
  },
  {
    id: "fall-back",
    label:
      "Added hour: one hour across New York's fall-back, both ends read 01:30",
    description:
      "The clocks fall back from 02:00 to 01:00, so 01:00–02:00 happens twice. One hour actually passes, but both ends read 01:30, so subtracting the wall clocks says zero.",
    state: {
      entry: "2024-11-03T05:30:00Z",
      exit: "2024-11-03T06:30:00Z",
      targetZone: "America/New_York",
    },
  },
  {
    id: "fixed-offset",
    label: "The same spring-forward night on a fixed −05:00",
    description:
      "The same seven hours, read on a fixed −05:00 instead of New York's own clock. A fixed offset observes no DST, so the wall-clock subtraction agrees with the elapsed time.",
    state: {
      entry: "2024-03-10T05:00:00Z",
      exit: "2024-03-10T12:00:00Z",
      targetZone: "-05:00",
    },
  },
  {
    id: "canal",
    label: "A 9½-hour canal transit, read in Berlin",
    description:
      "A canal transit logged as two instants and read on Berlin's clock: nine and a half hours, start to finish.",
    state: {
      entry: "2024-06-15T08:00:00Z",
      exit: "2024-06-15T17:30:00Z",
      targetZone: "Europe/Berlin",
    },
  },
  {
    id: "read-elsewhere",
    label: "Logged in Berlin, read on the canal's clock in Panama",
    description:
      "Logged with Berlin's own offset in brackets, but a bracket in the input is never read: both ends are rendered on the canal authority's clock in Panama.",
    state: {
      entry: "2024-06-15T08:00:00+02:00[Europe/Berlin]",
      exit: "2024-06-15T17:30:00+02:00[Europe/Berlin]",
      targetZone: "America/Panama",
    },
  },
  {
    id: "inverted",
    label: "Exit before entry",
    description:
      "The exit is logged before the entry. That is a data error, not a negative transit: crossingTime returns null.",
    state: {
      entry: "2024-06-16T01:00:00Z",
      exit: "2024-06-15T22:30:00Z",
      targetZone: "Europe/London",
    },
  },
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function readArgs(args: CrossingClockArgs): CrossingState {
  return {
    entry: str(args.entry),
    exit: str(args.exit),
    targetZone: str(args.targetZone),
  };
}

export function matchPreset(state: CrossingState): string {
  const t = (s: string) => s.trim();
  const hit = CROSSING_PRESETS.find(
    (p) =>
      t(p.state.entry) === t(state.entry) &&
      t(p.state.exit) === t(state.exit) &&
      t(p.state.targetZone) === t(state.targetZone),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** The call's three positional arguments as source text, for `renderCallLine`
 *  — `entry, exit, targetZone` quoted, in that order. `plain` is what a copy
 *  button hands back; `html` wraps each in the same string-token span every
 *  other call line on the site uses. */
export function crossingCallSource(state: CrossingState): [string, string] {
  const values = [
    state.entry.trim(),
    state.exit.trim(),
    state.targetZone.trim(),
  ];
  const html = values
    .map(
      (v) =>
        `<span class="gmt-code-str">${escapeHtml(JSON.stringify(v))}</span>`,
    )
    .join(", ");
  const plain = values.map((v) => JSON.stringify(v)).join(", ");
  return [html, plain];
}

export function permalinkOf(state: CrossingState): Record<string, string> {
  const out: Record<string, string> = {};
  const field = (key: keyof CrossingState) => {
    const value = state[key].trim();
    if (value !== "") out[key] = value;
  };
  field("entry");
  field("exit");
  field("targetZone");
  return out;
}

// ---------------------------------------------------------------------------
// The naive wall-clock subtraction
// ---------------------------------------------------------------------------

/** The `YYYY-MM-DDTHH:MM` text before any offset or bracket. */
function writtenWallClock(text: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(text.trim());
  return m ? m[1]! : text.trim();
}

/**
 * The naive value: `enter` and `exit`'s own printed `HH:MM` — the zoned
 * strings `crossingTime` already rendered — read as plain wall times and
 * subtracted, in minutes. No zone, no offset, no DST: the reading a paper
 * logbook, one page per end, would give.
 */
export function naiveWallDifference(result: Crossing): number {
  const enter = Temporal.PlainDateTime.from(writtenWallClock(result.enter));
  const exit = Temporal.PlainDateTime.from(writtenWallClock(result.exit));
  return exit.since(enter, { largestUnit: "minutes" }).total("minutes");
}

/** The library's own `duration` (an ISO 8601 duration of hours, minutes and
 *  seconds), in minutes — reading the real elapsed time back, never a second
 *  computation of it. */
export function durationMinutes(duration: string): number {
  return Temporal.Duration.from(duration).total("minutes");
}

/** `"8 h: 1 h more than elapsed"`, `"0 min: 1 h less than elapsed"` or
 *  `"9 h 30 min: agrees"`. */
export function naiveText(
  elapsedMinutes: number,
  naiveMinutes: number,
): string {
  const naive = minutesText(naiveMinutes);
  const diff = Math.round(naiveMinutes - elapsedMinutes);
  if (diff === 0) return `${naive}: agrees`;
  return `${naive}: ${minutesText(diff)} ${diff > 0 ? "more" : "less"} than elapsed`;
}

// ---------------------------------------------------------------------------
// The crossing strip (owner review, after the first build: the chip-per-
// hour ruler read as "a massive amount of text" — replaced with one
// compact proportional bar, annotated only where the clock actually
// changes, rather than a label on every whole hour)
// ---------------------------------------------------------------------------

export interface CrossingChangeMarker {
  kind: "skip" | "repeat";
  /** 0–100: the transition instant's position along the entry→exit span.
   *  The jump itself is instantaneous in real time — only the wall clock
   *  moves — so this is a point on the bar, not a range. */
  percent: number;
  /** e.g. "02:00–03:00 never shown · clocks jumped to −04:00", or
   *  "01:00–02:00 shown twice · −04:00 then −05:00". */
  label: string;
  /** The affected wall-clock hour, chronologically ordered (`from` is
   *  always the smaller reading) — the same pair the label's own
   *  `HH:MM–HH:MM` is built from. Handed to `renderCrystalClock`'s
   *  `highlight` option to draw the matching sector on the dial. */
  fromHour: number;
  fromMinute: number;
  toHour: number;
  toMinute: number;
}

export interface CrossingStripTick {
  /** 0–100, proportional position along the bar. */
  percent: number;
  /** Elapsed-hour label shown below the tick, e.g. `"2h"`. Null for the
   *  entry (0 %) and exit (100 %) ticks — those positions are already named
   *  by the end labels on either side of the bar. */
  label: string | null;
}

export interface CrossingStrip {
  /** `HH:MM ±hh:mm`, the entry end. */
  entryLabel: string;
  /** `HH:MM ±hh:mm`, the exit end. */
  exitLabel: string;
  /** Hour ticks with proportional position and an elapsed-hour label for
   *  every intermediate tick. */
  ticks: readonly CrossingStripTick[];
  /** 1 normally; past 48 ticks, the hours a tick step advances, so a
   *  multi-day crossing doesn't draw hundreds of them. */
  stepHours: number;
  /** Empty on a crossing with no DST transition inside it — the caller
   *  renders "no clock change" instead of this list. */
  changes: readonly CrossingChangeMarker[];
  /** The bar's accessible name (visually hidden, kept as its
   *  `aria-labelledby` target) — not shown as on-page prose. */
  summary: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function endLabel(ms: number, targetZone: string): string {
  const zdt =
    Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(targetZone);
  return `${pad(zdt.hour)}:${pad(zdt.minute)} ${zdt.offset}`;
}

/** Proportional tick positions — real-time spacing so the bar is accurate
 *  rather than one chip per wall-clock hour. Every intermediate tick carries
 *  an elapsed-hour label; entry (0 %) and exit (100 %) are null because the
 *  end labels beside the bar already name them. */
function buildTicks(
  entryMs: number,
  exitMs: number,
  wholeHours: number,
  stepHours: number,
): CrossingStripTick[] {
  const span = exitMs - entryMs;
  if (span <= 0) return [{ percent: 0, label: null }];
  const ticks: CrossingStripTick[] = [];
  for (let h = 0; h <= wholeHours; h += stepHours) {
    const percent = ((h * 3_600_000) / span) * 100;
    ticks.push({ percent, label: h > 0 ? `${h}h` : null });
  }
  if (ticks.length === 0 || ticks[ticks.length - 1].percent !== 100) {
    ticks.push({ percent: 100, label: null });
  }
  return ticks;
}

function parseOffsetMinutesLocal(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Every DST transition inside the crossing, at most 4 — mirrors
 * `delivery-scheduler.ts`'s `dstTransitionsIn`, computed the same way from
 * `getTimeZoneTransition("next")` and the offset either side of it, never
 * from arithmetic of its own. A fixed offset (no transitions) or an
 * unrecognised zone yields none.
 */
function crossingChanges(
  entryMs: number,
  exitMs: number,
  targetZone: string,
): CrossingChangeMarker[] {
  const span = exitMs - entryMs;
  if (span <= 0) return [];
  try {
    let cur =
      Temporal.Instant.fromEpochMilliseconds(entryMs).toZonedDateTimeISO(
        targetZone,
      );
    const out: CrossingChangeMarker[] = [];
    for (let i = 0; i < 4; i++) {
      const next = cur.getTimeZoneTransition("next");
      if (!next || next.epochMilliseconds > exitMs) break;
      const gapMinutes =
        parseOffsetMinutesLocal(next.offset) -
        parseOffsetMinutesLocal(cur.offset);
      if (gapMinutes === 0) {
        cur = next;
        continue;
      }
      const after = next.toPlainTime();
      const before = after.subtract({ minutes: gapMinutes });
      const wall = (t: Temporal.PlainTime) => `${pad(t.hour)}:${pad(t.minute)}`;
      const percent = ((next.epochMilliseconds - entryMs) / span) * 100;
      // Chronological order regardless of direction: skip runs before→after
      // (02:00 then 03:00), repeat runs after→before (01:00 then 02:00) —
      // both are already "from the smaller wall reading to the larger one".
      const range = gapMinutes > 0 ? [before, after] : [after, before];
      out.push(
        gapMinutes > 0
          ? {
              kind: "skip",
              percent,
              label: `${wall(range[0]!)}–${wall(range[1]!)} never shown · clocks jumped to ${next.offset}`,
              fromHour: range[0]!.hour,
              fromMinute: range[0]!.minute,
              toHour: range[1]!.hour,
              toMinute: range[1]!.minute,
            }
          : {
              kind: "repeat",
              percent,
              label: `${wall(range[0]!)}–${wall(range[1]!)} shown twice · ${cur.offset} then ${next.offset}`,
              fromHour: range[0]!.hour,
              fromMinute: range[0]!.minute,
              toHour: range[1]!.hour,
              toMinute: range[1]!.minute,
            },
      );
      cur = next;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The whole crossing as a proportional bar: labelled ends, faint unlabelled
 * hour ticks, and a change marker at every DST transition inside the span.
 * Everything here reads the real `crossingTime` result and the polyfill's
 * own zoned rendering and transition search — nothing is computed from
 * wall-clock arithmetic.
 */
export function crossingStrip(
  result: Crossing,
  targetZone: string,
): CrossingStrip {
  const entryMs = epochMs(result.enter);
  const exitMs = epochMs(result.exit);
  const totalMinutes = Temporal.Duration.from(result.duration).total("minutes");
  const wholeHours = Math.floor(totalMinutes / 60);
  const stepHours = wholeHours > 48 ? Math.ceil(wholeHours / 48) : 1;

  const entryLabel = endLabel(entryMs, targetZone);
  const exitLabel = endLabel(exitMs, targetZone);
  const changes = crossingChanges(entryMs, exitMs, targetZone);
  const summary = `${entryLabel} to ${exitLabel}. ${
    changes.length
      ? changes.map((c) => c.label).join("; ")
      : "No clock change during the crossing — every hour showed once"
  }.`;

  return {
    entryLabel,
    exitLabel,
    ticks: buildTicks(entryMs, exitMs, wholeHours, stepHours),
    stepHours,
    changes,
    summary,
  };
}

// ---------------------------------------------------------------------------
// The crystal clocks
// ---------------------------------------------------------------------------

const ZONED_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}(?:\.\d+)?([+-]\d{2}:\d{2}|Z)(?:\[([^\]]+)\])?$/;

export interface ClockFace {
  /** 0–23. */
  hour: number;
  /** 0–59. */
  minute: number;
  /** The zoned string's own offset, e.g. `"-04:00"`. */
  offset: string;
  /** The zone's last path segment with underscores turned to spaces, e.g.
   *  "New York" — or "Fixed offset" for an offset-only zone, which has no
   *  city to name. */
  zoneLabel: string;
  /** `"3 Nov 2024"`. */
  dateLabel: string;
  /** `"01:30"`. */
  timeLabel: string;
}

const BLANK_FACE: ClockFace = {
  hour: 0,
  minute: 0,
  offset: "",
  zoneLabel: "",
  dateLabel: "",
  timeLabel: "",
};

function shortZoneLabel(zone: string): string {
  if (/^[+-]\d{2}:\d{2}$/.test(zone)) return "Fixed offset";
  const last = zone.split("/").pop() ?? zone;
  return last.replace(/_/g, " ");
}

/**
 * Reads one of `crossingTime`'s own zoned strings — `enter` or `exit` —
 * into the pieces a crystal clock face and its captions need. Every field
 * is copied out of the string the library already rendered; nothing here
 * is computed from an instant or a duration.
 */
export function crossingClockFace(zoned: string): ClockFace {
  const m = ZONED_RE.exec(zoned.trim());
  if (!m) return BLANK_FACE;
  const [, year, month, day, hh, mm, offset, bracket] = m;
  return {
    hour: Number(hh),
    minute: Number(mm),
    offset: offset === "Z" ? "+00:00" : offset!,
    zoneLabel: shortZoneLabel(bracket ?? offset!),
    dateLabel: `${formatDayLabel(`${year}-${month}-${day}`)} ${year}`,
    timeLabel: `${hh}:${mm}`,
  };
}

/** `"minus 04:00"`, `"plus 02:00"` — the sign spelled out, because a screen
 *  reader may skip or mis-speak a bare minus sign in an accessible name. */
export function spokenOffset(offset: string): string {
  if (offset === "") return "";
  const sign = offset.startsWith("-") ? "minus" : "plus";
  return `${sign} ${offset.slice(1)}`;
}

/**
 * True when the entry and exit read the identical wall clock — New York's
 * fall-back night, where both ends read 01:30 and only the offset tells
 * them apart — so the crystal clocks can be marked "repeated" instead of
 * looking like two unrelated moments that happen to match.
 */
export function isRepeatedReading(entry: ClockFace, exit: ClockFace): boolean {
  return entry.hour === exit.hour && entry.minute === exit.minute;
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type CrossingNullReason =
  | "invalid-entry"
  | "invalid-exit"
  | "unknown-zone"
  | "inverted";

export const NULL_REASON_TEXT: Record<CrossingNullReason, string> = {
  "invalid-entry":
    "The entry is not an instant: it needs a Z, an offset, or an offset with a bracketed zone.",
  "invalid-exit":
    "The exit is not an instant: it needs a Z, an offset, or an offset with a bracketed zone.",
  "unknown-zone": "targetZone is not a time zone this browser knows.",
  inverted: "An exit before its entry is a data error, not a negative transit.",
};

const FAR_FUTURE = "9999-01-01T00:00:00Z";
const FAR_PAST = "0001-01-01T00:00:00Z";

/**
 * Why `crossingTime(entry, exit, targetZone)` returned `null`, checked in the
 * library's own order: `entry`, then `exit`, then `targetZone`, then
 * inversion. Each check substitutes a known-good far-future or far-past
 * instant for the other side, so it tests only the field it names — never
 * arithmetic of its own, only further real calls.
 */
export function explainNull(
  entry: string,
  exit: string,
  targetZone: string,
  lib: TransportLib,
): CrossingNullReason | null {
  if (lib.crossingTime(entry, FAR_FUTURE, "UTC") === null) {
    return "invalid-entry";
  }
  if (lib.crossingTime(FAR_PAST, exit, "UTC") === null) {
    return "invalid-exit";
  }
  if (lib.crossingTime(FAR_PAST, FAR_FUTURE, targetZone) === null) {
    return "unknown-zone";
  }
  if (lib.crossingTime(entry, exit, "UTC") === null) {
    return "inverted";
  }
  return null;
}
