/**
 * Pure helpers for the Satellite Clock Converter.
 *
 * One instant reads differently on every clock. Each satellite clock is a
 * whole number of seconds from UTC, GLONASS time follows UTC's hours, and TAI
 * is ahead of them all. The gap grew each time UTC inserted a second. The tool takes a time on any one of
 * these clocks and shows it on all the others, with each clock's lead.
 *
 * No DOM and no gmt import. Every function that calls the library takes a
 * `GnssLib` (`gnss-lib.ts`), loaded by the mount from the real package. The
 * widget draws the library's results and computes none of them:
 *
 * - `fromTAI` or `gnssToUtc` read the clock the reader typed;
 * - `utcToGnss` and `toTAI` write the instant on every clock;
 * - `leadOverUtc` (`gnss-widgets.ts`) and `taiMinusUtc` give the leads;
 * - `nextLeapSecond` gives the next change.
 *
 * The only numbers written here are drawing: the ladder's pixels per second,
 * its row height and its margins. Where a clock stands on the ladder is its
 * lead in seconds, as the library measured it.
 *
 * Naming rule: GMT tracks no law, and the UI names no body. Clocks are named
 * by their RINEX tokens (`GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN`) and `TAI`.
 */

import { runCall, type EdiCall } from "./edi-widgets";
import { GNSS_SYSTEMS, type GnssSystem } from "./gnss-names";
import type { GnssLib } from "./gnss-lib";
import {
  NO_RESULT_TEXT,
  durationSecondsText,
  labelParts,
  leadOverUtc,
} from "./gnss-widgets";
import type { PlateSpec } from "./ledger-widgets";
import { INTEGER_UTC_FROM, insertions, secondAfter } from "./timescale-widgets";
import type { ToolHandoff } from "./widget-permalink";

export { NO_RESULT_TEXT };

export const CUSTOM_PRESET_ID = "custom";

/** The longest value the input takes, and the longest a permalink carries. */
export const MAX_VALUE_LENGTH = 64;

/** The clock tokens after the space: TAI, then the six systems. */
export const CLOCK_TOKENS = ["TAI", ...GNSS_SYSTEMS] as const;

/** A row of the table: UTC, TAI or one system. */
export type ClockKey = "UTC" | "TAI" | GnssSystem;

/** The rows, in the order the table and the bars draw them. */
export const CLOCK_KEYS: readonly ClockKey[] = ["UTC", "TAI", ...GNSS_SYSTEMS];

export const INSIDE_SECOND_TEXT = "inside an inserted second";

/** What a clock's footnote says when the library gave it no reading. */
export const BEFORE_FIRST_INSTANT_NOTE = "before this system's first instant";

/** The chip beside UTC: it is the line the others are measured from. */
export const REFERENCE_TEXT = "the reference";

export const GLO_NOTE =
  "GLO is GLONASS time as RINEX and the BIPM report it, in UTC's own hours.";
export const IRN_NOTE =
  "No international body states NavIC's offset; the library derives it from the NavIC epoch.";

/** The tag on the NavIC row. */
export const DERIVED_TAG = "derived";

export const EMPTY_TEXT =
  "Type a time on any clock, or pick a preset, to see it on all of them.";

const TOKEN_LIST = `${CLOCK_TOKENS.slice(0, -1).join(", ")} or ${CLOCK_TOKENS.at(-1)}`;

/** The four sentences the tool says in place of an answer, in the order they are tried. */
export const SENTENCES = {
  unknownToken: `The scale after the space is not one of ${TOKEN_LIST}.`,
  noLeapSecond: "No leap second was inserted at the end of that day.",
  notOnClock:
    "The library does not read this as a time on that clock: check the form, or the date is before that clock's first instant.",
  notAnInstant:
    "That is not a UTC instant: write it like 2024-01-01T00:00:00Z, or add a clock after a space, such as 2024-01-01T00:00:37 TAI.",
} as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The widget's one text control. */
export interface ClockState {
  value: string;
}

