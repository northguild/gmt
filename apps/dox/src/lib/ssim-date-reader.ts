/**
 * Pure helpers for the SSIM Date Reader (AV-97).
 *
 * The reader types an IATA SSIM date (`DDMMMYY`, such as `01JAN26`), states the window a
 * two-digit year is read in, and picks a locale. Section 1 reads the date with
 * `parseSsimDate`. Section 2 puts the same text through `parseDateWithPattern` with the
 * locale's own month names, beside a twelve-month table of the SSIM letters and the
 * locale's short names. Section 3 writes an ISO date back with `formatSsimDate`. Every date
 * and every month letter on screen is a library result; this module holds the state, the
 * presets, the arguments a link or the chat can seed, the reasons and the printed calls.
 *
 * No DOM. Anything that reads the library takes an `AviationLib` as its first argument. The
 * module holds no month-letter table and never inspects the typed text to decide a reason:
 * a reason is the state, a preset's own flag or one more library call. The locale reaches
 * `parseDateWithPattern` and `getLocaleMonthNames` only; no `parseSsimDate` call takes it.
 */
import type { AviationLib, YearWindowOptions } from "./aviation-lib";
import { literal } from "./holiday-rule-builder";

/** The locale the tool opens with when a link or the chat names none. */
export const DEFAULT_LOCALE = "en";

/** The pattern the locale parser reads the same text with. */
export const PATTERN = "ddMMMyy";

/** The window the month table's SSIM letters are probed in; any hundred years would do. */
export const PROBE_WINDOW = 2000;

/** The year the month table's probes are dated in, inside the probe window. */
const PROBE_YEAR = 2026;

/** The number of months in the table. */
export const MONTH_COUNT = 12;

/** What a plate reads while nothing has been typed: an empty field is not a refusal. */
export const NOTHING_TYPED = "nothing typed";

/** What the pattern plate reads when the locale parser returned no date. */
export const NO_DATE = "no date";

/** What a month cell reads when the locale gave no name. */
export const NO_NAME = "no name";

/** The widest ISO date a plate shows (`2026-01-01`), the plates' reserved width. */
export const ISO_SAMPLE = "2026-12-31";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface SsimPreset {
  id: string;
  label: string;
  description: string;
  /** The SSIM text, exactly as it is typed. */
  value: string;
  /** `"rolling"`, a first year as text, or `""` for no window. */
  window: string;
  locale: string;
  /** An ISO date for section 3, or `""`. */
  date: string;
}

const WINDOW_NOTE = "The window is this example's pick: change it.";

export const SSIM_PRESETS: readonly SsimPreset[] = [
  {
    id: "french-locale",
    label: "01JAN26 with a French pattern",
    description: `The SSIM reader gives the date. Given fr-FR, the pattern parser reads the month as that locale's own short name, janv., so it does not. ${WINDOW_NOTE}`,
    value: "01JAN26",
    window: "2000",
    locale: "fr-FR",
    date: "2026-01-01",
  },
  {
    id: "english-locale",
    label: "01JAN26 with an English pattern",
    description: `The two agree only because English short names happen to match the code. ${WINDOW_NOTE}`,
    value: "01JAN26",
    window: "2000",
    locale: "en",
    date: "",
  },
  {
    id: "turkish-locale",
    label: "25OCT26 with a Turkish pattern",
    description: `The locale you pass the pattern parser changes nothing for the SSIM reader. ${WINDOW_NOTE}`,
    value: "25OCT26",
    window: "2000",
    locale: "tr-TR",
    date: "",
  },
  {
    id: "lower-case",
    label: "Lower case",
    description: `The SSIM reader refuses lower case. The locale parser ignores case, as prose reads. ${WINDOW_NOTE}`,
    value: "01jan26",
    window: "2000",
    locale: "en",
    date: "",
  },
  {
    id: "spanish-locale",
    label: "A translated month",
    description: `A translated month is not the code: the SSIM reader refuses what the Spanish pattern accepts. ${WINDOW_NOTE}`,
    value: "01ENE26",
    window: "2000",
    locale: "es-ES",
    date: "",
  },
  {
    id: "archive",
    label: "An archive window",
    description:
      "A window from 1950 places 09 in 2009. The window is this example's pick: change it.",
    value: "16DEC09",
    window: "1950",
    locale: "en",
    date: "",
  },
  {
    id: "leap-2000",
    label: "29FEB00 from 2000",
    description: `Valid with a window from 2000, where 00 is a leap year. ${WINDOW_NOTE}`,
    value: "29FEB00",
    window: "2000",
    locale: "en",
    date: "",
  },
  {
    id: "leap-1900",
    label: "29FEB00 from 1900",
    description: `Not valid from 1900: 1900 has no 29 February. ${WINDOW_NOTE}`,
    value: "29FEB00",
    window: "1900",
    locale: "en",
    date: "",
  },
  {
    id: "rolling",
    label: "A rolling window",
    description:
      "A live feed's window moves with today, so the same two digits can mean another year next century.",
    value: "25OCT26",
    window: "rolling",
    locale: "en",
    date: "",
  },
  {
    id: "no-window",
    label: "No window",
    description:
      "Nothing says which century 26 is, so the reader states it. Without a window there is no date.",
    value: "01JAN26",
    window: "",
    locale: "en",
    date: "",
  },
  {
    id: "write-outside",
    label: "Write a year outside the window",
    description: `The writer refuses a year the window does not hold, because it would read back as another century. ${WINDOW_NOTE}`,
    value: "01JAN26",
    window: "2000",
    locale: "en",
    date: "1999-12-31",
  },
];

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State and arguments
// ---------------------------------------------------------------------------

