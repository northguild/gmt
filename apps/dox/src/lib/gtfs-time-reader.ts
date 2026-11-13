/**
 * Pure helpers for the GTFS Time Reader (RAI-99).
 *
 * The reader pastes a GTFS `Time` value (`stop_times.arrival_time`, `departure_time`,
 * `frequencies.start_time`). Section 1 reads it with `parseGtfsTime` and `isValidGtfsTime` and
 * writes the record back with `formatGtfsTime`. Section 2 puts the same text through a
 * clock-time check (`isValidTime`) and folds it into one day, to show what a reader that does
 * not know GTFS loses. Section 3 writes a record from two typed numbers and reads it back.
 *
 * The site holds no GTFS rule. Every written time, day count, verdict and refusal is a library
 * result, and a refusal is explained by asking the library again. The one conversion the site
 * makes is a number grammar (`NUMBER`), not a GTFS one; the library judges the number.
 *
 * No DOM, no library import (the library arrives as a `RailLib`).
 */
import type { GtfsTime } from "@northguild/gmt/types";
import { literal } from "./holiday-rule-builder";
import type { RailLib } from "./rail-lib";

export const CUSTOM_PRESET_ID = "custom";

/** The most each box takes: the chat's argument cap. */
export const READ_MAX_CHARS = 16;
export const WRITE_MAX_CHARS = 16;

/** What a plate reads while nothing has been typed: an empty field is not a refusal. */
export const NOTHING_TYPED = "nothing typed";
/** What a plate reads when the typed seconds or days are not a number. */
export const NOT_A_NUMBER = "not a number";
/** What a plate reads when there is nothing to show because the read was refused. */
export const NOT_READ = "not read";
export const NOT_WRITTEN = "nothing written";

/** The wording of the clock note, always visible (the owner's words). */
export const CLOCK_NOTE_LEAD =
  "These are days and seconds counted from the start of the service day (noon minus 12 hours). To turn them into a clock time on a date you need the agency's zone, and the result can differ on a day the clocks change. ";
export const CLOCK_NOTE_TAIL = ", planned for a later release, does that.";
/** The note as plain text, for the prose test and the chat doc. */
export const CLOCK_NOTE_TEXT = `${CLOCK_NOTE_LEAD}gtfsToInstant${CLOCK_NOTE_TAIL}`;

/** The note under a written-back time that differs from the typed one. */
export const DIGITS_NOTE =
  "GTFS reads one, two or three hour digits; this writes two below 100.";

// ---------------------------------------------------------------------------
// State, presets and arguments
// ---------------------------------------------------------------------------

/** The text of the three boxes, as typed. */
export interface GtfsState {
  value: string;
  seconds: string;
  dayOverflow: string;
}

export interface GtfsTimeReaderArgs {
  preset?: string;
  writePreset?: string;
  value?: string;
  seconds?: string;
  dayOverflow?: string;
}

export type PresetReasonKey =
  | "badMinute"
  | "fourDigitHour"
  | "noSeconds"
  | "sign"
  | "fraction";

interface ReadPreset {
  id: string;
  label: string;
  description: string;
  value: string;
  /** The reason that holds for this exact text and no other. */
  reason?: PresetReasonKey;
}

interface WritePreset {
  id: string;
  label: string;
  description: string;
  seconds: string;
  dayOverflow: string;
}

