/**
 * Pure helpers for the Stored Time Audit widget (CORE-83).
 *
 * The reader pastes stored RFC 9557 strings, one per line, and the tool shows,
 * for each, what `classifyStoredZoned` finds under this browser's time zone
 * rules. The selected line is drawn against the clock change behind it.
 *
 * No DOM. Every function that reads the library takes a `StoredTimeLib`
 * (`stored-time-lib.ts`), loaded by the mount. The widget draws the library's
 * results and computes none: the kind and every reading come from
 * `classifyStoredZoned`, and the clock change a line is drawn against comes
 * from `getDstTransitions`. This file holds no zone table, no rule table and
 * no year window. The only arithmetic places a drawing (`laneMarks`,
 * `stripFor`), never a shown result.
 *
 * A zone comes from the reader's own string; the site never guesses one.
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  getTickerWindow,
  isGap,
  localDateAtTransition,
  parseOffsetMinutes,
  selectTickMinutes,
  type DstTransition,
  type TickerWindow,
} from "./dst-inspector";
import { runCall, type EdiCall } from "./edi-widgets";
import type { StoredTimeLib } from "./stored-time-lib";
import { encodeWidgetPermalink } from "./widget-permalink";

export const CUSTOM_PRESET_ID = "custom";

/** The most lines the tool reads, and the most characters it reads of each. */
export const AUDIT_MAX_LINES = 12;
export const AUDIT_MAX_CHARS = 80;

/** Why a line is not read: the library gave `null`. */
export const NOT_STORED_TEXT =
  "Not a stored zoned time: it needs a UTC offset and a bracketed IANA zone.";

/** What a line that names one instant shows in place of a drawing. */
export const VALID_REASON_TEXT =
  "This line names one instant under this browser's rules.";

/** Why a clock change is not drawn on the day strip. */
export const NO_BAND_TEXT =
  "This clock change does not fit inside one local day, so no band is drawn.";

/** The text of the host note, the tool's one host-dependence note. */
export const HOST_NOTE_TEXT =
  "Read with this browser's time zone rules. A browser does not say which tzdb release it carries, so the same line can read differently on another device or server. On Node, process.versions.tz names the release.";

// ---------------------------------------------------------------------------
// State, seeds and lines
// ---------------------------------------------------------------------------

/** The widget's controls, as strings, which is what the DOM holds. */
export interface AuditState {
  /** The textarea's text. */
  values: string;
  /** The selected line number, 1-based, or `null` for the default. */
  line: number | null;
}

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface StoredTimeAuditArgs {
  values?: string;
  line?: string;
}

/** Whether the args name anything, so the widget opens on them and not on a preset. */
export function isSeeded(args: StoredTimeAuditArgs): boolean {
  return typeof args.values === "string" && args.values.trim() !== "";
}

/** The seed as control values. A line number outside 1 to 12 is the default. */
export function readArgs(args: StoredTimeAuditArgs): AuditState {
  const line = Number(args.line);
  return {
    values: typeof args.values === "string" ? args.values : "",
    line:
      Number.isInteger(line) && line >= 1 && line <= AUDIT_MAX_LINES
        ? line
        : null,
  };
}

export interface ParsedLines {
  lines: string[];
  /** How many lines were left out past the line cap. */
  droppedLines: number;
  /** Whether a line was cut to the character cap. */
  cutLines: boolean;
  truncated: boolean;
}

/**
 * Splits the text on newlines, trims each line and drops the empty ones. Keeps
 * at most `AUDIT_MAX_LINES` lines, each cut to `AUDIT_MAX_CHARS` characters.
 */
export function parseAuditLines(text: string): ParsedLines {
  const all = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const kept = all.slice(0, AUDIT_MAX_LINES);
  const cutLines = kept.some((l) => l.length > AUDIT_MAX_CHARS);
  const lines = kept.map((l) => l.slice(0, AUDIT_MAX_CHARS));
  const droppedLines = all.length - kept.length;
  return {
    lines,
    droppedLines,
    cutLines,
    truncated: droppedLines > 0 || cutLines,
  };
}

