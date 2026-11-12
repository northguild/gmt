/**
 * Pure logic for the SWIFT Value Date Reader (FIN-96).
 *
 * Section 1 reads a pasted SWIFT value date (`YYMMDD`, the `<DATE2>` of field 30 or 32A) with
 * `parseSwiftDate` and `isValidSwiftDate`, both called on the text as typed. Section 2 tables
 * the century SWIFT states. Section 3 writes an ISO date with `formatSwiftDate` and reads it
 * back.
 *
 * The site holds no SWIFT rule, range or band edge. The bands come from `deriveBands`, which
 * asks the library for the first of January of every two-digit year, and every reason comes
 * from a library call: a refusal is explained by asking the library again. Only the T50 code
 * (MT 103 field 32A: a date that is not a valid `YYMMDD` is error T50, and so, by Standards MT
 * General Information 2025 §6.3.6, is a `YY` outside its range) is the site's word, and it is
 * shown for a refused text exactly six characters long.
 *
 * No DOM, no library import (the library arrives as a `FinanceLib`).
 */
import { runCall, type EdiCall } from "./edi-widgets";
import type { PicHalf } from "./edi-picture";
import type { FinanceLib } from "./finance-widgets";

export const CUSTOM_PRESET_ID = "custom";

/** The most the reading box takes: the chat's `value` cap. */
export const READ_MAX_CHARS = 16;

/** The most the write box takes. */
export const WRITE_MAX_CHARS = 32;

/** The code a refused six-character text shows (MT 103 field 32A and General Information §6.3.6). */
export const T50 = "T50";

export const NOTHING_TYPED = "nothing typed";
export const REFUSED_YEAR = "refused";
export const NOT_WRITTEN = "nothing written";
export const NOT_READ_TEXT = "Not read: there is no value date.";
export const NOT_WRITTEN_TEXT = "nothing to write";
export const EMPTY_READ_TEXT = "Type a six-character value date.";

// ---------------------------------------------------------------------------
// State, presets and arguments
// ---------------------------------------------------------------------------

/** The text of the two boxes, as typed. */
export interface SwiftReaderState {
  value: string;
  date: string;
}

export interface SwiftValueDateReaderArgs {
  preset?: string;
  value?: string;
  date?: string;
  writePreset?: string;
}

interface SwiftPreset {
  id: string;
  label: string;
  description: string;
  text: string;
}

/** Each preset's reading is the library's, asserted in the unit test. */
export const READ_PRESETS: readonly SwiftPreset[] = [
  {
    id: "twenty",
    label: "A 20YY date",
    description: "The century is SWIFT's rule, not today's.",
    text: "240615",
  },
  {
    id: "nineteen",
    label: "A 19YY date",
    description:
      "The same two-digit year shape, in the century before. SWIFT reads no year in it: refused with T50.",
    text: "990615",
  },
  {
    id: "year-00",
    label: "Year 00",
    description: "YY 00 is not a year SWIFT reads: refused with T50.",
    text: "000101",
  },
  {
    id: "first-year",
    label: "The first year",
    description: "The earliest year SWIFT reads.",
    text: "010101",
  },
  {
    id: "last-day",
    label: "The last day SWIFT accepts",
    description: "The latest date SWIFT reads.",
    text: "601231",
  },
  {
    id: "past-limit",
    label: "Past 2060",
    description: "A year past the last SWIFT reads: refused with T50.",
    text: "750101",
  },
  {
    id: "leap-2004",
    label: "29 February 2004",
    description: "The day exists in the year the rule gives.",
    text: "040229",
  },
  {
    id: "no-leap-2005",
    label: "29 February 2005",
    description: "The year the rule gives has no such day: refused with T50.",
    text: "050229",
  },
  {
    id: "whole-subfield",
    label: "The whole 32A subfield",
    description:
      "A date, a currency and an amount. The reader takes the date alone, so this is refused, with no code.",
    text: "240615EUR1000,00",
  },
];

export const WRITE_PRESETS: readonly SwiftPreset[] = [
  {
    id: "round-trip",
    label: "A round trip",
    description: "A date in range reads back as itself.",
    text: "2024-06-15",
  },
  {
    id: "last-year",
    label: "The last year",
    description: "The latest date SWIFT reads.",
    text: "2060-12-31",
  },
  {
    id: "before-first",
    label: "Before the first year",
    description: "Refused: two digits would read back as another year.",
    text: "2000-12-31",
  },
  {
    id: "after-last",
    label: "After the last year",
    description: "Refused: two digits would read back as another year.",
    text: "2061-01-01",
  },
  {
    id: "date-time",
    label: "A date-time",
    description: "Not a date: take the date first.",
    text: "2024-06-15T10:00:00",
  },
];