export type WindowMode = "fixed" | "rolling";

export interface SsimState {
  /** The SSIM text as typed: never trimmed, never upper-cased. */
  value: string;
  mode: WindowMode;
  /** The first year as typed; read only while the mode is `fixed`. */
  first: string;
  /** A BCP 47 tag, passed to the locale parser, which judges it. */
  locale: string;
  /** The ISO date to write back, as typed. */
  date: string;
}

/** The state with nothing typed and no window. */
export function blankState(): SsimState {
  return {
    value: "",
    mode: "fixed",
    first: "",
    locale: DEFAULT_LOCALE,
    date: "",
  };
}

export function presetState(preset: SsimPreset): SsimState {
  return {
    value: preset.value,
    mode: preset.window === "rolling" ? "rolling" : "fixed",
    first: preset.window === "rolling" ? "" : preset.window,
    locale: preset.locale,
    date: preset.date,
  };
}

/** The window as one string: `"rolling"`, the first year as typed, or `""`. */
export function windowOf(state: SsimState): string {
  return state.mode === "rolling" ? "rolling" : state.first;
}

export interface SsimArgs {
  /** A preset id, from a permalink. */
  preset?: string;
  value?: string;
  /** `"rolling"`, a year as text or a number, or `""` for no window. */
  window?: string | number;
  locale?: string;
  date?: string;
}

/** Whether the args seed anything. */
export function isSeeded(args: SsimArgs): boolean {
  return Object.values(args).some((v) => v !== undefined);
}

const INTEGER = /^-?\d+$/;

/**
 * Seed arguments as controls. Typed values (the chat) and their text forms (a permalink)
 * both land here. A link or a call with no `window` opens with the window blank: a preset's
 * window is taken only through the preset's own id, and the chat never picks a century.
 */
export function readArgs(args: SsimArgs): SsimState {
  const named = SSIM_PRESETS.find((p) => p.id === args.preset);
  const state = named === undefined ? blankState() : presetState(named);
  if (typeof args.value === "string") state.value = args.value;
  if (typeof args.date === "string") state.date = args.date;
  if (typeof args.locale === "string" && args.locale.trim() !== "") {
    state.locale = args.locale.trim();
  }
  if (args.window === "rolling") {
    state.mode = "rolling";
    state.first = "";
  } else if (typeof args.window === "number") {
    state.mode = "fixed";
    state.first = String(args.window);
  } else if (typeof args.window === "string") {
    state.mode = "fixed";
    state.first = args.window;
  }
  return state;
}

