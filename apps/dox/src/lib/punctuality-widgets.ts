/**
 * Pure helpers shared by the three punctuality widgets (TRAN-57): the
 * Punctuality Board (`scheduleDeviation`, `classifyPunctuality`,
 * `punctualityRate`), the ETA Drift Chart (`bestAvailable`, `estimateDrift`)
 * and the Departure Board (`nextDeparture`).
 *
 * No gmt import: every widget-facing function takes a `PunctualityLib`,
 * loaded by the mount from the real package (`punctuality-lib.ts`).
 *
 * `@js-temporal/polyfill` is imported for drawing only: turning a returned ISO
 * duration into a length on an axis (`isoToMinutes`), reading the weekday off a
 * date the caller wrote, and tick instants. Every deviation, class, rate,
 * best-available pick, drift and departure the widgets show comes from a real
 * `PunctualityLib` call. `minutesToIso` and `wallAsUtc` build an *input* for
 * the library; they compute no result.
 *
 * `cutoff-widgets.ts`'s `callSource` is not reused: its key table knows only
 * cut-off shapes and would print a `{ planned, actual }` pair as `{ }`.
 *
 * GMT tracks no law: DCSA's `eventClassifierCode` vocabulary (PLN, EST, REQ, ACT)
 * and the GTFS `frequencies.txt` format may be named; nothing else is.
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  durationText,
  localLabel,
  localParts,
  type LocalParts,
} from "./cutoff-widgets";
import { placeLabel } from "./label-fit";
import { escapeHtml } from "./widget-ui";

export {
  TRANSPORT_ZONES,
  dayTickLabel,
  durationText,
  epochMs,
  hourTickLabel,
  localLabel,
  localParts,
  walkTicks,
  zoneOptionsHtml,
} from "./cutoff-widgets";

// ---------------------------------------------------------------------------
// The library's shapes, declared locally
// ---------------------------------------------------------------------------

export type TimestampClass = "PLN" | "EST" | "REQ" | "ACT";

export interface TimestampEvent {
  classifier: TimestampClass;
  at: string;
  recordedAt: string;
}

export interface PunctualityTolerance {
  late: string;
  early?: string;
}

export type Punctuality = "early" | "onTime" | "late";

export interface PlannedActual {
  planned: string;
  actual: string;
}

export interface OnTimeRate {
  onTime: number;
  total: number;
  rate: number;
}

export interface ClassifiedTimestamp {
  at: string;
  classifier: TimestampClass;
}

export interface DriftReport {
  first: string;
  last: string;
  drift: string;
  revisions: number;
  exceedsTolerance: boolean | null;
}

export interface Headway {
  headway: string;
  from: string;
  to: string;
}

/** The six real functions the three widgets need, loaded at module
 *  granularity by `punctuality-lib.ts` and injected. */
export interface PunctualityLib {
  scheduleDeviation(planned: string, actual: string): string;
  classifyPunctuality(
    planned: string,
    actual: string,
    tolerance: PunctualityTolerance,
  ): Punctuality | null;
  punctualityRate(
    pairs: readonly PlannedActual[],
    tolerance: PunctualityTolerance,
  ): OnTimeRate | null;
  bestAvailable(events: readonly TimestampEvent[]): ClassifiedTimestamp | null;
  estimateDrift(
    events: readonly TimestampEvent[],
    options?: { tolerance?: string },
  ): DriftReport | null;
  nextDeparture(
    after: string,
    timetable: readonly string[] | Headway,
    options?: { minimumConnection?: string },
  ): string;
}

/** DCSA's four timestamp classes, in the order the widgets offer them. */
export const TIMESTAMP_CLASSES: readonly {
  code: TimestampClass;
  label: string;
}[] = [
  { code: "PLN", label: "planned" },
  { code: "EST", label: "estimated" },
  { code: "REQ", label: "requested" },
  { code: "ACT", label: "actual" },
];

