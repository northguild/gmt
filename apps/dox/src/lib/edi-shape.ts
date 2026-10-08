/**
 * The shape of a date-time format code, found by probing the public library.
 *
 * The EDI widgets draw a value taken apart: each field's characters in a box,
 * the standard's own mask letter beneath it. The site holds no table of codes
 * (the library owns that), so a code's shape is read off the formatter's own
 * output, the way `needsYearWindow` finds out whether a code has a two-digit
 * year: a probe value whose every field differs is written under the code, and
 * the digits that come back say which fields the code writes, in which order,
 * and how wide each is.
 *
 * The probes run from the richest to the plainest, with and without a year
 * window, until one is written (a formatter returns `""` for a value the code
 * cannot hold). Whatever is written is a value of the code, so its layout is the
 * code's layout. An unsupported code writes nothing: its shape is `null`.
 *
 * No DOM and no gmt import. The formatter is passed in, and a shape is cached
 * per formatter and code, because a code's shape never changes.
 */
import type { YearWindowOptions } from "./edi-widgets";

/** A formatter: `formatEdifactDtm` or `formatX12DateTimePeriod`. */
export type EdiFormatter = (
  value: string,
  code: string,
  options?: YearWindowOptions,
) => string;

/** The fields a mask holds, as the standards name them (`MI` is the minute,
 *  which the standards also write `MM`). `ZHHMM` is a signed hours-and-minutes
 *  offset; `ZZZ` is the three-character zone field. */
export type ShapePart =
  | "CCYY"
  | "YY"
  | "Y"
  | "MM"
  | "DD"
  | "DDD"
  | "HH"
  | "MI"
  | "SS"
  | "ZHHMM"
  | "ZZZ";

/** What a field belongs to, which sets its group's mark. */
export type ShapeGroup = "date" | "time" | "offset";

export interface ShapeField {
  part: ShapePart;
  /** Characters the field takes. */
  width: number;
  group: ShapeGroup;
}

export interface Shape {
  /** The value's fields, or a period's first half. */
  start: readonly ShapeField[];
  /** A period's second half. */
  end?: readonly ShapeField[];
  /** What sits between a period's halves: `""` for UN/EDIFACT, `"-"` for X12. */
  separator: string;
  /** Whether the year is two digits, so the century needs a window. */
  window: boolean;
}

/**
 * Probe values, all different field by field. The start half's fields are the
 * year 1987, month 03, day 14, hour 15, minute 26, second 48 and an offset of
 * +07:30; a period's end half is 1991, 05, 22, 08, 11 and 37. No two fields share
 * their digits, so a digit run names its field.
 */
const PROBES: readonly string[] = [
  "1987-03-14T15:26:48+07:30",
  "1987-03-14T15:26:48+07:00",
  "1987-03-14T15:26+07:30",
  "1987-03-14T15:26+07:00",
  "1987-03-14T15:26:48",
  "1987-03-14T15:26",
  "1987-03-14",
  "15:26:48+07:30",
  "15:26:48+07:00",
  "15:26:48",
  "15:26",
  "+07:30",
  "1987-03-14T15:26:48/1991-05-22T08:11:37",
  "1987-03-14T15:26/1991-05-22T08:11",
  "1987-03-14/1991-05-22",
  "1987-03-14/1991-05-22T08:11",
  "1987-03-14T15:26/1991-05-22",
  "15:26/08:11",
];

/** The year window a two-digit-year code is probed with. It holds 1987 and 1991. */
const PROBE_WINDOW: YearWindowOptions = { yearWindow: 1900 };

type Token = {
  text: string;
  half: 0 | 1;
  part: ShapePart;
  group: ShapeGroup;
};

const START: readonly Token[] = [
  { text: "1987", half: 0, part: "CCYY", group: "date" },
  { text: "87", half: 0, part: "YY", group: "date" },
  { text: "03", half: 0, part: "MM", group: "date" },
  { text: "14", half: 0, part: "DD", group: "date" },
  { text: "15", half: 0, part: "HH", group: "time" },
  { text: "26", half: 0, part: "MI", group: "time" },
  { text: "48", half: 0, part: "SS", group: "time" },
];

const END: readonly Token[] = [
  { text: "1991", half: 1, part: "CCYY", group: "date" },
  { text: "91", half: 1, part: "YY", group: "date" },
  { text: "05", half: 1, part: "MM", group: "date" },
  { text: "22", half: 1, part: "DD", group: "date" },
  { text: "08", half: 1, part: "HH", group: "time" },
  { text: "11", half: 1, part: "MI", group: "time" },
  { text: "37", half: 1, part: "SS", group: "time" },
];

const TOKENS: readonly Token[] = [...START, ...END];

/**
 * Reads a written probe back into fields. `null` when some of it is not a field
 * of the probe, so a shape is never half-read.
 */
