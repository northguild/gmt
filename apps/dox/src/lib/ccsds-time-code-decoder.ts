/**
 * Pure logic for the CCSDS Time Code Decoder (SPA-52).
 *
 * Section 1 reads one pasted CCSDS 301.0-B-4 ASCII time code. Every input goes to both parsers,
 * `parseCcsdsAsciiA` and `parseCcsdsAsciiB`, on the text exactly as typed; the site never picks
 * one by the text's shape. At most one of them can return an instant, because Code A carries
 * `MM-DD` and Code B carries `DDD`. Section 2 writes an instant back as both codes with
 * `formatCcsdsAsciiA` and `formatCcsdsAsciiB` at a chosen number of fraction digits.
 *
 * The site holds no CCSDS grammar, leap-second table, month table or leap-year rule: a refusal is
 * explained by asking the library again (`ccsds-picture.ts`).
 *
 * No DOM, no library import (the library arrives as a `CcsdsLib`).
 */
import type { FractionalDigit } from "@northguild/gmt";
import {
  droppedDigits,
  fractionDigits,
  pictureOf,
  reasonOf,
  type CcsdsKind,
  type CcsdsPicture,
} from "./ccsds-picture";
import { CCSDS_DIGITS, type CcsdsLib } from "./ccsds-widgets";
import { runCall, type EdiCall } from "./edi-widgets";

export const CUSTOM_PRESET_ID = "custom";

/** The longest code or instant the inputs take. */
export const CCSDS_MAX_CHARS = 64;

export const EMPTY_CODE_TEXT = "Paste a CCSDS ASCII time code.";
export const EMPTY_INSTANT_TEXT =
  "Type an instant, or use the instant read above.";
export const NOT_READ_TEXT = "Not read: there is no time code.";
export const NO_RESULT_WORDS = "no result";
export const WRITE_REFUSED_TEXT =
  "Not an instant with Z or an offset, or a second 60 UTC did not insert. For a local time, resolve it with resolveLocal first.";
export const CUT_LABEL = "cut, not rounded:";

/** The digit choice a chip stands for. */
export type DigitChoice = (typeof CCSDS_DIGITS)[number];

/** The digit choices as chip values, in chip order. */
export const DIGIT_VALUES: readonly string[] = CCSDS_DIGITS.map(String);

/** The text of the two inputs and the chosen digits, as typed. */
export interface CcsdsState {
  code: string;
  instant: string;
  digits: DigitChoice;
}

export interface CcsdsDecoderArgs {
  preset?: string;
  code?: string;
  instant?: string;
  writePreset?: string;
  /** `"auto"` or `"0"` to `"9"`. */
  digits?: string;
}

