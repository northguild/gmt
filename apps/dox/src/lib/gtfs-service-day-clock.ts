/**
 * Pure logic for the GTFS Service Day Clock (RAI-100).
 *
 * The reader types a service date, a stop time and the agency's zone, as a feed holds them.
 * `gtfsToInstant` gives the instant GTFS means: noon of the service day minus 12 hours, plus the
 * stop time as exact elapsed seconds. Next to it the tool computes what a midnight anchor gives:
 * `resolveLocal` of local midnight, plus the same elapsed seconds through `addUtc`. On a day the
 * clocks change the two are an hour apart; on any other day they agree. The tool also draws both
 * on one day rail, with the clock change marked.
 *
 * The site holds no GTFS rule, no offset and no day arithmetic. Every instant, reading, gap and
 * position is a library result, and a refusal is explained by asking the library again. The
 * only text the site cuts is a clock reading out of a string the library wrote
 * (`readingOf`), to name a mark.
 *
 * No DOM, no library import (the library arrives as a `ServiceDayLib`).
 */
import { literal } from "./holiday-rule-builder";
import type { ServiceDayLib } from "./rail-lib";

export const CUSTOM_PRESET_ID = "custom";

/** The most each box takes. */
export const DATE_MAX_CHARS = 16;
export const TIME_MAX_CHARS = 16;
export const ZONE_MAX_CHARS = 64;

/** What a plate reads while a box is empty: an empty field is not a refusal. */
export const NOTHING_TYPED = "nothing typed";

/** The rail's one line when the library gave no position for an instant. */
export const NOT_DRAWN =
  "Not drawn: the library gave no position for this instant.";
/** The rail's line before anything is typed, and when there is no instant to draw. */
export const NOTHING_TO_DRAW = "Nothing to draw: no instant yet.";

// ---------------------------------------------------------------------------
// State, presets and arguments
// ---------------------------------------------------------------------------

/** The text of the three boxes, as typed. */
export interface ServiceDayState {
  date: string;
  time: string;
  zone: string;
}

export interface GtfsServiceDayClockArgs {
  preset?: string;
  serviceDate?: string;
  time?: string;
  timeZone?: string;
}

export interface ServiceDayPreset extends ServiceDayState {
  id: string;
  label: string;
  description: string;
}

/** Each preset's values are the library's, asserted in the unit test. */
export const PRESETS: readonly ServiceDayPreset[] = [
  {
    id: "spring-forward",
    label: "Berlin, clocks go forward",
    description: "The midnight anchor is 60 minutes after GTFS.",
    date: "20260329",
    time: "08:00:00",
    zone: "Europe/Berlin",
  },
  {
    id: "spring-start",
    label: "Berlin, start of that day",
    description: "00:00:00 is 23:00 the day before.",
    date: "20260329",
    time: "00:00:00",
    zone: "Europe/Berlin",
  },
  {
    id: "fall-back",
    label: "Berlin, clocks go back",
    description: "The midnight anchor is 60 minutes before GTFS.",
    date: "20261025",
    time: "08:00:00",
    zone: "Europe/Berlin",
  },
  {
    id: "ordinary",
    label: "An ordinary day",
    description: "Both anchors agree.",
    date: "20260615",
    time: "08:00:00",
    zone: "Europe/Berlin",
  },
  {
    id: "past-midnight",
    label: "26:30:00, the day before",
    description: "Elapsed seconds from the anchor, not a wall-clock move.",
    date: "20260328",
    time: "26:30:00",
    zone: "Europe/Berlin",
  },
  {
    id: "new-york",
    label: "New York, clocks go forward",
    description: "The same hour, in the US.",
    date: "20260308",
    time: "08:00:00",
    zone: "America/New_York",
  },
  {
    id: "no-noon",
    label: "Samoa skipped a day",
    description: "Noon did not happen, so GTFS defines no anchor.",
    date: "20111230",
    time: "12:00:00",
    zone: "Pacific/Apia",
  },
  {
    id: "offset",
    label: "An offset as the zone",
    description: "+05:30 never changes.",
    date: "20260329",
    time: "08:00:00",
    zone: "+05:30",
  },
];

