/**
 * Pure logic for the FIX Timestamp Reader (FIN-95).
 *
 * Section 1 reads a pasted FIX `UTCTimestamp` with `parseFixUtcTimestamp` and
 * `isValidFixUtcTimestamp`, both called on the text as typed. Section 2 writes one instant at
 * the five precisions with `formatFixUtcTimestamp`. The site holds no FIX grammar, no width
 * table and no leap-second table: a widget draws the library's results, and a refusal is
 * explained by asking the library again (`fix-picture.ts`).
 *
 * "None sent" is not `0`: the parser reports `picoseconds` `0` both for a 12-digit fraction
 * whose last three digits are `000` and for every stamp that sent no such digits, so the plate
 * shows digits only at `"picosecond"`.
 *
 * No DOM, no library import (the library arrives as a `FinanceLib`).
 */
import type { FixPrecision, FixUtcTimestamp } from "@northguild/gmt";
import { runCall, type EdiCall } from "./edi-widgets";
import {
  digitsSent,
  pictureOf,
  probeShape,
  reasonOf,
  type FixPicture,
  type FixShape,
} from "./fix-picture";
import { FIX_PRECISIONS, type FinanceLib } from "./finance-widgets";

export const CUSTOM_PRESET_ID = "custom";

/** The longest stamp or instant the inputs take. */
export const FIX_MAX_CHARS = 64;

export const EMPTY_STAMP_TEXT = "Paste a FIX UTCTimestamp.";
export const EMPTY_INSTANT_TEXT =
  "Type an instant, or use the instant read above.";
export const NOT_READ_TEXT = "Not read: there is no timestamp.";
export const NONE_SENT_TEXT = "none sent";
export const CUT_NOTE = "cut, not rounded";
export const PAD_NOTE = "padded with 000: the instant holds nothing finer";
export const WRITE_REFUSED_TEXT =
  "Not an instant with Z or an offset, a year outside 0000–9999 in UTC, or a second 60 UTC did not insert. For a local time, resolve it with resolveLocal first.";

/** The text of the two inputs, as typed. */
export interface FixReaderState {
  stamp: string;
  write: string;
}