const DEFAULT_READ = READ_PRESETS[0]!;
const DEFAULT_WRITE = WRITE_PRESETS[0]!;

export function matchPreset(
  presets: readonly SwiftPreset[],
  text: string,
): string {
  return presets.find((p) => p.text === text)?.id ?? CUSTOM_PRESET_ID;
}

export const matchReadPreset = (value: string): string =>
  matchPreset(READ_PRESETS, value);
export const matchWritePreset = (date: string): string =>
  matchPreset(WRITE_PRESETS, date);

/** Whether the args seed the widget: a blank `value` or `date` is a seed, a cleared field. */
export function isSeeded(args: SwiftValueDateReaderArgs | undefined): boolean {
  return (
    args !== undefined &&
    (["preset", "value", "date", "writePreset"] as const).some(
      (k) => typeof args[k] === "string",
    )
  );
}

export function presetState(
  read: SwiftPreset = DEFAULT_READ,
  write: SwiftPreset = DEFAULT_WRITE,
): SwiftReaderState {
  return { value: read.text, date: write.text };
}

/** The state a seed describes: the named presets, then any text the seed also gives. */
export function readArgs(args: SwiftValueDateReaderArgs): SwiftReaderState {
  const state = presetState(
    READ_PRESETS.find((p) => p.id === args.preset),
    WRITE_PRESETS.find((p) => p.id === args.writePreset),
  );
  // A blank value is a seed: a link made from a cleared field must open cleared.
  if (typeof args.value === "string") state.value = args.value;
  if (typeof args.date === "string") state.date = args.date;
  return state;
}

/**
 * The permalink keys for `state`: a preset's id when the text is exactly that preset, else the
 * text itself (even blank, so the link does not fall back to the default).
 */
export function permalinkOf(state: SwiftReaderState): Record<string, string> {
  const read = matchReadPreset(state.value);
  const write = matchWritePreset(state.date);
  return {
    ...(read === CUSTOM_PRESET_ID ? { value: state.value } : { preset: read }),
    ...(write === CUSTOM_PRESET_ID
      ? { date: state.date }
      : { writePreset: write }),
  };
}

// ---------------------------------------------------------------------------
// The bands: the century, as the library states it
// ---------------------------------------------------------------------------

/** One run of consecutive two-digit years that the library reads alike. */
export interface Band {
  /** The first and last `YY` of the run, as two digits. */
  from: string;
  to: string;
  /** The years the run reads as, or `null` for a refused run. */
  firstYear: number | null;
  lastYear: number | null;
}

export interface Bands {
  /** Ordered by year; the refused runs, which have none, are last, by `YY`. */
  list: readonly Band[];
  /** The first and last year the library reads. */
  first: number | null;
  last: number | null;
  /** The index in `list` of each `YY`, or `-1` when `YY` is not one of the hundred strings. */
  indexOf(yy: string): number;
}

/** The hundred two-digit strings the probe asks about. */
const TWO_DIGITS = Array.from({ length: 100 }, (_, i) =>
  String(i).padStart(2, "0"),
);

/** The year of an ISO date the library gave, or `null` for its sentinel. */
function yearOf(iso: string): number | null {
  return iso === "" ? null : Number(iso.slice(0, 4));
}

/**
 * Asks the library for `YY + "0101"` for all 100 `YY` and groups consecutive years that read
 * alike (the same century, or all refused) into runs. Nothing here knows where a run ends.
 */
export function deriveBands(lib: FinanceLib): Bands {
  const runs: { from: string; to: string; years: (number | null)[] }[] = [];
  let kind: string | null = null;
  for (const yy of TWO_DIGITS) {
    const year = yearOf(lib.parseSwiftDate(`${yy}0101`));
    const k = year === null ? "refused" : String(Math.floor(year / 100));
    const last = runs[runs.length - 1];
    if (last !== undefined && k === kind) {
      last.to = yy;
      last.years.push(year);
    } else {
      runs.push({ from: yy, to: yy, years: [year] });
      kind = k;
    }
  }
  const list = runs
    .map((r): Band => ({
      from: r.from,
      to: r.to,
      firstYear: r.years[0] ?? null,
      lastYear: r.years[r.years.length - 1] ?? null,
    }))
    // By year; the refused runs, which have none, are last, by YY.
    .sort(
      (a, b) =>
        (a.firstYear ?? Infinity) - (b.firstYear ?? Infinity) ||
        Number(a.from) - Number(b.from),
    );
  const years = list.flatMap((b) =>
    b.firstYear === null ? [] : [b.firstYear, b.lastYear as number],
  );
  return {
    list,
    first: years.length === 0 ? null : Math.min(...years),
    last: years.length === 0 ? null : Math.max(...years),
    indexOf: (yy) =>
      TWO_DIGITS.includes(yy)
        ? list.findIndex((b) => yy >= b.from && yy <= b.to)
        : -1,
  };
}