const DEFAULT_PRESET = PRESETS[0]!;

export function matchPreset(state: ServiceDayState): string {
  return (
    PRESETS.find(
      (p) =>
        p.date === state.date && p.time === state.time && p.zone === state.zone,
    )?.id ?? CUSTOM_PRESET_ID
  );
}

export function presetState(
  preset: ServiceDayPreset = DEFAULT_PRESET,
): ServiceDayState {
  return { date: preset.date, time: preset.time, zone: preset.zone };
}

/** Whether the args seed the widget: a blank box is a seed, a cleared field. */
export function isSeeded(args: GtfsServiceDayClockArgs | undefined): boolean {
  return (
    args !== undefined &&
    (["preset", "serviceDate", "time", "timeZone"] as const).some(
      (k) => typeof args[k] === "string",
    )
  );
}

/** The state a seed describes: the named preset, then any text the seed also gives. */
export function readArgs(args: GtfsServiceDayClockArgs): ServiceDayState {
  const state = presetState(PRESETS.find((p) => p.id === args.preset));
  // A blank box is a seed: a link made from a cleared field must open cleared.
  if (typeof args.serviceDate === "string") state.date = args.serviceDate;
  if (typeof args.time === "string") state.time = args.time;
  if (typeof args.timeZone === "string") state.zone = args.timeZone;
  return state;
}

/**
 * The permalink keys for `state`: a preset's id while the boxes match one, else the text itself
 * (even blank, so the link does not fall back to the default).
 */
