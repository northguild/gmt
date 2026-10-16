/**
 * Pure helpers for the GNSS Week Decoder.
 *
 * A broadcast week number means nothing without its counter and its era, and a
 * RINEX file's week is not the week a satellite sends. The tool reads a week
 * three ways in (a broadcast week, a RINEX week, a UTC instant), draws every
 * era's answer in a lane, and shows the same moment on every counter.
 *
 * No DOM and no gmt import. Every function that calls the library takes a
 * `GnssLib` (`gnss-lib.ts`), loaded by the mount from the real package. The
 * widget draws the library's results and computes none of them:
 *
 * - `gnssWeekToUtc` and `rinexWeekToUtc` give the instant, and one reading on
 *   each era;
 * - `utcToGnssWeek` and `utcToRinexWeek` give a reading on every counter and
 *   every RINEX system, and the era a reading falls in;
 * - `utcToGnss` gives the reading's own system clock, and `leadOverUtc`
 *   (`gnss-widgets.ts`) its lead over UTC.
 *
 * The only numbers written here are drawing: where a pin sits on a lane is the
 * reading's own week as a fraction of the counter's weeks, and
 * `SECONDS_PER_WEEK` is the slider's end.
 *
 * Naming rule: GMT tracks no law, and the UI names no body. Systems are named
 * by their RINEX tokens (`GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN`).
 */

import { runCall, type EdiCall } from "./edi-widgets";
import { toEpochMs } from "./dwell-ledger";
import {
  GNSS_DECODER_MODES,
  GNSS_WEEK_COUNTERS,
  RINEX_WEEK_SYSTEMS,
  type GnssDecoderMode,
  type GnssWeekCounter,
  type RinexWeekSystem,
} from "./gnss-names";
import type { GnssLib, RolloverEra } from "./gnss-lib";
import {
  BEFORE_FIRST_WEEK_NOTE,
  NO_RESULT_TEXT,
  beforeFirstWeekText,
  counterSystem,
  durationSecondsText,
  eraStart,
  firstRefusedWeek,
  leadOverUtc,
  systemFirstInstant,
  weeksBelowText,
} from "./gnss-widgets";
import type { PlateSpec } from "./ledger-widgets";
import type { ToolHandoff } from "./widget-permalink";

export { BEFORE_FIRST_WEEK_NOTE, NO_RESULT_TEXT };

/**
 * The length of a week in seconds. It is the time-of-week slider's end, not a
 * library rule: the test asserts the library accepts `604799.999` and refuses
 * `604800`, so a drift fails there.
 */
export const SECONDS_PER_WEEK = 7 * 86_400;

export const CUSTOM_PRESET_ID = "custom";

/** The three ways to say which era a broadcast week is in. */
export const ERA_MODES = ["rolling", "number", "notBefore"] as const;
export type EraMode = (typeof ERA_MODES)[number];

export const ERA_MODE_LABELS: Record<EraMode, string> = {
  rolling: "Nearest today (rolling)",
  number: "A number",
  notBefore: "Not before a date",
};

export const MODE_LABELS: Record<GnssDecoderMode, string> = {
  broadcast: "Broadcast week",
  rinex: "RINEX week",
  utc: "UTC instant",
};

/** What a lane reads when the counter has not been picked. */
export const PICK_COUNTER_TEXT = "Pick a counter to see its eras";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The widget's controls, as strings. `counter` is `""` until one is picked
 *  (a chat call in UTC mode may name none). */
export interface GnssDecoderState {
  mode: GnssDecoderMode;
  counter: GnssWeekCounter | "";
  system: RinexWeekSystem;
  week: string;
  timeOfWeekSeconds: string;
  eraMode: EraMode;
  era: string;
  pivot: string;
  utc: string;
}

/** Seed arguments: the permalink's flat string keys, or a chat call's numbers. */
export type GnssWeekDecoderArgs = Record<string, unknown>;

export interface GnssPreset {
  id: string;
  label: string;
  description: string;
  state: GnssDecoderState;
}

/** A blank carrier for the fields a preset's mode does not use. */
const BASE: GnssDecoderState = {
  mode: "broadcast",
  counter: "GAL",
  system: "GAL",
  week: "1024",
  timeOfWeekSeconds: "18",
  eraMode: "number",
  era: "0",
  pivot: "2020-01-01T00:00:00Z",
  utc: "2019-04-07T00:00:00Z",
};

const broadcast = (
  counter: GnssWeekCounter,
  week: string,
  tow: string,
  era: { rolling: true } | { era: string } | { pivot: string },
): GnssDecoderState => ({
  ...BASE,
  mode: "broadcast",
  counter,
  system: counterSystem(counter),
  week,
  timeOfWeekSeconds: tow,
  ...("rolling" in era
    ? { eraMode: "rolling" as const }
    : "era" in era
      ? { eraMode: "number" as const, era: era.era }
      : { eraMode: "notBefore" as const, pivot: era.pivot }),
});

