/**
 * The Duration Parser Bench's pure logic (CORE-85): the fixed rows with their
 * notes, the laytime anchors, the seeds, and `benchView`.
 *
 * **A widget draws the library's results and computes none of them.**
 * `benchView` only calls `lib` and arranges what comes back; every unit, string
 * and hour on the page is a return value. The only values written here are copy
 * (the notes and the refusal sentence), the written strings the tables parse,
 * and the two laytime start times the hours are measured from.
 */
import type { DurationBenchLib } from "./duration-bench-lib";

// ---------------------------------------------------------------------------
// Seeds and permalink
// ---------------------------------------------------------------------------

/** The permalink's cap on a string value (`widget-permalink.ts`). */
export const BENCH_MAX_TEXT = 64;
export const BENCH_DEFAULT_TEXT = "2h 30m";
export const BENCH_DEFAULT_LOCALE = "en";

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface DurationParserBenchArgs {
  text?: string;
  locale?: string;
}

/** The widget's controls, as strings, which is what the DOM holds. */
export interface BenchState {
  text: string;
  locale: string;
}

/**
 * The seed as control values. The text is never trimmed: a leading space is a
 * case the reader should see refused. An empty text is the default.
 */
export function readArgs(args: DurationParserBenchArgs): BenchState {
  const text =
    typeof args.text === "string" && args.text !== ""
      ? args.text.slice(0, BENCH_MAX_TEXT)
      : BENCH_DEFAULT_TEXT;
  const locale =
    typeof args.locale === "string" && args.locale !== ""
      ? args.locale
      : BENCH_DEFAULT_LOCALE;
  return { text, locale };
}

/** The permalink's strings: the text as typed, and the locale when it is not the default. */
export function permalinkOf(state: BenchState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.text !== "") out["text"] = state.text;
  if (state.locale !== BENCH_DEFAULT_LOCALE) out["locale"] = state.locale;
  return out;
}

/** Strings the Try buttons write into the field, in order. */
export const TRY_STRINGS = [
  "1.5h",
  "2h, and 30m",
  "30m 2h",
  "1.5h 30m",
  "2h 3h",
  "1,5h",
  "PT90M",
  "-2h 30m",
] as const;

// ---------------------------------------------------------------------------
// The ten duration fields
// ---------------------------------------------------------------------------

export interface DurationField {
  /** The `getDurationUnit` unit name. */
  field: string;
  /** The singular word, for a sentence. */
  name: string;
  /** The grammar's shortest written symbol, or `null` for a unit it has no spelling for. */
  symbol: string | null;
}

/** Years to nanoseconds, the ten fields of a Temporal duration. */
export const DURATION_FIELDS: readonly DurationField[] = [
  { field: "years", name: "year", symbol: "y" },
  { field: "months", name: "month", symbol: "mo" },
  { field: "weeks", name: "week", symbol: "w" },
  { field: "days", name: "day", symbol: "d" },
  { field: "hours", name: "hour", symbol: "h" },
  { field: "minutes", name: "minute", symbol: "m" },
  { field: "seconds", name: "second", symbol: "s" },
  { field: "milliseconds", name: "millisecond", symbol: "ms" },
  { field: "microseconds", name: "microsecond", symbol: null },
  { field: "nanoseconds", name: "nanosecond", symbol: null },
];

/** The label a unit with no spelling carries in the strip. */
export const NO_SPELLING_TEXT = "no spelling";

// ---------------------------------------------------------------------------
// Section 2: what a typed string reads as
// ---------------------------------------------------------------------------

/** Which parser accepted the string. */
export type Parser = "iso" | "human" | "none";

/** The sentence under a string neither parser reads. Static: chosen by what the calls returned. */
export const REFUSAL_TEXT =
  "Neither parser reads it. ISO 8601 starts with P; the human grammar takes numbers with units, largest first, each unit once, with plain spaces.";

export const PARSER_LABEL: Record<Exclude<Parser, "none">, string> = {
  iso: "ISO 8601",
  human: "human",
};

/** The chain a caller who takes either form writes. */
export const CHAIN_TEXT = "parseDuration(s) || parseHumanDuration(s)";