/** The permalink's strings: the lines as read, and the selected line. */
export function permalinkOf(state: AuditState): Record<string, string> {
  const { lines } = parseAuditLines(state.values);
  const out: Record<string, string> = {};
  if (lines.length > 0) out["values"] = lines.join("\n");
  if (state.line !== null && lines.length > 0) out["line"] = String(state.line);
  return out;
}

// ---------------------------------------------------------------------------
// Reading a line
// ---------------------------------------------------------------------------

/** What `classifyStoredZoned` returns, as the library declares it. */
export type Classified = NonNullable<
  ReturnType<StoredTimeLib["classifyStoredZoned"]>
>;

export type StoredKind = Classified["kind"] | null;

export interface AuditLine {
  value: string;
  result: Classified | null;
}

/** One line, read. The result is the library's own, drawn as returned. */
export function readAuditLine(value: string, lib: StoredTimeLib): AuditLine {
  return { value, result: lib.classifyStoredZoned(value) };
}

/** Every line, read. */
export function readAuditLines(
  lines: readonly string[],
  lib: StoredTimeLib,
): AuditLine[] {
  return lines.map((l) => readAuditLine(l, lib));
}

/**
 * The bracketed zone annotation of a line, for drawing only, without a leading
 * `!`. A key-value annotation (`[u-ca=hebrew]`) is not a zone.
 */
export function zoneOfLine(value: string): string | null {
  const m = /\[!?([^\]=[]+)\]/.exec(value);
  return m ? m[1]! : null;
}

interface WallParts {
  year: number;
  date: string;
  minute: number;
}

/** The written wall clock of a line, for drawing only. */
function wallOfLine(value: string): WallParts | null {
  const m = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})/.exec(
    value,
  );
  if (!m) return null;
  return {
    year: Number(m[1]),
    date: `${m[1]}-${m[2]}-${m[3]}`,
    minute: Number(m[4]) * 60 + Number(m[5]),
  };
}

const KIND_LABELS: Record<Classified["kind"], string> = {
  valid: "Valid",
  validInOverlap: "Valid in an overlap",
  offsetMismatch: "Offset mismatch",
  ambiguous: "Ambiguous",
  nonexistent: "Nonexistent",
};

/** The kind in words. */
export function kindLabel(kind: Classified["kind"]): string {
  return KIND_LABELS[kind];
}

/** The longest kind label, for the column's reserved width. */
export const KIND_LABEL_WIDEST = KIND_LABELS.validInOverlap;

/** One plain sentence per kind, built from the returned fields. */
export function lineSentence(line: AuditLine): string {
  const r = line.result;
  if (r === null) return NOT_STORED_TEXT;
  switch (r.kind) {
    case "valid":
      return r.atStoredOffset === r.instant
        ? `The string names one instant: ${r.instant}.`
        : `The string names one instant: ${r.instant}. The stored offset is the zone's rounded to the minute, so read as written it gives ${r.atStoredOffset}.`;
    case "validInOverlap":
      return `This wall time happens twice, and the stored offset picks the one at ${r.instant}.`;
    case "offsetMismatch":
      return `The zone was at ${r.zoneOffset} at this time; the stored ${r.storedOffset} is no offset it has.`;
    case "ambiguous":
      return "This wall time happens twice, and the stored offset picks neither.";
    case "nonexistent":
      return "This wall time falls in a gap, so the stored offset matches no occurrence.";
  }
}

/** The readings of a result, in the order the table prints them. */
export function readingsOf(
  result: Classified,
): { name: string; value: string }[] {
  switch (result.kind) {
    case "valid":
      return [
        { name: "instant", value: result.instant },
        { name: "atStoredOffset", value: result.atStoredOffset },
      ];
    case "validInOverlap":
      return [
        { name: "instant", value: result.instant },
        { name: "earlier", value: result.earlier },
        { name: "later", value: result.later },
        { name: "atStoredOffset", value: result.atStoredOffset },
      ];
    case "offsetMismatch":
      return [
        { name: "storedOffset", value: result.storedOffset },
        { name: "zoneOffset", value: result.zoneOffset },
        { name: "atStoredOffset", value: result.atStoredOffset },
        { name: "atZoneOffset", value: result.atZoneOffset },
      ];
    case "ambiguous":
    case "nonexistent":
      return [
        { name: "earlier", value: result.earlier },
        { name: "later", value: result.later },
        { name: "atStoredOffset", value: result.atStoredOffset },
      ];
  }
}