export interface FixTimestampReaderArgs {
  preset?: string;
  stamp?: string;
  write?: string;
  writePreset?: string;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface FixPreset {
  id: string;
  label: string;
  description: string;
  text: string;
}

/**
 * Each preset's output is the library's real output, asserted in the unit test. A label never
 * states more than that run shows.
 */
export const STAMP_PRESETS: readonly FixPreset[] = [
  {
    id: "milliseconds",
    label: "A millisecond stamp",
    description: "Three fraction digits.",
    text: "20240615-14:30:00.100",
  },
  {
    id: "microseconds",
    label: "A microsecond stamp",
    description: "Six fraction digits.",
    text: "20240615-14:30:00.123456",
  },
  {
    id: "picoseconds",
    label: "A picosecond stamp",
    description:
      "Twelve fraction digits: the last three are held apart from the instant.",
    text: "20240615-14:30:00.123456789012",
  },
  {
    id: "whole-seconds",
    label: "Whole seconds",
    description: "No period and no fraction.",
    text: "20240615-14:30:00",
  },
  {
    id: "fix-leap-second",
    label: "FIX's leap second",
    description:
      "Second 60 on the last day of 1998, a day UTC inserted a second.",
    text: "19981231-23:59:60",
  },
  {
    id: "inside-2016",
    label: "Inside the 2016 leap second",
    description:
      "Half a second into the second UTC inserted at the end of 2016.",
    text: "20161231-23:59:60.500",
  },
  {
    id: "second-60-ordinary",
    label: "Second 60 on an ordinary day",
    description: "Second 60 on a day UTC inserted no second.",
    text: "20171231-23:59:60",
  },
  {
    id: "eight-digits",
    label: "An eight-digit fraction",
    description: "A width FIX does not name.",
    text: "20240615-14:30:00.12345678",
  },
];

export const WRITE_PRESETS: readonly FixPreset[] = [
  {
    id: "near-midnight",
    label: "Microseconds near midnight",
    description: "A fraction a narrower precision cuts and does not round up.",
    text: "2024-12-31T23:59:59.999600Z",
  },
  {
    id: "offset",
    label: "An offset converted to UTC",
    description: "An instant written with +02:00.",
    text: "2024-06-15T16:30:00.123456789+02:00",
  },
  {
    id: "leap-2016",
    label: "The 2016 leap second",
    description: "Second 60, written with a half second.",
    text: "2016-12-31T23:59:60.5Z",
  },
  {
    id: "local-time",
    label: "A local time (refused)",
    description: "No Z and no offset, so there is no instant to write.",
    text: "2024-06-15T14:30:00",
  },
];

const DEFAULT_STAMP = STAMP_PRESETS[0]!;
const DEFAULT_WRITE = WRITE_PRESETS[0]!;

/** The widest instant any reading shows: a nine-digit instant in a leap second. */
export const WIDEST_INSTANT = "2016-12-31T23:59:60.123456789Z";

/** The widest stamp, which sizes the figure and the call. */
export const WIDEST_STAMP = "20240615-14:30:00.123456789012";

export function matchPreset(
  presets: readonly FixPreset[],
  text: string,
): string {
  return presets.find((p) => p.text === text)?.id ?? CUSTOM_PRESET_ID;
}

export const matchStampPreset = (stamp: string): string =>
  matchPreset(STAMP_PRESETS, stamp);
export const matchWritePreset = (write: string): string =>
  matchPreset(WRITE_PRESETS, write);

// ---------------------------------------------------------------------------
// Permalink
// ---------------------------------------------------------------------------

/** Whether the args seed the widget: a blank `stamp` or `write` is a seed, a cleared field. */
export function isSeeded(args: FixTimestampReaderArgs | undefined): boolean {
  return (
    args !== undefined &&
    (["preset", "stamp", "write", "writePreset"] as const).some(
      (k) => typeof args[k] === "string",
    )
  );
}

export function presetState(
  stamp: FixPreset = DEFAULT_STAMP,
  write: FixPreset = DEFAULT_WRITE,
): FixReaderState {
  return { stamp: stamp.text, write: write.text };
}

/** The state a seed describes: the named presets, then any text the seed also gives. */
export function readArgs(args: FixTimestampReaderArgs): FixReaderState {
  const state = presetState(
    STAMP_PRESETS.find((p) => p.id === args.preset),
    WRITE_PRESETS.find((p) => p.id === args.writePreset),
  );
  // A blank value is a seed: a link made from a cleared field must open cleared.
  if (typeof args.stamp === "string") state.stamp = args.stamp;
  if (typeof args.write === "string") state.write = args.write;
  return state;
}

/**
 * The permalink keys for `state`: a preset's id when the text is exactly that preset, else the
 * text itself (even blank, so the link does not fall back to the default). Every value is a
 * string.
 */
export function permalinkOf(state: FixReaderState): Record<string, string> {
  const stamp = matchStampPreset(state.stamp);
  const write = matchWritePreset(state.write);
  return {
    ...(stamp === CUSTOM_PRESET_ID
      ? { stamp: state.stamp }
      : { preset: stamp }),
    ...(write === CUSTOM_PRESET_ID
      ? { write: state.write }
      : { writePreset: write }),
  };
}

// ---------------------------------------------------------------------------
// Section 1: read a timestamp
// ---------------------------------------------------------------------------

export interface Verdict {
  tone: "neutral" | "good" | "bad";
  title: string;
  detail: string;
}

export interface StampReading {
  kind: "empty" | "read" | "refused";
  stamp: string;
  parsed: FixUtcTimestamp | null;
  /** `parseFixUtcTimestamp` then `isValidFixUtcTimestamp`; none for an empty box. */
  calls: EdiCall[];
  picture: FixPicture | null;
  /** The fraction digits the precision states, `null` when the probe gave no shape. */
  digits: number | null;
  /** The three digits below the nanosecond, `null` unless the stamp sent them. */
  belowNanosecond: string | null;
  verdict: Verdict;
}

/**
 * Reads `stamp` exactly as typed: no trim, no case change. The shape is probed once per
 * reading from the same library.
 */
export function readStamp(
  lib: FinanceLib,
  stamp: string,
  shape: FixShape | null = probeShape(lib),
): StampReading {
  if (stamp === "") {
    return {
      kind: "empty",
      stamp,
      parsed: null,
      calls: [],
      picture: null,
      digits: null,
      belowNanosecond: null,
      verdict: { tone: "neutral", title: EMPTY_STAMP_TEXT, detail: "" },
    };
  }

  const parse = runCall(lib, "parseFixUtcTimestamp", stamp);
  const valid = runCall(lib, "isValidFixUtcTimestamp", stamp);
  const parsed = parse.result as FixUtcTimestamp | null;

  if (parsed === null) {
    return {
      kind: "refused",
      stamp,
      parsed: null,
      calls: [parse, valid],
      picture: pictureOf(stamp, shape, false),
      digits: null,
      belowNanosecond: null,
      verdict: {
        tone: "bad",
        title: "Refused",
        detail: reasonOf(lib, stamp, shape),
      },
    };
  }

  const index = FIX_PRECISIONS.indexOf(parsed.precision);
  const digits = shape === null ? null : digitsSent(shape, index);
  const sent = digits === null ? "" : `${digits} digits sent`;
  const finer = "nothing finer was measured.";
  return {
    kind: "read",
    stamp,
    parsed,
    calls: [parse, valid],
    picture: pictureOf(stamp, shape, true),
    digits,
    belowNanosecond:
      parsed.precision === "picosecond"
        ? String(parsed.picoseconds).padStart(3, "0")
        : null,
    verdict: parsed.leapSecond
      ? {
          tone: "good",
          title: "A leap second UTC inserted",
          detail: `Read at ${parsed.precision}${digits === null ? "" : `: ${sent}`}; ${finer}`,
        }
      : {
          tone: "good",
          title: `Read at ${parsed.precision}`,
          detail:
            digits === 0
              ? `No fraction digits sent; ${finer}`
              : `${sent === "" ? "" : `${sent}; `}${finer}`,
        },
  };
}

/** The words under the precision: how many digits the stamp sent. */
export function digitsLine(reading: StampReading): string {
  return reading.digits === null
    ? ""
    : `${reading.digits} fraction ${reading.digits === 1 ? "digit" : "digits"} sent`;
}

// ---------------------------------------------------------------------------
// Section 2: write an instant
// ---------------------------------------------------------------------------

export interface WriteRow {
  precision: FixPrecision;
  call: EdiCall;
  /** What the formatter returned; `""` is its sentinel. */
  out: string;
  /** The sub line: how the digits were fitted. */
  note: string;
}

export interface WriteReading {
  kind: "empty" | "written" | "refused";
  text: string;
  rows: WriteRow[];
}

/** Whether `narrow` dropped any digit that `nanosecond` still holds. */
function droppedDigits(narrow: string, nanosecond: string): boolean {
  return /[1-9]/.test(nanosecond.slice(narrow.length));
}

/** Writes `text` at the five precisions. The note compares strings and applies no rule. */
export function writeInstant(lib: FinanceLib, text: string): WriteReading {
  if (text === "") return { kind: "empty", text, rows: [] };
  const calls = FIX_PRECISIONS.map((p) =>
    runCall(lib, "formatFixUtcTimestamp", text, p),
  );
  const outs = calls.map((c) => c.result as string);
  const nano = outs[FIX_PRECISIONS.indexOf("nanosecond")]!;
  const rows = FIX_PRECISIONS.map((precision, i): WriteRow => {
    const out = outs[i]!;
    let note = "";
    if (out !== "") {
      if (precision === "picosecond") note = PAD_NOTE;
      else if (
        precision !== "nanosecond" &&
        nano !== "" &&
        droppedDigits(out, nano)
      ) {
        note = CUT_NOTE;
      }
    }
    return { precision, call: calls[i]!, out, note };
  });
  return {
    kind: outs.every((o) => o === "") ? "refused" : "written",
    text,
    rows,
  };
}