export interface UnitCell extends DurationField {
  /** `getDurationUnit(iso, field)`, or `null` when there was no duration to read. */
  value: number | null;
  lit: boolean;
}

/** One call the bench made, with its return as the library gave it. */
export interface BenchCall {
  fn: string;
  /** Every argument is a string. */
  args: string[];
  result: string;
}

/** The five printed calls, in order. A call the bench did not make is `null`. */
export const CALL_IDS = [
  "iso",
  "human",
  "compact",
  "roundtrip",
  "words",
] as const;
export type CallId = (typeof CALL_IDS)[number];

export interface BenchView {
  parser: Parser;
  /** The ISO duration the chain returns, or `""`. */
  iso: string;
  /** The sentence for a string neither parser reads, else `null`. */
  refusal: string | null;
  cells: UnitCell[];
  /** `formatHumanDuration(iso)`, or `null` when it was not called. */
  compact: string | null;
  /** `parseHumanDuration(compact)`, or `null` when it was not called. */
  roundTrip: string | null;
  /** Whether the round trip returned the same duration; `null` when it was not made. */
  sameDuration: boolean | null;
  /** `formatDuration(iso, locale)`, or `null` when it was not called. */
  words: string | null;
  calls: Record<CallId, BenchCall | null>;
}

/** The first non-zero field of `iso`, as its singular word, or `null`. */
export function unitWord(lib: DurationBenchLib, iso: string): string | null {
  if (iso === "") return null;
  for (const f of DURATION_FIELDS) {
    const v = lib.getDurationUnit(iso, f.field);
    if (v !== null && v !== 0) return f.name;
  }
  return null;
}

/**
 * What the typed string reads as. Calls `lib` and arranges what comes back.
 * `parseDuration` runs first, then `parseHumanDuration`; no string is valid in
 * both, so the chain is whichever returned something.
 */
export function benchView(
  lib: DurationBenchLib,
  text: string,
  locale: string,
): BenchView {
  const isoResult = lib.parseDuration(text);
  const humanResult = lib.parseHumanDuration(text);
  const iso = isoResult || humanResult;
  const parser: Parser =
    isoResult !== "" ? "iso" : humanResult !== "" ? "human" : "none";

  const calls: Record<CallId, BenchCall | null> = {
    iso: { fn: "parseDuration", args: [text], result: isoResult },
    human: { fn: "parseHumanDuration", args: [text], result: humanResult },
    compact: null,
    roundtrip: null,
    words: null,
  };

  if (iso === "") {
    return {
      parser,
      iso,
      refusal: REFUSAL_TEXT,
      cells: DURATION_FIELDS.map((f) => ({ ...f, value: null, lit: false })),
      compact: null,
      roundTrip: null,
      sameDuration: null,
      words: null,
      calls,
    };
  }

  const cells = DURATION_FIELDS.map((f) => {
    const value = lib.getDurationUnit(iso, f.field);
    return { ...f, value, lit: value !== null && value !== 0 };
  });
  const compact = lib.formatHumanDuration(iso);
  calls.compact = { fn: "formatHumanDuration", args: [iso], result: compact };
  let roundTrip: string | null = null;
  if (compact !== "") {
    roundTrip = lib.parseHumanDuration(compact);
    calls.roundtrip = {
      fn: "parseHumanDuration",
      args: [compact],
      result: roundTrip,
    };
  }
  const words = lib.formatDuration(iso, locale);
  calls.words = { fn: "formatDuration", args: [iso, locale], result: words };

  return {
    parser,
    iso,
    refusal: null,
    cells,
    compact,
    roundTrip,
    sameDuration: roundTrip === null ? null : roundTrip === iso,
    words,
    calls,
  };
}

// ---------------------------------------------------------------------------
// Section 3, table A: minute or month
// ---------------------------------------------------------------------------

export interface MinuteOrMonthSeed {
  written: string;
  /** The unit the note names: the field `getDurationUnit` finds non-zero, as a word. */
  unit: string;
  note: string;
}