const rinex = (
  system: RinexWeekSystem,
  week: string,
  tow: string,
): GnssDecoderState => ({
  ...BASE,
  mode: "rinex",
  system,
  counter: GNSS_WEEK_COUNTERS.find((c) => counterSystem(c) === system)!,
  week,
  timeOfWeekSeconds: tow,
});

const fromUtc = (utc: string, counter: GnssWeekCounter): GnssDecoderState => ({
  ...BASE,
  mode: "utc",
  counter,
  system: counterSystem(counter),
  utc,
});

/**
 * Every preset is a worked case whose result a real run of the library
 * decided. The tests assert each one against the library.
 */
export const GNSS_PRESETS: readonly GnssPreset[] = [
  {
    id: "galileo-2019",
    label: "Galileo week 1024, first era",
    description:
      "A Galileo receiver reports week 1024, 18 seconds in, in its first era. That is the start of 7 April 2019, UTC. The same reading in the next era is a date in 2097.",
    state: broadcast("GAL", "1024", "18", { era: "0" }),
  },
  {
    id: "lnav-2024",
    label: "GPS legacy week 247, third era",
    description:
      "The 10-bit GPS week 247 repeats every 1024 weeks. In its third era, counting from the first, it is the start of 2024. In the other eras it is a different day.",
    state: broadcast("GPS-LNAV", "247", "86418", { era: "2" }),
  },
  {
    id: "not-before-2020",
    label: "QZSS legacy week 247 on or after 2020",
    description:
      "A receiver built in 2020 counts a week from its build date. The reading is the first instant on or after 1 January 2020 that has this week number.",
    state: broadcast("QZS-LNAV", "247", "86418", {
      pivot: "2020-01-01T00:00:00Z",
    }),
  },
  {
    id: "same-reading-two-dates",
    label: "One reading, two dates",
    description:
      "GPS legacy week 100 is a day in 1981. One era later the same week and second is a day in 2001, 19.6 years on.",
    state: broadcast("GPS-LNAV", "100", "0", { era: "0" }),
  },
  {
    id: "second-rollover",
    label: "Week 0 in the third era",
    description:
      "GPS legacy week 0 first came at the start of 1980. In its third era the counter wrapped back to 0 on 6 April 2019, 18 seconds before the week boundary in UTC.",
    state: broadcast("GPS-LNAV", "0", "0", { era: "2" }),
  },
  {
    id: "third-rollover",
    label: "Week 0 in the fourth era",
    description:
      "The next wrap of the 10-bit GPS week comes in November 2038. Week 0 in the fourth era is that day.",
    state: broadcast("GPS-LNAV", "0", "0", { era: "3" }),
  },
  {
    id: "nearest-today",
    label: "GPS legacy week 247, nearest to today",
    description:
      "A receiver with no stored era picks the one nearest its own clock. On a clock set in the 2020s, week 247 is the start of 2024.",
    state: broadcast("GPS-LNAV", "247", "86418", { rolling: true }),
  },
  {
    id: "cnav-2024",
    label: "GPS civil week 2295",
    description:
      "The 13-bit GPS civil message counts to 8191 before it wraps. Week 2295 in its first era is the start of 2024.",
    state: broadcast("GPS-CNAV", "2295", "86418", { era: "0" }),
  },
  {
    id: "beidou-2024",
    label: "BeiDou week 939",
    description:
      "BeiDou counts weeks from 2006 and runs 4 seconds ahead of UTC. Week 939, 86404 seconds in, is the start of 2024.",
    state: broadcast("BDT", "939", "86404", { era: "0" }),
  },
  {
    id: "leap-second",
    label: "A reading inside a leap second",
    description:
      "GPS legacy week 906, 17 seconds in, in its second era falls inside the second added at the end of 2016. UTC shows it as 23:59:60.",
    state: broadcast("GPS-LNAV", "906", "17", { era: "1" }),
  },
  {
    id: "week-past-the-counter",
    label: "A week the counter does not show",
    description:
      "The 10-bit GPS week shows weeks 0 to 1023. Week 1024 does not exist on that counter, so the library gives no answer.",
    state: broadcast("GPS-LNAV", "1024", "0", { era: "2" }),
  },
  {
    id: "rinex-navic",
    label: "RINEX week 2295 for NavIC",
    description:
      "A RINEX file counts one continuous week. Week 2295, 86418 seconds in, is the start of 2024. The same two numbers on NavIC's L1 counter are a date in 2043.",
    state: rinex("IRN", "2295", "86418"),
  },
  {
    id: "rinex-leap-second",
    label: "A RINEX week inside a leap second",
    description:
      "GPS RINEX week 1930, 17 seconds in, is the second added at the end of 2016.",
    state: rinex("GPS", "1930", "17"),
  },
  {
    id: "utc-2019-rollover",
    label: "The 2019 GPS rollover, as a UTC instant",
    description:
      "At the start of 7 April 2019 the 10-bit GPS week went back to 0. The 13-bit GPS counter read 2048, and Galileo read 1024, at the same moment.",
    state: fromUtc("2019-04-07T00:00:00Z", "GPS-LNAV"),
  },
  {
    id: "utc-2024",
    label: "The start of 2024, on BeiDou",
    description:
      "The start of 2024 in UTC is 4 seconds past on BeiDou's clock, and 18 past on GPS's. A RINEX file for NavIC calls it week 2295.",
    state: fromUtc("2024-01-01T00:00:00Z", "BDT"),
  },
  {
    id: "utc-before-galileo",
    label: "An instant before Galileo's first week",
    description:
      "Galileo's counter starts in August 1999. An earlier instant has no Galileo week, though the GPS counters still have one.",
    state: fromUtc("1999-08-21T23:59:46Z", "GAL"),
  },
  {
    id: "utc-no-leap-second",
    label: "A leap second that never happened",
    description:
      "23:59:60 is a real second only on a day a leap second was added. 31 December 2017 had none, so the library gives no answer.",
    state: fromUtc("2017-12-31T23:59:60Z", "GPS-LNAV"),
  },
];

