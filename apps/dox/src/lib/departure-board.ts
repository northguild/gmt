/**
 * Pure helpers for the Departure Board (TRAN-57): `nextDeparture` reading a
 * timetable list or a service every N minutes, after an arrival plus the time
 * it takes to connect.
 *
 * Every departure shown comes from a real `PunctualityLib` call. The tool's one
 * naive value is the same call with no `minimumConnection`. `@js-temporal/
 * polyfill` is used only through `punctuality-widgets.ts` for drawing the rail
 * (positions, tick instants, the connection bar's end) and for writing a
 * handle's position in the arrival's own notation.
 *
 * `""` from `nextDeparture` means two things: invalid input, and no departure
 * qualifies. `departureNullReason` tells them apart by probing the library,
 * never by guessing, so a correct empty answer is never drawn as NO SIGNAL.
 *
 * No DOM and no gmt import: the library comes in from the mount.
 */

import {
  epochMs,
  isoToMinutes,
  writeLike,
  writtenLabel,
  type Headway,
  type PunctualityLib,
} from "./punctuality-widgets";

export const MAX_DEPARTURES = 6;
export const CUSTOM_PRESET_ID = "custom";

export type BoardForm = "list" | "headway";

export interface DepartureState {
  form: BoardForm;
  after: string;
  minimumConnection: string;
  /** `"1"` to `"6"`: the first this many list slots are visible. */
  departureCount: string;
  /** Always six; unused ones are blank. */
  departures: string[];
  headway: string;
  from: string;
  to: string;
  onwardDuration: string;
  onwardZone: string;
  onwardMode: string;
}

/** What a chat call or a permalink hands over. */
export interface DepartureBoardArgs {
  after?: string;
  departures?: string[];
  headway?: string;
  from?: string;
  to?: string;
  minimumConnection?: string;
  onwardDuration?: string;
  onwardZone?: string;
  preset?: string;
  form?: string;
  departureCount?: string;
  [key: string]: unknown;
}

type Timetable = readonly string[] | Headway;

export interface DeparturePreset {
  id: string;
  label: string;
  description: string;
  form: BoardForm;
  departures: readonly string[];
  headway: Headway;
  after: string;
  minimumConnection: string;
  onwardDuration: string;
  onwardZone: string;
  onwardMode: string;
}

const AMS = (t: string) => `2024-06-15T${t}+02:00[Europe/Amsterdam]`;
const HEL = (t: string) => `2024-06-15T${t}+03:00[Europe/Helsinki]`;
const EDT = (t: string) => `2024-11-03T${t}-04:00[America/New_York]`;
const EST = (t: string) => `2024-11-03T${t}-05:00[America/New_York]`;

/** Appendix Z's SHUTTLE, FERRY (out of order) and HOURLY. */
const SHUTTLE: Headway = {
  headway: "PT20M",
  from: AMS("06:00:00"),
  to: AMS("09:00:00"),
};
const FERRY: readonly string[] = [
  HEL("16:30:00"),
  HEL("07:30:00"),
  HEL("10:30:00"),
  HEL("13:00:00"),
  HEL("19:30:00"),
];
const HOURLY: Headway = {
  headway: "PT1H",
  from: EDT("00:00:00"),
  to: EST("04:00:00"),
};

export const DEPARTURE_PRESETS: readonly DeparturePreset[] = [
  {
    id: "shuttle-headway",
    label: "A shuttle every 20 minutes from 06:00, a 10-minute connection",
    description:
      "An airport shuttle in Amsterdam leaves every 20 minutes from 06:00 until 09:00 on 15 June 2024. You arrive at 06:12 and need 10 minutes to reach the stop, so the 06:20 is gone and you make the 06:40.",
    form: "headway",
    departures: FERRY,
    headway: SHUTTLE,
    after: AMS("06:12:00"),
    minimumConnection: "PT10M",
    onwardDuration: "PT35M",
    onwardZone: "Europe/Amsterdam",
    onwardMode: "shuttle",
  },
  {
    id: "ferry-list",
    label: "Five ferries from Helsinki, a 45-minute connection",
    description:
      "Ferries leave Helsinki at 07:30, 10:30, 13:00, 16:30 and 19:30 on 15 June 2024, listed out of order. Your train arrives at 10:05 and boarding takes 45 minutes, so you miss the 10:30 and make the 13:00.",
    form: "list",
    departures: FERRY,
    headway: SHUTTLE,
    after: HEL("10:05:00"),
    minimumConnection: "PT45M",
    onwardDuration: "PT2H",
    onwardZone: "Europe/Tallinn",
    onwardMode: "ferry",
  },
  {
    id: "arrival-at-to",
    label: "Arriving exactly at to: 09:00 is not a departure",
    description:
      "The same shuttle. You arrive at 09:00, the end of the service window. The window is half-open, [06:00, 09:00): the last shuttle left at 08:40, and 09:00 is never a departure. Drag the arrival back to 08:40 and you make it with no time to spare.",
    form: "headway",
    departures: FERRY,
    headway: SHUTTLE,
    after: AMS("09:00:00"),
    minimumConnection: "",
    onwardDuration: "PT35M",
    onwardZone: "Europe/Amsterdam",
    onwardMode: "shuttle",
  },
  {
    id: "fall-back-hourly",
    label: "Hourly across New York's fall-back",
    description:
      "A service every hour from midnight on 3 November 2024, the night New York's clocks went back. Departures keep their spacing in exact time, so after 01:30 EDT the next one is 01:00 EST, the second pass of the repeated hour.",
    form: "headway",
    departures: FERRY,
    headway: HOURLY,
    after: EDT("01:30:00"),
    minimumConnection: "",
    onwardDuration: "",
    onwardZone: "",
    onwardMode: "",
  },
];