export function permalinkOf(state: ServiceDayState): Record<string, string> {
  const id = matchPreset(state);
  return id === CUSTOM_PRESET_ID
    ? { serviceDate: state.date, time: state.time, timeZone: state.zone }
    : { preset: id };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export const GTFS_CARD_TITLE = "GTFS: noon minus 12 h";
export const MIDNIGHT_CARD_TITLE = "Midnight anchor";

export const CAPTIONS = {
  anchor: "Anchor (local)",
  answerUtc: "Answer (UTC)",
  answerLocal: "Answer (local)",
} as const;

export type ReasonKey =
  | "empty"
  | "ok"
  | "time"
  | "date"
  | "zone"
  | "nonexistent"
  | "ambiguous"
  | "other";

/** Why GTFS gave no instant, in the order the probes run. */
export const REASONS: Record<ReasonKey, string> = {
  empty: "Type a service date, a stop time and the agency's zone.",
  ok: "",
  time: "The stop time is not a GTFS time.",
  date: "The service date is not YYYYMMDD or YYYY-MM-DD, or the day does not exist.",
  zone: "The zone is not an IANA name or an offset.",
  nonexistent:
    "Noon did not happen on this date in this zone, so GTFS defines no anchor.",
  ambiguous:
    "Noon happened twice on this date in this zone, so GTFS defines no anchor.",
  other: "The library returned no instant.",
};

/** What the midnight card says under its plates. */
export const MIDNIGHT_NOTES = {
  empty: "Type a service date, a stop time and the agency's zone.",
  ok: "Local midnight of the date, plus the stop time as elapsed seconds.",
  none: "The library gave no midnight for this date and zone.",
} as const;

export const SAME_TITLE = "Same instant:";
export const SAME_DETAIL =
  "on this date noon minus 12 hours is local midnight.";
export const DIFFERENT_TITLE = "Different instants:";

export const minutesText = (n: number): string =>
  `${n} ${n === 1 ? "minute" : "minutes"}`;

export const differentDetail = (gap: number): string =>
  `The midnight anchor is ${minutesText(Math.abs(gap))} ${gap > 0 ? "later" : "earlier"} than GTFS.`;

/** The verdict under the cards, or `null` while there is nothing to compare. */
export function verdictOf(gap: number | null): {
  tone: "good" | "bad";
  title: string;
  detail: string;
} | null {
  if (gap === null) return null;
  return gap === 0
    ? { tone: "good", title: SAME_TITLE, detail: SAME_DETAIL }
    : { tone: "bad", title: DIFFERENT_TITLE, detail: differentDetail(gap) };
}

/** The longest texts the verdict can say, to reserve its room. */
export const VERDICT_SAMPLES: readonly { title: string; detail: string }[] = [
  { title: SAME_TITLE, detail: SAME_DETAIL },
  { title: DIFFERENT_TITLE, detail: differentDetail(1440) },
  { title: DIFFERENT_TITLE, detail: differentDetail(-1440) },
];

// ---------------------------------------------------------------------------
// The held widths
// ---------------------------------------------------------------------------

/**
 * One local reading of each shape the presets give, widest first: the values a card reserves.
 * The unit test asserts each is a preset's library output and none is shorter than any other
 * preset reading.
 */
export const GHOST_LOCAL: readonly string[] = [
  "2026-03-08T08:00:00-04:00[America/New_York]",
  "2026-03-29T08:00:00+02:00[Europe/Berlin]",
  "2011-12-31T12:00:00+14:00[Pacific/Apia]",
  "2026-03-29T08:00:00+05:30[+05:30]",
];

/** The widest UTC answer the presets give. */
export const GHOST_UTC: readonly string[] = ["2026-03-28T22:00:00Z"];

// ---------------------------------------------------------------------------
// The calls
// ---------------------------------------------------------------------------

/** Prints a call and its result the way a call reads, and returns the result. */
function recorder(calls: string[]) {
  return function call<T>(name: string, args: unknown[], result: T): T {
    calls.push(
      `${name}(${args.map(literal).join(", ")}); // ${literal(result)}`,
    );
    return result;
  };
}

// ---------------------------------------------------------------------------
// A clock reading, cut from a string the library wrote
// ---------------------------------------------------------------------------

const READING =
  /T(\d{2}:\d{2})(:\d{2})?(?:\.\d+)?(Z|[+-]\d{2}(?::\d{2}(?::\d{2})?)?)/;

/**
 * The clock reading and offset inside a zoned string (`23:00 +01:00`), for a mark's name. Seconds
 * show only when they are not zero. `""` when the string is not one.
 */
export function readingOf(zoned: string): string {
  const m = READING.exec(zoned);
  if (m === null) return "";
  const seconds = m[2] === undefined || m[2] === ":00" ? "" : m[2];
  return `${m[1]}${seconds} ${m[3]}`;
}

/** Just the clock part of `readingOf`, for an axis tick. */
export function clockOf(zoned: string): string {
  const m = READING.exec(zoned);
  return m === null ? "" : m[1]!;
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

/** An instant and its reading in the zone, `""` for either the library did not give. */
export interface Reading {
  utc: string;
  local: string;
}

export interface Side {
  anchor: Reading;
  answer: Reading;
}

export type LaneId = "gtfs" | "midnight";

export interface RailMark {
  lane: LaneId;
  kind: "anchor" | "answer" | "noon" | "change";
  at: number;
  label: string;
}

export interface RailSpan {
  lane: LaneId;
  kind: "anchor-gap" | "answer-gap";
  at: number;
  span: number;
  label: string;
}

export interface RailTick {
  at: number;
  label: string;
}

export interface Rail {
  marks: RailMark[];
  spans: RailSpan[];
  ticks: RailTick[];
  /** The clock changes in the window, as `offsetBefore → offsetAfter`. */
  changes: RailTick[];
}

export interface ClockResult {
  kind: "empty" | "computed";
  /** `YYYY-MM-DD` from the library's own date rule, or `""`. */
  iso: string;
  /** The year of `iso` as the library parses it, `null` when there is none. */
  year: number | null;
  /** Whether the zone changes its clock in that year at all, for the DST link. */
  hasChange: boolean;
  gtfs: Side;
  midnight: Side;
  noon: Reading;
  /** `diffUtc` of the two answers in minutes: positive when the midnight answer is later. */
  gap: number | null;
  reason: ReasonKey;
  /** `null` when there is nothing to draw. */
  rail: Rail | null;
  railNote: "" | "notDrawn" | "nothing";
  calls: string[];
}

const NONE: Reading = { utc: "", local: "" };

export const BLANK_RESULT: ClockResult = {
  kind: "empty",
  iso: "",
  year: null,
  hasChange: false,
  gtfs: { anchor: NONE, answer: NONE },
  midnight: { anchor: NONE, answer: NONE },
  noon: NONE,
  gap: null,
  reason: "empty",
  rail: null,
  railNote: "nothing",
  calls: [],
};

/**
 * Why `gtfsToInstant` gave `""`, by asking the library again. The probes run in order and the
 * first that matches wins:
 *
 * 1. The stop time is not a GTFS time.
 * 2. The date has no noon in UTC: it is not a date.
 * 3. Noon on that date in the zone: no such zone, skipped, or repeated.
 */
export function explainRefusal(
  lib: ServiceDayLib,
  date: string,
  time: string,
  zone: string,
  calls: string[] = [],
): ReasonKey {
  const call = recorder(calls);
  if (!call("isValidGtfsTime", [time], lib.isValidGtfsTime(time)))
    return "time";
  const noonUtc = call(
    "gtfsToInstant",
    [date, "12:00:00", "UTC"],
    lib.gtfsToInstant(date, "12:00:00", "UTC"),
  );
  if (noonUtc === "") return "date";
  const iso = lib.convertUtcToPlainDate(noonUtc);
  const kind = call(
    "classifyLocal",
    [`${iso}T12:00:00`, zone],
    lib.classifyLocal(`${iso}T12:00:00`, zone),
  );
  if (kind === null) return "zone";
  if (kind === "nonexistent") return "nonexistent";
  if (kind === "ambiguous") return "ambiguous";
  return "other";
}

const TICK_HOURS = 6;
/** Most axis ticks drawn: a longer window doubles the step rather than crowd the axis. */
const MAX_TICKS = 12;
const WINDOW_PAD = { hours: 2 };

/** One clock change `getDstTransitions` reports. */
interface Transition {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

/** Draws the rail, or returns `null` when the library gave no position for an instant. */
function drawRail(
  lib: ServiceDayLib,
  call: ReturnType<typeof recorder>,
  zone: string,
  transitions: readonly Transition[],
  readings: {
    gtfsAnchor: Reading;
    midAnchor: Reading;
    gtfs: Reading;
    midAnswer: Reading;
    noon: Reading;
  },
  gap: number | null,
): Rail | null {
  const { gtfsAnchor, midAnchor, gtfs, midAnswer, noon } = readings;
  const anchors = [gtfsAnchor.utc, midAnchor.utc].filter((u) => u !== "");
  const ends = [gtfs.utc, midAnswer.utc, noon.utc].filter((u) => u !== "");
  const first = call("minUtc", [anchors], lib.minUtc(anchors));
  const last = call("maxUtc", [ends], lib.maxUtc(ends));
  if (first === null || last === null) return null;
  const start = call(
    "subtractUtc",
    [first, WINDOW_PAD],
    lib.subtractUtc(first, WINDOW_PAD),
  );
  const end = call("addUtc", [last, WINDOW_PAD], lib.addUtc(last, WINDOW_PAD));
  if (start === "" || end === "") return null;
  const width = lib.diffUtc(end, start, "minutes");
  if (width === null || width === 0) return null;
  const at = (instant: string): number | null => {
    const d = lib.diffUtc(instant, start, "minutes");
    return d === null ? null : d / width;
  };

  const marks: RailMark[] = [];
  const place = (
    lane: LaneId,
    kind: RailMark["kind"],
    reading: Reading,
    name: string,
  ): boolean => {
    if (reading.utc === "") return true;
    const x = at(reading.utc);
    if (x === null) return false;
    marks.push({
      lane,
      kind,
      at: x,
      label: `${name} ${readingOf(reading.local)}`,
    });
    return true;
  };
  const ok =
    place("gtfs", "anchor", gtfsAnchor, "anchor") &&
    place("gtfs", "answer", gtfs, "answer") &&
    place("gtfs", "noon", noon, "noon") &&
    place("midnight", "anchor", midAnchor, "anchor") &&
    place("midnight", "answer", midAnswer, "answer");
  if (!ok) return null;

  const spans: RailSpan[] = [];
  if (gap !== null && gap !== 0) {
    const gapSpan = (
      kind: RailSpan["kind"],
      a: string,
      b: string,
      name: string,
    ): boolean => {
      const lo = at(a);
      const hi = at(b);
      if (lo === null || hi === null) return false;
      spans.push({
        lane: "midnight",
        kind,
        at: Math.min(lo, hi),
        span: Math.abs(hi - lo),
        label: `gap between the ${name}, ${minutesText(Math.abs(gap))}`,
      });
      return true;
    };
    if (
      !gapSpan("anchor-gap", gtfsAnchor.utc, midAnchor.utc, "anchors") ||
      !gapSpan("answer-gap", gtfs.utc, midAnswer.utc, "answers")
    ) {
      return null;
    }
  }

  // Axis ticks every 6 hours from the window's start, widening the step for a long window.
  const ticks: RailTick[] = [];
  let step = TICK_HOURS;
  // `diffUtc(end, start)` is start minus end: negative for a window that runs forward.
  const minutes = Math.abs(width);
  while (minutes / (step * 60) > MAX_TICKS) step *= 2;
  for (let k = 0; k * step * 60 <= minutes; k++) {
    const instant = lib.addUtc(start, { hours: k * step });
    if (instant === "") return null;
    const x = at(instant);
    if (x === null) return null;
    ticks.push({
      at: x,
      label: clockOf(lib.convertUtcToZoned(instant, zone)),
    });
  }

  // The clock changes inside the window.
  const changes: RailTick[] = [];
  for (const t of transitions) {
    if (!lib.isBetweenUtc(t.instant, start, end)) continue;
    const x = at(t.instant);
    if (x === null) return null;
    const label = `${t.offsetBefore} → ${t.offsetAfter}`;
    changes.push({ at: x, label });
    for (const lane of ["gtfs", "midnight"] as const) {
      marks.push({
        lane,
        kind: "change",
        at: x,
        label: `clock change ${label}`,
      });
    }
  }
  return { marks, spans, ticks, changes };
}

/**
 * Computes everything the tool shows for `state`. An empty box makes no call. The library's
 * `""` or `null` stays `""` or `null` in the result: the mount renders it as NO SIGNAL.
 */
export function computeClock(
  lib: ServiceDayLib,
  state: ServiceDayState,
): ClockResult {
  const { date, time, zone } = state;
  if (date === "" || time === "" || zone === "") return BLANK_RESULT;

  const calls: string[] = [];
  const call = recorder(calls);
  const local = (utc: string): string =>
    utc === ""
      ? ""
      : call(
          "convertUtcToZoned",
          [utc, zone],
          lib.convertUtcToZoned(utc, zone),
        );
  const reading = (utc: string): Reading => ({ utc, local: local(utc) });

  const gtfsUtc = call(
    "gtfsToInstant",
    [date, time, zone],
    lib.gtfsToInstant(date, time, zone),
  );
  const gtfsAnchorUtc = call(
    "gtfsToInstant",
    [date, "00:00:00", zone],
    lib.gtfsToInstant(date, "00:00:00", zone),
  );
  const noonUtc = call(
    "gtfsToInstant",
    [date, "12:00:00", zone],
    lib.gtfsToInstant(date, "12:00:00", zone),
  );
  const dayNoon = call(
    "gtfsToInstant",
    [date, "12:00:00", "UTC"],
    lib.gtfsToInstant(date, "12:00:00", "UTC"),
  );
  const iso =
    dayNoon === ""
      ? ""
      : call(
          "convertUtcToPlainDate",
          [dayNoon],
          lib.convertUtcToPlainDate(dayNoon),
        );

  const midUtc =
    iso === ""
      ? ""
      : call(
          "resolveLocal",
          [`${iso}T00:00:00`, zone],
          lib.resolveLocal(`${iso}T00:00:00`, zone),
        );
  const record = call("parseGtfsTime", [time], lib.parseGtfsTime(time));
  const midAnswerUtc =
    midUtc === "" || record === null
      ? ""
      : call(
          "addUtc",
          [midUtc, { days: record.dayOverflow, seconds: record.seconds }],
          lib.addUtc(midUtc, {
            days: record.dayOverflow,
            seconds: record.seconds,
          }),
        );

  const gtfs: Side = {
    anchor: reading(gtfsAnchorUtc),
    answer: reading(gtfsUtc),
  };
  const midnight: Side = {
    anchor: reading(midUtc),
    answer: reading(midAnswerUtc),
  };
  const noon = reading(noonUtc);

  const gap =
    gtfsUtc === "" || midAnswerUtc === ""
      ? null
      : call(
          "diffUtc",
          [gtfsUtc, midAnswerUtc, "minutes"],
          lib.diffUtc(gtfsUtc, midAnswerUtc, "minutes"),
        );

  const parsed = iso === "" ? Number.NaN : Number(lib.parseYearFromDate(iso));
  const year = Number.isFinite(parsed) ? parsed : null;
  const transitions: Transition[] =
    year === null
      ? []
      : call(
          "getDstTransitions",
          [zone, year],
          lib.getDstTransitions(zone, year),
        );

  const reason: ReasonKey =
    gtfsUtc === "" ? explainRefusal(lib, date, time, zone, calls) : "ok";

  let rail: Rail | null = null;
  let railNote: ClockResult["railNote"] = "nothing";
  const anyInstant =
    gtfsAnchorUtc !== "" || midUtc !== "" || gtfsUtc !== "" || noonUtc !== "";
  if (anyInstant) {
    rail = drawRail(
      lib,
      call,
      zone,
      transitions,
      {
        gtfsAnchor: gtfs.anchor,
        midAnchor: midnight.anchor,
        gtfs: gtfs.answer,
        midAnswer: midnight.answer,
        noon,
      },
      gap,
    );
    railNote = rail === null ? "notDrawn" : "";
  }

  return {
    kind: "computed",
    iso,
    year,
    hasChange: transitions.length > 0,
    gtfs,
    midnight,
    noon,
    gap,
    reason,
    rail,
    railNote,
    calls,
  };
}

/**
 * The widest text the calls frame can print, so it holds one height whatever the reader types:
 * a stub library answering with the widest values, run through the real reader.
 */
export function callsSizerText(): string {
  const zone = "America/New_York";
  const utc = "2026-03-28T22:00:00Z";
  const stub = {
    gtfsToInstant: () => utc,
    resolveLocal: () => utc,
    classifyLocal: () => "unique",
    addUtc: () => utc,
    subtractUtc: () => utc,
    diffUtc: () => 1440,
    minUtc: () => utc,
    maxUtc: () => utc,
    isBetweenUtc: () => true,
    convertUtcToZoned: () => GHOST_LOCAL[0]!,
    convertUtcToPlainDate: () => "2026-03-08",
    parseYearFromDate: () => "2026",
    getDstTransitions: () => [
      { instant: utc, offsetBefore: "-05:00", offsetAfter: "-04:00" },
      { instant: utc, offsetBefore: "-04:00", offsetAfter: "-05:00" },
      { instant: utc, offsetBefore: "-10:00", offsetAfter: "+14:00" },
    ],
    parseGtfsTime: () => ({ seconds: 86399, dayOverflow: 41 }),
    isValidGtfsTime: () => true,
  } as unknown as ServiceDayLib;
  return computeClock(stub, {
    date: "20260308",
    time: "999:59:59",
    zone,
  }).calls.join("\n");
}