/** The default selected line (1-based): the first that is neither valid nor `null`, else 1. */
export function defaultLine(
  lines: readonly AuditLine[],
  preset: number | null = null,
): number {
  if (preset !== null && preset >= 1 && preset <= lines.length) return preset;
  const first = lines.findIndex(
    (l) => l.result !== null && l.result.kind !== "valid",
  );
  return first === -1 ? 1 : first + 1;
}

// ---------------------------------------------------------------------------
// The drawing: the strip behind the selected line
// ---------------------------------------------------------------------------

/** A reading placed on the exact timeline: one instant, under the names it carries. */
export interface LaneMark {
  names: string[];
  instant: string;
  ms: number;
}

/** The exact-timeline readings of a result, those at one instant sharing a mark. */
export function laneMarks(result: Classified): LaneMark[] {
  const fields: { name: string; value: string }[] = readingsOf(result).filter(
    (r) => !r.name.endsWith("Offset") || r.name.startsWith("at"),
  );
  const marks: LaneMark[] = [];
  for (const f of fields) {
    let ms: number;
    try {
      ms = Temporal.Instant.from(f.value).epochMilliseconds;
    } catch {
      continue;
    }
    const same = marks.find((m) => m.ms === ms);
    if (same) same.names.push(f.name);
    else marks.push({ names: [f.name], instant: f.value, ms });
  }
  return marks;
}

export type Strip =
  /** A skipped or repeated hour on the local day. */
  | {
      kind: "day";
      zone: string;
      date: string;
      transition: DstTransition;
      gap: boolean;
      window: TickerWindow;
      pinMinute: number;
      calls: EdiCall[];
    }
  /** The clock change a stored offset predates. */
  | {
      kind: "since";
      zone: string;
      transition: DstTransition | null;
      /** The years scanned, in the order scanned. */
      years: number[];
      calls: EdiCall[];
    }
  /** Nothing to draw, and why. */
  | { kind: "none"; reason: string; calls: EdiCall[] };

function ms(instant: string): number | null {
  try {
    return Temporal.Instant.from(instant).epochMilliseconds;
  } catch {
    return null;
  }
}

/**
 * The selected line's drawing, or the reason it has none.
 *
 * A gap, an overlap or a pick inside one is a day strip: the transition on the
 * wall date, from one `getDstTransitions` call. A mismatch is a since strip:
 * the last transition at or before the zone's reading, from the wall year and
 * then the year before (at most two calls). A valid line and a `null` line
 * have nothing behind them to draw.
 */
export function stripFor(line: AuditLine, lib: StoredTimeLib): Strip {
  const r = line.result;
  if (r === null) return { kind: "none", reason: NOT_STORED_TEXT, calls: [] };
  if (r.kind === "valid") {
    return { kind: "none", reason: VALID_REASON_TEXT, calls: [] };
  }
  const zone = zoneOfLine(line.value);
  const wall = wallOfLine(line.value);
  if (zone === null || wall === null) {
    return { kind: "none", reason: NO_BAND_TEXT, calls: [] };
  }

  if (r.kind === "offsetMismatch") {
    const calls: EdiCall[] = [];
    const years: number[] = [];
    const zoneAt = ms(r.atZoneOffset);
    let found: DstTransition | null = null;
    for (const year of [wall.year, wall.year - 1]) {
      const call = runCall(lib, "getDstTransitions", zone, year);
      calls.push(call);
      years.push(year);
      const list = (call.result as DstTransition[] | null) ?? [];
      const before = list.filter((t) => {
        const at = ms(t.instant);
        return at !== null && zoneAt !== null && at <= zoneAt;
      });
      const last = before.at(-1) ?? null;
      if (last !== null) {
        found = last;
        break;
      }
    }
    return { kind: "since", zone, transition: found, years, calls };
  }

  // nonexistent, ambiguous, validInOverlap: the transition on the wall date.
  const call = runCall(lib, "getDstTransitions", zone, wall.year);
  const list = (call.result as DstTransition[] | null) ?? [];
  const transition =
    list.find((t) => localDateAtTransition(t, zone) === wall.date) ?? null;
  const window = transition === null ? null : getTickerWindow(transition, zone);
  if (transition === null || window === null) {
    return { kind: "none", reason: NO_BAND_TEXT, calls: [call] };
  }
  return {
    kind: "day",
    zone,
    date: wall.date,
    transition,
    gap: isGap(transition),
    window,
    pinMinute: wall.minute,
    calls: [call],
  };
}