const presetById = (id: string): DeparturePreset | undefined =>
  DEPARTURE_PRESETS.find((p) => p.id === id);

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const t = (s: string) => s.trim();

const padList = (list: readonly string[]): string[] =>
  Array.from({ length: MAX_DEPARTURES }, (_, i) => list[i] ?? "");

export function presetState(p: DeparturePreset): DepartureState {
  return {
    form: p.form,
    after: p.after,
    minimumConnection: p.minimumConnection,
    departureCount: String(p.departures.length),
    departures: padList(p.departures),
    headway: p.headway.headway,
    from: p.headway.from,
    to: p.headway.to,
    onwardDuration: p.onwardDuration,
    onwardZone: p.onwardZone,
    onwardMode: p.onwardMode,
  };
}

/** A state with every field blank except the idle form's defaults, which a
 *  reader switching forms can start from. */
function blankState(): DepartureState {
  return {
    ...presetState(DEPARTURE_PRESETS[0]!),
    form: "list",
    after: "",
    minimumConnection: "",
    onwardDuration: "",
    onwardZone: "",
    onwardMode: "",
  };
}

const SCALARS = [
  "after",
  "minimumConnection",
  "onwardDuration",
  "onwardZone",
  "onwardMode",
] as const;

/**
 * The state a chat call or a permalink names. A `departures` array (the chat)
 * sets the list form; a chat `headway` sets the headway form with `from` and
 * `to`; flat keys (`form`, `departureCount`, `departure1…`) do the same. None of
 * those carries a preset, so every field the call does not give is blank.
 * Otherwise the preset named by `args.preset` (else the first) is the base.
 * Then each scalar present overrides its field (`"none"` clears it).
 */
export function readArgs(args: DepartureBoardArgs): DepartureState {
  let state: DepartureState;
  if (Array.isArray(args.departures)) {
    state = blankState();
    const list = args.departures.slice(0, MAX_DEPARTURES).map(str);
    state.form = "list";
    state.departureCount = String(Math.max(1, list.length));
    state.departures = padList(list);
  } else if (args.headway !== undefined && args.preset === undefined) {
    state = blankState();
    state.form = "headway";
    state.headway = str(args.headway);
    state.from = str(args.from);
    state.to = str(args.to);
  } else if (args.form !== undefined && args.preset === undefined) {
    state = blankState();
    state.form = args.form === "headway" ? "headway" : "list";
    if (state.form === "list") {
      const declared = Number.parseInt(str(args.departureCount), 10);
      let count = Number.isInteger(declared) ? declared : 0;
      if (count < 1) {
        while (
          count < MAX_DEPARTURES &&
          args[`departure${count + 1}`] !== undefined
        ) {
          count++;
        }
      }
      count = Math.min(MAX_DEPARTURES, Math.max(1, count));
      state.departureCount = String(count);
      state.departures = padList(
        Array.from({ length: count }, (_, i) => str(args[`departure${i + 1}`])),
      );
    } else {
      state.headway = str(args.headway);
      state.from = str(args.from);
      state.to = str(args.to);
    }
  } else {
    const named =
      typeof args.preset === "string" ? presetById(args.preset) : undefined;
    state = presetState(named ?? DEPARTURE_PRESETS[0]!);
  }
  for (const key of SCALARS) {
    if (args[key] === undefined) continue;
    const value = str(args[key]);
    state[key] = value === "none" ? "" : value;
  }
  return state;
}