/** The preset the controls match, or `custom`. */
export function matchPreset(state: SsimState): string {
  const hit = SSIM_PRESETS.find(
    (p) =>
      p.value === state.value &&
      p.window === windowOf(state) &&
      p.locale === state.locale &&
      p.date === state.date,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The permalink payload: `{ preset }` alone while the state matches one, else the four
 * strings. The window is a string (`"rolling"`, a year, or `""`) because a number outside
 * 1900 to 2100 is dropped from a link.
 */
export function permalinkOf(state: SsimState): Record<string, unknown> {
  const preset = matchPreset(state);
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  return {
    value: state.value,
    window: windowOf(state),
    locale: state.locale,
    date: state.date,
  };
}

/**
 * The options every SSIM call takes. A blank or non-integer first year sends no
 * `yearWindow`, so the library answers with its sentinel; an integer goes through whatever
 * it is, and the library judges its range.
 */
export function optionsOf(state: SsimState): YearWindowOptions {
  if (state.mode === "rolling") return { yearWindow: "rolling" };
  const text = state.first.trim();
  return INTEGER.test(text) ? { yearWindow: Number(text) } : {};
}

/** Whether the state states a window the library can be given. */
function hasWindow(options: YearWindowOptions): boolean {
  return options.yearWindow !== undefined;
}

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

export type ReadReasonKey =
  | "empty"
  | "noWindow"
  | "badWindow"
  | "lowerCase"
  | "noSuchDay"
  | "shape"
  | "read";

export const READ_REASONS: Record<ReadReasonKey, string> = {
  empty: "Type an SSIM date, such as 01JAN26, to read it.",
  noWindow:
    "No window, no date: SSIM does not say which century 26 is, so you state it.",
  badWindow:
    "The library refuses this window: a first year is a whole number from 0 to 9900.",
  lowerCase:
    "Lower case is refused: the letters are a code, written upper case.",
  noSuchDay: "That month has no such day in the windowed year.",
  shape:
    "Not two digits, three upper-case English month letters and two digits.",
  read: "Read with the window you gave; the locale played no part.",
};

export type WriteReasonKey = "empty" | "outside" | "refused" | "written";

export const WRITE_REASONS: Record<WriteReasonKey, string> = {
  empty: "Type an ISO date, such as 2026-01-01, to write it.",
  outside:
    "Outside your window: written, it would read back as another century.",
  refused: "Not an ISO calendar date, or no window.",
  written: "Written upper case with a two-digit year, in the window above.",
};

/** The lead sentence of section 2: fixed text, and never a fault in the library. */
export const PATTERN_LEAD =
  "parseDateWithPattern reads MMM as the chosen locale's own short month names, and ignores case, as a reader of prose should. An SSIM date is written in no locale, so this is the wrong function for it.";

/** The note under section 3's field. */
export const WRITE_NOTE =
  "Section 3 uses the window from section 1: it has no window of its own.";

// ---------------------------------------------------------------------------
// Section 1: read
// ---------------------------------------------------------------------------

export interface ReadResult {
  /** Nothing was typed: no call was made. */
  blank: boolean;
  /** `parseSsimDate`, or `null` for the sentinel. */
  ssim: string | null;
  /** `isValidSsimDate`, or `null` while nothing was typed. */
  valid: boolean | null;
  reason: ReadReasonKey;
  calls: string[];
}

/** The first of January exists in every year, so it reads in every window the library takes. */
const WINDOW_PROBE = "01JAN00";

/** Two ASCII digits of day at the start: the day probe swaps them for `01`. */
const LEADING_DAY = /^[0-9]{2}/;

/** Ask the library to read `text`, print the call, and say whether it gave a date. */
function probe(
  lib: AviationLib,
  text: string,
  options: YearWindowOptions,
  calls: string[],
): boolean {
  const read = lib.parseSsimDate(text, options);
  calls.push(
    `parseSsimDate(${literal(text)}, ${literal(options)}); // ${literal(read)}`,
  );
  return read !== "";
}

/**
 * Read the typed SSIM text. A refusal with a window is named by asking the library again,
 * each probe printed with the calls, in this order:
 *
 * 1. **The window.** `01JAN00` reads in every window the library takes, so a refusal of it is
 *    the window's.
 * 2. **The case.** The text upper-cased. `toUpperCase` does not depend on the locale
 *    (ECMA-262 defines it by Unicode default case conversion, and only `toLocaleUpperCase`
 *    takes one), so the probe cannot be moved by the reader's machine.
 * 3. **The day.** The text with its two digits of day swapped for `01`. Every month has a
 *    first day in every year, so when this reads, the day is the only fault.
 *
 * A probe whose text is the typed text is not run: it has already been refused. Whatever no
 * probe reads has the wrong shape.
 */
export function readSsim(lib: AviationLib, state: SsimState): ReadResult {
  if (state.value === "") {
    return {
      blank: true,
      ssim: null,
      valid: null,
      reason: "empty",
      calls: [],
    };
  }
  const options = optionsOf(state);
  const calls: string[] = [];
  const read = lib.parseSsimDate(state.value, options);
  calls.push(
    `parseSsimDate(${literal(state.value)}, ${literal(options)}); // ${literal(read)}`,
  );
  const valid = lib.isValidSsimDate(state.value, options);
  calls.push(
    `isValidSsimDate(${literal(state.value)}, ${literal(options)}); // ${literal(valid)}`,
  );
  if (read !== "") {
    return { blank: false, ssim: read, valid, reason: "read", calls };
  }

  const reads = (text: string): boolean =>
    text !== state.value && probe(lib, text, options, calls);
  const upper = state.value.toUpperCase();
  const firstDay = LEADING_DAY.test(state.value)
    ? `01${state.value.slice(2)}`
    : state.value;
  let reason: ReadReasonKey;
  if (!hasWindow(options)) {
    reason = "noWindow";
  } else if (!reads(WINDOW_PROBE)) {
    reason = "badWindow";
  } else if (reads(upper)) {
    reason = "lowerCase";
  } else if (reads(firstDay)) {
    reason = "noSuchDay";
  } else {
    reason = "shape";
  }
  return { blank: false, ssim: null, valid, reason, calls };
}

// ---------------------------------------------------------------------------
// Section 2: the locale pattern
// ---------------------------------------------------------------------------

export interface PatternResult {
  /** The locale parser's date, `null` for no date, or `undefined` while nothing was typed. */
  date: string | null | undefined;
  /** It disagrees with section 1. */
  differs: boolean;
  calls: string[];
}

export function readPattern(
  lib: AviationLib,
  state: SsimState,
  read: ReadResult,
): PatternResult {
  if (read.blank) return { date: undefined, differs: false, calls: [] };
  const options = optionsOf(state);
  const out = lib.parseDateWithPattern(
    state.value,
    PATTERN,
    state.locale,
    options,
  );
  const calls = [
    `parseDateWithPattern(${literal(state.value)}, ${literal(PATTERN)}, ${literal(state.locale)}, ${literal(options)}); // ${literal(out)}`,
  ];
  return {
    date: out === "" ? null : out,
    differs: (out === "" ? null : out) !== read.ssim,
    calls,
  };
}

export interface MonthRow {
  /** `01` to `12`. */
  month: string;
  /** The three letters the library wrote, or `null` if it wrote none. */
  letters: string | null;
  /** The locale's short name, or `null` if the locale gave none. */
  name: string | null;
}

export interface MonthTable {
  rows: MonthRow[];
  /** The longest short name the locale gave, for the locale column's reserved width. */
  widest: string;
  calls: string[];
}

/**
 * The twelve months: SSIM letters from the library's writer (characters 2 to 5 of the
 * seven-character result), and the locale's short names. The site holds no letter table.
 */
export function monthTable(lib: AviationLib, locale: string): MonthTable {
  const calls: string[] = [];
  const letters: (string | null)[] = [];
  const probeOptions = { yearWindow: PROBE_WINDOW };
  for (let i = 1; i <= MONTH_COUNT; i += 1) {
    const iso = `${PROBE_YEAR}-${String(i).padStart(2, "0")}-01`;
    const written = lib.formatSsimDate(iso, probeOptions);
    calls.push(
      `formatSsimDate(${literal(iso)}, ${literal(probeOptions)}); // ${literal(written)}`,
    );
    letters.push(written === "" ? null : written.slice(2, 5));
  }
  const names = lib.getLocaleMonthNames(locale, "short");
  calls.push(
    `getLocaleMonthNames(${literal(locale)}, "short"); // ${literal(names)}`,
  );
  const rows = letters.map((l, i) => ({
    month: String(i + 1).padStart(2, "0"),
    letters: l,
    name: names[i] === undefined || names[i] === "" ? null : names[i]!,
  }));
  let widest = "";
  for (const row of rows) {
    if (row.name !== null && row.name.length > widest.length) widest = row.name;
  }
  return { rows, widest, calls };
}

// ---------------------------------------------------------------------------
// Section 3: write back
// ---------------------------------------------------------------------------

export interface WriteResult {
  /** Nothing was typed: no call was made. */
  blank: boolean;
  /** `formatSsimDate`, or `null` for the sentinel. */
  written: string | null;
  /** `parseSsimDate(written)`, or `null` when nothing was written. */
  back: string | null;
  reason: WriteReasonKey;
  calls: string[];
}

export function writeSsim(lib: AviationLib, state: SsimState): WriteResult {
  if (state.date === "") {
    return {
      blank: true,
      written: null,
      back: null,
      reason: "empty",
      calls: [],
    };
  }
  const options = optionsOf(state);
  const calls: string[] = [];
  const written = lib.formatSsimDate(state.date, options);
  calls.push(
    `formatSsimDate(${literal(state.date)}, ${literal(options)}); // ${literal(written)}`,
  );
  if (written === "") {
    // With no window every date is refused, so "outside your window" would be untrue.
    let reason: WriteReasonKey = "refused";
    if (hasWindow(options)) {
      const calendar = lib.isValidDate(state.date);
      calls.push(
        `isValidDate(${literal(state.date)}); // ${literal(calendar)}`,
      );
      if (calendar) reason = "outside";
    }
    return { blank: false, written: null, back: null, reason, calls };
  }
  const back = lib.parseSsimDate(written, options);
  calls.push(
    `parseSsimDate(${literal(written)}, ${literal(options)}); // ${literal(back)}`,
  );
  return {
    blank: false,
    written,
    back: back === "" ? null : back,
    reason: "written",
    calls,
  };
}

// ---------------------------------------------------------------------------
// The whole model
// ---------------------------------------------------------------------------

export interface SsimModel {
  read: ReadResult;
  pattern: PatternResult;
  write: WriteResult;
}

/** Everything the page draws that depends on the typed fields. The month table is drawn apart. */
export function buildModel(lib: AviationLib, state: SsimState): SsimModel {
  const read = readSsim(lib, state);
  return {
    read,
    pattern: readPattern(lib, state, read),
    write: writeSsim(lib, state),
  };
}

export type CallsSection = "read" | "pattern" | "write";

/**
 * The printed calls at their widest, for the frames' reserved height: the same lines the
 * mount prints, built by the same functions over a library whose every call takes its
 * longest path. A frame is the hidden twin's height, so it holds one height whatever the
 * reader types.
 */
export function callsSizerText(section: CallsSection): string {
  const wide = {
    // The typed text and its upper-cased twin are refused and the window probe reads, so all
    // three probes print.
    parseSsimDate: (value: string) =>
      value === "31apr26" || value === "31APR26" ? "" : "2026-01-01",
    formatSsimDate: () => "01JAN26",
    isValidSsimDate: () => false,
    parseDateWithPattern: () => "2026-01-01",
    getLocaleMonthNames: () =>
      Array.from({ length: MONTH_COUNT }, () => "janv."),
    isValidDate: () => true,
  } as unknown as AviationLib;
  const state: SsimState = {
    value: "31apr26",
    mode: "fixed",
    first: "2000",
    locale: "fr-FR",
    date: "1999-12-31",
  };
  const read = readSsim(wide, state);
  if (section === "read") return read.calls.join("\n");
  if (section === "pattern") {
    return [
      ...readPattern(wide, state, read).calls,
      ...monthTable(wide, state.locale).calls,
    ].join("\n");
  }
  return writeSsim(
    {
      ...wide,
      formatSsimDate: () => "",
    } as unknown as AviationLib,
    state,
  ).calls.join("\n");
}