/** A chat call's `digits`, mapped back to the library's type. */
export function digitChoiceOf(value: string | undefined): DigitChoice {
  return CCSDS_DIGITS.find((d) => String(d) === value) ?? "auto";
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface CodePreset {
  id: string;
  label: string;
  description: string;
  text: string;
}

interface WritePreset extends CodePreset {
  digits: DigitChoice;
}

/** Each preset's outcome is the library's real output, asserted in the unit test. */
export const CODE_PRESETS: readonly CodePreset[] = [
  {
    id: "leap-2016-b",
    label: "Inside the 2016 leap second",
    description: "Code B, day 366: half a second into the second UTC inserted.",
    text: "2016-366T23:59:60.5Z",
  },
  {
    id: "code-a",
    label: "A Code A, six digits",
    description: "A calendar date, with a fraction of six digits.",
    text: "1988-01-18T17:20:43.123456Z",
  },
  {
    id: "code-b",
    label: "The same instant as Code B",
    description: "Day 018 is 18 January: the same instant as the Code A above.",
    text: "1988-018T17:20:43.123456Z",
  },
  {
    id: "no-z",
    label: "No Z sent",
    description: "A code read without its Z, which is still UTC.",
    text: "2024-001T00:00:00",
  },
  {
    id: "twelve-digits",
    label: "Twelve fraction digits",
    description: "Nine are kept and three are dropped.",
    text: "2024-06-15T10:30:00.123456789012Z",
  },
  {
    id: "false-60",
    label: "Second 60 on an ordinary day",
    description: "A second UTC did not insert, so the code is refused.",
    text: "2017-365T23:59:60Z",
  },
  {
    id: "day-366-common",
    label: "Day 366 in a common year",
    description: "A year of 365 days has no day 366.",
    text: "2023-366T00:00:00Z",
  },
  {
    id: "minutes-only",
    label: "Minutes only",
    description: "A code coarser than whole seconds names a span.",
    text: "2024-06-15T10:30Z",
  },
  {
    id: "lower-case",
    label: "Lower-case t and z",
    description: "CCSDS writes T and Z in upper case only.",
    text: "2024-06-15t10:30:00z",
  },
];

export const WRITE_PRESETS: readonly WritePreset[] = [
  {
    id: "year-end-cut",
    label: "Cut at the end of a year",
    description: "Cutting to three digits never carries into the next year.",
    text: "2026-12-31T23:59:59.9999999Z",
    digits: 3,
  },
  {
    id: "leap-2016",
    label: "The 2016 leap second",
    description: "The second stays 60 when the fraction is cut.",
    text: "2016-12-31T23:59:60.999999999Z",
    digits: 0,
  },
  {
    id: "offset",
    label: "An offset converted to UTC",
    description: "An instant written with +02:00 comes out in UTC with a Z.",
    text: "2024-06-15T16:30:00.123456789+02:00",
    digits: "auto",
  },
  {
    id: "local-time",
    label: "A local time (refused)",
    description: "No Z and no offset, so there is no instant to write.",
    text: "2024-06-15T14:30:00",
    digits: "auto",
  },
];

const DEFAULT_CODE = CODE_PRESETS[0]!;
const DEFAULT_WRITE = WRITE_PRESETS[0]!;

/** The widest instant any reading shows: nine digits in a leap second. */
export const WIDEST_INSTANT = "2016-12-31T23:59:60.123456789Z";
export const WIDEST_CODE_A = WIDEST_INSTANT;
export const WIDEST_CODE_B = "2016-366T23:59:60.123456789Z";

export function matchPreset(
  presets: readonly CodePreset[],
  text: string,
): string {
  return presets.find((p) => p.text === text)?.id ?? CUSTOM_PRESET_ID;
}

export const matchCodePreset = (code: string): string =>
  matchPreset(CODE_PRESETS, code);

/** A write preset matches only on its text and its digits together. */
export function matchWritePreset(instant: string, digits: DigitChoice): string {
  return (
    WRITE_PRESETS.find((p) => p.text === instant && p.digits === digits)?.id ??
    CUSTOM_PRESET_ID
  );
}

// ---------------------------------------------------------------------------
// Permalink
// ---------------------------------------------------------------------------

/** Whether the args seed the widget: a blank `code` or `instant` is a seed, a cleared field. */
export function isSeeded(args: CcsdsDecoderArgs | undefined): boolean {
  return (
    args !== undefined &&
    (["preset", "code", "instant", "writePreset", "digits"] as const).some(
      (k) => typeof args[k] === "string",
    )
  );
}

export function presetState(
  code: CodePreset = DEFAULT_CODE,
  write: WritePreset = DEFAULT_WRITE,
): CcsdsState {
  return { code: code.text, instant: write.text, digits: write.digits };
}

/** The state a seed describes: the named presets, then any text or digits the seed also gives. */
export function readArgs(args: CcsdsDecoderArgs): CcsdsState {
  const state = presetState(
    CODE_PRESETS.find((p) => p.id === args.preset),
    WRITE_PRESETS.find((p) => p.id === args.writePreset),
  );
  if (typeof args.code === "string") state.code = args.code;
  if (typeof args.instant === "string") state.instant = args.instant;
  if (typeof args.digits === "string")
    state.digits = digitChoiceOf(args.digits);
  return state;
}

/**
 * The permalink keys for `state`: a preset's id when the text is exactly that preset, else the
 * text itself (even blank). The default state writes nothing for a box at its default. Every
 * value is a string.
 */
export function permalinkOf(state: CcsdsState): Record<string, string> {
  const code = matchCodePreset(state.code);
  const write = matchWritePreset(state.instant, state.digits);
  return {
    ...(code === CUSTOM_PRESET_ID ? { code: state.code } : { preset: code }),
    ...(write === CUSTOM_PRESET_ID
      ? { instant: state.instant, digits: String(state.digits) }
      : { writePreset: write }),
  };
}

// ---------------------------------------------------------------------------
// Section 1: read a code
// ---------------------------------------------------------------------------

export interface CodeReading {
  kind: "empty" | "read" | "refused";
  code: string;
  /** Which code the text is, `null` when neither parser read it. */
  which: CcsdsKind | null;
  /** The instant the parser returned, `""` when none did. */
  instant: string;
  /** `parseCcsdsAsciiA` then `parseCcsdsAsciiB`; none for an empty box. */
  calls: EdiCall[];
  /** The fraction digits the return keeps. */
  digits: number;
  /** Digits after the ninth that the text sent and the instant does not hold. */
  dropped: number;
  secondSixty: boolean;
  /** Whether the text ended in `Z`. */
  zSent: boolean;
  picture: CcsdsPicture | null;
  /** The reason a refusal gives, and the probe calls that found it. */
  reason: string;
  reasonCalls: EdiCall[];
  /** `day 061 = 1 March` for a Code B read. */
  dayCaption: string;
}

const EMPTY_READING = (code: string): CodeReading => ({
  kind: "empty",
  code,
  which: null,
  instant: "",
  calls: [],
  digits: 0,
  dropped: 0,
  secondSixty: false,
  zSent: false,
  picture: null,
  reason: "",
  reasonCalls: [],
  dayCaption: "",
});

/** Whether the return's seconds field is `60`, which only an inserted second reads. */
const hasSecondSixty = (instant: string): boolean =>
  /T\d{2}:\d{2}:60(?:\.\d+)?Z$/.test(instant);

/**
 * `day 061 = 1 March`: the day field of a Code B text, and the month and day of the instant the
 * parser returned. The month name comes from the library.
 */
export function dayCaptionOf(lib: CcsdsLib, written: string, instant: string) {
  const day = /^\d{4}-(\d{3})T/.exec(written)?.[1];
  const month = Number(instant.slice(5, 7));
  const name = lib.getLocaleMonthNames("en", "long")[month - 1];
  return day === undefined || name === undefined
    ? ""
    : `day ${day} = ${Number(instant.slice(8, 10))} ${name}`;
}

/**
 * Writes `instant` as Code A or Code B at `digits`, with no second argument on `auto`.
 */
function writeCall(
  lib: CcsdsLib,
  kind: CcsdsKind,
  instant: string,
  digits: DigitChoice,
): EdiCall {
  const fn = kind === "A" ? "formatCcsdsAsciiA" : "formatCcsdsAsciiB";
  return digits === "auto"
    ? runCall(lib, fn, instant)
    : runCall(lib, fn, instant, digits as FractionalDigit);
}

/** Reads `code` exactly as typed: no trim, no case change, no choice between the parsers. */
export function readCode(lib: CcsdsLib, code: string): CodeReading {
  if (code === "") return EMPTY_READING(code);

  const a = runCall(lib, "parseCcsdsAsciiA", code);
  const b = runCall(lib, "parseCcsdsAsciiB", code);
  const calls = [a, b];
  const ra = a.result as string;
  const rb = b.result as string;
  if (ra !== "" && rb !== "") {
    throw new Error(
      `Both CCSDS parsers read ${JSON.stringify(code)}: Code A and Code B cannot both apply.`,
    );
  }

  const which: CcsdsKind | null = ra !== "" ? "A" : rb !== "" ? "B" : null;
  if (which === null) {
    const reason = reasonOf(lib, code);
    return {
      ...EMPTY_READING(code),
      kind: "refused",
      calls,
      reason: reason.text,
      reasonCalls: reason.calls,
    };
  }

  const instant = which === "A" ? ra : rb;
  const digits = fractionDigits(instant);
  // The code as the library writes it at the digits it kept: the fields are cut from this.
  const written = writeCall(lib, which, instant, digits as FractionalDigit)
    .result as string;
  const dayCaption = which === "B" ? dayCaptionOf(lib, written, instant) : "";
  return {
    ...EMPTY_READING(code),
    kind: "read",
    which,
    instant,
    calls,
    digits,
    dropped: droppedDigits(lib, which, code, instant),
    secondSixty: hasSecondSixty(instant),
    zSent: code.endsWith("Z"),
    picture: pictureOf(which, written, dayCaption),
    dayCaption,
  };
}

export const CODE_WORDS = {
  A: "Code A · calendar date",
  B: "Code B · day of year",
  none: "Neither",
} as const;

const DIGIT_NAMES: Readonly<Record<number, string>> = {
  3: "milliseconds",
  6: "microseconds",
  9: "nanoseconds",
};

/** `6 digits (microseconds)` or `whole seconds`. */
export function precisionWords(digits: number): string {
  if (digits === 0) return "whole seconds";
  const unit = DIGIT_NAMES[digits];
  return `${digits} ${digits === 1 ? "digit" : "digits"}${unit === undefined ? "" : ` (${unit})`}`;
}

/** The second line under the precision, `""` when no digit was dropped. */
export function droppedWords(dropped: number): string {
  return dropped === 0
    ? ""
    : `${dropped} ${dropped === 1 ? "digit" : "digits"} after the ninth dropped`;
}

// ---------------------------------------------------------------------------
// Section 2: write an instant
// ---------------------------------------------------------------------------

export interface WriteReading {
  kind: "empty" | "written" | "refused";
  instant: string;
  digits: DigitChoice;
  /** `formatCcsdsAsciiA` then `formatCcsdsAsciiB` at the chosen digits. */
  calls: EdiCall[];
  a: string;
  b: string;
  /** The `auto` Code B beside the cut one; used for the cut line. */
  cut: CutLine | null;
}

/** The code at `n` digits with the digits it dropped after it. */
export interface CutLine {
  kept: string;
  dropped: string;
}

/**
 * The dropped digits: the `auto` code's fraction past the cut code's fraction. A string suffix,
 * not arithmetic. `null` when nothing was cut.
 */
export function cutLineOf(auto: string, cut: string): CutLine | null {
  if (auto === "" || cut === "" || auto.length <= cut.length) return null;
  const fraction = (s: string): string => /\.(\d+)/.exec(s)?.[1] ?? "";
  const full = fraction(auto);
  const kept = fraction(cut);
  // A cut at zero digits has no period: its fraction is empty and the whole fraction is dropped.
  const dropped = full.slice(kept.length);
  return dropped === "" ? null : { kept: cut, dropped };
}

/** Writes `instant` as both codes at `digits`. */
export function writeInstant(
  lib: CcsdsLib,
  instant: string,
  digits: DigitChoice,
): WriteReading {
  if (instant === "") {
    return {
      kind: "empty",
      instant,
      digits,
      calls: [],
      a: "",
      b: "",
      cut: null,
    };
  }
  const a = writeCall(lib, "A", instant, digits);
  const b = writeCall(lib, "B", instant, digits);
  const ra = a.result as string;
  const rb = b.result as string;
  let cut: CutLine | null = null;
  if (digits !== "auto" && ra !== "") {
    const autoA = writeCall(lib, "A", instant, "auto").result as string;
    cut = cutLineOf(autoA, ra);
  }
  return {
    kind: ra === "" && rb === "" ? "refused" : "written",
    instant,
    digits,
    calls: [a, b],
    a: ra,
    b: rb,
    cut,
  };
}
