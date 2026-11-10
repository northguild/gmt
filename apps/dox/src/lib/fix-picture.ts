/**
 * The FIX Timestamp Reader's picture and its reasons (FIN-95).
 *
 * The shape of a FIX `UTCTimestamp` (where the date, the time and the punctuation sit, and how
 * many digits each fraction run holds) is read off `formatFixUtcTimestamp` run on one probe
 * instant at the five precisions, the way `edi-picture.ts` reads a layout off a formatter. The
 * site holds no grammar and no width table: a library that wrote another width would move the
 * cut.
 *
 * A refusal is explained by asking the library again, in this order: the text with its second
 * `60` changed to `59`, then the same day at 23:59:60, then the text with its fraction removed,
 * then one general sentence.
 *
 * No DOM; the library arrives as a `FinanceLib`.
 */
import type { PicField, PicHalf } from "./edi-picture";
import { FIX_PRECISIONS, type FinanceLib } from "./finance-widgets";

/** A moment whose every field has a different value, so each can be found in the output. */
export const PROBE = "2016-12-31T23:59:59.123456789Z";

/** The probe's digits, in the order the output writes them: date, hour, minute, second. */
const PROBE_FIELDS = ["20161231", "23", "59", "59"] as const;

/** The name of each fraction run, in the order the precisions add them. */
export const RUN_NAMES = ["ms", "µs", "ns", "ps"] as const;

/** The standard's own mask letters for the four fixed fields. */
const FIELD_MASKS = ["YYYYMMDD", "HH", "MM", "SS"] as const;

type Span = readonly [start: number, end: number];

export interface FixRun {
  name: string;
  /** Digits this run adds to the one before it. */
  width: number;
  /** Where the run's digits start, counted from the first digit after the period. */
  offset: number;
}

export interface FixShape {
  /** The probe written at the first precision: date, time and no fraction. */
  base: string;
  /** Where the date, hour, minute and second sit in `base`. */
  spans: readonly [Span, Span, Span, Span];
  /** The text before the hour, the minute and the second. */
  gaps: readonly [string, string, string];
  /** What sits between the second and the fraction. */
  point: string;
  runs: readonly FixRun[];
  /** The length of a stamp at each precision, narrowest first. */
  totals: readonly number[];
}

const isDigits = (text: string): boolean => /^\d+$/.test(text);

/** The shape the library writes, or `null` when it will not write the probe. */
export function probeShape(lib: FinanceLib): FixShape | null {
  const outs = FIX_PRECISIONS.map((p) => lib.formatFixUtcTimestamp(PROBE, p));
  const base = outs[0]!;
  if (outs.some((o) => o === "")) return null;

  const spans: Span[] = [];
  const gaps: string[] = [];
  let at = 0;
  for (const token of PROBE_FIELDS) {
    const i = base.indexOf(token, at);
    if (i < 0 || (spans.length === 0 && i !== 0)) return null;
    if (spans.length > 0) gaps.push(base.slice(at, i));
    spans.push([i, i + token.length]);
    at = i + token.length;
  }
  if (base.slice(at) !== "") return null;

  let point = "";
  const runs: FixRun[] = [];
  let before = 0;
  for (const [i, out] of outs.slice(1).entries()) {
    if (!out.startsWith(base)) return null;
    const rest = out.slice(base.length);
    const digits = rest.slice(1);
    if (!isDigits(digits) || (point !== "" && rest[0] !== point)) return null;
    point = rest[0]!;
    runs.push({
      name: RUN_NAMES[i] ?? `run ${i + 1}`,
      width: digits.length - before,
      offset: before,
    });
    before = digits.length;
  }

  return {
    base,
    spans: spans as unknown as FixShape["spans"],
    gaps: gaps as unknown as FixShape["gaps"],
    point,
    runs,
    totals: outs.map((o) => o.length),
  };
}

/** The fraction digits a precision states: how far its stamp reaches past the base. */
export function digitsSent(shape: FixShape, precisionIndex: number): number {
  const total = shape.totals[precisionIndex];
  return total === undefined || total === shape.base.length
    ? 0
    : total - shape.base.length - shape.point.length;
}

/** The widths a fraction may have, in digits, narrowest first. */
export function widthsOf(shape: FixShape): number[] {
  return shape.totals.map((_, i) => digitsSent(shape, i)).filter((w) => w > 0);
}

/** `3, 6, 9 or 12` */
export function widthsText(shape: FixShape): string {
  const w = widthsOf(shape).map(String);
  return w.length < 2
    ? w.join("")
    : `${w.slice(0, -1).join(", ")} or ${w.at(-1)}`;
}

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

/** What the figure draws and what a screen reader hears. */
export interface FixPicture {
  halves: PicHalf[];
  aria: string;
}

const field = (
  text: string,
  mask: string,
  group: PicField["group"],
  word: string,
  extra: Pick<PicField, "bracket" | "run"> = {},
): PicField => ({ text, mask, group, word, ...extra });

/**
 * The stamp cut by the probed positions, or one neutral box when its length is none of the
 * probed totals or its punctuation is not the shape's. `read` false draws every box neutral:
 * a refused stamp is never coloured as if it were read.
 */
