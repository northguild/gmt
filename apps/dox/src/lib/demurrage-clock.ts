/**
 * Pure helpers for the Demurrage Clock widget (INT-14).
 *
 * Demurrage and detention are two clocks on one container, and they share one
 * event and nothing else. The tool takes a container's events and runs
 * `demurrageClock` once for each of the four clocks, then draws the four
 * intervals against the events they come from. It teaches which two events
 * bound each clock, not where the events sit.
 *
 * No DOM and no gmt import. Every function that calls the library takes a
 * `DemurrageLib`, loaded by the mount (`ledger-lib.ts`). The widget draws the
 * library's results and computes none of them. The one site-side rule is
 * `clockPair`, and it holds no table either: it asks the library. It calls
 * `demurrageClock` with one event of each of the seven types at seven known,
 * rising instants, and reads the two types back from the strings that come
 * out. `@js-temporal/polyfill` is imported for drawing only, in the helpers
 * this module shares with the other ledger tools.
 *
 * The terminal clock is a display zone. It sets the day columns and the local
 * times on the chips and plates. It is not an argument of `demurrageClock`.
 *
 * Naming rule: GMT tracks no law, and the UI names no body. No string here
 * names a statute, an agency, a carrier or a court. The seven event types are
 * the library's own names for what happens to a container. A place may be
 * named as an example (a preset's terminal clock).
 */

import { toEpochMs } from "./dwell-ledger";
import { runCall, type EdiCall } from "./edi-widgets";
import {
  hourDurationText,
  localText,
  NO_RESULT,
  type PlateSpec,
  type SeriesNumber,
} from "./ledger-widgets";
import type { ClockInterval, DemurrageLib } from "./ledger-lib";

// ---------------------------------------------------------------------------
// The library's names
// ---------------------------------------------------------------------------

/** The events a charging clock can start or end at, in the library's own names. */
export const CLOCK_EVENT_TYPES = [
  "discharged",
  "available",
  "gatedOut",
  "emptyReturned",
  "emptyReleased",
  "gatedIn",
  "loaded",
] as const;

/** The four clocks, in the order the lanes are drawn. */
export const CLOCK_SCOPES = [
  "demurrage",
  "detention",
  "storage",
  "combined",
] as const;

export const CLOCK_DIRECTIONS = ["import", "export"] as const;

/** Where an import clock starts when the tariff says so. */
export const CLOCK_START_EVENTS = ["discharged", "available"] as const;

/** The most event rows the form holds. */
export const MAX_EVENTS = 6;

export const CUSTOM_PRESET_ID = "custom";

/**
 * Seven known instants, one for each event type, each later than the last. The
 * probe puts the n-th type at the n-th instant, so a start or an end read back
 * from the library names its event.
 */
const PROBE_INSTANTS = [
  "2024-01-01T00:00:00Z",
  "2024-01-02T00:00:00Z",
  "2024-01-03T00:00:00Z",
  "2024-01-04T00:00:00Z",
  "2024-01-05T00:00:00Z",
  "2024-01-06T00:00:00Z",
  "2024-01-07T00:00:00Z",
] as const;

/** An event in words: `gatedOut` is "gated out". */
export function eventWord(type: string): string {
  return type.replace(/([A-Z])/g, " $1").toLowerCase();
}

// ---------------------------------------------------------------------------
// State and seeds
// ---------------------------------------------------------------------------

export interface EventRow {
  type: string;
  at: string;
}

/** The widget's controls, as strings, which is what the DOM holds. */
export interface DemurrageState {
  /** Always `MAX_EVENTS` rows. A row with both fields blank is not an event. */
  rows: EventRow[];
  scope: string;
  direction: string;
  /** Blank leaves `startEvent` out of the call. */
  startEvent: string;
  /** The terminal clock, a display zone. Blank is UTC. */
  zone: string;
}

type FlatKeys = {
  [K in `type${1 | 2 | 3 | 4 | 5 | 6}` | `at${1 | 2 | 3 | 4 | 5 | 6}`]?: string;
};

/**
 * Seed arguments. The chat tool sends `events` (an array); a permalink can only
 * carry strings, so the rows are flat keys (`type1`, `at1`, ...) and
 * `eventCount` says how many are read. `events` wins when both are present.
 */
export interface DemurrageClockArgs extends FlatKeys {
  events?: { type?: string; at?: string }[];
  eventCount?: string;
  scope?: string;
  direction?: string;
  startEvent?: string;
  zone?: string;
}

