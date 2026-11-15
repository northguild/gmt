/**
 * Pure helpers for the PTP Clock Converter (IOT-101).
 *
 * A PTP (IEEE 1588) timestamp counts TAI seconds and nanoseconds from 1970-01-01T00:00:00 TAI.
 * UTC is the count minus the `currentUtcOffset` the grandmaster announces. Section 1 reads a
 * record with `ptpToUtc` and shows the same count read with the offset ignored. Section 2
 * checks the announced offset against the leap-second table (`taiMinusUtc`) and draws the two
 * on a fixed ruler. Section 3 writes a UTC instant back with `utcToPtp`.
 *
 * The site holds no PTP rule. Every reading, refusal and verdict is a library result, and a
 * refusal is explained by asking the library again. The conversions the site makes are two
 * number grammars (`INTEGER`, `DECIMAL`), not PTP ones: the library judges the number, and
 * the one piece of arithmetic is the integer difference of two library offsets.
 *
 * No DOM, no library import (the library arrives as an `IotLib`).
 */
import { Temporal } from "@js-temporal/polyfill";
import type { IotLib } from "./iot-lib";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_READ_PRESET,
  DEFAULT_WRITE_PRESET,
  PROBE_RECORD,
  READ_PRESETS,
  WIDEST_DECIMAL_TEXT,
  WIDEST_INSTANT,
  WIDEST_SECONDS_TEXT,
  WRITE_PRESETS,
  type PtpState,
  type ReadPreset,
  type WriteNamedReason,
  type WritePreset,
} from "./ptp-clock-presets";
import { INTEGER_UTC_FROM } from "./timescale-widgets";

export {
  CUSTOM_PRESET_ID,
  READ_PRESETS,
  WRITE_PRESETS,
  type PtpState,
} from "./ptp-clock-presets";

/** The most each number box takes: the chat's argument cap. The instant takes 64. */
export const NUMBER_MAX_CHARS = 24;
export const INSTANT_MAX_CHARS = 64;

/** What a plate reads while nothing has been typed: an empty field is not a refusal. */
export const NOTHING_TYPED = "nothing typed";
/** What a plate reads when a box holds text that is not a number. */
export const NOT_A_NUMBER = "not a number";
/** What a plate reads when there is nothing to show because the read was refused. */
export const NOT_READ = "not read";
export const NOT_WRITTEN = "nothing written";

/** The ruler is a fixed 0 to 40 s drawing, never rescaled. */
export const RULER_SECONDS = 40;
/** A mark's width as a share of the ruler: a drawing constant. */
export const MARK_WIDTH = 0.02;
export const RULER_LABEL = "TAI − UTC (s)";

export interface PtpClockArgs {
  preset?: string;
  writePreset?: string;
  seconds?: string;
  nanoseconds?: string;
  offset?: string;
  instant?: string;
}

// ---------------------------------------------------------------------------
// State, presets and arguments
// ---------------------------------------------------------------------------

export function matchReadPreset(state: PtpState): string {
  return (
    READ_PRESETS.find(
      (p) =>
        p.seconds === state.seconds &&
        p.nanoseconds === state.nanoseconds &&
        p.offset === state.offset,
    )?.id ?? CUSTOM_PRESET_ID
  );
}

export function matchWritePreset(instant: string): string {
  return (
    WRITE_PRESETS.find((p) => p.instant === instant)?.id ?? CUSTOM_PRESET_ID
  );
}

const KEYS = [
  "preset",
  "writePreset",
  "seconds",
  "nanoseconds",
  "offset",
  "instant",
] as const;

/** Whether the args seed the widget: a blank box is a seed, a cleared field. */
export function isSeeded(args: PtpClockArgs | undefined): boolean {
  return args !== undefined && KEYS.some((k) => typeof args[k] === "string");
}