export const DEFAULT_PRESET = GNSS_PRESETS[0]!;

/** The fields a mode reads, for matching a preset and writing a permalink. */
function usedFields(s: GnssDecoderState): string[] {
  const t = (v: string) => v.trim();
  switch (s.mode) {
    case "broadcast":
      return [
        s.mode,
        s.counter,
        t(s.week),
        t(s.timeOfWeekSeconds),
        s.eraMode,
        s.eraMode === "number"
          ? t(s.era)
          : s.eraMode === "notBefore"
            ? t(s.pivot)
            : "",
      ];
    case "rinex":
      return [s.mode, s.system, t(s.week), t(s.timeOfWeekSeconds)];
    case "utc":
      return [s.mode, s.counter, t(s.utc)];
  }
}

/** The preset whose controls match `state`, trimmed, or `custom`. */
export function matchPreset(state: GnssDecoderState): string {
  const mine = usedFields(state).join("\u0000");
  const hit = GNSS_PRESETS.find(
    (p) => usedFields(p.state).join("\u0000") === mine,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

export function presetState(preset: GnssPreset): GnssDecoderState {
  return { ...preset.state };
}

// ---------------------------------------------------------------------------
// Permalink and seed
// ---------------------------------------------------------------------------

const isText = (v: unknown): v is string => typeof v === "string";

/** A number or a string as text; anything else as `""`. */
function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

const KEYS = [
  "preset",
  "mode",
  "counter",
  "system",
  "week",
  "timeOfWeekSeconds",
  "rolloverEra",
  "rolloverNotBefore",
  "utc",
] as const;

/** Whether `args` carries anything the widget can seed from. */
export function isSeeded(args: GnssWeekDecoderArgs | undefined): boolean {
  return args !== undefined && KEYS.some((k) => k in args && args[k] !== "");
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  isText(v) && (list as readonly string[]).includes(v) ? (v as T) : null;

/**
 * The state a seed describes: a preset (`preset`), then any key that differs
 * from it. A key a mode does not use is ignored, and the era is never
 * defaulted by the tool when a seed names a mode that needs one: a seed with
 * no era shows the preset's.
 */
export function readArgs(args: GnssWeekDecoderArgs): GnssDecoderState {
  const named = GNSS_PRESETS.find((p) => p.id === args["preset"]);
  const mode = oneOf(GNSS_DECODER_MODES, args["mode"]);
  const base: GnssDecoderState = {
    ...(
      named ??
      (mode === "rinex"
        ? GNSS_PRESETS.find((p) => p.state.mode === "rinex")!
        : mode === "utc"
          ? GNSS_PRESETS.find((p) => p.state.mode === "utc")!
          : DEFAULT_PRESET)
    ).state,
  };
  const state: GnssDecoderState = { ...base };
  if (mode !== null) state.mode = mode;

  const counter = oneOf(GNSS_WEEK_COUNTERS, args["counter"]);
  if (counter !== null) {
    state.counter = counter;
    state.system = counterSystem(counter);
  } else if (state.mode === "utc" && named === undefined && mode === "utc") {
    // A UTC call may name no counter: the lanes then ask for one.
    state.counter = "";
  }
  const system = oneOf(RINEX_WEEK_SYSTEMS, args["system"]);
  if (system !== null) state.system = system;

  const week = textOf(args["week"]);
  if (week !== "") state.week = week;
  const tow = textOf(args["timeOfWeekSeconds"]);
  if (tow !== "") state.timeOfWeekSeconds = tow;

  const era = textOf(args["rolloverEra"]);
  const pivot = textOf(args["rolloverNotBefore"]);
  if (pivot !== "") {
    state.eraMode = "notBefore";
    state.pivot = pivot;
  } else if (era === "rolling") {
    state.eraMode = "rolling";
  } else if (era !== "") {
    state.eraMode = "number";
    state.era = era;
  }

  const utc = textOf(args["utc"]);
  if (utc !== "") state.utc = utc;
  return state;
}

/**
 * The permalink keys for `state`: `preset` alone when it is exactly a preset,
 * else the keys its mode uses. A key a mode does not use is left out, and
 * every number is a string, because `seedFromLocation` keeps strings.
 */
export function permalinkOf(state: GnssDecoderState): Record<string, string> {
  const id = matchPreset(state);
  if (id !== CUSTOM_PRESET_ID) return { preset: id };
  const t = (v: string) => v.trim();
  const out: Record<string, string> = { mode: state.mode };
  if (state.mode === "utc") {
    if (state.counter !== "") out["counter"] = state.counter;
    out["utc"] = t(state.utc);
    return out;
  }
  out["week"] = t(state.week);
  out["timeOfWeekSeconds"] = t(state.timeOfWeekSeconds);
  if (state.mode === "rinex") {
    out["system"] = state.system;
    return out;
  }
  out["counter"] = state.counter;
  if (state.eraMode === "rolling") out["rolloverEra"] = "rolling";
  else if (state.eraMode === "number") out["rolloverEra"] = t(state.era);
  else out["rolloverNotBefore"] = t(state.pivot);
  return out;
}

// ---------------------------------------------------------------------------
// Reading the library
// ---------------------------------------------------------------------------

/** One lane of section 2: one era, or one RINEX row. */
export interface Lane {
  /** `era-2`, `rinex` or a counter's name. */
  key: string;
  label: string;
  /** The library's instant, `""` when it gave none. */
  result: string;
  /** Where the pin sits on the track, 0 to 100, or `null` for no pin. */
  pin: number | null;
  /** The reading's own era (lit glass, "your reading"). */
  chosen: boolean;
  /** The era `"rolling"` picked ("nearest today"). */
  nearest: boolean;
  /** The RINEX lanes only: this counter reads the same numbers as another instant. */
  differs: boolean;
  /** The "today" mark's position on this lane, or `null` if today is not here. */
  today: number | null;
  /** A break before this lane: the eras between are not drawn. */
  gapBefore: boolean;
  /** The lane in one sentence, for the drawing's hidden list. */
  sentence: string;
}

export interface CounterRow {
  counter: GnssWeekCounter;
  week: string;
  timeOfWeek: string;
  era: string;
  /** The reading's own counter. */
  yours: boolean;
  /** The library gave no reading on this counter. */
  none: boolean;
}

export interface RinexRow {
  system: RinexWeekSystem;
  week: string;
  timeOfWeek: string;
  yours: boolean;
  none: boolean;
}

/** What the controls not in use hold, so a change of mode continues from the same moment. */
export interface Carry {
  utc: string | null;
  week: string | null;
  timeOfWeekSeconds: string | null;
  era: string | null;
  system: RinexWeekSystem | null;
}

export interface GnssRead {
  state: GnssDecoderState;
  /** `ok`, `empty` (a form with nothing to ask) or `sentinel` (the library gave nothing). */
  status: "ok" | "empty" | "sentinel";
  /** The one plain sentence that says why the library gave nothing. */
  failure: string | null;
  /** The words an empty form shows. */
  emptyText: string | null;
  utc: string | null;
  counter: GnssWeekCounter | null;
  system: RinexWeekSystem | null;
  lanes: Lane[];
  /** The words the lanes show in place of lanes. */
  lanesEmpty: string | null;
  counters: CounterRow[];
  rinexRows: RinexRow[];
  /** The footnote under the tables, `""` when every reading was given. */
  footnote: string;
  plates: PlateSpec[];
  carry: Carry;
  /** The calls behind sections 2 and 3, in the order made. */
  calls: { reading: EdiCall[]; counters: EdiCall[]; rinex: EdiCall[] };
}

/** `^\d+$` as a safe integer. */
export function wholeNumber(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/** A finite number in `[0, SECONDS_PER_WEEK)`. */
export function timeOfWeek(text: string): number | null {
  const t = text.trim();
  if (t === "" || !/^\d+(?:\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < SECONDS_PER_WEEK ? n : null;
}

/** The first RINEX week a system accepts, found by doubling then bisecting.
 *  Cached per library. 0 when the system accepts week 0. */
const FIRST_RINEX = new WeakMap<GnssLib, Map<RinexWeekSystem, number>>();

export function firstRinexWeek(lib: GnssLib, system: RinexWeekSystem): number {
  let perLib = FIRST_RINEX.get(lib);
  if (perLib === undefined) {
    perLib = new Map();
    FIRST_RINEX.set(lib, perLib);
  }
  const cached = perLib.get(system);
  if (cached !== undefined) return cached;
  const accepted = (w: number) => lib.rinexWeekToUtc(system, w, 0) !== "";
  let answer = 0;
  if (!accepted(0)) {
    let refused = 0;
    let step = 1;
    while (step <= 1 << 20 && !accepted(step)) {
      refused = step;
      step *= 2;
    }
    let ok = step;
    while (ok - refused > 1) {
      const middle = refused + Math.floor((ok - refused) / 2);
      if (accepted(middle)) ok = middle;
      else refused = middle;
    }
    answer = ok;
  }
  perLib.set(system, answer);
  return answer;
}

const SENTENCES = {
  week: "The week is a whole number from 0.",
  tow: `Time of week runs from 0 up to, not including, ${SECONDS_PER_WEEK} seconds.`,
  era: "The era is a whole number from 0, or rolling.",
  pivot: "The date the era counts from is not an ISO 8601 instant.",
  beyond: "That reading falls after the year 9999.",
  noLeap: "No leap second was inserted at the end of that day.",
  badInstant: "This is not an ISO 8601 instant with an offset or Z.",
} as const;

export const GNSS_SENTENCES = SENTENCES;

/** The sentence for a pivot that is an instant but before the counter's first week. */
export function pivotBeforeFirstWeekText(firstInstant: string): string {
  return `The date the era counts from is before the counter's first week, which starts at ${firstInstant}.`;
}

/** The sentence for a RINEX week before the system's first week. */
export function rinexBeforeFirstText(firstInstant: string): string {
  return `This is before the system's first week, which starts at ${firstInstant}.`;
}

const pad = (n: number, min: number) => Math.max(n, min);

const secondsLine = (n: string) => `time of week ${n} s`;

/** "ahead of UTC by 18 s", "behind UTC by 2 s", or the empty-style words. */
export function leadText(duration: string): string {
  const seconds = durationSecondsText(duration);
  if (seconds === null) return "";
  if (seconds.startsWith("-")) return `behind UTC by ${seconds.slice(1)} s`;
  return `ahead of UTC by ${seconds} s`;
}

export const INSIDE_SECOND_TEXT = "inside an inserted second";

/** The plates' captions the system plate can show, for its hold. */
export function systemCaptions(): string[] {
  return RINEX_WEEK_SYSTEMS.map((s) => `${s} time`);
}

/**
 * The plates for a reading. `read` null draws the empty plates.
 * Width is reserved by the sheet for the longest value any range position and
 * a nine-digit fraction can give.
 */
export function platesOf(
  parts: {
    utc: string | null;
    eraLine: string;
    leap: boolean;
    system: RinexWeekSystem | null;
    label: string;
    lead: string;
    rinexWeek: string | null;
    rinexLine: string;
  } | null,
): PlateSpec[] {
  const none = parts === null;
  return [
    {
      role: "hero-utc",
      caption: "UTC",
      value: none || parts.utc === null || parts.utc === "" ? null : parts.utc,
      lines: [
        none ? "" : parts.eraLine,
        none || !parts.leap ? "" : "leap second",
      ],
      series: 1,
    },
    {
      role: "hero-system",
      caption:
        none || parts.system === null ? "system time" : `${parts.system} time`,
      captions: ["system time", ...systemCaptions()],
      value: none || parts.label === "" ? null : parts.label,
      lines: [none ? "" : parts.lead],
      quiet: true,
    },
    {
      role: "hero-rinex",
      caption: "RINEX week",
      value: none || parts.rinexWeek === null ? null : parts.rinexWeek,
      lines: [none ? "" : parts.rinexLine],
      quiet: true,
    },
  ];
}

/** Every text a plate's sub line can show, for the holds. */
export function plateTexts(): {
  eraLines: string[];
  leads: string[];
  rinex: string[];
} {
  return {
    eraLines: ["era 12", "era 12 · nearest today", "continuous count"],
    leads: ["ahead of UTC by 18 s", "behind UTC by 18 s", INSIDE_SECOND_TEXT],
    rinex: [secondsLine("604799.999999999")],
  };
}

/** The pin position of a reading on a counter's lane: its week as a share of
 *  the counter's weeks. Drawing, not a library calculation. */
export function pinOf(week: number, tow: number, weeksShown: number): number {
  if (!(weeksShown > 0)) return 0;
  const share = (week + tow / SECONDS_PER_WEEK) / weeksShown;
  return Math.round(Math.min(1, Math.max(0, share)) * 10_000) / 100;
}

/** The lane's sentence for the hidden list. */
function laneSentence(lane: Omit<Lane, "sentence">): string {
  const tags = [
    lane.chosen ? "your reading" : "",
    lane.nearest ? "nearest today" : "",
    lane.differs ? "a different instant" : "",
    lane.today !== null ? "holds today" : "",
  ].filter(Boolean);
  const value = lane.result === "" ? NO_RESULT_TEXT : lane.result;
  return `${lane.label}: ${value}${tags.length === 0 ? "" : ` (${tags.join(", ")})`}`;
}

function blankRead(state: GnssDecoderState): GnssRead {
  return {
    state,
    status: "empty",
    failure: null,
    emptyText: null,
    utc: null,
    counter: null,
    system: null,
    lanes: [],
    lanesEmpty: null,
    counters: GNSS_WEEK_COUNTERS.map((counter) => ({
      counter,
      week: "",
      timeOfWeek: "",
      era: "",
      yours: false,
      none: false,
    })),
    rinexRows: RINEX_WEEK_SYSTEMS.map((system) => ({
      system,
      week: "",
      timeOfWeek: "",
      yours: false,
      none: false,
    })),
    footnote: "",
    plates: platesOf(null),
    carry: {
      utc: null,
      week: null,
      timeOfWeekSeconds: null,
      era: null,
      system: null,
    },
    calls: { reading: [], counters: [], rinex: [] },
  };
}

/**
 * Read the library for `state`. `nowIso` is the reader's clock, read once per
 * reading by the mount (`Temporal.Now.instant()`), and used only to find the
 * era "today" is in.
 *
 * Every instant, week, era and lead below is a library call kept in `calls`,
 * in the order made, so what the page prints is the call made.
 */
export function readGnss(
  lib: GnssLib,
  state: GnssDecoderState,
  nowIso: string,
): GnssRead {
  const read = blankRead(state);
  const reading: EdiCall[] = read.calls.reading;
  const call = <F extends keyof GnssLib & string>(
    fn: F,
    ...args: Parameters<GnssLib[F]>
  ): ReturnType<GnssLib[F]> => {
    const c = runCall(lib, fn, ...args);
    reading.push(c);
    return c.result as ReturnType<GnssLib[F]>;
  };
  const fail = (sentence: string): GnssRead => {
    read.status = "sentinel";
    read.failure = sentence;
    return read;
  };

  // 1. The instant, and the counter or record the reading is on.
  let utc = "";
  let week: number | null = null;
  let tow: number | null = null;
  let counter: GnssWeekCounter | null = null;
  let system: RinexWeekSystem | null = null;
  let eraArg: RolloverEra = 0;

  if (state.mode === "broadcast") {
    if (state.counter === "") {
      read.status = "empty";
      read.lanesEmpty = PICK_COUNTER_TEXT;
      read.emptyText = PICK_COUNTER_TEXT;
      return read;
    }
    counter = state.counter;
    system = counterSystem(counter);
    week = wholeNumber(state.week);
    if (week === null) return fail(SENTENCES.week);
    const refused = firstRefusedWeek(lib, counter);
    if (week >= refused) return fail(weeksBelowText(refused));
    tow = timeOfWeek(state.timeOfWeekSeconds);
    if (tow === null) return fail(SENTENCES.tow);
    if (state.eraMode === "rolling") eraArg = "rolling";
    else if (state.eraMode === "number") {
      const era = wholeNumber(state.era);
      if (era === null) return fail(SENTENCES.era);
      eraArg = era;
    } else {
      const pivot = state.pivot.trim();
      if (!lib.isValidInstant(pivot)) return fail(SENTENCES.pivot);
      eraArg = { notBefore: pivot };
    }
    utc = call("gnssWeekToUtc", counter, week, tow, eraArg);
    if (utc === "") {
      if (
        typeof eraArg === "object" &&
        lib.utcToGnssWeek(counter, eraArg.notBefore) === null
      ) {
        return fail(pivotBeforeFirstWeekText(eraStart(lib, counter, 0)));
      }
      return fail(SENTENCES.beyond);
    }
  } else if (state.mode === "rinex") {
    system = state.system;
    week = wholeNumber(state.week);
    if (week === null) return fail(SENTENCES.week);
    tow = timeOfWeek(state.timeOfWeekSeconds);
    if (tow === null) return fail(SENTENCES.tow);
    utc = call("rinexWeekToUtc", system, week, tow);
    if (utc === "") {
      return fail(
        week < firstRinexWeek(lib, system)
          ? rinexBeforeFirstText(systemFirstInstant(lib, system))
          : SENTENCES.beyond,
      );
    }
    counter = state.counter === "" ? null : state.counter;
  } else {
    utc = state.utc.trim();
    if (utc === "") {
      read.status = "empty";
      read.emptyText = "Type a UTC instant to read it on every counter.";
      read.lanesEmpty = read.emptyText;
      return read;
    }
    if (lib.hasSecond60(utc)) {
      if (!lib.isLeapSecond(utc)) return fail(SENTENCES.noLeap);
    } else if (!lib.isValidInstant(utc)) {
      return fail(SENTENCES.badInstant);
    }
    counter = state.counter === "" ? null : state.counter;
    system = counter === null ? null : counterSystem(counter);
  }

  read.utc = utc;
  read.counter = counter;
  read.system = system;

  // 2. The reading on every counter and every RINEX system (section 3).
  const tableCall = <F extends "utcToGnssWeek" | "utcToRinexWeek">(
    group: EdiCall[],
    fn: F,
    ...args: Parameters<GnssLib[F]>
  ) => {
    const c = runCall(lib, fn, ...args);
    group.push(c);
    return c.result as ReturnType<GnssLib[F]>;
  };
  let missing = false;
  read.counters = GNSS_WEEK_COUNTERS.map((c) => {
    const r = tableCall(read.calls.counters, "utcToGnssWeek", c, utc);
    if (r === null) missing = true;
    return {
      counter: c,
      week: r === null ? "" : String(r.week),
      timeOfWeek: r === null ? "" : String(r.timeOfWeekSeconds),
      era: r === null ? "" : String(r.era),
      yours: c === counter,
      none: r === null,
    };
  });
  read.rinexRows = RINEX_WEEK_SYSTEMS.map((s) => {
    const r = tableCall(read.calls.rinex, "utcToRinexWeek", s, utc);
    if (r === null) missing = true;
    return {
      system: s,
      week: r === null ? "" : String(r.week),
      timeOfWeek: r === null ? "" : String(r.timeOfWeekSeconds),
      yours: s === system,
      none: r === null,
    };
  });
  read.footnote = missing ? `No reading: ${BEFORE_FIRST_WEEK_NOTE}.` : "";

  // 3. The reading's own counter in UTC mode: nothing to show without one.
  const ownWeek = counter === null ? null : call("utcToGnssWeek", counter, utc);
  if (state.mode === "utc" && counter !== null && ownWeek === null) {
    // The sentinel still leaves the tables standing.
    read.status = "sentinel";
    read.failure = beforeFirstWeekText(eraStart(lib, counter, 0));
    read.lanesEmpty = null;
    return finish(read, lib, utc, null, null, null);
  }
  if (state.mode === "utc" && ownWeek !== null) {
    week = ownWeek.week;
    tow = ownWeek.timeOfWeekSeconds;
  }

  // 4. The lanes (section 2).
  if (state.mode === "rinex") {
    read.lanes = rinexLanes(lib, reading, state, system!, utc, week!, tow!);
  } else if (counter === null) {
    read.lanesEmpty = PICK_COUNTER_TEXT;
  } else {
    read.lanes = eraLanes(
      lib,
      reading,
      state,
      counter,
      nowIso,
      week!,
      tow!,
      ownWeek?.era ?? null,
    );
  }

  read.status = "ok";
  return finish(read, lib, utc, ownWeek, week, tow);

  // Section 2's plates and the carried values.
  function finish(
    r: GnssRead,
    l: GnssLib,
    instant: string,
    own: { week: number; timeOfWeekSeconds: number; era: number } | null,
    w: number | null,
    t: number | null,
  ): GnssRead {
    const sys = r.system;
    const label = sys === null ? "" : call("utcToGnss", sys, instant);
    const lead = label === "" ? null : leadOverUtc(l, instant, label);
    const ownRinex = sys === null ? null : call("utcToRinexWeek", sys, instant);
    const leap = call("isLeapSecond", instant);
    const nearest = state.mode === "broadcast" && state.eraMode === "rolling";
    const eraLine =
      state.mode === "rinex"
        ? "continuous count"
        : own === null
          ? ""
          : `era ${own.era}${nearest ? " · nearest today" : ""}`;
    r.plates = platesOf({
      utc: instant,
      eraLine,
      leap,
      system: sys,
      label,
      lead:
        lead === null || lead.kind === "none"
          ? ""
          : lead.kind === "inside-inserted-second"
            ? INSIDE_SECOND_TEXT
            : leadText(lead.duration),
      rinexWeek: ownRinex === null ? null : String(ownRinex.week),
      rinexLine:
        ownRinex === null
          ? ""
          : secondsLine(String(ownRinex.timeOfWeekSeconds)),
    });
    r.carry = {
      utc: instant,
      week: w === null ? null : String(w),
      timeOfWeekSeconds: t === null ? null : String(t),
      era: own === null ? null : String(own.era),
      system: sys,
    };
    if (r.status === "sentinel") {
      // The UTC plate still shows what the reader typed; the library gave no
      // week, so the others keep their boxes and read "no result".
      r.plates = platesOf({
        utc: instant,
        eraLine: "",
        leap,
        system: sys,
        label,
        lead: "",
        rinexWeek: ownRinex === null ? null : String(ownRinex.week),
        rinexLine:
          ownRinex === null
            ? ""
            : secondsLine(String(ownRinex.timeOfWeekSeconds)),
      });
    }
    return r;
  }
}

/** The eras 0 through today's era plus one, plus the reading's own era after a
 *  gap when it is further out. */
function eraLanes(
  lib: GnssLib,
  calls: EdiCall[],
  state: GnssDecoderState,
  counter: GnssWeekCounter,
  nowIso: string,
  week: number,
  tow: number,
  ownEra: number | null,
): Lane[] {
  const run = <F extends "gnssWeekToUtc" | "utcToGnssWeek">(
    fn: F,
    ...args: Parameters<GnssLib[F]>
  ) => {
    const c = runCall(lib, fn, ...args);
    calls.push(c);
    return c.result as ReturnType<GnssLib[F]>;
  };
  const today = run("utcToGnssWeek", counter, nowIso);
  const todayEra = today?.era ?? 0;
  const lastDrawn = todayEra + 1;
  const eras = Array.from({ length: lastDrawn + 1 }, (_, e) => e);
  const beyond = ownEra !== null && ownEra > lastDrawn;
  if (beyond) eras.push(ownEra);
  const weeksShown = firstRefusedWeek(lib, counter);
  const pin = pinOf(week, tow, weeksShown);
  // The era "rolling" chose is the era of the instant it gave; for a fixed era
  // it is that era.
  return eras.map((e, i) => {
    const result = run("gnssWeekToUtc", counter, week, tow, e);
    const base = {
      key: `era-${e}`,
      label: `era ${e}`,
      result,
      pin: result === "" ? null : pin,
      chosen: ownEra === e,
      nearest:
        state.mode === "broadcast" &&
        state.eraMode === "rolling" &&
        ownEra === e,
      differs: false,
      today:
        today !== null && e === todayEra
          ? pinOf(today.week, today.timeOfWeekSeconds, weeksShown)
          : null,
      gapBefore: beyond && i === eras.length - 1,
    };
    return { ...base, sentence: laneSentence(base) };
  });
}

/** The continuous RINEX lane, then each counter of the system at era 0. */
function rinexLanes(
  lib: GnssLib,
  calls: EdiCall[],
  state: GnssDecoderState,
  system: RinexWeekSystem,
  utc: string,
  week: number,
  tow: number,
): Lane[] {
  void state;
  const counters = GNSS_WEEK_COUNTERS.filter(
    (c) => counterSystem(c) === system,
  );
  const rows: { key: string; label: string; result: string }[] = [
    { key: "rinex", label: "RINEX", result: utc },
    ...counters.map((c) => {
      const run = runCall(lib, "gnssWeekToUtc", c, week, tow, 0);
      calls.push(run);
      return { key: c, label: c, result: run.result as string };
    }),
  ];
  const ms = rows.map((r) =>
    r.result === "" ? Number.NaN : toEpochMs(r.result),
  );
  const known = ms.filter((m) => Number.isFinite(m));
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  // Pins share one axis from the earliest to the latest answer, with a margin,
  // so two answers 19 years apart sit apart. Drawing, not a calculation.
  const place = (m: number): number | null => {
    if (!Number.isFinite(m)) return null;
    if (!(hi > lo)) return 50;
    return Math.round((8 + ((m - lo) / (hi - lo)) * 84) * 100) / 100;
  };
  return rows.map((r, i) => {
    const base = {
      key: r.key,
      label: r.label,
      result: r.result,
      pin: place(ms[i]!),
      chosen: i === 0,
      nearest: false,
      differs: i > 0 && r.result !== "" && r.result !== utc,
      today: null,
      gapBefore: false,
    };
    return { ...base, sentence: laneSentence(base) };
  });
}

/** `aria-label` for the lanes' drawing. */
export function lanesAria(read: GnssRead): string {
  if (read.lanes.length === 0) return read.lanesEmpty ?? "No lanes to draw";
  const what =
    read.state.mode === "rinex"
      ? "RINEX and broadcast counters"
      : "rollover eras";
  return `${read.lanes.length} lanes, one for each of ${what}: ${read.lanes.map((l) => l.sentence).join("; ")}.`;
}

/** The sentence a screen reader hears when the plates change. */
export function summaryText(read: GnssRead): string {
  if (read.status === "sentinel") return read.failure ?? "";
  if (read.status === "empty" || read.utc === null) return read.emptyText ?? "";
  const bits = read.plates
    .filter((p) => p.value !== null)
    .map(
      (p) =>
        `${p.caption} ${p.value}${p.lines.filter(Boolean).length === 0 ? "" : `, ${p.lines.filter(Boolean).join(", ")}`}`,
    );
  return bits.join(". ");
}

/** The slider ends the mount sets: the counter's last week. */
export function lastWeekOf(lib: GnssLib, counter: GnssWeekCounter): number {
  return pad(firstRefusedWeek(lib, counter) - 1, 0);
}

// ---------------------------------------------------------------------------
// Links to the other tools
// ---------------------------------------------------------------------------

/** The links row: every satellite clock at the moment, and the rollover check. */
export const DECODER_LINKS = [
  { role: "link-clocks", text: "Every satellite clock at this moment" },
  {
    role: "link-rollover",
    text: "Is a receiver on this counter affected, and when?",
  },
] as const;

/**
 * Where each link goes for `read`, or `null` while there is nothing to send.
 *
 * The clocks link carries the UTC result. The rollover link carries the
 * counter, the era form the reading used (the pivot for "not before", else the
 * era the reading falls in, which is the era "rolling" chose) and the UTC
 * result as the check date. A RINEX reading has no counter, so it sends none.
 */
export function decoderHandoffs(read: GnssRead): {
  clocks: ToolHandoff | null;
  rollover: ToolHandoff | null;
} {
  const utc = read.status === "ok" ? read.utc : null;
  if (utc === null || utc === "") return { clocks: null, rollover: null };
  const clocks: ToolHandoff = { kind: "satclock", args: { value: utc } };
  const { state, counter } = read;
  const pivot = state.pivot.trim();
  const era: Record<string, string> | null =
    state.mode === "broadcast" && state.eraMode === "notBefore"
      ? { firmwareNotBefore: pivot }
      : read.carry.era === null
        ? null
        : { firmwareEra: read.carry.era };
  if (state.mode === "rinex" || counter === null || era === null) {
    return { clocks, rollover: null };
  }
  return {
    clocks,
    rollover: { kind: "rollover", args: { counter, ...era, date: utc } },
  };
}