export const PUNCTUALITY_LABELS: Record<Punctuality, string> = {
  early: "early",
  onTime: "on time",
  late: "late",
};

// ---------------------------------------------------------------------------
// Durations: building an input, reading a length to draw
// ---------------------------------------------------------------------------

/**
 * Whole minutes (zero or more) as an exact duration with hours as the largest
 * unit: 0 is `"PT0S"`, 90 is `"PT1H30M"`, 1440 is `"PT24H"`. It builds an
 * input for the library; it computes no result.
 */
export function minutesToIso(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return "PT0S";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 ? `${m}M` : ""}`;
}

/**
 * A duration's length in minutes, **for drawing only**: a day counts as 24
 * hours and a leading `-` negates. `null` for anything with years, months or
 * weeks, or that does not parse.
 */
export function isoToMinutes(iso: string): number | null {
  const text = iso.trim();
  if (text === "") return null;
  try {
    const negative = text.startsWith("-");
    const body = negative || text.startsWith("+") ? text.slice(1) : text;
    const minutes = Temporal.Duration.from(body).total({ unit: "minutes" });
    return negative ? -minutes : minutes;
  } catch {
    return null;
  }
}

/** A returned deviation as a signed reading: `"PT15M"` is `"+15 min"`,
 *  `"-PT3M"` is `"−3 min"` (U+2212), `"PT0S"` is `"0 min"`. `""` stays `""`. */
export function signedText(iso: string): string {
  const body = durationText(iso);
  if (body === "") return "";
  if (body === "0 min") return body;
  return `${iso.startsWith("-") ? "−" : "+"}${body}`;
}

/**
 * A tolerance or duration as the reader typed it, in words: `"PT15M"` is
 * `"15 min"`, `"P1D"` is `"24 h"` (a day is 24 hours here). Text that does not
 * read as an exact duration comes back as typed. Formatting only.
 */
export function toleranceText(iso: string): string {
  const minutes = isoToMinutes(iso);
  if (minutes === null) return iso;
  return durationText(minutesToIso(Math.abs(minutes)));
}

/** A length for `aria-valuetext`: `15` is `"15 minutes"`, `90` is
 *  `"1 hour 30 minutes"`, `1440` is `"24 hours"`. */
export function spokenMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (h === 0) return unit(m, "minute");
  return m === 0 ? unit(h, "hour") : `${unit(h, "hour")} ${unit(m, "minute")}`;
}

let instanceCount = 0;

/** A number for each template rendered, so two widgets on one page (a tool page
 *  and the chat rail) never share a radio `name` or an `id`. */
export function nextInstanceId(): number {
  instanceCount += 1;
  return instanceCount;
}

const NICE_MINUTES = [
  5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440, 2160, 2880,
  4320, 5760, 7200, 10080,
] as const;

/** The smallest axis length in `NICE_MINUTES` that is at least `m`, else `m`
 *  rounded up to whole days. Drawing only. */
export function niceMinutes(m: number): number {
  const hit = NICE_MINUTES.find((n) => n >= m);
  return hit ?? Math.ceil(m / 1440) * 1440;
}

/** A handle's keyboard step and snap, in minutes, from the axis length. */
export function stepMinutesFor(spanMinutes: number): number {
  if (spanMinutes <= 180) return 1;
  if (spanMinutes <= 2880) return 15;
  return 60;
}

// ---------------------------------------------------------------------------
// A moment as written
// ---------------------------------------------------------------------------

const OFFSET_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:\d{2})$/;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function trimSeconds(time: string): string {
  const m = /^(\d{2}:\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(time);
  if (!m) return time;
  const [, hm, sec] = m;
  return sec === undefined || sec === "00" ? hm! : `${hm}:${sec}`;
}

/**
 * `{ date, weekday, time, offset, zone }` of a moment **as written**. A zoned
 * string goes through `localParts`; an instant with `Z` or a numeric offset is
 * read by pattern (`zone` is `""`). Seconds show only when non-zero. Every
 * field is `""` when the text does not parse.
 */
export function writtenParts(s: string): LocalParts {
  const zoned = localParts(s);
  if (zoned.date !== "") return zoned;
  const m = OFFSET_PATTERN.exec(s);
  if (!m) return { date: "", weekday: "", time: "", offset: "", zone: "" };
  const [, date, time, offset] = m;
  let weekday = "";
  try {
    weekday = WEEKDAYS[Temporal.PlainDate.from(date!).dayOfWeek - 1] ?? "";
  } catch {
    return { date: "", weekday: "", time: "", offset: "", zone: "" };
  }
  return {
    date: date!,
    weekday,
    time: trimSeconds(time!),
    offset: offset!,
    zone: "",
  };
}

/** `"Sat 15 Jun 13:00"`; `""` when the text does not parse. */
export function writtenLabel(s: string): string {
  const p = writtenParts(s);
  if (p.date === "") return "";
  // `localLabel` already prints this shape for a zoned string; an offset
  // string takes the same route through a zoned stand-in.
  if (p.zone !== "") return localLabel(s);
  return localLabel(`${p.date}T${p.time}${p.offset}[UTC]`);
}

/** `"13:00"`; `""` when the text does not parse. */
export function writtenTime(s: string): string {
  return writtenParts(s).time;
}

const WALL_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/;

/**
 * The date-time part of `s`, before any offset or `[`, with `Z` appended: the
 * wall clock read as if it were UTC. It builds the Punctuality Board's one
 * naive reading's input; `""` when there is no date-time part.
 */
export function wallAsUtc(s: string): string {
  const m = WALL_PATTERN.exec(s);
  return m ? `${m[1]}Z` : "";
}

// ---------------------------------------------------------------------------
// The real call, as source text
// ---------------------------------------------------------------------------

const KEY_ORDERS: readonly (readonly string[])[] = [
  ["planned", "actual"],
  ["classifier", "at", "recordedAt"],
  ["headway", "from", "to"],
  ["late", "early"],
  ["onTime", "total", "rate"],
  ["first", "last", "drift", "revisions", "exceedsTolerance"],
  ["tolerance"],
  ["minimumConnection"],
];

/** The key order of an object's shape: the table that shares the most keys
 *  with it. A classified pick (`at`, `classifier` with no `recordedAt`) prints
 *  `at` first, as the JSDoc does. */
function keyOrderFor(obj: Record<string, unknown>): readonly string[] {
  const keys = Object.keys(obj);
  if (keys.includes("classifier") && !keys.includes("recordedAt")) {
    return ["at", "classifier"];
  }
  let best: readonly string[] = [];
  let bestScore = 0;
  for (const order of KEY_ORDERS) {
    const score = keys.filter((k) => order.includes(k)).length;
    if (score > bestScore) {
      best = order;
      bestScore = score;
    }
  }
  return best;
}

/**
 * `formatValue` as source text, in the JSDoc spelling: unquoted keys,
 * double-quoted strings, numbers and booleans bare, `null` as `null`, arrays in
 * brackets. An absent (`undefined`) key is omitted; an unknown key keeps its
 * insertion order after the known ones, never dropped.
 */
function renderValue(value: unknown, str: (s: string) => string): string {
  if (value === null) return "null";
  if (typeof value === "string") return str(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => renderValue(v, str)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const known = keyOrderFor(obj).filter((k) => k in obj);
    const rest = Object.keys(obj).filter((k) => !known.includes(k));
    const entries = [...known, ...rest]
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${k}: ${renderValue(obj[k], str)}`);
    return entries.length === 0 ? "{ }" : `{ ${entries.join(", ")} }`;
  }
  return String(value);
}