/** The ticks of the day strip: the local day, 00:00 to 24:00, thinned to the track. */
export function dayTicks(window: TickerWindow, trackPx: number): number[] {
  return selectTickMinutes(
    { ...window, windowStartMinutes: 0, windowEndMinutes: 1440 },
    trackPx,
  );
}

/** The clock change's size, in words: "1 hour" or "30 minutes". */
export function bandMinutesText(t: DstTransition): string {
  // From the offsets, not the drawn band: a band that ends at midnight is
  // clamped to 23:59 and would read as 59 minutes.
  const m = Math.abs(
    parseOffsetMinutes(t.offsetAfter) - parseOffsetMinutes(t.offsetBefore),
  );
  if (m % 60 === 0) return m === 60 ? "1 hour" : `${m / 60} hours`;
  return `${m} minutes`;
}

/** The band's chip: "skipped hour" or "repeated hour", with its size. */
export function bandChipText(strip: Extract<Strip, { kind: "day" }>): string {
  return `${strip.gap ? "skipped" : "repeated"} ${bandMinutesText(strip.transition)}`;
}

/** The local date of a transition, falling back to its UTC date. */
export function transitionDate(t: DstTransition, zone: string | null): string {
  return (zone && localDateAtTransition(t, zone)) || t.instant.slice(0, 10);
}