/** `2001–2060`, or `""` when the library read no year. */
export function rangeText(bands: Bands): string {
  return bands.first === null || bands.last === null
    ? ""
    : `${bands.first}–${bands.last}`;
}

/**
 * Bands for the template, before the library has loaded: they carry the widest text each
 * reason can hold and no fact about SWIFT. `mount` replaces them with `deriveBands`.
 */
export const WIDTH_BANDS: Bands = {
  list: [
    { from: "00", to: "99", firstYear: 9999, lastYear: 9999 },
    { from: "00", to: "99", firstYear: null, lastYear: null },
    { from: "00", to: "99", firstYear: null, lastYear: null },
  ],
  first: 9999,
  last: 9999,
  indexOf: () => 0,
};

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

/** `01–60`, or `00` for a run of one `YY`. */
export const bandText = (b: Band): string =>
  b.from === b.to ? b.from : `${b.from}–${b.to}`;

/** The `YY` the library reads, as runs: `01–60`. */
const readYyText = (bands: Bands): string =>
  bands.list
    .filter((b) => b.firstYear !== null)
    .map(bandText)
    .join(", ");

export const NOT_SIX_REASON =
  "A value date is six characters, YYMMDD; pass the date component alone (no tag, currency or amount).";
export const NOT_DIGITS_REASON = "The year digits are not two ASCII digits.";
export const BAD_MONTH_REASON = "MM is not a month, 01 to 12.";
export const BAD_DAY_REASON = "DD is not a day, 01 to 31.";
export const NOT_A_DATE_REASON =
  "Not an ISO calendar date. A date-time names a calendar date only in a zone, so take the date first.";
export const EMPTY_WRITE_TEXT = "Type an ISO date, or use the date read above.";

const acceptedReason = (yy: string, band: Band): string =>
  `YY ${yy} falls in ${bandText(band)}, which SWIFT reads as ${band.firstYear}–${band.lastYear}.`;

const bandRefusedReason = (yy: string, bands: Bands): string =>
  `SWIFT reads only YY ${readYyText(bands)}, as ${rangeText(bands)}, so YY ${yy} is refused.`;

const noDayReason = (mm: string, dd: string, year: number | null): string =>
  mm === "02" && dd === "29"
    ? `29 February does not exist in ${year}: ${year} is not a leap year.`
    : `Day ${dd} does not exist in month ${mm} of ${year}.`;

const outsideReason = (bands: Bands): string =>
  `Outside ${rangeText(bands)}, would read back as another year.`;

/** Every reading reason, at its widest, for the reason line's reserved room. */
export function readReasonSamples(bands: Bands): string[] {
  const refused = bands.list.some((b) => b.firstYear === null);
  return [
    NOT_SIX_REASON,
    NOT_DIGITS_REASON,
    ...bands.list
      .filter((b) => b.firstYear !== null)
      .map((b) => acceptedReason("99", b)),
    ...(refused ? [bandRefusedReason("99", bands)] : []),
    BAD_MONTH_REASON,
    BAD_DAY_REASON,
    noDayReason("02", "29", bands.last),
    noDayReason("12", "31", bands.last),
    EMPTY_READ_TEXT,
  ];
}

export function writeReasonSamples(bands: Bands): string[] {
  return [NOT_A_DATE_REASON, outsideReason(bands), EMPTY_WRITE_TEXT];
}

// ---------------------------------------------------------------------------
// Section 1: read a value date
// ---------------------------------------------------------------------------

export interface ValueReading {
  kind: "empty" | "read" | "refused";
  text: string;
  /** `parseSwiftDate`'s ISO date, or `null`. */
  iso: string | null;
  /** The year of that date, which is the library's. */
  year: string | null;
  /** `isValidSwiftDate`, `null` for an empty box. */
  valid: boolean | null;
  /** `"T50"` for a refused six-character text, else `null`. */
  code: string | null;
  reason: string;
  /** The row of the band table that the typed `YY` falls in, or `-1`. */
  band: number;
  /** `parseSwiftDate` then `isValidSwiftDate`; none for an empty box. */
  calls: EdiCall[];
}

/**
 * Reads `text` exactly as typed: no trim, no case change. A refusal of a six-character text is
 * explained by asking the library again, in this order, and the first probe it accepts names
 * the reason:
 *
 * 1. `YY` is not one of the hundred two-digit strings.
 * 2. `YY` falls in a run the library refuses.
 * 3. `YY MM 01` is refused, so MM is wrong.
 * 4. `YY 01 DD` is refused, so DD is wrong.
 * 5. Otherwise the day does not exist in that month of the year the library gave.
 */