/** Each preset's reading is the library's, asserted in the unit test. */
export const READ_PRESETS: readonly ReadPreset[] = [
  {
    id: "next-day",
    label: "A stop after midnight",
    description: "25:35:00 is 01:35, one day past the service day.",
    value: "25:35:00",
  },
  {
    id: "daytime",
    label: "A daytime stop",
    description: "No days past the service day.",
    value: "14:30:00",
  },
  {
    id: "one-digit",
    label: "One hour digit",
    description: "Read, and written back with two.",
    value: "8:05:00",
  },
  {
    id: "midnight",
    label: "24:00:00",
    description: "Midnight at the end of the service day.",
    value: "24:00:00",
  },
  {
    id: "two-days",
    label: "48:00:00",
    description: "Two days past the service day.",
    value: "48:00:00",
  },
  {
    id: "three-digits",
    label: "Three hour digits",
    description: "110:29:00, written back with three.",
    value: "110:29:00",
  },
  {
    id: "largest",
    label: "The largest time",
    description: "The latest time the reader takes.",
    value: "999:59:59",
  },
  {
    id: "bad-minute",
    label: "Minute 60",
    description: "Refused.",
    value: "25:60:00",
    reason: "badMinute",
  },
  {
    id: "four-digits",
    label: "Four hour digits",
    description: "Refused.",
    value: "1000:00:00",
    reason: "fourDigitHour",
  },
  {
    id: "no-seconds",
    label: "No seconds",
    description: "Refused.",
    value: "25:35",
    reason: "noSeconds",
  },
  {
    id: "sign",
    label: "A negative time",
    description: "Refused.",
    value: "-01:00:00",
    reason: "sign",
  },
  {
    id: "fraction",
    label: "A fraction of a second",
    description: "Refused.",
    value: "25:35:00.5",
    reason: "fraction",
  },
  {
    id: "space",
    label: "A leading space",
    description: "Refused: the reader does not trim.",
    value: " 25:35:00",
  },
];

export const WRITE_PRESETS: readonly WritePreset[] = [
  {
    id: "write-next-day",
    label: "5700 seconds, 1 day",
    description: "Written back as the time you started with.",
    seconds: "5700",
    dayOverflow: "1",
  },
  {
    id: "write-120h",
    label: "0 seconds, 5 days",
    description: "120 hours: three hour digits.",
    seconds: "0",
    dayOverflow: "5",
  },
  {
    id: "write-1000h",
    label: "1000 hours",
    description: "Refused: three hour digits cannot hold it.",
    seconds: "57600",
    dayOverflow: "41",
  },
  {
    id: "write-full-day",
    label: "86400 seconds",
    description: "Refused: a whole day belongs in the days.",
    seconds: "86400",
    dayOverflow: "0",
  },
  {
    id: "write-fraction",
    label: "1.5 seconds",
    description: "Refused: whole seconds only.",
    seconds: "1.5",
    dayOverflow: "0",
  },
];

const DEFAULT_READ = READ_PRESETS[0]!;
const DEFAULT_WRITE = WRITE_PRESETS[0]!;

export function matchReadPreset(value: string): string {
  return READ_PRESETS.find((p) => p.value === value)?.id ?? CUSTOM_PRESET_ID;
}

export function matchWritePreset(seconds: string, dayOverflow: string): string {
  return (
    WRITE_PRESETS.find(
      (p) => p.seconds === seconds && p.dayOverflow === dayOverflow,
    )?.id ?? CUSTOM_PRESET_ID
  );
}

/** Whether the args seed the widget: a blank box is a seed, a cleared field. */
export function isSeeded(args: GtfsTimeReaderArgs | undefined): boolean {
  return (
    args !== undefined &&
    (
      ["preset", "writePreset", "value", "seconds", "dayOverflow"] as const
    ).some((k) => typeof args[k] === "string")
  );
}

export function presetState(
  read: ReadPreset = DEFAULT_READ,
  write: WritePreset = DEFAULT_WRITE,
): GtfsState {
  return {
    value: read.value,
    seconds: write.seconds,
    dayOverflow: write.dayOverflow,
  };
}

/** The state a seed describes: the named presets, then any text the seed also gives. */
export function readArgs(args: GtfsTimeReaderArgs): GtfsState {
  const state = presetState(
    READ_PRESETS.find((p) => p.id === args.preset),
    WRITE_PRESETS.find((p) => p.id === args.writePreset),
  );
  // A blank box is a seed: a link made from a cleared field must open cleared.
  if (typeof args.value === "string") state.value = args.value;
  if (typeof args.seconds === "string") state.seconds = args.seconds;
  if (typeof args.dayOverflow === "string")
    state.dayOverflow = args.dayOverflow;
  return state;
}

/**
 * The permalink keys for `state`: a preset's id while a box matches one, else the text itself
 * (even blank, so the link does not fall back to the default).
 */