/** The text the lanes read out, as the figure's `aria-label`. */
export function figureLabel(line: AuditLine, strip: Strip): string {
  const base = lineSentence(line);
  switch (strip.kind) {
    case "day":
      return `${base} The local day shows a ${bandChipText(strip)} at ${strip.date}.`;
    case "since":
      return strip.transition === null
        ? `${base} No clock change in ${strip.years.join(" or ")} under this browser's rules.`
        : `${base} The zone has been at ${strip.transition.offsetAfter} since ${strip.transition.instant}.`;
    case "none":
      return `${base} ${strip.reason}`;
  }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** The link row's one link, before a line gives it a year. */
export const AUDIT_LINKS = [
  { role: "link-dst", text: "This zone's clock changes" },
] as const;

/**
 * The DST Inspector link for the selected line, or `null` for a line with no
 * zone or a year outside the Inspector's range. The year is the wall year.
 */
export function dstLink(
  line: AuditLine,
): { href: string; text: string; zone: string; year: number } | null {
  if (line.result === null) return null;
  const zone = zoneOfLine(line.value);
  const wall = wallOfLine(line.value);
  if (zone === null || wall === null) return null;
  if (wall.year < 1900 || wall.year > 2100) return null;
  return {
    href: encodeWidgetPermalink("dst", { zone, year: wall.year }),
    text: `This zone's clock changes in ${wall.year}`,
    zone,
    year: wall.year,
  };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface AuditPreset {
  id: string;
  label: string;
  description: string;
  /** The lines, in order. */
  lines: readonly string[];
  /** The line the widget opens on. */
  selected: number;
}

/**
 * Each preset is a worked case. The mount test runs each against the library.
 * The strings are the library's own test rows (CORE-83), written with `:00`
 * seconds.
 */
export const AUDIT_PRESETS: readonly AuditPreset[] = [
  {
    id: "istanbul-2016",
    label: "Istanbul, stored before 2016",
    description:
      "Turkey stayed on +03:00 from 2016-09-07 (tzdb 2016g), so a winter time written at +02:00 before the change no longer matches.",
    lines: [
      "2015-11-08T03:30:00+03:00[Europe/Istanbul]",
      "2015-11-08T03:30:00+01:00[Europe/Istanbul]",
      "2016-03-27T03:30:00+03:00[Europe/Istanbul]",
      "2016-10-30T03:30:00+02:00[Europe/Istanbul]",
      "2016-12-01T09:00:00+02:00[Europe/Istanbul]",
      "2016-12-01T09:00:00+03:00[Europe/Istanbul]",
    ],
    selected: 5,
  },
  {
    id: "casablanca-2018",
    label: "Casablanca, stored before 2018",
    description:
      "Morocco moved to +01:00 for good in 2018, so winter times written at +00:00 name a different hour than the zone now has.",
    lines: [
      "2018-06-17T02:30:00+00:00[Africa/Casablanca]",
      "2018-10-28T02:30:00+00:00[Africa/Casablanca]",
      "2018-12-01T09:00:00+00:00[Africa/Casablanca]",
      "2018-12-01T09:00:00+01:00[Africa/Casablanca]",
      "2019-05-05T02:30:00+00:00[Africa/Casablanca]",
      "2019-05-05T02:30:00+02:00[Africa/Casablanca]",
    ],
    selected: 3,
  },
  {
    id: "sao-paulo-2019",
    label: "Sao Paulo, stored before 2019",
    description:
      "Brazil dropped daylight saving time after February 2019, so a summer time written at -02:00 in January 2020 no longer matches, and a spring day that once skipped an hour now exists.",
    lines: [
      "2018-11-04T00:30:00-03:00[America/Sao_Paulo]",
      "2019-02-16T23:30:00-03:00[America/Sao_Paulo]",
      "2019-02-16T23:30:00-04:00[America/Sao_Paulo]",
      "2019-11-03T00:30:00-03:00[America/Sao_Paulo]",
      "2020-01-15T12:00:00-02:00[America/Sao_Paulo]",
    ],
    selected: 5,
  },
  {
    id: "kept-offset",
    label: "A kept offset in a gap",
    description:
      "In a gap the stored offset places the time in neither reading, except where it equals one of the two offsets around the change, as in Lord Howe's 30-minute gap.",
    lines: [
      "2024-10-06T02:15:00+10:30[Australia/Lord_Howe]",
      "2024-09-29T03:15:00+12:45[Pacific/Chatham]",
      "2026-03-08T02:30:00-03:00[America/Los_Angeles]",
      "2026-11-01T01:30:00-03:00[America/Los_Angeles]",
      "2026-11-01T01:30:00-08:00[America/Los_Angeles]",
      "2026-11-01T01:30:00-07:00[America/Los_Angeles]",
    ],
    selected: 1,
  },
  {
    id: "z-and-zero",
    label: "Z, -00:00 and +00:00",
    description:
      "A Z names the instant outright, while -00:00 and +00:00 are read as numeric offsets that London does not have in July, and Monrovia's 1960 offset has seconds.",
    lines: [
      "2022-07-08T00:14:07Z[Europe/London]",
      "2022-07-08T00:14:07-00:00[Europe/London]",
      "2022-07-08T00:14:07+00:00[!Europe/London]",
      "1960-01-01T00:20:00-00:45[Africa/Monrovia]",
      "1960-01-01T00:20:00-00:44:30[Africa/Monrovia]",
    ],
    selected: 2,
  },
  {
    id: "not-stored-times",
    label: "Not stored times",
    description:
      "Each line is missing a part the function needs, or carries one it refuses, so each reads as a signal lost with its reason.",
    lines: [
      "2026-03-08T02:30:00[America/Los_Angeles]",
      "2026-03-08T02:30:00-08:00",
      "2026-03-08T02:30:00-08:00[-08:00]",
      "2026-03-08T02:30:00-08:00[Mars/Base]",
      "20260308T023000-0800[America/Los_Angeles]",
      "2026-03-08T02:30:00-08:00[America/Los_Angeles][u-ca=hebrew]",
    ],
    selected: 1,
  },
];

/** A preset as control values. */
export function presetState(preset: AuditPreset): AuditState {
  return { values: preset.lines.join("\n"), line: preset.selected };
}

/** The preset whose lines the text holds, or `custom`. */
export function matchPreset(text: string): string {
  const { lines } = parseAuditLines(text);
  const key = lines.join("\n");
  return (
    AUDIT_PRESETS.find((p) => p.lines.join("\n") === key)?.id ??
    CUSTOM_PRESET_ID
  );
}