export function readValueDate(
  lib: FinanceLib,
  text: string,
  bands: Bands,
): ValueReading {
  if (text === "") {
    return {
      kind: "empty",
      text,
      iso: null,
      year: null,
      valid: null,
      code: null,
      reason: EMPTY_READ_TEXT,
      band: -1,
      calls: [],
    };
  }
  const parse = runCall(lib, "parseSwiftDate", text);
  const valid = runCall(lib, "isValidSwiftDate", text);
  const calls = [parse, valid];
  const iso = parse.result as string;
  const yy = text.slice(0, 2);
  const six = text.length === 6;
  const band = six ? bands.indexOf(yy) : -1;

  if (iso !== "") {
    return {
      kind: "read",
      text,
      iso,
      year: iso.slice(0, 4),
      valid: valid.result as boolean,
      code: null,
      reason: band < 0 ? "" : acceptedReason(yy, bands.list[band] as Band),
      band,
      calls,
    };
  }

  const refused = (reason: string): ValueReading => ({
    kind: "refused",
    text,
    iso: null,
    year: null,
    valid: valid.result as boolean,
    code: six ? T50 : null,
    reason,
    band,
    calls,
  });

  if (!six) return refused(NOT_SIX_REASON);
  if (band < 0) return refused(NOT_DIGITS_REASON);
  const found = bands.list[band] as Band;
  if (found.firstYear === null) {
    return refused(bandRefusedReason(yy, bands));
  }
  const monthDate = lib.parseSwiftDate(`${text.slice(0, 4)}01`);
  if (monthDate === "") return refused(BAD_MONTH_REASON);
  if (lib.parseSwiftDate(`${yy}01${text.slice(4)}`) === "") {
    return refused(BAD_DAY_REASON);
  }
  return refused(
    noDayReason(text.slice(2, 4), text.slice(4), yearOf(monthDate)),
  );
}

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

export interface ValuePicture {
  halves: PicHalf[];
  aria: string;
}

/**
 * The six characters cut into YY, MM and DD, each under its own bracket, or one neutral box
 * for any other length. `read` false draws every box neutral: a refused text is never coloured
 * as if it were read. The cut is positional, not a rule: the library decides what it means.
 */
export function pictureOf(text: string, read: boolean): ValuePicture {
  const group = read ? "date" : "neutral";
  if (text.length !== 6) {
    return {
      halves: [
        {
          label: "",
          fields: [{ text, mask: "", group: "neutral", word: "text" }],
        },
      ],
      aria: `Value date text ${text}: not cut into fields.`,
    };
  }
  const parts = [
    ["YY", "year", text.slice(0, 2)],
    ["MM", "month", text.slice(2, 4)],
    ["DD", "day", text.slice(4, 6)],
  ] as const;
  return {
    halves: [
      {
        label: "",
        fields: parts.map(([mask, word, part]) => ({
          text: part,
          mask,
          group,
          word,
          bracket: word,
          run: mask,
        })),
      },
    ],
    aria: `Value date ${text}: ${parts.map(([, word, part]) => `${word} ${part}`).join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Section 3: write a value date
// ---------------------------------------------------------------------------

export interface WriteReading {
  kind: "empty" | "written" | "refused";
  text: string;
  /** `formatSwiftDate`'s `YYMMDD`, or `null`. */
  written: string | null;
  /** `parseSwiftDate` of that, or `null` when nothing was written. */
  back: string | null;
  /** The read-back equals the input. */
  same: boolean;
  reason: string;
  calls: EdiCall[];
}

/** Writes `text` and reads it back. A refusal asks `isValidDate` which kind it was. */
export function writeValueDate(
  lib: FinanceLib,
  text: string,
  bands: Bands,
): WriteReading {
  if (text === "") {
    return {
      kind: "empty",
      text,
      written: null,
      back: null,
      same: false,
      reason: EMPTY_WRITE_TEXT,
      calls: [],
    };
  }
  const write = runCall(lib, "formatSwiftDate", text);
  const out = write.result as string;
  if (out === "") {
    const calendar = runCall(lib, "isValidDate", text);
    return {
      kind: "refused",
      text,
      written: null,
      back: null,
      same: false,
      reason:
        calendar.result === true ? outsideReason(bands) : NOT_A_DATE_REASON,
      calls: [write, calendar],
    };
  }
  const back = runCall(lib, "parseSwiftDate", out);
  const read = back.result as string;
  return {
    kind: "written",
    text,
    written: out,
    back: read === "" ? null : read,
    same: read === text,
    reason: "",
    calls: [write, back],
  };
}