/** Seed arguments: the permalink's flat string key, or a chat call's `value`. */
export type SatelliteClockConverterArgs = Record<string, unknown>;

export interface ClockPreset {
  id: string;
  label: string;
  description: string;
  state: ClockState;
}

/**
 * Every preset is a worked case whose result a real run of the library
 * decided. The tests assert each one against the library.
 */
export const CLOCK_PRESETS: readonly ClockPreset[] = [
  {
    id: "utc-2024",
    label: "The start of 2024, in UTC",
    description:
      "At the start of 2024 in UTC, GPS, Galileo, QZSS and NavIC read 18 seconds later, BeiDou 4 seconds later, and GLO the same. TAI reads 37 seconds later.",
    state: { value: "2024-01-01T00:00:00Z" },
  },
  {
    id: "galileo-first-instant",
    label: "Galileo's first instant",
    description:
      "Galileo's clock starts at midnight on 22 August 1999. In UTC that is 13 seconds earlier, the evening before.",
    state: { value: "1999-08-22T00:00:00 GAL" },
  },
  {
    id: "beidou-reading",
    label: "A BeiDou reading",
    description:
      "A BeiDou receiver that reads 4 seconds past midnight at the start of 2024 is reading midnight in UTC.",
    state: { value: "2024-01-01T00:00:04 BDT" },
  },
  {
    id: "tai-reading",
    label: "A TAI reading",
    description:
      "A TAI clock that reads 37 seconds past midnight at the start of 2026 is reading midnight in UTC.",
    state: { value: "2026-01-01T00:00:37 TAI" },
  },
  {
    id: "inside-leap-second",
    label: "Inside a leap second",
    description:
      "At the end of 2016 UTC added a second, written 23:59:60. GLO keeps UTC's hours and shows it too. GPS shows the first seconds of 2017.",
    state: { value: "2016-12-31T23:59:60Z" },
  },
  {
    id: "before-beidou",
    label: "Before BeiDou's first instant",
    description:
      "BeiDou's clock starts at the beginning of 2006. An earlier instant has no BeiDou reading, though the other clocks still have one.",
    state: { value: "2005-12-31T23:59:59Z" },
  },
  {
    id: "no-leap-second-that-day",
    label: "A leap second that never happened",
    description:
      "23:59:60 is a real second only on a day UTC added one. 31 December 2017 had none, so the library gives no answer.",
    state: { value: "2017-12-31T23:59:60 GLO" },
  },
  {
    id: "wrong-token",
    label: "A clock that does not exist",
    description:
      "UTC is not a clock you write after a space: a bare instant is already UTC. The library reads only TAI and the six systems there, so it gives no answer.",
    state: { value: "2024-01-01T00:00:37 UTC" },
  },
];

export const DEFAULT_PRESET = CLOCK_PRESETS[0]!;

export function presetState(preset: ClockPreset): ClockState {
  return { ...preset.state };
}