/** The state a widget opens on: the call's when it names a timetable or a
 *  preset, else the first preset. */
export function initialState(args: DepartureBoardArgs): DepartureState {
  const seeded =
    args.departures !== undefined ||
    args.headway !== undefined ||
    args.form !== undefined ||
    args.preset !== undefined;
  return seeded ? readArgs(args) : presetState(DEPARTURE_PRESETS[0]!);
}

export function visibleCount(state: DepartureState): number {
  const n = Number.parseInt(state.departureCount, 10);
  return Number.isInteger(n) ? Math.min(MAX_DEPARTURES, Math.max(1, n)) : 1;
}

/** The visible non-blank list entries in input order, or the headway row. */
export function timetableOf(state: DepartureState): Timetable {
  if (state.form === "headway") {
    return {
      headway: t(state.headway),
      from: t(state.from),
      to: t(state.to),
    };
  }
  return state.departures
    .slice(0, visibleCount(state))
    .map(t)
    .filter((d) => d !== "");
}

/** `{ minimumConnection }` when it is not blank, else `undefined`. */
export function optionsOf(
  state: DepartureState,
): { minimumConnection: string } | undefined {
  const m = t(state.minimumConnection);
  return m === "" ? undefined : { minimumConnection: m };
}

function sameTimetable(state: DepartureState, p: DeparturePreset): boolean {
  if (state.form !== p.form) return false;
  if (p.form === "headway") {
    return (
      t(state.headway) === t(p.headway.headway) &&
      t(state.from) === t(p.headway.from) &&
      t(state.to) === t(p.headway.to)
    );
  }
  const list = timetableOf(state) as readonly string[];
  return (
    list.length === p.departures.length &&
    list.every((d, i) => d === p.departures[i])
  );
}