/** A library value as the JSDoc prints it. */
export function formatValue(value: unknown): string {
  return renderValue(value, (s) => JSON.stringify(s));
}

/** `[html, plain]` for `renderCallLine`: the arguments of a real call. */
export function callArgs(args: readonly unknown[]): [string, string] {
  const htmlStr = (s: string) =>
    `<span class="gmt-code-str">${escapeHtml(JSON.stringify(s))}</span>`;
  return [
    args.map((a) => renderValue(a, htmlStr)).join(", "),
    args.map((a) => renderValue(a, (s) => JSON.stringify(s))).join(", "),
  ];
}

// ---------------------------------------------------------------------------
// Axis ticks
// ---------------------------------------------------------------------------

/** A tick label for a minute-level axis: `"09:15"`. */
export function minuteTickLabel(z: Temporal.ZonedDateTime): string {
  return `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}

/** Ticks every `stepMinutes` of exact time, the first at or after `startMs`
 *  and aligned to the local hour at or before it. Drawing only. */
export function minuteTicks(
  startMs: number,
  endMs: number,
  zone: string,
  stepMinutes: number,
  label: (z: Temporal.ZonedDateTime) => string = minuteTickLabel,
): { ms: number; label: string }[] {
  if (endMs <= startMs || stepMinutes <= 0) return [];
  try {
    let cur = Temporal.Instant.fromEpochMilliseconds(startMs)
      .toZonedDateTimeISO(zone)
      .round({ smallestUnit: "hour", roundingMode: "floor" });
    const out: { ms: number; label: string }[] = [];
    for (
      let guard = 0;
      guard < 4000 && cur.epochMilliseconds <= endMs;
      guard++
    ) {
      if (cur.epochMilliseconds >= startMs) {
        out.push({ ms: cur.epochMilliseconds, label: label(cur) });
      }
      // Exact minutes: a tick never walks the repeated hour's wall clock twice.
      cur = Temporal.Instant.fromEpochMilliseconds(
        cur.epochMilliseconds + stepMinutes * 60_000,
      ).toZonedDateTimeISO(zone);
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Writing a moment in a sample's notation
// ---------------------------------------------------------------------------

/** The zone a drawn axis reads in: a bracketed zone as itself, a numeric offset
 *  as itself, `Z` as UTC. `""` when the text does not parse. */
export function zoneOf(text: string): string {
  const p = writtenParts(text);
  if (p.date === "") return "";
  if (p.zone !== "") return p.zone;
  return p.offset === "Z" ? "UTC" : p.offset;
}

/**
 * `ms` written the way `sample` is written: a bracketed zone stays that zone
 * (`2024-06-15T08:40:00+02:00[Europe/Amsterdam]`), a numeric offset stays that
 * offset, `Z` stays `Z`. It builds an input for the library from a handle's
 * position. `""` when `sample` does not parse.
 */
export function writeLike(sample: string, ms: number): string {
  const p = writtenParts(sample);
  if (p.date === "") return "";
  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(ms);
    if (p.zone !== "") return instant.toZonedDateTimeISO(p.zone).toString();
    if (p.offset === "Z") return instant.toString();
    return instant.toString({ timeZone: p.offset });
  } catch {
    return "";
  }
}

export interface LabelBox {
  /** The label's anchor, in px from the plot's top-left: a mark's centre. */
  x: number;
  y: number;
  /** The label's measured size. */
  w: number;
  h: number;
}

export interface PlacedLabel {
  left: number;
  top: number;
}

export interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PlaceOptions {
  /** The size of the mark (and its ring) at every anchor; `0` when the anchors
   *  are not marks. A label never covers one. Default 14. */
  markPx?: number;
  /** Drawn lines a label should not cross: a join line, an arrow. */
  lines?: readonly Segment[];
  /** Fixed rectangles no label may cover: a handle's hit square, a bar, the rule. */
  blocked?: readonly Rect[];
  /** Clear space kept round every obstacle. Default 2. */
  pad?: number;
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.left + b.w &&
  b.left < a.left + a.w &&
  a.top < b.top + b.h &&
  b.top < a.top + a.h;

/** Whether a segment passes through a rectangle (Liang-Barsky clipping). */
export function segmentHitsRect(seg: Segment, box: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const edges: [number, number][] = [
    [-dx, seg.x1 - box.left],
    [dx, box.left + box.w - seg.x1],
    [-dy, seg.y1 - box.top],
    [dy, box.top + box.h - seg.y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        t0 = Math.max(t0, r);
      } else {
        if (r < t0) return false;
        t1 = Math.min(t1, r);
      }
    }
  }
  return true;
}

const grow = (r: Rect, by: number): Rect => ({
  left: r.left - by,
  top: r.top - by,
  w: r.w + 2 * by,
  h: r.h + 2 * by,
});

/**
 * Where each anchor's label goes inside a `width` x `height` plot so no label
 * crosses another label, covers a mark or a blocked rectangle, runs off the
 * plot or, when a position exists, is struck through by a drawn line.
 *
 * The horizontal side comes from `placeLabel`. A collision moves the label up
 * or down in label-height steps on that side, then on the other, then above and
 * below the anchor. Two passes: first every obstacle including lines, then every
 * obstacle but lines (the label has an opaque background, so a line behind it
 * never crosses a glyph). Falls back to the first candidate when nothing is
 * clear. Pure geometry, so it is tested without a browser. Drawing only.
 */
export function placeLabels(
  boxes: readonly LabelBox[],
  width: number,
  height: number,
  options: PlaceOptions | number = {},
): PlacedLabel[] {
  const o: PlaceOptions =
    typeof options === "number" ? { markPx: options } : options;
  const markPx = o.markPx ?? 14;
  const pad = o.pad ?? 2;
  const gap = markPx / 2 + pad;
  const lines = o.lines ?? [];
  const blocked = (o.blocked ?? []).map((r) => grow(r, pad));
  const placed: Rect[] = [];
  return boxes.map((b) => {
    const side = placeLabel({
      atPx: b.x,
      labelPx: b.w,
      trackPx: width,
      offsetPx: gap,
    });
    const right = b.x + gap;
    const left = b.x - gap - b.w;
    const first = side === "start" ? right : left;
    const other = side === "start" ? left : right;
    const baseTop = b.y - b.h / 2;
    const steps = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5];
    const tops = steps.map((k) => baseTop + k * (b.h + pad));
    const candidates: PlacedLabel[] = [
      ...tops.map((top) => ({ left: first, top })),
      ...tops.map((top) => ({ left: other, top })),
      ...[-b.w / 2, 0, -b.w].flatMap((dx) => [
        { left: b.x + dx, top: b.y - gap - b.h },
        { left: b.x + dx, top: b.y + gap },
      ]),
    ];
    const fits = (
      c: PlacedLabel,
      avoidLines: boolean,
      markSize: number,
    ): boolean => {
      const box: Rect = { ...c, w: b.w, h: b.h };
      if (c.left < -0.5 || c.top < -0.5) return false;
      if (c.left + b.w > width + 0.5 || c.top + b.h > height + 0.5)
        return false;
      const padded = grow(box, pad);
      if (placed.some((p) => overlaps(padded, p))) return false;
      if (
        markSize > 0 &&
        boxes.some((m) =>
          overlaps(box, {
            left: m.x - markSize / 2,
            top: m.y - markSize / 2,
            w: markSize,
            h: markSize,
          }),
        )
      ) {
        return false;
      }
      if (blocked.some((r) => overlaps(box, r))) return false;
      return !(avoidLines && lines.some((l) => segmentHitsRect(l, padded)));
    };
    // Rings and lines first; then the lines may go (the label is opaque); then
    // the ring shrinks to the mark itself; last, the first candidate.
    const bare = Math.min(markPx, 14);
    const hit =
      candidates.find((c) => fits(c, true, markPx)) ??
      candidates.find((c) => fits(c, false, markPx)) ??
      candidates.find((c) => fits(c, true, bare)) ??
      candidates.find((c) => fits(c, false, bare)) ??
      candidates[0]!;
    placed.push({ ...hit, w: b.w, h: b.h });
    return hit;
  });
}