export function presetState(
  read: ReadPreset = DEFAULT_READ_PRESET,
  write: WritePreset = DEFAULT_WRITE_PRESET,
): PtpState {
  return {
    seconds: read.seconds,
    nanoseconds: read.nanoseconds,
    offset: read.offset,
    instant: write.instant,
  };
}

/** The state a seed describes: the named presets, then any text the seed also gives. */
export function readArgs(args: PtpClockArgs): PtpState {
  const state = presetState(
    READ_PRESETS.find((p) => p.id === args.preset),
    WRITE_PRESETS.find((p) => p.id === args.writePreset),
  );
  // A blank box is a seed: a link made from a cleared field must open cleared.
  if (typeof args.seconds === "string") state.seconds = args.seconds;
  if (typeof args.nanoseconds === "string")
    state.nanoseconds = args.nanoseconds;
  if (typeof args.offset === "string") state.offset = args.offset;
  if (typeof args.instant === "string") state.instant = args.instant;
  return state;
}

/**
 * The permalink keys for `state`: a preset's id while a box set matches one, else the text
 * itself (even blank, so the link does not fall back to the default).
 */
export function permalinkOf(state: PtpState): Record<string, string> {
  const read = matchReadPreset(state);
  const write = matchWritePreset(state.instant);
  return {
    ...(read === CUSTOM_PRESET_ID
      ? {
          seconds: state.seconds,
          nanoseconds: state.nanoseconds,
          offset: state.offset,
        }
      : { preset: read }),
    ...(write === CUSTOM_PRESET_ID
      ? { instant: state.instant }
      : { writePreset: write }),
  };
}

// ---------------------------------------------------------------------------
// Text readers
// ---------------------------------------------------------------------------

/** Whole seconds, read as a `bigint`: digits with an optional sign. */
const INTEGER = /^-?\d{1,20}$/;
/** Seconds with a fraction, read as a `number`: the library takes one and refuses it. */
const FRACTION = /^-?\d{1,20}\.\d{1,9}$/;
/** A number with an optional fraction, for the nanoseconds and the offset. */
const DECIMAL = /^-?\d{1,11}(\.\d{1,9})?$/;

export type Typed<T> =
  | { kind: "empty" }
  | { kind: "notNumber" }
  | { kind: "ok"; value: T };

/**
 * The seconds box: an empty box is "nothing typed", text off the pattern is "not a number".
 * Whole seconds are a `bigint`; with a fraction they are a `number`, so the library's own
 * refusal shows, as it does for a sign.
 */
export function readSeconds(text: string): Typed<bigint | number> {
  if (text === "") return { kind: "empty" };
  if (INTEGER.test(text)) return { kind: "ok", value: BigInt(text) };
  return FRACTION.test(text)
    ? { kind: "ok", value: Number(text) }
    : { kind: "notNumber" };
}