export function pictureOf(
  text: string,
  shape: FixShape | null,
  read: boolean,
): FixPicture {
  const plain: FixPicture = {
    halves: [{ label: "", fields: [field(text, "", "neutral", "timestamp")] }],
    aria: `FIX timestamp ${text}: not cut into fields.`,
  };
  if (shape === null) return plain;
  const sent = shape.totals.indexOf(text.length);
  if (sent < 0) return plain;

  const slice = (span: Span): string => text.slice(span[0], span[1]);
  const [date, hour, minute, second] = shape.spans;
  const gapsAt: Span[] = [
    [date[1], hour[0]],
    [hour[1], minute[0]],
    [minute[1], second[0]],
  ];
  const punctuated = gapsAt.every(
    (g, i) => text.slice(g[0], g[1]) === shape.gaps[i],
  );
  const pointed =
    sent === 0 ||
    text.slice(shape.base.length, shape.base.length + shape.point.length) ===
      shape.point;
  if (!punctuated || !pointed) return plain;

  const dateGroup = read ? "date" : "neutral";
  const timeGroup = read ? "time" : "neutral";
  const fields: PicField[] = [
    field(slice(date), FIELD_MASKS[0], dateGroup, "date"),
    field(shape.gaps[0], "", "neutral", "separator"),
    field(slice(hour), FIELD_MASKS[1], timeGroup, "hour"),
    field(shape.gaps[1], shape.gaps[1], timeGroup, "separator"),
    field(slice(minute), FIELD_MASKS[2], timeGroup, "minute"),
    field(shape.gaps[2], shape.gaps[2], timeGroup, "separator"),
    field(slice(second), FIELD_MASKS[3], timeGroup, "second"),
  ];
  if (sent > 0) fields.push(field(shape.point, "", "neutral", "period"));

  const words = [
    `date ${slice(date)}`,
    `hour ${slice(hour)}`,
    `minute ${slice(minute)}`,
    `second ${slice(second)}`,
  ];
  const start = shape.base.length + shape.point.length;
  for (const [i, run] of shape.runs.entries()) {
    const mask = "s".repeat(run.width);
    if (i < sent) {
      const digits = text.slice(
        start + run.offset,
        start + run.offset + run.width,
      );
      fields.push(
        field(digits, mask, timeGroup, run.name, {
          bracket: run.name,
          run: run.name,
        }),
      );
      words.push(`${run.name} ${digits}`);
    } else {
      fields.push(
        field("", mask, "none", run.name, {
          bracket: "not sent",
          run: run.name,
        }),
      );
      words.push(`${run.name} not sent`);
    }
  }
  return {
    halves: [{ label: "", fields }],
    aria: `FIX timestamp ${text}: ${words.join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// The reasons
// ---------------------------------------------------------------------------

/** The layout sentence the general reason opens with, written from the probe's own masks. */
function layoutOf(shape: FixShape): string {
  const [d, h, m, s] = FIELD_MASKS;
  return `${d}${shape.gaps[0]}${h}${shape.gaps[1]}${m}${shape.gaps[2]}${s}`;
}

/**
 * Why the library refused `text`. The first probe that fits wins, and every probe is a library
 * call: the text with its second `60` changed to `59` (and then, to tell a wrong day from a wrong
 * minute, the text moved to 23:59), then the text without its fraction.
 */
export function reasonOf(
  lib: FinanceLib,
  text: string,
  shape: FixShape | null,
): string {
  if (shape === null) return "Not a FIX UTCTimestamp.";
  const [, hour, minute, second] = shape.spans;

  if (text.slice(second[0], second[1]) === "60") {
    const ordinary = `${text.slice(0, second[0])}59${text.slice(second[1])}`;
    if (lib.parseFixUtcTimestamp(ordinary) !== null) {
      // The same day at 23:59:60 parses only if UTC inserted a second that day.
      const lastMinute = `${text.slice(0, hour[0])}23${text.slice(hour[1], minute[0])}59${text.slice(minute[1])}`;
      return lastMinute !== text &&
        lib.parseFixUtcTimestamp(lastMinute) !== null
        ? "Second 60 at a time UTC inserted no second; it inserts one only at 23:59:60."
        : "Second 60 on a day UTC inserted no second.";
    }
  }

  const fraction = text.slice(shape.base.length);
  if (fraction.startsWith(shape.point)) {
    const digits = fraction.length - shape.point.length;
    // A bare period is the whole-second width with a stray point, not a width of its own.
    if (
      digits > 0 &&
      !widthsOf(shape).includes(digits) &&
      lib.parseFixUtcTimestamp(text.slice(0, shape.base.length)) !== null
    ) {
      return `A fraction of ${digits} digits states no precision FIX names; other widths need the parties' agreement.`;
    }
  }

  return `Not a FIX UTCTimestamp: ${layoutOf(shape)}, then a period and ${widthsText(shape)} digits, or nothing.`;
}

/**
 * The longest each reason can run, written out so a hold can reserve its box before the library
 * has loaded. A layout reservation only: `reasonOf` writes what is shown, and the tests hold
 * every real reason to these.
 */
export const REASON_SAMPLES: readonly string[] = [
  "Second 60 on a day UTC inserted no second.",
  "Second 60 at a time UTC inserted no second; it inserts one only at 23:59:60.",
  "A fraction of 99 digits states no precision FIX names; other widths need the parties' agreement.",
  "Not a FIX UTCTimestamp: YYYYMMDD-HH:MM:SS, then a period and 3, 6, 9 or 12 digits, or nothing.",
];