function readFields(written: string): Shape | null {
  const halves: ShapeField[][] = [[]];
  let separator = "";
  let i = 0;
  while (i < written.length) {
    const here = written.slice(i);
    const current = halves[halves.length - 1]!;

    // A signed offset: `+0730` (hours and minutes) or `+07` (hours only).
    if ((here[0] === "+" || here[0] === "-") && here.slice(1, 3) === "07") {
      if (here.slice(3, 5) === "30") {
        current.push({ part: "ZHHMM", width: 5, group: "offset" });
        i += 5;
      } else {
        current.push({ part: "ZZZ", width: 3, group: "offset" });
        i += 3;
      }
      continue;
    }

    const token = TOKENS.find((t) => here.startsWith(t.text));
    if (token !== undefined) {
      if (token.half === 1 && halves.length === 1) halves.push([]);
      halves[token.half]!.push({
        part: token.part,
        width: token.text.length,
        group: token.group,
      });
      i += token.text.length;
      continue;
    }

    // The last digit of the year (`7` of 1987) opens a year digit and a day of
    // the year (`7073`).
    if (here.startsWith("7073")) {
      current.push({ part: "Y", width: 1, group: "date" });
      i += 1;
      continue;
    }
    // A day of the year, three digits: March 14 is day 073.
    if (here.startsWith("073")) {
      current.push({ part: "DDD", width: 3, group: "date" });
      i += 3;
      continue;
    }
    // What a period writes between its halves.
    if (/^[^0-9A-Za-z]/.test(here) && halves.length === 1 && current.length > 0) {
      separator = here[0]!;
      halves.push([]);
      i += 1;
      continue;
    }
    return null;
  }
  const [start, end] = halves;
  if (start === undefined || start.length === 0) return null;
  if (end !== undefined && end.length === 0) return null;
  return {
    start,
    ...(end === undefined ? {} : { end }),
    separator,
    window: start.some((f) => f.part === "YY"),
  };
}

const cache = new WeakMap<EdiFormatter, Map<string, Shape | null>>();

/**
 * The shape of `code` under `format`: which fields its values hold, in order, and
 * how wide each is. `null` for a code the formatter does not write (an
 * unsupported one, or `UN`). Cached per formatter and code.
 */
export function shapeOf(format: EdiFormatter, code: string): Shape | null {
  let byCode = cache.get(format);
  if (byCode === undefined) {
    byCode = new Map();
    cache.set(format, byCode);
  }
  const known = byCode.get(code);
  if (known !== undefined || byCode.has(code)) return known ?? null;

  let shape: Shape | null = null;
  search: for (const options of [undefined, PROBE_WINDOW]) {
    for (const probe of PROBES) {
      const written =
        options === undefined ? format(probe, code) : format(probe, code, options);
      if (written !== "") {
        shape = readFields(written);
        break search;
      }
    }
  }
  byCode.set(code, shape);
  return shape;
}

/** The characters a shape takes, halves and separator included. */
export function shapeWidth(shape: Shape): number {
  const sum = (fields: readonly ShapeField[]): number =>
    fields.reduce((n, f) => n + f.width, 0);
  return (
    sum(shape.start) +
    (shape.end === undefined ? 0 : shape.separator.length + sum(shape.end))
  );
}

/** One field of a real value: its characters and the field they sit in. */
export interface ValueCell {
  field: ShapeField;
  text: string;
}

/** A value cut along a shape: one list of cells per half. */
export interface ValueCells {
  halves: ValueCell[][];
  separator: string;
}

/**
 * Cuts a value along a shape. `null` when the value's length is not the shape's,
 * which is every value the code would refuse for length (a released character, a
 * missing digit, a hyphen in a period that sends none).
 */
export function cutValue(value: string, shape: Shape): ValueCells | null {
  if (value.length !== shapeWidth(shape)) return null;
  let at = 0;
  const take = (fields: readonly ShapeField[]): ValueCell[] =>
    fields.map((field) => {
      const text = value.slice(at, at + field.width);
      at += field.width;
      return { field, text };
    });
  const first = take(shape.start);
  if (shape.end === undefined) return { halves: [first], separator: "" };
  const gap = value.slice(at, at + shape.separator.length);
  if (gap !== shape.separator) return null;
  at += shape.separator.length;
  return { halves: [first, take(shape.end)], separator: shape.separator };
}

/** The mask letters of a part, as the standards print them. */
export function maskOf(part: ShapePart): string {
  return part === "MI" ? "MM" : part;
}

/** A part named in words, for the label a screen reader hears. */
export function partWord(part: ShapePart): string {
  switch (part) {
    case "CCYY":
      return "year";
    case "YY":
      return "two-digit year";
    case "Y":
      return "last digit of the year";
    case "MM":
      return "month";
    case "DD":
      return "day";
    case "DDD":
      return "day of the year";
    case "HH":
      return "hour";
    case "MI":
      return "minute";
    case "SS":
      return "second";
    case "ZHHMM":
      return "offset";
    case "ZZZ":
      return "zone";
  }
}