const ARG_KEYS: readonly string[] = [
  "events",
  "eventCount",
  "scope",
  "direction",
  "startEvent",
  "zone",
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`type${n}`, `at${n}`]),
];

/** Whether the args name anything, so the widget opens on them and not on a preset. */
export function isSeeded(args: DemurrageClockArgs): boolean {
  const rec = args as Record<string, unknown>;
  return ARG_KEYS.some((key) => rec[key] !== undefined);
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const BLANK_ROW: EventRow = { type: "", at: "" };

function padRows(rows: readonly EventRow[]): EventRow[] {
  const out: EventRow[] = [];
  for (let i = 0; i < MAX_EVENTS; i++) out.push({ ...(rows[i] ?? BLANK_ROW) });
  return out;
}

/**
 * Seed arguments as control values. `events` (an array) wins; otherwise the
 * flat keys, of which `eventCount` limits how many are read. Anything that is
 * not a string becomes `""`, and a key the seed does not carry stays blank: the
 * direction and the scope are never filled in for the reader.
 */
export function readArgs(args: DemurrageClockArgs): DemurrageState {
  const rec = args as Record<string, unknown>;
  let rows: EventRow[];
  if (Array.isArray(args.events)) {
    rows = args.events
      .slice(0, MAX_EVENTS)
      .map((e) => ({ type: str(e?.type), at: str(e?.at) }));
  } else {
    const count = Number.parseInt(str(args.eventCount), 10);
    const limit =
      Number.isInteger(count) && count >= 1 && count <= MAX_EVENTS
        ? count
        : MAX_EVENTS;
    rows = [];
    for (let n = 1; n <= limit; n++) {
      rows.push({ type: str(rec[`type${n}`]), at: str(rec[`at${n}`]) });
    }
  }
  return {
    rows: padRows(rows),
    scope: str(args.scope),
    direction: str(args.direction),
    startEvent: str(args.startEvent),
    zone: str(args.zone),
  };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface DemurrageClockPreset {
  id: string;
  label: string;
  description: string;
  /** The events, in the order the form lists them. */
  events: readonly EventRow[];
  scope: string;
  direction: string;
  startEvent: string;
  /** The terminal clock, written by hand: the library maps no place to a zone. */
  zone: string;
}

/** The import example of the function's JSDoc: four events, one container. */
const IMPORT_EVENTS: readonly EventRow[] = [
  { type: "discharged", at: "2024-06-14T19:00:00Z" },
  { type: "available", at: "2024-06-15T12:00:00Z" },
  { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
  { type: "emptyReturned", at: "2024-06-27T09:00:00Z" },
];

/** The export example of the function's JSDoc. */
const EXPORT_EVENTS: readonly EventRow[] = [
  { type: "emptyReleased", at: "2024-07-01T08:00:00Z" },
  { type: "gatedIn", at: "2024-07-05T16:00:00Z" },
  { type: "loaded", at: "2024-07-09T03:00:00Z" },
];

/**
 * Every preset is one of `demurrageClock`'s JSDoc examples, so the interval the
 * widget prints is one the library documents. The mount test asserts each one
 * against the literal strings. The terminal clock is a display zone: it moves
 * the day columns and the local times, never the interval.
 */
export const DEMURRAGE_PRESETS: readonly DemurrageClockPreset[] = [
  {
    id: "import-demurrage",
    label: "Import demurrage",
    description:
      "An import container is discharged, becomes available, leaves the terminal and comes back empty. The demurrage clock runs from discharge to gate-out.",
    events: IMPORT_EVENTS,
    scope: "demurrage",
    direction: "import",
    startEvent: "",
    zone: "America/New_York",
  },
  {
    id: "import-detention",
    label: "Import detention",
    description:
      "The same four events, read as detention. Detention starts where demurrage stops: at the gate-out, and it runs to the empty return. The discharge is not part of it.",
    events: IMPORT_EVENTS,
    scope: "detention",
    direction: "import",
    startEvent: "",
    zone: "America/New_York",
  },
  {
    id: "export-storage",
    label: "Export storage",
    description:
      "An export container is picked up empty, gated in full and loaded on board. The storage clock runs from the full gate-in to the loading.",
    events: EXPORT_EVENTS,
    scope: "storage",
    direction: "export",
    startEvent: "",
    zone: "Asia/Shanghai",
  },
  {
    id: "merged-clock",
    label: "Combined clock",
    description:
      "The import events read as one merged clock: demurrage and detention as a single period, from the discharge to the empty return.",
    events: IMPORT_EVENTS,
    scope: "combined",
    direction: "import",
    startEvent: "",
    zone: "Europe/Amsterdam",
  },
  {
    id: "recorded-twice",
    label: "Discharged twice",
    description:
      "A container discharged twice is a data error, not a choice. The library does not pick one of the two, so every clock that starts at discharge returns no interval.",
    events: [
      { type: "discharged", at: "2024-06-14T19:00:00Z" },
      { type: "discharged", at: "2024-06-15T19:00:00Z" },
      { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
    ],
    scope: "demurrage",
    direction: "import",
    startEvent: "",
    zone: "America/New_York",
  },
  {
    id: "gate-out-before-discharge",
    label: "Gate-out before discharge",
    description:
      "The gate-out is earlier than the discharge. A clock that ends before it starts is a data error, so the library returns no interval.",
    events: [
      { type: "discharged", at: "2024-06-21T19:00:00Z" },
      { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
    ],
    scope: "demurrage",
    direction: "import",
    startEvent: "",
    zone: "America/New_York",
  },
];

/** A preset as control values. */
export function presetState(p: DemurrageClockPreset): DemurrageState {
  return {
    rows: padRows(p.events),
    scope: p.scope,
    direction: p.direction,
    startEvent: p.startEvent,
    zone: p.zone,
  };
}

/** The preset whose controls match `state`, or `custom`. */
export function matchPreset(state: DemurrageState): string {
  const hit = DEMURRAGE_PRESETS.find((p) => {
    const s = presetState(p);
    return (
      s.scope === state.scope &&
      s.direction === state.direction &&
      s.startEvent === state.startEvent &&
      s.zone === state.zone &&
      s.rows.every(
        (r, i) =>
          r.type === (state.rows[i]?.type ?? "") &&
          r.at === (state.rows[i]?.at ?? ""),
      )
    );
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// The library's arguments
// ---------------------------------------------------------------------------

const isBlankRow = (r: EventRow): boolean =>
  r.type.trim() === "" && r.at.trim() === "";

/** The events the library is called with: every row that is not blank, as typed. */
export function eventsOf(state: DemurrageState): EventRow[] {
  return state.rows
    .filter((r) => !isBlankRow(r))
    .map((r) => ({ type: r.type.trim(), at: r.at.trim() }));
}

export interface ClockOptions {
  direction: string;
  startEvent?: string;
}

/** The options object: `startEvent` is left out when the reader gave none. */
export function optionsOf(state: DemurrageState): ClockOptions {
  const startEvent = state.startEvent.trim();
  return startEvent === ""
    ? { direction: state.direction.trim() }
    : { direction: state.direction.trim(), startEvent };
}

/** `eventCount` and every non-blank row under its flat key, then the options. Strings only. */
export function permalinkOf(state: DemurrageState): Record<string, string> {
  const out: Record<string, string> = {};
  let count = 0;
  state.rows.forEach((r, i) => {
    if (!isBlankRow(r)) count = i + 1;
  });
  if (count > 0) out["eventCount"] = String(count);
  state.rows.forEach((r, i) => {
    const n = i + 1;
    if (r.type.trim() !== "") out[`type${n}`] = r.type.trim();
    if (r.at.trim() !== "") out[`at${n}`] = r.at.trim();
  });
  if (state.scope.trim() !== "") out["scope"] = state.scope.trim();
  if (state.direction.trim() !== "") out["direction"] = state.direction.trim();
  if (state.startEvent.trim() !== "")
    out["startEvent"] = state.startEvent.trim();
  if (state.zone.trim() !== "") out["zone"] = state.zone.trim();
  return out;
}

// ---------------------------------------------------------------------------
// Which pair bounds a clock
// ---------------------------------------------------------------------------

export interface ClockPair {
  start: string;
  end: string;
}

/**
 * The two events a clock runs between, read from the library and never from a
 * table. `demurrageClock` is called with one event of each of the seven types at
 * seven known, rising instants, under the reader's scope and options. The
 * strings it returns are two of those instants, and each names its event.
 * `null` when the library returns `null` for the scope and options.
 */
export function clockPair(
  scope: string,
  options: ClockOptions,
  lib: DemurrageLib,
): ClockPair | null {
  const events = CLOCK_EVENT_TYPES.map((type, i) => ({
    type,
    at: PROBE_INSTANTS[i]!,
  }));
  const found = lib.demurrageClock(events, scope, options);
  if (found === null) return null;
  const instants: readonly string[] = PROBE_INSTANTS;
  const start = instants.indexOf(found.start);
  const end = instants.indexOf(found.end);
  if (start === -1 || end === -1) return null;
  return { start: CLOCK_EVENT_TYPES[start]!, end: CLOCK_EVENT_TYPES[end]! };
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type LaneReasonCode =
  | "bad-scope"
  | "bad-direction"
  | "bad-start-event"
  | "bad-event"
  | "missing"
  | "twice"
  | "inverted";

export interface LaneReason {
  code: LaneReasonCode;
  /** The words on the lane's chip. */
  lane: string;
  /** The sentence in the caution aside. */
  sentence: string;
}

const isOneOf = (list: readonly string[], value: string): boolean =>
  list.includes(value);

/**
 * Why `demurrageClock` returned `null` for a scope, checked in the order the
 * library checks, so the reason shown is the one that stopped it. The pair
 * comes from `clockPair`, so the event named is the event the library reads.
 * `null` when none applies.
 */
export function explainClockNull(
  state: DemurrageState,
  scope: string,
  pair: ClockPair | null,
  lib: Pick<DemurrageLib, "isValidInstant">,
): LaneReason | null {
  if (!isOneOf(CLOCK_SCOPES, scope)) {
    return {
      code: "bad-scope",
      lane: "not a clock the library selects",
      sentence:
        scope === ""
          ? "No clock is chosen. Choose demurrage, detention, storage or combined."
          : `${scope} is not a clock the library selects. Choose demurrage, detention, storage or combined.`,
    };
  }
  if (!isOneOf(CLOCK_DIRECTIONS, state.direction.trim())) {
    return {
      code: "bad-direction",
      lane: "direction is not import or export",
      sentence:
        "The direction must be import or export. It has no default, because the same clock runs between different events on each leg.",
    };
  }
  const startEvent = state.startEvent.trim();
  if (startEvent !== "" && !isOneOf(CLOCK_START_EVENTS, startEvent)) {
    return {
      code: "bad-start-event",
      lane: "start event is not discharged or available",
      sentence: "The start event must be discharged or available, or left out.",
    };
  }
  const events = eventsOf(state);
  const badRow = state.rows.findIndex(
    (r) =>
      !isBlankRow(r) &&
      (!isOneOf(CLOCK_EVENT_TYPES, r.type.trim()) ||
        !lib.isValidInstant(r.at.trim())),
  );
  if (badRow !== -1) {
    return {
      code: "bad-event",
      lane: `row ${badRow + 1} is not a valid event`,
      sentence: `Row ${badRow + 1} is not a valid event. It needs one of the seven event types and an instant with a Z, an offset, or an offset and a bracketed zone.`,
    };
  }
  if (pair === null) return null;
  const count = (type: string) => events.filter((e) => e.type === type).length;
  for (const type of [pair.start, pair.end]) {
    const n = count(type);
    if (n === 0) {
      return {
        code: "missing",
        lane: `${eventWord(type)} is not recorded`,
        sentence: `The ${eventWord(type)} event is not recorded. This clock runs from ${eventWord(pair.start)} to ${eventWord(pair.end)}.`,
      };
    }
    if (n > 1) {
      return {
        code: "twice",
        lane: `${eventWord(type)} is recorded twice`,
        sentence: `The ${eventWord(type)} event is recorded twice. That is a data error, not a choice, so the library picks neither.`,
      };
    }
  }
  const startAt = events.find((e) => e.type === pair.start)!.at;
  const endAt = events.find((e) => e.type === pair.end)!.at;
  if (toEpochMs(startAt) > toEpochMs(endAt)) {
    return {
      code: "inverted",
      lane: `${eventWord(pair.end)} is before ${eventWord(pair.start)}`,
      sentence: `The ${eventWord(pair.end)} event is before the ${eventWord(pair.start)} event. A clock that ends before it starts is a data error.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface LaneRead {
  scope: string;
  /** The `demurrageClock` call made for this clock. */
  call: EdiCall;
  interval: ClockInterval | null;
  /** The two events the library reads for this clock, or `null`. */
  pair: ClockPair | null;
  /** Why the interval is `null`, else `null`. */
  reason: LaneReason | null;
}

export interface Elapsed {
  /** The three calls that put the interval's strings on one clock. */
  calls: EdiCall[];
  /** The ISO 8601 duration `diffUtcAsDuration` returned. */
  duration: string;
}

export interface ClockRead {
  /** The four lanes, in `CLOCK_SCOPES` order. */
  lanes: LaneRead[];
  /** The chosen scope's lane. Its own call when the scope is not one of the four. */
  chosen: LaneRead;
  /** Every call made, in order: the chosen scope's first, then the other lanes', then the elapsed ones. */
  calls: EdiCall[];
  /** The elapsed time of the chosen interval, when it has one. */
  elapsed: Elapsed | null;
}

function readLane(
  state: DemurrageState,
  scope: string,
  lib: DemurrageLib,
): LaneRead {
  const options = optionsOf(state);
  const call = runCall(lib, "demurrageClock", eventsOf(state), scope, options);
  const interval = call.result as ClockInterval | null;
  const pair = clockPair(scope, options, lib);
  return {
    scope,
    call,
    interval,
    pair,
    reason:
      interval === null ? explainClockNull(state, scope, pair, lib) : null,
  };
}

/**
 * The four clocks and the chosen one. `demurrageClock` is called once for each
 * of the four scopes, with the reader's events and options: each lane is a fresh
 * call. When the chosen scope returned an interval, `toOffsetInstant` puts each
 * end on a `Z` instant and `diffUtcAsDuration` measures between them, because
 * `demurrageClock` returns the caller's own strings and `diffUtcAsDuration`
 * reads `Z` instants only.
 */
export function readClocks(
  state: DemurrageState,
  lib: DemurrageLib,
): ClockRead {
  const lanes = CLOCK_SCOPES.map((scope) => readLane(state, scope, lib));
  const scope = state.scope.trim();
  const chosen =
    lanes.find((l) => l.scope === scope) ?? readLane(state, scope, lib);
  const calls = [
    chosen.call,
    ...lanes.filter((l) => l !== chosen).map((l) => l.call),
  ];
  let elapsed: Elapsed | null = null;
  if (chosen.interval !== null) {
    const start = runCall(lib, "toOffsetInstant", chosen.interval.start);
    const end = runCall(lib, "toOffsetInstant", chosen.interval.end);
    const a = start.result as { instant: string } | null;
    const b = end.result as { instant: string } | null;
    if (a !== null && b !== null) {
      const diff = runCall(
        lib,
        "diffUtcAsDuration",
        a.instant,
        b.instant,
        "hours",
      );
      elapsed = { calls: [start, end, diff], duration: diff.result as string };
      calls.push(start, end, diff);
    }
  }
  return { lanes, chosen, calls, elapsed };
}

// ---------------------------------------------------------------------------
// Drawing text
// ---------------------------------------------------------------------------

/** The terminal clock as the widget names it: the zone, or UTC when there is none. */
export function zoneLabel(zone: string): string {
  return zone.trim() === "" ? "UTC" : zone.trim();
}

/** Whether the drawing can lay out days in `zone` (blank is UTC). */
export function zoneReadable(zone: string): boolean {
  return localText("2000-01-01T00:00:00Z", zoneLabel(zone)) !== "";
}

/** The series (1 to 4) of a scope's lane, or `undefined` for a scope with no lane. */
export function seriesOf(scope: string): SeriesNumber | undefined {
  const i = (CLOCK_SCOPES as readonly string[]).indexOf(scope);
  return i === -1 ? undefined : ((i + 1) as SeriesNumber);
}

/** A lane's label: its scope and, when the library reads a pair for it, the pair. */
export function laneLabel(scope: string, pair: ClockPair | null): string {
  return pair === null
    ? scope
    : `${scope}: ${eventWord(pair.start)} to ${eventWord(pair.end)}`;
}

/** An event row drawn on the rail. */
export interface EventMark {
  /** The row's number, 1 to 6. */
  n: number;
  type: string;
  word: string;
  at: string;
  ms: number;
  /** The instant on the terminal clock: "Fri 14 Jun 15:00". */
  local: string;
}

/** The rows the rail can draw: a known type and an instant the library accepts. */
export function eventMarks(
  state: DemurrageState,
  lib: Pick<DemurrageLib, "isValidInstant">,
): EventMark[] {
  const zone = zoneLabel(state.zone);
  const marks: EventMark[] = [];
  state.rows.forEach((r, i) => {
    const type = r.type.trim();
    const at = r.at.trim();
    if (!isOneOf(CLOCK_EVENT_TYPES, type) || !lib.isValidInstant(at)) return;
    const ms = toEpochMs(at);
    if (Number.isNaN(ms)) return;
    marks.push({
      n: i + 1,
      type,
      word: eventWord(type),
      at,
      ms,
      local: localText(at, zone),
    });
  });
  return marks;
}

/** The sentence a lane's list item carries for a screen reader. */
export function laneAria(lane: LaneRead, zone: string): string {
  const label = laneLabel(lane.scope, lane.pair);
  if (lane.interval === null) {
    return `${label}: ${lane.reason ? lane.reason.lane : "no clock"}`;
  }
  const z = zoneLabel(zone);
  const from = localText(lane.interval.start, z);
  const to = localText(lane.interval.end, z);
  return `${label}: from ${from === "" ? lane.interval.start : from} to ${to === "" ? lane.interval.end : to}`;
}

/**
 * The three result plates, for the chosen clock. The event words come from the
 * pair the library reads, so the captions hold when the interval is `null`: the
 * times and the elapsed plate then read "no result". A clock the library reads
 * no pair for has no words, and its plates read "no result" throughout.
 */
export function clockPlates(read: ClockRead, zone: string): PlateSpec[] {
  const { chosen, elapsed } = read;
  const z = zoneLabel(zone);
  const timeOf = (instant: string | undefined): string => {
    if (instant === undefined) return NO_RESULT;
    const text = localText(instant, z);
    return text === "" ? "zone not read" : text;
  };
  const series = seriesOf(chosen.scope);
  return [
    {
      role: "hero-start",
      caption: "Clock starts",
      ...(series === undefined ? {} : { series }),
      quiet: true,
      value: chosen.pair === null ? null : eventWord(chosen.pair.start),
      lines: [timeOf(chosen.interval?.start)],
    },
    {
      role: "hero-end",
      caption: "Clock ends",
      ...(series === undefined ? {} : { series }),
      quiet: true,
      value: chosen.pair === null ? null : eventWord(chosen.pair.end),
      lines: [timeOf(chosen.interval?.end)],
    },
    {
      role: "hero-ran",
      caption: "Ran for",
      ...(series === undefined ? {} : { series }),
      value:
        elapsed === null
          ? null
          : hourDurationText(elapsed.duration) || elapsed.duration,
      lines: [elapsed === null ? "" : elapsed.duration],
    },
  ];
}

/** The three plates before the library has answered: the same boxes, "no result". */
export function blankPlates(scope: string): PlateSpec[] {
  const series = seriesOf(scope.trim());
  const base = series === undefined ? {} : { series };
  return [
    {
      role: "hero-start",
      caption: "Clock starts",
      ...base,
      quiet: true,
      value: null,
      lines: [""],
    },
    {
      role: "hero-end",
      caption: "Clock ends",
      ...base,
      quiet: true,
      value: null,
      lines: [""],
    },
    { role: "hero-ran", caption: "Ran for", ...base, value: null, lines: [""] },
  ];
}

/** One sentence for the visually hidden live region: both ends and the elapsed time. */
export function summaryText(read: ClockRead, zone: string): string {
  const { chosen, elapsed } = read;
  const z = zoneLabel(zone);
  const label = laneLabel(chosen.scope, chosen.pair);
  if (chosen.interval === null) {
    return `${label}: no clock. ${chosen.reason ? chosen.reason.sentence : ""}`.trim();
  }
  const at = (instant: string) => localText(instant, z) || instant;
  const ran =
    elapsed === null
      ? ""
      : ` It ran for ${hourDurationText(elapsed.duration) || elapsed.duration}.`;
  return `${label}: from ${at(chosen.interval.start)} to ${at(chosen.interval.end)} on the ${z} clock.${ran}`;
}

// ---------------------------------------------------------------------------
// The hand-off to the Free Time Ledger
// ---------------------------------------------------------------------------

/**
 * The Free Time Ledger's seed for the chosen clock: its `start` and `end` as
 * the library returned them, and the terminal clock. `zone` is left out when
 * there is none. `null` when the chosen scope returned `null`.
 */
export function freeTimeArgs(
  read: ClockRead,
  state: DemurrageState,
): Record<string, string> | null {
  const interval = read.chosen.interval;
  if (interval === null) return null;
  const zone = state.zone.trim();
  return {
    clockStart: interval.start,
    clockEnd: interval.end,
    ...(zone === "" ? {} : { zone }),
  };
}

/** Why the link is disabled, else `""`. */
export function freeTimeHint(read: ClockRead): string {
  return read.chosen.interval === null
    ? "No clock to count: the chosen clock returned no interval."
    : "";
}