/** The preset whose value matches `state`, trimmed, or `custom`. */
export function matchPreset(state: ClockState): string {
  const hit = CLOCK_PRESETS.find((p) => p.state.value === state.value.trim());
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// Permalink and seed
// ---------------------------------------------------------------------------

/** Whether `args` carries anything the widget can seed from. */
export function isSeeded(
  args: SatelliteClockConverterArgs | undefined,
): boolean {
  return (
    args !== undefined &&
    (typeof args["value"] === "string" || typeof args["preset"] === "string") &&
    (args["value"] ?? args["preset"]) !== ""
  );
}

/**
 * The state a seed describes: `value` as written, else a preset by its id,
 * else the default. A chat call's `value` is exactly what the reader typed.
 */
export function readArgs(args: SatelliteClockConverterArgs): ClockState {
  const value = args["value"];
  if (typeof value === "string" && value !== "") {
    return { value: value.slice(0, MAX_VALUE_LENGTH) };
  }
  const named = CLOCK_PRESETS.find((p) => p.id === args["preset"]);
  return presetState(named ?? DEFAULT_PRESET);
}

/** The permalink key for `state`: the trimmed value, a string of 1 to 64 characters. */
export function permalinkOf(state: ClockState): Record<string, string> {
  const value = state.value.trim().slice(0, MAX_VALUE_LENGTH);
  return value === "" ? {} : { value };
}

// ---------------------------------------------------------------------------
// The slider's positions
// ---------------------------------------------------------------------------

/**
 * The instants the slider steps through: the start of integer UTC, then the
 * first second on the new offset after each inserted second. `insertions`
 * walks `nextLeapSecond` and `secondAfter` asks `addUtc`; nothing is listed
 * here. A position the library cannot add to is left out.
 */
export function sliderPositions(
  lib: Pick<GnssLib, "nextLeapSecond" | "addUtc">,
): string[] {
  return [
    INTEGER_UTC_FROM,
    ...insertions(lib)
      .map((insertion) => secondAfter(lib, insertion))
      .filter((position) => position !== ""),
  ];
}

// ---------------------------------------------------------------------------
// Reading the library
// ---------------------------------------------------------------------------

/** How far a clock is ahead of UTC, in the form the row and the bar draw. */
export type ClockLead =
  | { kind: "seconds"; seconds: string }
  | { kind: "inside" }
  | { kind: "reference" }
  | { kind: "none" };

/** One row of the table and one bar. */
export interface ClockRow {
  key: ClockKey;
  /** The library's reading on this clock, `""` when it gave none. */
  reading: string;
  none: boolean;
  /** The row the reader typed. */
  yours: boolean;
  /** The library's spelling of the reader's own value, when it differs from
   *  what was typed (a trimmed fraction, an offset rewritten as `Z`). */
  writtenAs: string | null;
  lead: ClockLead;
  /** The lead as words: "37 s", "inside an inserted second", "no result". */
  leadText: string;
  /** The tags beside the clock's name: "your reading", "derived". */
  tags: string[];
}

export interface ClockRead {
  state: ClockState;
  status: "ok" | "empty" | "sentinel";
  /** The one sentence a sentinel says. */
  failure: string | null;
  /** What an empty state says. */
  emptyText: string | null;
  /** The clock the reader's value is on, or `null` before it is known. */
  clock: ClockKey | null;
  /** The UTC instant every row is made from. */
  utc: string | null;
  /** UTC leads, TAI leads and the six systems, always eight rows. */
  rows: ClockRow[];
  /** `nextLeapSecond(utc)`: `""` means none after this instant. */
  next: string | null;
  /** `taiMinusUtc(utc)`. */
  taiMinusUtc: number | null;
  plates: PlateSpec[];
  /** The footnote under the table, or `""`. */
  footnote: string;
  /** The calls made, in the order they were made. */
  calls: EdiCall[];
}

/** The lead as words. */
export function leadWords(lead: ClockLead): string {
  switch (lead.kind) {
    case "seconds":
      return `${lead.seconds} s`;
    case "inside":
      return INSIDE_SECOND_TEXT;
    case "reference":
      return REFERENCE_TEXT;
    case "none":
      return NO_RESULT_TEXT;
  }
}

const isClockToken = (t: string): t is (typeof CLOCK_TOKENS)[number] =>
  (CLOCK_TOKENS as readonly string[]).includes(t);

/** The plates for a reading. `read` null draws the empty plates. */
export function platesOf(
  parts: {
    utc: string;
    clock: ClockKey;
    leap: boolean;
    taiMinusUtc: number | null;
    tai: string;
    next: string;
  } | null,
): PlateSpec[] {
  const none = parts === null;
  return [
    {
      role: "hero-utc",
      caption: "UTC",
      value: none ? null : parts.utc,
      lines: [
        none
          ? ""
          : parts.clock === "UTC"
            ? "as typed"
            : `read from ${parts.clock}`,
        none || !parts.leap ? "" : "leap second",
      ],
      series: 1,
    },
    {
      role: "hero-tai",
      caption: "TAI − UTC",
      value:
        none || parts.taiMinusUtc === null ? null : `${parts.taiMinusUtc} s`,
      lines: [none ? "" : parts.tai, ""],
      quiet: true,
    },
    {
      role: "hero-next",
      caption: "Next change",
      value: none
        ? null
        : parts.next === ""
          ? "none after this instant"
          : parts.next,
      lines: [
        none
          ? ""
          : parts.next === ""
            ? "these gaps stay as they are"
            : "the next inserted second",
        "",
      ],
      quiet: true,
    },
  ];
}

function emptyRows(): ClockRow[] {
  return CLOCK_KEYS.map((key) => ({
    key,
    reading: "",
    none: false,
    yours: false,
    writtenAs: null,
    lead: { kind: "none" },
    leadText: "",
    tags: key === "IRN" ? [DERIVED_TAG] : [],
  }));
}

function blank(
  state: ClockState,
  status: "empty" | "sentinel",
  text: string,
  clock: ClockKey | null,
  calls: EdiCall[],
): ClockRead {
  return {
    state,
    status,
    failure: status === "sentinel" ? text : null,
    emptyText: status === "empty" ? text : null,
    clock,
    utc: null,
    rows: emptyRows(),
    next: null,
    taiMinusUtc: null,
    plates: platesOf(null),
    footnote: "",
    calls,
  };
}

/** The converter before anything is typed: eight empty rows, no reading. */
export function emptyRead(): ClockRead {
  return blank({ value: "" }, "empty", EMPTY_TEXT, null, []);
}

/** What a ladder row says under its name when the clock has no reading. */
export const LADDER_NONE_NOTE = "before its first instant";

/** The chip on a ladder row: the table's words, shortened where a lead is not seconds. */
export function ladderChip(row: ClockRow): string {
  return row.lead.kind === "inside" && !row.none
    ? "inserted second"
    : row.leadText;
}

/**
 * Read the converter's one value with the library. The value is trimmed, and
 * the clock it is on is the token after its one space: `TAI` goes to `fromTAI`,
 * a system token to `gnssToUtc`, no space means UTC as typed. The UTC instant
 * then goes to `toTAI` and to `utcToGnss` for each system, in table order.
 *
 * A state with no value makes no library call and is `empty`, not a sentinel.
 */
export function readClocks(lib: GnssLib, state: ClockState): ClockRead {
  const value = state.value.trim();
  if (value === "") return blank(state, "empty", EMPTY_TEXT, null, []);

  const calls: EdiCall[] = [];
  let clock: ClockKey = "UTC";
  let utc = value;

  if (value.includes(" ")) {
    const parts = labelParts(value);
    if (parts === null) {
      return blank(state, "sentinel", SENTENCES.notAnInstant, null, calls);
    }
    if (!isClockToken(parts.token)) {
      return blank(state, "sentinel", SENTENCES.unknownToken, null, calls);
    }
    clock = parts.token;
  }

  // GLONASS time keeps UTC's hours, so a second 60 on it is read as UTC's.
  if (clock === "UTC" || clock === "GLO") {
    const stamp = clock === "UTC" ? value : `${value.split(" ")[0]}Z`;
    if (lib.hasSecond60(stamp) && !lib.isLeapSecond(stamp)) {
      return blank(state, "sentinel", SENTENCES.noLeapSecond, clock, calls);
    }
  }

  if (clock === "TAI") {
    const call = runCall(lib, "fromTAI", value);
    calls.push(call);
    utc = call.result as string;
  } else if (clock !== "UTC") {
    const call = runCall(lib, "gnssToUtc", clock, value);
    calls.push(call);
    utc = call.result as string;
  }
  if (clock !== "UTC" && utc === "") {
    return blank(state, "sentinel", SENTENCES.notOnClock, clock, calls);
  }
  if (clock === "UTC" && !lib.isValidInstant(utc) && !lib.isLeapSecond(utc)) {
    return blank(state, "sentinel", SENTENCES.notAnInstant, clock, calls);
  }

  const taiCall = runCall(lib, "toTAI", utc);
  calls.push(taiCall);
  const tai = taiCall.result as string;

  // The reader's own UTC value, spelled back by the library (through TAI).
  let utcWrittenAs: string | null = null;
  if (clock === "UTC" && tai !== "") {
    const back = runCall(lib, "fromTAI", tai);
    calls.push(back);
    if (back.result !== value && back.result !== "") {
      utcWrittenAs = back.result as string;
    }
  }

  const labels = new Map<GnssSystem, string>();
  for (const system of GNSS_SYSTEMS) {
    const call = runCall(lib, "utcToGnss", system, utc);
    calls.push(call);
    labels.set(system, call.result as string);
  }

  const taiLead = runCall(lib, "taiMinusUtc", utc);
  calls.push(taiLead);
  const taiMinusUtc = taiLead.result as number | null;
  const nextCall = runCall(lib, "nextLeapSecond", utc);
  calls.push(nextCall);
  const next = nextCall.result as string;

  const rows: ClockRow[] = CLOCK_KEYS.map((key): ClockRow => {
    const reading =
      key === "UTC" ? utc : key === "TAI" ? tai : (labels.get(key) ?? "");
    const yours = key === clock;
    let lead: ClockLead;
    if (key === "UTC") lead = { kind: "reference" };
    else if (key === "TAI") {
      lead =
        taiMinusUtc !== null
          ? { kind: "seconds", seconds: String(taiMinusUtc) }
          : { kind: "none" };
    } else {
      const found = reading === "" ? null : leadOverUtc(lib, utc, reading);
      if (found?.kind === "lead") {
        const seconds = durationSecondsText(found.duration);
        lead =
          seconds === null ? { kind: "none" } : { kind: "seconds", seconds };
      } else if (found?.kind === "inside-inserted-second") {
        lead = { kind: "inside" };
      } else {
        lead = { kind: "none" };
      }
    }
    let writtenAs: string | null = null;
    if (yours && key === "UTC") writtenAs = utcWrittenAs;
    else if (yours && reading !== "" && reading !== value) writtenAs = reading;
    return {
      key,
      reading,
      none: reading === "",
      yours,
      writtenAs,
      lead,
      leadText: reading === "" ? NO_RESULT_TEXT : leadWords(lead),
      tags: [
        yours ? "your reading" : "",
        key === "IRN" ? DERIVED_TAG : "",
      ].filter(Boolean),
    };
  });

  const missing = rows.filter((r) => r.none).map((r) => r.key);
  const footnote =
    missing.length === 0
      ? ""
      : `${missing.join(", ")}: ${BEFORE_FIRST_INSTANT_NOTE}.`;

  return {
    state,
    status: "ok",
    failure: null,
    emptyText: null,
    clock,
    utc,
    rows,
    next,
    taiMinusUtc,
    plates: platesOf({
      utc,
      clock,
      leap: lib.isLeapSecond(utc),
      taiMinusUtc,
      tai,
      next,
    }),
    footnote,
    calls,
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The clock ladder
// ---------------------------------------------------------------------------

/**
 * The ladder's drawing, in pixels. Nothing here is a time: a clock stands
 * `step` pixels above the baseline for each second it leads UTC by, and its
 * lead is the library's.
 */
export const LADDER = {
  /** Pixels per second of lead. */
  step: 11,
  /** The height one clock's row takes, and the gap between two blocks of rows. */
  row: 48,
  gap: 4,
  /** Room above the longest scale and below the baseline. */
  padTop: 28,
  padBottom: 52,
  /** The least space between a row and the ladder's top or bottom edge. */
  edge: 4,
  /** The three columns of the drawing: second labels, the rail, the leaders. */
  axis: 30,
  rail: 18,
  gutter: 26,
} as const;

/** How a clock keeps time against the others, as the library shows it. */
export type ClockTie = "tai" | "utc" | null;

export const TIE_TEXT = {
  tai: "tied to TAI",
  utc: "follows UTC",
} as const;

/**
 * One small mark for each clock, drawn on a 16-unit square in the ink colour:
 * a dial for UTC, a plain square for TAI, then a different outline for each
 * system. A mark identifies a clock beside its name; none is a flag and none
 * is the default.
 */
export const CLOCK_GLYPHS: Record<ClockKey, string> = {
  UTC: '<circle cx="8" cy="8" r="5.5"/><path d="M8 4.8V8l2.4 1.6"/>',
  TAI: '<rect x="3" y="3" width="10" height="10"/><path d="M3 8h10"/>',
  GPS: '<path d="M8 2.6 14 13.4H2Z"/>',
  GAL: '<path d="M8 2 14 8 8 14 2 8Z"/>',
  BDT: '<path d="M8 2 13.2 5v6L8 14 2.8 11V5Z"/>',
  QZS: '<path d="M2.8 12a5.2 5.2 0 0 1 10.4 0"/><circle cx="8" cy="5.2" r="1.3"/>',
  GLO: '<path d="M8 2.2v11.6M2.2 8h11.6"/>',
  IRN: '<path d="M8 2 13.8 6.2 11.6 13.4H4.4L2.2 6.2Z"/>',
};

/** What each row says beside its name: the two ends of the ladder, then each system's tie. */
export function tieTag(key: ClockKey, tie: ClockTie): string {
  if (key === "UTC") return "baseline";
  if (key === "TAI") return "top rail";
  return tie === null ? "" : TIE_TEXT[tie];
}

/**
 * Which satellite clocks move with TAI and which keep UTC's hours, read from
 * the library over every stop of the slider. A clock is tied to TAI when its
 * distance from TAI is the same at every stop (`taiMinusUtc` less its lead),
 * and follows UTC when its lead is the same at every stop. A clock the library
 * reads at fewer than two stops, or one that does neither, is `null`.
 */
export function clockTies(
  lib: GnssLib,
  positions: readonly string[],
): Record<GnssSystem, ClockTie> {
  const ties = {} as Record<GnssSystem, ClockTie>;
  for (const system of GNSS_SYSTEMS) {
    const leads: number[] = [];
    const fromTai: number[] = [];
    for (const utc of positions) {
      const label = lib.utcToGnss(system, utc);
      const tai = lib.taiMinusUtc(utc);
      if (label === "" || tai === null) continue;
      const found = leadOverUtc(lib, utc, label);
      if (found.kind !== "lead") continue;
      const seconds = durationSecondsText(found.duration);
      if (seconds === null) continue;
      leads.push(Number(seconds));
      fromTai.push(tai - Number(seconds));
    }
    const same = (list: number[]) => list.every((n) => n === list[0]);
    ties[system] =
      leads.length < 2
        ? null
        : same(fromTai)
          ? "tai"
          : same(leads)
            ? "utc"
            : null;
  }
  return ties;
}

/**
 * The longest scale the ladder has to hold, in seconds: the largest
 * `taiMinusUtc` over the slider's stops. The stage reserves this height for
 * good, so the ladder grows inside a box that does not move.
 */
export function ladderSpan(
  lib: Pick<GnssLib, "taiMinusUtc">,
  positions: readonly string[],
): number {
  return Math.max(
    0,
    ...positions
      .map((utc) => lib.taiMinusUtc(utc))
      .filter((n): n is number => n !== null),
  );
}

/** One rung: the clocks that stand the same number of seconds from UTC. */
export interface LadderRung {
  seconds: number;
  keys: ClockKey[];
}

/**
 * The rungs of a reading, highest first, and the clocks that have no place on
 * the scale: no reading, or inside an inserted second, where a lead is not a
 * number of seconds. UTC is the baseline rung at 0. Clocks on one rung keep
 * the table's order.
 */
export function ladderRungs(read: ClockRead): {
  rungs: LadderRung[];
  off: ClockKey[];
} {
  const rungs = new Map<number, ClockKey[]>();
  const off: ClockKey[] = [];
  if (read.status !== "ok") return { rungs: [], off };
  for (const row of read.rows) {
    const seconds =
      row.lead.kind === "reference"
        ? 0
        : row.lead.kind === "seconds"
          ? Number(row.lead.seconds)
          : null;
    if (row.none || seconds === null || !(seconds >= 0)) {
      off.push(row.key);
      continue;
    }
    rungs.set(seconds, [...(rungs.get(seconds) ?? []), row.key]);
  }
  return {
    rungs: [...rungs]
      .sort((a, b) => b[0] - a[0])
      .map(([seconds, keys]) => ({ seconds, keys })),
    off,
  };
}

/**
 * The most clocks any slider stop leaves off the scale, read from the library
 * at every stop. The group under the ladder reserves this many rows, so a drag
 * never moves what is below it.
 */
export function offReserve(lib: GnssLib, positions: readonly string[]): number {
  return Math.max(
    0,
    ...positions.map((value) => ladderRungs(readClocks(lib, { value })).off.length),
  );
}

/** The signal-lost text, in the stage and (short) on the plates. */
export const LADDER_NO_SIGNAL = "⟨ NO SIGNAL — invalid input ⟩";
export const PLATE_NO_SIGNAL = "⟨ NO SIGNAL ⟩";

/** A placed rung: where it stands on the rail, and where its rows sit. */
export interface PlacedRung extends LadderRung {
  /** The rung's own height, from the ladder's top. */
  y: number;
  /** The top of its block of rows. A crowded block is moved off `y`. */
  top: number;
}

export interface LadderLayout {
  /** The stage's height, fixed for a given scale. */
  height: number;
  /** The baseline (UTC), and the top of the scale, from the ladder's top. */
  base: number;
  scaleTop: number;
  /** The scale in seconds. */
  span: number;
  /** TAI's height, or `null` when there is no TAI reading. */
  taiY: number | null;
  rungs: PlacedRung[];
  /** The top of each clock's row, from the ladder's top. */
  tops: Record<ClockKey, number>;
  /** The clocks with no place on the scale. */
  off: ClockKey[];
}

/**
 * Place the rows. A rung's block of rows is centred on the rung; blocks that
 * would overlap are pushed apart, down and then back up, so every row keeps
 * its own box inside the stage. A pushed block is joined to its rung by a
 * leader. Clocks off the scale take no place on the stage. With no reading the eight
 * rows are spread evenly.
 */
export function ladderLayout(read: ClockRead, span: number): LadderLayout {
  const { step, row, gap, padTop, padBottom, edge } = LADDER;
  const { rungs, off } = ladderRungs(read);
  const reach = Math.max(span, ...rungs.map((r) => r.seconds));
  const count = CLOCK_KEYS.length;
  const height = Math.max(
    padTop + padBottom + reach * step,
    count * row + (count - 1) * gap + 2 * edge,
  );
  const base = height - padBottom;
  const tops = {} as Record<ClockKey, number>;

  if (read.status !== "ok") {
    const room = height - 2 * edge - row;
    CLOCK_KEYS.forEach((key, i) => {
      tops[key] = edge + (i * room) / (count - 1);
    });
    return {
      height,
      base,
      scaleTop: base - reach * step,
      span: reach,
      taiY: null,
      rungs: [],
      tops,
      off: [],
    };
  }

  // Blocks, top to bottom: the rungs. Clocks off the scale are not on the stage;
  // the mount lists them under it, so each row left here stands at its true height.
  interface Block {
    keys: ClockKey[];
    y: number | null;
    seconds: number;
    size: number;
    top: number;
  }
  const blocks: Block[] = [];
  for (const rung of rungs) {
    const y = base - rung.seconds * step;
    const size = rung.keys.length * row;
    blocks.push({
      keys: rung.keys,
      y,
      seconds: rung.seconds,
      size,
      top: y - size / 2,
    });
  }
  let floor = edge;
  for (const block of blocks) {
    block.top = Math.max(block.top, floor);
    floor = block.top + block.size + gap;
  }
  let ceiling = height - edge;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]!;
    block.top = Math.min(block.top, ceiling - block.size);
    ceiling = block.top - gap;
  }
  for (const block of blocks) {
    block.keys.forEach((key, i) => {
      tops[key] = block.top + i * row;
    });
  }

  for (const key of off) tops[key] = 0;

  const taiRung = rungs.find((r) => r.keys.includes("TAI"));
  return {
    height,
    base,
    scaleTop: base - reach * step,
    span: reach,
    taiY: taiRung === undefined ? null : base - taiRung.seconds * step,
    rungs: blocks
      .filter((b) => b.y !== null)
      .map((b) => ({
        seconds: b.seconds,
        keys: b.keys,
        y: b.y!,
        top: b.top,
      })),
    tops,
    off,
  };
}

/** "A", "A and B", "A, B and C". */
function listOf(items: readonly string[]): string {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * The ladder in words, for the figure's `aria-label`: every rung from the top
 * down, each with its clocks and its lead, then the clocks off the scale.
 */
export function ladderAria(read: ClockRead): string {
  if (read.status !== "ok") {
    return read.failure ?? read.emptyText ?? "No ladder to draw";
  }
  const { rungs, off } = ladderRungs(read);
  const parts = rungs.map((rung) => {
    const names = listOf(rung.keys);
    return rung.seconds === 0
      ? `${names} on the baseline, 0 s`
      : `${names} ${rung.seconds} s ahead of UTC`;
  });
  const lost = off.map((key) => {
    const row = read.rows.find((r) => r.key === key)!;
    return row.none
      ? `${key}: no result, ${BEFORE_FIRST_INSTANT_NOTE}`
      : `${key}: ${row.leadText}`;
  });
  return `Ladder of ${read.rows.length} clocks on one scale of seconds ahead of UTC, TAI at the top: ${[...parts, ...lost].join("; ")}.`;
}

/** One row as a sentence: "GPS: 2024-01-01T00:00:18 GPS, 18 s ahead of UTC". */
export function rowSentence(row: ClockRow): string {
  if (row.none) return `${row.key}: no result, ${BEFORE_FIRST_INSTANT_NOTE}`;
  if (row.lead.kind === "reference") return `${row.key}: ${row.reading}`;
  const lead =
    row.lead.kind === "seconds"
      ? `${row.lead.seconds} s ahead of UTC`
      : row.lead.kind === "inside"
        ? INSIDE_SECOND_TEXT
        : NO_RESULT_TEXT;
  return `${row.key}: ${row.reading}, ${lead}`;
}

/** The sentence a screen reader hears when the plates change. */
export function summaryText(read: ClockRead): string {
  if (read.status === "sentinel") return read.failure ?? "";
  if (read.status === "empty") return read.emptyText ?? "";
  return read.plates
    .filter((p) => p.value !== null)
    .map((p) => {
      const lines = p.lines.filter(Boolean);
      return `${p.caption} ${p.value}${lines.length === 0 ? "" : `, ${lines.join(", ")}`}`;
    })
    .join(". ");
}

// ---------------------------------------------------------------------------
// Links to the other tools
// ---------------------------------------------------------------------------

/** The links row: the moment as a week, and why the gaps grew. */
export const CLOCK_LINKS = [
  { role: "link-weeks", text: "This moment as a week on every counter" },
  { role: "link-timeline", text: "Why these gaps grew" },
] as const;

/** Where each link goes for `read`, or `null` while there is no UTC instant. */
export function clockHandoffs(read: ClockRead): {
  weeks: ToolHandoff | null;
  timeline: ToolHandoff | null;
} {
  const utc = read.status === "ok" ? read.utc : null;
  if (utc === null || utc === "") return { weeks: null, timeline: null };
  return {
    weeks: { kind: "gnssweek", args: { mode: "utc", utc } },
    timeline: { kind: "leapline", args: { date: utc } },
  };
}