/** The preset whose timetable and fields equal the state's, else `"custom"`. */
export function matchPreset(state: DepartureState): string {
  const hit = DEPARTURE_PRESETS.find(
    (p) =>
      sameTimetable(state, p) && SCALARS.every((k) => t(state[k]) === t(p[k])),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The permalink for the state, strings only, each 1 to 64 characters. When the
 * timetable is a preset's: `{ preset }` plus every field that differs from it
 * (`"none"` when cleared). Otherwise the flat form, which reproduces what the
 * reader sees.
 */
export function permalinkOf(state: DepartureState): Record<string, string> {
  // Presets can share a timetable (the shuttle appears in three): take the one
  // the state differs from least, so the link carries the fewest overrides.
  const differing = (p: DeparturePreset) =>
    SCALARS.filter((k) => t(state[k]) !== t(p[k])).length;
  const preset = DEPARTURE_PRESETS.filter((p) => sameTimetable(state, p)).sort(
    (a, b) => differing(a) - differing(b),
  )[0];
  if (preset) {
    const out: Record<string, string> = { preset: preset.id };
    for (const key of SCALARS) {
      if (t(state[key]) === t(preset[key])) continue;
      out[key] = t(state[key]) === "" ? "none" : t(state[key]);
    }
    return out;
  }
  const out: Record<string, string> = { form: state.form };
  if (state.form === "list") {
    const list = timetableOf(state) as readonly string[];
    out.departureCount = String(Math.max(1, visibleCount(state)));
    list.forEach((d, i) => {
      out[`departure${i + 1}`] = d;
    });
  } else {
    if (t(state.headway) !== "") out.headway = t(state.headway);
    if (t(state.from) !== "") out.from = t(state.from);
    if (t(state.to) !== "") out.to = t(state.to);
  }
  for (const key of SCALARS) {
    if (t(state[key]) !== "") out[key] = t(state[key]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Facts: every departure is a library call
// ---------------------------------------------------------------------------

export interface DepartureFacts {
  made: string;
  /** The same call with no `minimumConnection`: the tool's one naive value. */
  naive: string;
}

export function collectDepartureFacts(
  state: DepartureState,
  lib: PunctualityLib,
): DepartureFacts {
  const after = t(state.after);
  const timetable = timetableOf(state);
  return {
    made: lib.nextDeparture(after, timetable, optionsOf(state)),
    naive: lib.nextDeparture(after, timetable),
  };
}

// ---------------------------------------------------------------------------
// Why ""
// ---------------------------------------------------------------------------

export type DepartureReasonKind =
  | "no-arrival"
  | "invalid-after"
  | "invalid-connection"
  | "invalid-entry"
  | "invalid-from"
  | "invalid-to"
  | "empty-window"
  | "invalid-headway"
  | "empty-list"
  | "none-left"
  | "after-window";

export interface DepartureReason {
  kind: DepartureReasonKind;
  /** 1-based, for `invalid-entry`. */
  entry?: number;
  /** A drawn label, for the two correct-empty reasons. */
  threshold?: string;
  to?: string;
}

/** A correct empty answer, not a sentinel. */
export function isEmptyReason(r: DepartureReason | null): boolean {
  return (
    r !== null &&
    (r.kind === "empty-list" ||
      r.kind === "none-left" ||
      r.kind === "after-window")
  );
}

/** A moment too far ahead for any timetable, for probing a connection. */
const FAR = "+275760-09-13T00:00:00Z";

/** The moment a departure must reach: the arrival plus the connection time,
 *  in the arrival's own notation. `""` when either is not readable. Drawing
 *  only. */
export function thresholdOf(after: string, connection: string): string {
  const c = t(connection) === "" ? 0 : isoToMinutes(connection);
  if (c === null || c < 0) return "";
  try {
    return writeLike(after, epochMs(after) + c * 60_000);
  } catch {
    return "";
  }
}

/**
 * Why the answer is `""`, found by probing the library, in this order: the
 * arrival, the connection time, then the timetable. A `""` with every probe
 * passing is a **correct empty answer**. `null` when a departure was found.
 */
export function departureNullReason(
  state: DepartureState,
  facts: DepartureFacts,
  lib: PunctualityLib,
): DepartureReason | null {
  if (facts.made !== "") return null;
  const after = t(state.after);
  if (after === "") return { kind: "no-arrival" };
  if (lib.nextDeparture(after, [after]) === "")
    return { kind: "invalid-after" };
  const connection = t(state.minimumConnection);
  if (
    connection !== "" &&
    lib.nextDeparture(after, [FAR], { minimumConnection: connection }) === ""
  ) {
    return { kind: "invalid-connection" };
  }
  const bad = (text: string) => lib.nextDeparture(text, [text]) === "";
  if (state.form === "list") {
    const slots = state.departures.slice(0, visibleCount(state)).map(t);
    const index = slots.findIndex((d) => d !== "" && bad(d));
    if (index >= 0) return { kind: "invalid-entry", entry: index + 1 };
  } else {
    const row = timetableOf(state) as Headway;
    if (bad(row.from)) return { kind: "invalid-from" };
    if (bad(row.to)) return { kind: "invalid-to" };
    if (lib.nextDeparture(row.to, [row.from]) !== "") {
      return { kind: "empty-window" };
    }
    if (lib.nextDeparture(row.from, row) === "") {
      return { kind: "invalid-headway" };
    }
  }
  const threshold = writtenLabel(thresholdOf(after, connection));
  if (state.form === "list") {
    const list = timetableOf(state) as readonly string[];
    return list.length === 0
      ? { kind: "empty-list" }
      : { kind: "none-left", threshold };
  }
  return {
    kind: "after-window",
    threshold,
    to: writtenLabel(t(state.to)),
  };
}

export function departureReasonText(r: DepartureReason): string {
  switch (r.kind) {
    case "no-arrival":
      return "No arrival time.";
    case "invalid-after":
      return "The arrival has no offset. Every moment needs its offset (Z, +02:00, or a zoned string written with its offset): in a repeated fall-back hour a wall time names two instants.";
    case "invalid-connection":
      return "The minimum connection is not an exact duration that is zero or more. Write it as PT45M or PT1H30M: weeks, months and years have no fixed length.";
    case "invalid-entry":
      return `Departure ${r.entry} has no offset, or its zone disagrees with its offset. One invalid entry makes the whole list return "".`;
    case "invalid-from":
      return 'from has no offset, or its zone disagrees with its offset. One invalid entry makes the whole list return "".';
    case "invalid-to":
      return 'to has no offset, or its zone disagrees with its offset. One invalid entry makes the whole list return "".';
    case "empty-window":
      return "to must be after from: the window [from, to) is empty.";
    case "invalid-headway":
      return "The headway is not an exact duration greater than zero, such as PT20M.";
    case "empty-list":
      return "An empty timetable has no departure.";
    case "none-left":
      return `No departure at or after ${r.threshold}: the last one leaves before it.`;
    case "after-window":
      return `No departure at or after ${r.threshold}: the window ends at ${r.to}, and to itself is never a departure.`;
  }
}

// ---------------------------------------------------------------------------
// The hand-off
// ---------------------------------------------------------------------------

/**
 * The Delivery Scheduler's flat permalink for the departure the library found:
 * one leg that leaves at `made`. `null` when there is no departure or the
 * onward leg's duration or destination clock is blank.
 */
export function handoffArgs(
  state: DepartureState,
  made: string,
): Record<string, string> | null {
  const duration = t(state.onwardDuration);
  const zone = t(state.onwardZone);
  if (made === "" || duration === "" || zone === "") return null;
  const out: Record<string, string> = {
    legCount: "1",
    departure1: made,
    duration1: duration,
    timeZone1: zone,
  };
  if (t(state.onwardMode) !== "") out.mode1 = t(state.onwardMode);
  return out;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export interface RailWindow {
  startMs: number;
  endMs: number;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

const instant = (text: string): number | null => {
  try {
    return epochMs(text);
  } catch {
    return null;
  }
};

/**
 * The rail's extent. List form: from the earliest of the arrival and every
 * valid entry to the latest of the threshold and every valid entry. Headway
 * form: `[from, to]` when it is under 24 hours, else three hours either side of
 * the threshold; either way it holds the arrival and the threshold. Padded 8%,
 * at least 15 minutes each side, rounded outward to whole minutes. `null` when
 * the arrival is not a moment. Drawing only.
 */
export function railWindow(state: DepartureState): RailWindow | null {
  const after = instant(t(state.after));
  if (after === null) return null;
  const thresholdText = thresholdOf(t(state.after), state.minimumConnection);
  const threshold =
    (thresholdText === "" ? null : instant(thresholdText)) ?? after;
  let lo = Math.min(after, threshold);
  let hi = Math.max(after, threshold);
  if (state.form === "list") {
    for (const d of timetableOf(state) as readonly string[]) {
      const ms = instant(d);
      if (ms === null) continue;
      lo = Math.min(lo, ms);
      hi = Math.max(hi, ms);
    }
  } else {
    const from = instant(t(state.from));
    const to = instant(t(state.to));
    if (from !== null && to !== null && to > from && to - from < 24 * HOUR_MS) {
      lo = Math.min(lo, from);
      hi = Math.max(hi, to);
    } else {
      lo = Math.min(lo, threshold - 3 * HOUR_MS);
      hi = Math.max(hi, threshold + 3 * HOUR_MS);
    }
  }
  const pad = Math.max(15 * MINUTE_MS, (hi - lo) * 0.08);
  return {
    startMs: Math.floor((lo - pad) / MINUTE_MS) * MINUTE_MS,
    endMs: Math.ceil((hi + pad) / MINUTE_MS) * MINUTE_MS,
  };
}

/** The most departure ticks the rail draws before it draws a patterned run. */
export const MAX_RAIL_TICKS = 60;

export interface RailDepartures {
  /** Departures to draw as ticks, in ms, inside the window. */
  ticks: number[];
  /** Set when a headway is too short to draw tick by tick. */
  dense: boolean;
}

/**
 * The departures a rail draws as ticks: the list entries, or for a headway
 * `from + k × headway`, in exact time, while before `to` (half-open) and inside
 * the window. Drawing only: which departure the arrival makes is the library's.
 */
export function railDepartures(
  state: DepartureState,
  win: RailWindow,
): RailDepartures {
  if (state.form === "list") {
    const ticks = (timetableOf(state) as readonly string[])
      .map(instant)
      .filter(
        (ms): ms is number =>
          ms !== null && ms >= win.startMs && ms <= win.endMs,
      );
    return { ticks, dense: false };
  }
  const from = instant(t(state.from));
  const to = instant(t(state.to));
  const step = isoToMinutes(t(state.headway));
  if (
    from === null ||
    to === null ||
    step === null ||
    step <= 0 ||
    to <= from
  ) {
    return { ticks: [], dense: false };
  }
  const stepMs = step * MINUTE_MS;
  const first = Math.max(0, Math.ceil((win.startMs - from) / stepMs));
  const last = Math.ceil((Math.min(to, win.endMs + 1) - from) / stepMs) - 1;
  if (last - first + 1 > MAX_RAIL_TICKS) return { ticks: [], dense: true };
  const ticks: number[] = [];
  for (let k = first; k <= last; k++) {
    const ms = from + k * stepMs;
    if (ms < to && ms >= win.startMs && ms <= win.endMs) ticks.push(ms);
  }
  return { ticks, dense: false };
}

/** The step, in minutes, of the rail's axis ticks: the smallest nice step that
 *  leaves about eight labels. */
export function railTickStep(spanMs: number): number {
  const steps = [5, 10, 15, 20, 30, 60, 120, 180, 360, 720, 1440];
  return steps.find((s) => spanMs / MINUTE_MS / s <= 8) ?? 2880;
}