export function permalinkOf(state: GtfsState): Record<string, string> {
  const read = matchReadPreset(state.value);
  const write = matchWritePreset(state.seconds, state.dayOverflow);
  return {
    ...(read === CUSTOM_PRESET_ID ? { value: state.value } : { preset: read }),
    ...(write === CUSTOM_PRESET_ID
      ? { seconds: state.seconds, dayOverflow: state.dayOverflow }
      : { writePreset: write }),
  };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** `1 day`, `2 days`. */
export const daysText = (n: number): string =>
  `${n} ${n === 1 ? "day" : "days"}`;

/** The reading line: the days past the service day, then the seconds written with no days. */
export const readingText = (dayOverflow: number, lessDays: string): string =>
  `${daysText(dayOverflow)} past the service day, ${lessDays}`;

/** The widest reading, for the held line's room. */
export const READING_SAMPLE = readingText(41, "23:59:59");

export const EMPTY_READING = "Type a GTFS time, such as 25:35:00, to read it.";
export const NOT_READ_READING = "Not read: the library returned no record.";

/** The record as the library returned it, printed the way a call prints it. */
export const recordText = (record: GtfsTime): string =>
  literal({ seconds: record.seconds, dayOverflow: record.dayOverflow });

/** The widest record, for the held line's room. */
export const RECORD_SAMPLE = recordText({ seconds: 86399, dayOverflow: 41 });

export type ReadReasonKey =
  | "empty"
  | "read"
  | "trimmed"
  | PresetReasonKey
  | "shape";

export const READ_REASONS: Record<ReadReasonKey, string> = {
  empty: "Type a GTFS time, such as 25:35:00.",
  read: "Read exactly as typed.",
  trimmed:
    "Spaces, a tab, a line break or a byte-order mark around the value: GTFS asks the feed to remove them, and the reader does not trim.",
  badMinute: "The minutes are 60: minutes and seconds run 00 to 59.",
  fourDigitHour: "Four hour digits: hours run up to 999.",
  noSeconds: "The seconds are missing: a stop time is H:MM:SS.",
  sign: "A sign is refused: a stop time has no negative hours.",
  fraction: "A fraction of a second is refused: a stop time is whole seconds.",
  shape:
    "Not H:MM:SS, HH:MM:SS or HHH:MM:SS, with minutes and seconds 00 to 59 and hours up to 999.",
};

export type WriteReasonKey =
  | "empty"
  | "notNumber"
  | "written"
  | "days"
  | "seconds"
  | "hours";

export const WRITE_REASONS: Record<WriteReasonKey, string> = {
  empty: "Type the seconds and the days past the service day.",
  notNumber:
    "Not a number: type digits, with a minus sign or a decimal point if you like, and the library will say whether it takes them.",
  written:
    "Written by the library and read back to see whether it is the same record.",
  days: "Days past the service day must be a whole number, 0 or more, and few enough for three hour digits.",
  seconds: "Seconds must be a whole number from 0 to 86399.",
  hours: "1000 hours or more, which three hour digits cannot hold.",
};

// ---------------------------------------------------------------------------
// Section 1: read
// ---------------------------------------------------------------------------

export interface ReadResult {
  kind: "empty" | "read" | "refused";
  /** `parseGtfsTime`'s record, as a plain literal the site built, or `null`. */
  record: GtfsTime | null;
  /** `formatGtfsTime({ seconds, dayOverflow: 0 })`: the library writing the seconds with no days. */
  lessDays: string | null;
  /** `formatGtfsTime(record)`, or `null`. */
  writtenBack: string | null;
  /** `isValidGtfsTime`, `null` for an empty box. */
  valid: boolean | null;
  reason: ReadReasonKey;
  calls: string[];
}

/** Ask the library to read `text`, print the call, and return what it gave. */
function parse(lib: RailLib, text: string, calls: string[]): GtfsTime | null {
  const record = lib.parseGtfsTime(text);
  calls.push(`parseGtfsTime(${literal(text)}); // ${literal(record)}`);
  return record;
}

function format(lib: RailLib, value: GtfsTime, calls: string[]): string {
  const out = lib.formatGtfsTime(value);
  calls.push(`formatGtfsTime(${literal(value)}); // ${literal(out)}`);
  return out;
}

/**
 * Reads `text` exactly as typed: no trim, no case change. A refusal is explained by asking the
 * library again, in this order, and the first that applies names the reason:
 *
 * 1. The trimmed text reads: spaces, a tab, a line break or a byte-order mark around it.
 * 2. The text is exactly a preset that names its reason.
 * 3. Otherwise the shape is wrong.
 */
export function readGtfs(lib: RailLib, text: string): ReadResult {
  if (text === "") {
    return {
      kind: "empty",
      record: null,
      lessDays: null,
      writtenBack: null,
      valid: null,
      reason: "empty",
      calls: [],
    };
  }
  const calls: string[] = [];
  const parsed = parse(lib, text, calls);
  const valid = lib.isValidGtfsTime(text);
  calls.push(`isValidGtfsTime(${literal(text)}); // ${literal(valid)}`);

  if (parsed !== null) {
    // Plain literals the site builds: the library reads any object, so the parsed record is
    // never handed back.
    const record: GtfsTime = {
      seconds: parsed.seconds,
      dayOverflow: parsed.dayOverflow,
    };
    const lessDays = format(
      lib,
      { seconds: record.seconds, dayOverflow: 0 },
      calls,
    );
    const writtenBack = format(lib, { ...record }, calls);
    return {
      kind: "read",
      record,
      lessDays: lessDays === "" ? null : lessDays,
      writtenBack: writtenBack === "" ? null : writtenBack,
      valid,
      reason: "read",
      calls,
    };
  }

  const refused = (reason: ReadReasonKey): ReadResult => ({
    kind: "refused",
    record: null,
    lessDays: null,
    writtenBack: null,
    valid,
    reason,
    calls,
  });

  const trimmed = text.trim();
  if (trimmed !== text && parse(lib, trimmed, calls) !== null) {
    return refused("trimmed");
  }
  const named = READ_PRESETS.find((p) => p.value === text)?.reason;
  return refused(named ?? "shape");
}

// ---------------------------------------------------------------------------
// Section 2: folded into one day
// ---------------------------------------------------------------------------

export interface FoldResult {
  kind: "empty" | "notRead" | "folded";
  /** `isValidTime` of the typed text, `null` until a value was read. */
  clockValid: boolean | null;
  /** The seconds written with no days, from section 1. */
  folded: string | null;
  /** `parseGtfsTime` of the folded text. */
  foldedBack: GtfsTime | null;
  /** The whole days the fold loses: section 1's days past the service day, less the fold's. */
  lost: number;
  calls: string[];
}

/** What code that does not know GTFS does with the same text. Runs only after a read. */
export function foldGtfs(
  lib: RailLib,
  text: string,
  read: ReadResult,
): FoldResult {
  const none = (kind: "empty" | "notRead"): FoldResult => ({
    kind,
    clockValid: null,
    folded: null,
    foldedBack: null,
    lost: 0,
    calls: [],
  });
  if (read.kind === "empty") return none("empty");
  if (read.kind === "refused" || read.record === null) return none("notRead");
  const calls: string[] = [];
  const clockValid = lib.isValidTime(text);
  calls.push(`isValidTime(${literal(text)}); // ${literal(clockValid)}`);
  const folded = read.lessDays;
  const foldedBack = folded === null ? null : parse(lib, folded, calls);
  return {
    kind: "folded",
    clockValid,
    folded,
    foldedBack,
    lost: read.record.dayOverflow - (foldedBack?.dayOverflow ?? 0),
    calls,
  };
}

export const foldVerdictText = (lost: number): string =>
  lost > 0
    ? `loses the service day: ${daysText(lost)}`
    : "nothing lost below midnight";

/** The widest verdict, for the badge's room. */
export const FOLD_VERDICT_SAMPLES = [
  foldVerdictText(41),
  foldVerdictText(0),
  "not folded",
];

/** One line on what the fold means, in words only the fold's own numbers fill. */
export function foldMeaning(fold: FoldResult): string {
  if (fold.kind === "empty") return "Type a GTFS time above to fold it.";
  if (fold.kind === "notRead") {
    return "Nothing to fold: section 1 read no record.";
  }
  if (fold.lost > 0) {
    return `Folded, ${fold.folded ?? ""} sits at the start of the service day, not after its midnight.`;
  }
  return "Folding changes nothing: no whole days were past the service day.";
}

export const FOLD_MEANING_SAMPLES = [
  foldMeaning({
    kind: "folded",
    clockValid: false,
    folded: "23:59:59",
    foldedBack: { seconds: 86399, dayOverflow: 0 },
    lost: 41,
    calls: [],
  }),
  foldMeaning({
    kind: "folded",
    clockValid: true,
    folded: "14:30:00",
    foldedBack: { seconds: 52200, dayOverflow: 0 },
    lost: 0,
    calls: [],
  }),
  foldMeaning({
    kind: "empty",
    clockValid: null,
    folded: null,
    foldedBack: null,
    lost: 0,
    calls: [],
  }),
  foldMeaning({
    kind: "notRead",
    clockValid: null,
    folded: null,
    foldedBack: null,
    lost: 0,
    calls: [],
  }),
];

// ---------------------------------------------------------------------------
// Section 3: write
// ---------------------------------------------------------------------------

/** A plain decimal number. Anything else is "not a number" and makes no call. */
const NUMBER = /^-?[0-9]+(\.[0-9]+)?$/;

export interface WriteResult {
  kind: "empty" | "notNumber" | "written" | "refused";
  /** `formatGtfsTime`'s text, or `null`. */
  written: string | null;
  /** `parseGtfsTime` of that text, or `null`. */
  back: GtfsTime | null;
  /** The read-back is the record that was written. */
  same: boolean;
  reason: WriteReasonKey;
  calls: string[];
}

/**
 * Writes the record the two boxes name and reads it back. The only conversion is `Number` on
 * text that is a plain decimal; the library refuses `-1`, `1.5`, `86400` and the rest. A
 * refusal is named by asking the library again:
 *
 * 1. `{ seconds: 0, dayOverflow }` is refused: the days.
 * 2. `{ seconds, dayOverflow: 0 }` is refused: the seconds.
 * 3. Otherwise the hours are too many for three digits.
 */
export function writeGtfs(
  lib: RailLib,
  secondsText: string,
  daysTextValue: string,
): WriteResult {
  const none = (
    kind: "empty" | "notNumber",
    reason: WriteReasonKey,
  ): WriteResult => ({
    kind,
    written: null,
    back: null,
    same: false,
    reason,
    calls: [],
  });
  if (secondsText === "" || daysTextValue === "") return none("empty", "empty");
  if (!NUMBER.test(secondsText) || !NUMBER.test(daysTextValue)) {
    return none("notNumber", "notNumber");
  }
  const seconds = Number(secondsText);
  const dayOverflow = Number(daysTextValue);
  const calls: string[] = [];
  const written = format(lib, { seconds, dayOverflow }, calls);

  if (written === "") {
    let reason: WriteReasonKey = "hours";
    if (format(lib, { seconds: 0, dayOverflow }, calls) === "") {
      reason = "days";
    } else if (format(lib, { seconds, dayOverflow: 0 }, calls) === "") {
      reason = "seconds";
    }
    return {
      kind: "refused",
      written: null,
      back: null,
      same: false,
      reason,
      calls,
    };
  }
  const back = parse(lib, written, calls);
  return {
    kind: "written",
    written,
    back,
    same:
      back !== null &&
      back.seconds === seconds &&
      back.dayOverflow === dayOverflow,
    reason: "written",
    calls,
  };
}

// ---------------------------------------------------------------------------
// Calls frames
// ---------------------------------------------------------------------------

export type CallsSection = "read" | "fold" | "write";

/**
 * The widest text each calls frame can print, so the frame holds one height whatever the
 * reader types: a stub library that answers every probe, run through the real readers.
 */
export function callsSizerText(section: CallsSection): string {
  const record: GtfsTime = { seconds: 86399, dayOverflow: 41 };
  const wide = {
    parseGtfsTime: () => record,
    formatGtfsTime: () => "999:59:59",
    isValidGtfsTime: () => true,
    isValidTime: () => false,
  } as unknown as RailLib;
  // Refuses only the whole record, so both probes run and print: the longest refusal.
  const refusing = {
    ...wide,
    formatGtfsTime: (v: GtfsTime) =>
      v.seconds > 0 && v.dayOverflow > 0 ? "" : "999:59:59",
  } as unknown as RailLib;
  if (section === "write") {
    return writeGtfs(refusing, "86399", "41").calls.join("\n");
  }
  const read = readGtfs(wide, "999:59:59");
  if (section === "read") return read.calls.join("\n");
  return foldGtfs(wide, "999:59:59", read).calls.join("\n");
}