/** The nanoseconds and offset boxes. `+ 0` turns a negative zero into 0. */
export function readDecimal(text: string): Typed<number> {
  if (text === "") return { kind: "empty" };
  return DECIMAL.test(text)
    ? { kind: "ok", value: Number(text) + 0 }
    : { kind: "notNumber" };
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

/** A value as source: a bigint carries its `n`, keys are unquoted. */
export function lit(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  const entries = Object.entries(value as Record<string, unknown>);
  return `{ ${entries.map(([k, v]) => `${k}: ${lit(v)}`).join(", ")} }`;
}

/** A record as `utcToPtp` writes it: whole seconds as a `bigint`. */
interface WrittenRecord {
  seconds: bigint;
  nanoseconds: number;
}

/** A record as the library takes it: `bigint` seconds, or `number` seconds, fraction and all. */
type Record80 = WrittenRecord | { seconds: number; nanoseconds: number };

/** Narrowed once, so the record is one of the two shapes the library declares. */
const recordOf = (seconds: bigint | number, nanoseconds: number): Record80 =>
  typeof seconds === "bigint"
    ? { seconds, nanoseconds }
    : { seconds, nanoseconds };

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export type ReadReasonKey =
  | "empty"
  | "notNumber"
  | "read"
  | "recordOut"
  | "offsetRefused"
  | "pastEnd"
  | "before1970";

export const READ_REASONS: Record<ReadReasonKey, string> = {
  empty: "Type the seconds, the nanoseconds and the offset.",
  notNumber:
    "Not a number: type digits, with a minus sign or a decimal point if you like, and the library will say whether it takes them.",
  read: "Read with the announced offset, and again with the offset ignored.",
  recordOut: "The record is out of range.",
  offsetRefused: "The offset is refused.",
  pastEnd: "Past the last instant the library can write.",
  before1970:
    "Before 1970-01-01: the count is smaller than the offset, which in practice is a clock that was never set.",
};

export const EMPTY_BADGE = "";
export const badgeText = (valid: boolean): string =>
  valid ? "record in range" : "record out of range";
export const BADGE_SAMPLES = [badgeText(true), badgeText(false)];

// ---------------------------------------------------------------------------
// Section 1: read
// ---------------------------------------------------------------------------

export interface ReadResult {
  kind: "empty" | "notNumber" | "read" | "refused";
  record: Record80 | null;
  offset: number | null;
  /** `ptpToUtc(record, offset)`, `""` when the library refused. */
  utc: string | null;
  /** `ptpToUtc(record, 0)`: the count read as if it were UTC. */
  ignored: string | null;
  /** `isValidPtpTimestamp(record)`, `null` until a record was typed. */
  valid: boolean | null;
  reason: ReadReasonKey;
  calls: string[];
}

const blankRead = (kind: "empty" | "notNumber"): ReadResult => ({
  kind,
  record: null,
  offset: null,
  utc: null,
  ignored: null,
  valid: null,
  reason: kind,
  calls: [],
});

/**
 * Reads the three boxes exactly as typed and asks the library. A refusal is explained by asking
 * it again, in this order, and the first that applies names the reason:
 *
 * 1. `isValidPtpTimestamp(record)` is false: the record is out of range.
 * 2. `ptpToUtc(PROBE_RECORD, offset)` is `""`: the offset is refused.
 * 3. `ptpToUtc(record, 0)` is `""` too: past the last instant the library can write.
 * 4. Otherwise the count is smaller than the offset: before 1970.
 */
export function readPtp(lib: IotLib, state: PtpState): ReadResult {
  const seconds = readSeconds(state.seconds);
  const nanoseconds = readDecimal(state.nanoseconds);
  const offset = readDecimal(state.offset);
  const parts = [seconds.kind, nanoseconds.kind, offset.kind];
  if (parts.includes("empty")) return blankRead("empty");
  if (
    seconds.kind !== "ok" ||
    nanoseconds.kind !== "ok" ||
    offset.kind !== "ok"
  ) {
    return blankRead("notNumber");
  }

  const record = recordOf(seconds.value, nanoseconds.value);
  const calls: string[] = [];
  const valid = lib.isValidPtpTimestamp(record);
  calls.push(`isValidPtpTimestamp(${lit(record)}); // ${lit(valid)}`);
  const utc = lib.ptpToUtc(record, offset.value);
  calls.push(`ptpToUtc(${lit(record)}, ${lit(offset.value)}); // ${lit(utc)}`);
  const ignored = lib.ptpToUtc(record, 0);
  calls.push(`ptpToUtc(${lit(record)}, 0); // ${lit(ignored)}`);

  const result = (
    kind: "read" | "refused",
    reason: ReadReasonKey,
  ): ReadResult => ({
    kind,
    record,
    offset: offset.value,
    utc,
    ignored,
    valid,
    reason,
    calls,
  });

  if (utc !== "") return result("read", "read");
  if (!valid) return result("refused", "recordOut");
  const probe = lib.ptpToUtc(PROBE_RECORD, offset.value);
  calls.push(
    `ptpToUtc(${lit(PROBE_RECORD)}, ${lit(offset.value)}); // ${lit(probe)}`,
  );
  if (probe === "") return result("refused", "offsetRefused");
  if (ignored === "") return result("refused", "pastEnd");
  return result("refused", "before1970");
}

// ---------------------------------------------------------------------------
// Section 2: check the offset
// ---------------------------------------------------------------------------

export type CheckKind = "empty" | "noReading" | "checked";

export interface Verdict {
  tone: "neutral" | "good" | "bad";
  title: string;
  detail: string;
}

export interface CheckResult {
  kind: CheckKind;
  announced: number | null;
  /** `taiMinusUtc(utc)`; `null` is the library's no-value answer. */
  table: number | null;
  /** `ptpToUtc(record, table)`: the UTC the leap-second table gives for the same count. */
  tableUtc: string | null;
  verdict: Verdict;
  calls: string[];
}

export const NO_READING_VERDICT: Verdict = {
  tone: "neutral",
  title: "No reading, so nothing to check",
  detail: "",
};
export const BEFORE_1972_VERDICT: Verdict = {
  tone: "neutral",
  title: "No table value before 1972",
  detail: "TAI − UTC was not a whole number of seconds",
};
export const MATCH_VERDICT: Verdict = {
  tone: "good",
  title: "Offset matches the table",
  detail: "",
};

/** N is the table's offset less the announced one: the site's only arithmetic. */
export function differenceVerdict(announced: number, table: number): Verdict {
  const n = table - announced;
  const size = Math.abs(n);
  return {
    tone: "bad",
    title: `Offset differs from the table by ${size} s`,
    detail: `Every reading is ${size} s ${n > 0 ? "later" : "earlier"} than UTC`,
  };
}

/** Every verdict the section can show, widest included, for the hold. */
export const VERDICT_SAMPLES: readonly Verdict[] = [
  NO_READING_VERDICT,
  BEFORE_1972_VERDICT,
  MATCH_VERDICT,
  differenceVerdict(0, 99999),
  differenceVerdict(99999, 0),
];

/** The verdict for an announced offset and a table value. */
export function verdictOf(
  announced: number,
  table: number | null,
  utc: string,
): Verdict {
  if (table === null) {
    const before =
      Temporal.Instant.compare(
        Temporal.Instant.from(utc),
        Temporal.Instant.from(INTEGER_UTC_FROM),
      ) < 0;
    return before
      ? BEFORE_1972_VERDICT
      : {
          tone: "neutral",
          title: "The table gives no value here",
          detail: "",
        };
  }
  return table === announced
    ? MATCH_VERDICT
    : differenceVerdict(announced, table);
}

const noCheck = (kind: "empty" | "noReading"): CheckResult => ({
  kind,
  announced: null,
  table: null,
  tableUtc: null,
  verdict: NO_READING_VERDICT,
  calls: [],
});

/** The table's offset at the announced reading, and the UTC the table gives for the same count. */
export function checkOffset(lib: IotLib, read: ReadResult): CheckResult {
  if (read.kind === "empty" || read.kind === "notNumber")
    return noCheck("empty");
  if (
    read.kind !== "read" ||
    read.record === null ||
    read.offset === null ||
    read.utc === null ||
    read.utc === ""
  ) {
    return noCheck("noReading");
  }
  const calls: string[] = [];
  const table = lib.taiMinusUtc(read.utc);
  calls.push(`taiMinusUtc(${lit(read.utc)}); // ${lit(table)}`);
  let tableUtc: string | null = null;
  if (table !== null) {
    tableUtc = lib.ptpToUtc(read.record, table);
    calls.push(
      `ptpToUtc(${lit(read.record)}, ${lit(table)}); // ${lit(tableUtc)}`,
    );
  }
  return {
    kind: "checked",
    announced: read.offset,
    table,
    tableUtc,
    verdict: verdictOf(read.offset, table, read.utc),
    calls,
  };
}

// --- The ruler ---------------------------------------------------------------

export interface RulerMark {
  kind: "announced" | "table" | "same";
  /** Where the mark's centre sits, 0 to 1, clamped to the ruler. */
  at: number;
  label: string;
}

export interface RulerSpan {
  at: number;
  span: number;
  label: string;
}

export interface RulerModel {
  marks: RulerMark[];
  gap: RulerSpan | null;
  /** The facts, for the visually hidden list. */
  facts: string[];
}

const share = (seconds: number): number =>
  Math.min(1, Math.max(0, seconds / RULER_SECONDS));

const offRuler = (seconds: number): boolean =>
  seconds < 0 || seconds > RULER_SECONDS;

/** A seconds value in words, naming the clamp when it falls outside the ruler. */
export const rulerValueText = (seconds: number): string =>
  offRuler(seconds) ? `off the ruler: ${seconds} s` : `${seconds} s`;

/** The left edge of a mark centred on `centre`, kept inside the lane. */
export const markStart = (centre: number): number =>
  Math.min(1 - MARK_WIDTH, Math.max(0, centre - MARK_WIDTH / 2));

export const gapText = (n: number): string => `${n} s apart`;

export function rulerOf(check: CheckResult): RulerModel {
  if (check.kind !== "checked" || check.announced === null) {
    return { marks: [], gap: null, facts: ["Nothing to draw."] };
  }
  const announced = check.announced;
  const table = check.table;
  if (table === null) {
    return {
      marks: [
        {
          kind: "announced",
          at: share(announced),
          label: `Announced offset, ${rulerValueText(announced)}`,
        },
      ],
      gap: null,
      facts: [
        `Announced offset, ${rulerValueText(announced)}.`,
        "The table gives no value here.",
      ],
    };
  }
  if (table === announced) {
    const text = `Announced = table, ${rulerValueText(announced)}`;
    return {
      marks: [{ kind: "same", at: share(announced), label: text }],
      gap: null,
      facts: [`${text}.`],
    };
  }
  const size = Math.abs(table - announced);
  const from = Math.min(share(announced), share(table));
  const to = Math.max(share(announced), share(table));
  return {
    marks: [
      {
        kind: "announced",
        at: share(announced),
        label: `Announced offset, ${rulerValueText(announced)}`,
      },
      {
        kind: "table",
        at: share(table),
        label: `Table offset, ${rulerValueText(table)}`,
      },
    ],
    gap: { at: from, span: to - from, label: gapText(size) },
    facts: [
      `Announced offset, ${rulerValueText(announced)}.`,
      `Table offset, ${rulerValueText(table)}.`,
      `${gapText(size)}.`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Section 3: write
// ---------------------------------------------------------------------------

export type WriteReasonKey =
  | "empty"
  | "needOffset"
  | "notNumber"
  | "written"
  | "offsetRefused"
  | "noInstant"
  | WriteNamedReason;

export const WRITE_REASONS: Record<WriteReasonKey, string> = {
  empty: "Type a UTC instant, such as 2024-01-01T00:00:00Z.",
  needOffset: "Type the announced offset in section 1: a write needs it too.",
  notNumber:
    "The offset is not a number: type digits, with a minus sign or a decimal point if you like, and the library will say whether it takes them.",
  written: "Written by the library and read back with the same offset.",
  offsetRefused: "The offset is refused.",
  noInstant:
    "The library reads no instant here, or the result is out of range.",
  leapSecond:
    "A second of 60 is an inserted second: with one offset for the whole call it has no reading of its own.",
  before1970:
    "Before 1970-01-01T00:00:00Z: the count starts in 1970, so there is nothing to write.",
};

export interface WriteResult {
  kind: "empty" | "notNumber" | "written" | "refused";
  seconds: bigint | null;
  nanoseconds: number | null;
  /** `ptpToUtc` of the written record, with the same offset. */
  back: string | null;
  reason: WriteReasonKey;
  calls: string[];
}

const noWrite = (
  kind: "empty" | "notNumber",
  reason: WriteReasonKey,
): WriteResult => ({
  kind,
  seconds: null,
  nanoseconds: null,
  back: null,
  reason,
  calls: [],
});

/**
 * Writes the instant as typed, whole: no trim, no folding. A refusal is named by asking the
 * library again: `utcToPtp(instant, 0)` taking the instant means the offset is refused; if it
 * does not, a preset that matches the text exactly may name a reason, else the library reads no
 * instant here.
 */
export function writePtp(lib: IotLib, state: PtpState): WriteResult {
  if (state.instant === "") return noWrite("empty", "empty");
  const offset = readDecimal(state.offset);
  if (offset.kind === "empty") return noWrite("empty", "needOffset");
  if (offset.kind === "notNumber") return noWrite("notNumber", "notNumber");

  const calls: string[] = [];
  const written = lib.utcToPtp(state.instant, offset.value);
  calls.push(
    `utcToPtp(${lit(state.instant)}, ${lit(offset.value)}); // ${lit(written)}`,
  );
  if (written === null) {
    const probe = lib.utcToPtp(state.instant, 0);
    calls.push(`utcToPtp(${lit(state.instant)}, 0); // ${lit(probe)}`);
    const named = WRITE_PRESETS.find(
      (p) => p.instant === state.instant,
    )?.reason;
    const reason: WriteReasonKey =
      probe !== null ? "offsetRefused" : (named ?? "noInstant");
    return {
      kind: "refused",
      seconds: null,
      nanoseconds: null,
      back: null,
      reason,
      calls,
    };
  }
  // A plain literal the site builds: the library reads any object.
  const record: WrittenRecord = {
    seconds: written.seconds,
    nanoseconds: written.nanoseconds,
  };
  const back = lib.ptpToUtc(record, offset.value);
  calls.push(`ptpToUtc(${lit(record)}, ${lit(offset.value)}); // ${lit(back)}`);
  return {
    kind: "written",
    seconds: record.seconds,
    nanoseconds: record.nanoseconds,
    back,
    reason: "written",
    calls,
  };
}

export const ROUND_TRIP_LEAD = "Round trip: ";
export const roundTripText = (back: string): string =>
  `${ROUND_TRIP_LEAD}${back}`;

// ---------------------------------------------------------------------------
// Calls frames
// ---------------------------------------------------------------------------

export type CallsSection = "read" | "check" | "write";

/**
 * The widest text each calls frame can print, so the frame holds one height whatever the
 * reader types: stub libraries run through the real readers. One stub answers every call at
 * the widest, one refuses so that every probe runs; the frame takes the most lines of the two
 * and the widest line of either.
 */
export function callsSizer(section: CallsSection): {
  lines: number;
  widest: string;
} {
  const record = { seconds: BigInt(WIDEST_SECONDS_TEXT), nanoseconds: 0 };
  const wide = {
    ptpToUtc: () => WIDEST_INSTANT,
    utcToPtp: () => record,
    isValidPtpTimestamp: () => true,
    taiMinusUtc: () => -99,
  } as unknown as IotLib;
  const refusing = {
    ...wide,
    ptpToUtc: () => "",
    utcToPtp: () => null,
  } as unknown as IotLib;
  const state: PtpState = {
    seconds: WIDEST_SECONDS_TEXT,
    nanoseconds: WIDEST_DECIMAL_TEXT,
    offset: WIDEST_DECIMAL_TEXT,
    instant: WIDEST_INSTANT,
  };
  const linesOf = (lib: IotLib): string[] => {
    if (section === "write") return writePtp(lib, state).calls;
    const read = readPtp(lib, state);
    return section === "read" ? read.calls : checkOffset(lib, read).calls;
  };
  const sets = [linesOf(wide), linesOf(refusing)];
  const all = sets.flat();
  return {
    lines: Math.max(...sets.map((s) => s.length)),
    widest: all.reduce((a, b) => (b.length > a.length ? b : a), ""),
  };
}