/** The seven rows, in order. */
export const MINUTE_OR_MONTH_ROWS: readonly MinuteOrMonthSeed[] = [
  {
    written: "1m",
    unit: "minute",
    note: "`m` is a minute.",
  },
  {
    written: "1M",
    unit: "minute",
    note: "`M` is a minute too: spellings ignore case.",
  },
  {
    written: "1min",
    unit: "minute",
    note: "`min` is the long spelling of a minute.",
  },
  {
    written: "1mo",
    unit: "month",
    note: "`mo` is the short spelling of a month; `m` is a minute.",
  },
  {
    written: "1 month",
    unit: "month",
    note: "`month` is the long spelling; a space after the number is fine.",
  },
  {
    written: "500ms",
    unit: "millisecond",
    note: "`ms` is a millisecond; it joins the seconds when written out.",
  },
  {
    written: "P1M",
    unit: "month",
    note: "`P1M` is ISO 8601's month. The human parser refuses it; the chain reads it with `parseDuration`.",
  },
];

export interface MinuteOrMonthRow extends MinuteOrMonthSeed {
  /** `parseHumanDuration(written)`. */
  human: string;
  /** `parseDuration(written)`. */
  iso: string;
  /** The field found non-zero in the chained result, as a word. */
  unitFound: string | null;
  /** `formatHumanDuration(chained)`. */
  compact: string;
  /** `formatDuration(chained, locale)`. */
  words: string;
}

export function minuteOrMonthRows(
  lib: DurationBenchLib,
  locale: string,
): MinuteOrMonthRow[] {
  return MINUTE_OR_MONTH_ROWS.map((seed) => {
    const human = lib.parseHumanDuration(seed.written);
    const iso = lib.parseDuration(seed.written);
    const chained = iso || human;
    return {
      ...seed,
      human,
      iso,
      unitFound: unitWord(lib, chained),
      compact: chained === "" ? "" : lib.formatHumanDuration(chained),
      words: chained === "" ? "" : lib.formatDuration(chained, locale),
    };
  });
}

// ---------------------------------------------------------------------------
// Section 3, table B: laytime
// ---------------------------------------------------------------------------

export interface LaytimeStart {
  /** The column heading. */
  label: string;
  /** The zoned start time the hours are measured from. */
  relativeTo: string;
}

/** Rotterdam. The clock goes forward on 29 Mar 2026 and back on 25 Oct 2026. */
export const LAYTIME_ZONE = "Europe/Amsterdam";
export const LAYTIME_STARTS: readonly LaytimeStart[] = [
  {
    label: "Fri 27 Mar 2026 12:00",
    relativeTo: "2026-03-27T12:00:00+01:00[Europe/Amsterdam]",
  },
  {
    label: "Fri 23 Oct 2026 12:00",
    relativeTo: "2026-10-23T12:00:00+02:00[Europe/Amsterdam]",
  },
];

/** The two strings the laytime table parses. */
export const LAYTIME_WRITTEN = ["3 days", "72h"] as const;

export const BIMCO_URL =
  "https://www.bimco.org/media/qy2neqim/laytime-definitions-for-charter-parties-2013-v2.pdf";

/**
 * The note under the laytime table. `link` is the document's title, which the
 * bench renders as a link to `BIMCO_URL`; `rest` follows it. Backticks mark code.
 */
export const LAYTIME_NOTE = {
  link: "BIMCO Laytime Definitions for Charter Parties 2013",
  rest: ", no. 8, defines a laytime DAY as twenty-four (24) consecutive hours. `3 days` is `P3D`, three calendar days, so across a clock change it is the hours above. `72h` is `PT72H`, 72 hours in every zone.",
} as const;

export interface LaytimeRow {
  written: string;
  /** `parseHumanDuration(written)`. */
  human: string;
  /** `formatHumanDuration(human)`. */
  compact: string;
  /** `totalDuration(human, "hours", { relativeTo })` for each start, in order. */
  hours: (number | null)[];
}

export function laytimeRows(lib: DurationBenchLib): LaytimeRow[] {
  return LAYTIME_WRITTEN.map((written) => {
    const human = lib.parseHumanDuration(written);
    return {
      written,
      human,
      compact: human === "" ? "" : lib.formatHumanDuration(human),
      hours: LAYTIME_STARTS.map((start) =>
        human === ""
          ? null
          : lib.totalDuration(human, "hours", { relativeTo: start.relativeTo }),
      ),
    };
  });
}
