/*
 * The fixed digit-order grammars of UN/EDIFACT data element 2379 (Date or time or period format
 * code), X12 data element 1250 (Date Time Period Format Qualifier) and X12 data element 337
 * (Time), and the code list of X12 data element 623 (Time Code). Private: a value-plus-code
 * grammar is a two-argument relation, so its public form is a validator function
 * (`isValidEdifactDate(value, format)`), never a constant per code.
 *
 * Each code states one kind of value: a date, a time, a local date-time, a date-time with an
 * offset, or a period or range of two dates or two local date-times. The kind is written beside
 * the mask in the layout tables below, and one public parser, formatter and validator reads each
 * kind.
 *
 * Sources:
 * - UNTDID data element 2379. UNECE's own directory page, D.21B, as archived:
 *   http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm
 *   Earlier directories were read from the stylusstudio
 *   (https://www.stylusstudio.com/edifact/D04B/2379.htm) and edifactory
 *   (https://www.edifactory.de/edifact/directory/D13B/data-element/2379) mirrors. Each entry's
 *   comment quotes the directory's mask and description; code 208 first appears in D.12A.
 * - A 2379 period is transmitted without a hyphen. Every directory read (twelve, from D.93A to
 *   D.22B) says so. 718, D.93A to D.01B: "Format of period to be given without hyphen."; from
 *   D.01C: "Data is to be transmitted as consecutive characters without hyphen." 719, in every
 *   directory that has it (it is absent from D.93A and D.96A): "Format of period to be given in
 *   actual message without hyphen." The hyphen in the mask is notation, so a period grammar
 *   matches the run-together form only: a hyphen in the value is rejected.
 * - X12 data element 1250, release 005010, read from Stedi's X12-licensed dictionary
 *   (https://www.stedi.com/edi/x12-005010/element/1250); the 42-code list is the same in release
 *   008010. The X12 text was not reached. Each 1250 definition gives a range *with* its hyphen
 *   ("Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD") and carries no instruction to omit
 *   it, so a range grammar requires exactly one.
 * - X12 data element 623, release 008010, same dictionary
 *   (https://www.stedi.com/edi/x12-008010/element/623): 56 codes. Release 005010 has 51 of them
 *   (https://www.stedi.com/edi/x12-005010/element/623); `25`–`29` were added in release 006010
 *   and are not valid in an 004010 or 005010 interchange. `x12TimeCodeOffset` and
 *   `x12TimeCodeZone` take no release, so they read the superset.
 * - The three-character `ZZZ` of 2379 codes 303 and 304, which no directory defines beyond
 *   "Z = Time zone". It is read as an offset only, in two forms, and anything else is rejected
 *   (**GMT rule**):
 *   1. `[+-]HH`, hour 00–23: UN/ECE Recommendation 7 (1988) ¶12 appends the difference from UTC
 *      "in hours and minutes, or hours only, with a leading "+" or "-" sign" (`+01`, `-05`).
 *   2. The literals `UTC` and `GMT` are +00:00: the SMDG IFTSAI 2.0 and BAPLIE 3.1.1 guides write
 *      `UTC` in a 303 value, and Recommendation 7 ¶12 names one scale by both names,
 *      "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)".
 *   Any other three characters are rejected. No UN/EDIFACT text defines a zone abbreviation
 *   (`CET`, `PDT`), so GMT reads none. A field led by a sign, or holding a digit, that is not a
 *   valid signed hour (`+24`, `-99`, `000`) is a broken offset. Lower case is rejected because
 *   every published example is upper case. A lone `Z` is rejected: Recommendation 7 ¶12 does
 *   write UTC as the single letter `Z`, but the mask has three characters, a variable-length
 *   element carries no trailing spaces (syntax rules §7: "leading zeroes and trailing spaces
 *   shall be suppressed"), and no guide writes it.
 *
 * Codes that are not read, and return the sentinel from every function:
 * - Every mask with a two-digit year: 2379 codes 101, 201, 202, 206, 207, 301, 302, 713 and 717;
 *   1250 codes D6, TT, TR, RD6 and TU. Neither standard says which century `YY` belongs to. The
 *   pattern parsers read such a value with the century stated by the caller:
 *   `parseDateWithPattern("240615", "yyMMdd", undefined, { yearWindow: 2000 })`.
 * - The codes that state no date, time, date-time or instant: 2379 codes 209 and 404 (a time
 *   with an offset and no date) and 406 (an offset alone); 1250 codes TC and EH (a day of the
 *   year with no whole year), DDT and DTD (a range with a date on one side and a date-time on
 *   the other), RTM (a range of times with no date) and UN (Unstructured).
 * - Every other code of either element.
 *
 * Every grammar proves shape only: month 01–12, day 01–31, hour 00–23, minute and second 00–59.
 * Whether the day exists in its month is Temporal's (`ediDateTimeFields.ts`,
 * `overflow: "reject"`).
 *
 * One table per standard describes each code as its kind and its parts in mask order; the
 * classifier, the regex, the field reader (`ediDateTimeFields.ts`) and the writer
 * (`ediDateTimeWriter.ts`) are all derived from it, so a code's kind, its grammar, the fields it
 * yields and the digits written for it cannot drift apart.
 */
import type {
  EdifactDateFormat,
  EdifactDatePeriodFormat,
  EdifactDateTimeFormat,
  EdifactDateTimePeriodFormat,
  EdifactDtmFormat,
  EdifactDtmFormatClass,
  EdifactOffsetDateTimeFormat,
  EdifactTimeFormat,
  X12DateFormat,
  X12DateRangeFormat,
  X12DateTimeFormat,
  X12DateTimePeriodFormat,
  X12DateTimePeriodFormatClass,
  X12DateTimeRangeFormat,
  X12TimeCode,
  X12TimeFormat,
} from "../types/edi";

/**
 * One field of a mask, named as the standards print it. Each part is one capture group. The
 * standards write `MM` for both month and minute; `MI` is this file's name for the minute. `ZS`,
 * `ZH` and `ZM` are the sign, hours and minutes of the `ZHHMM` offset of codes 205 and 208.
 */
export type EdiPart =
  | "CCYY"
  | "MM"
  | "DD"
  | "HH"
  | "MI"
  | "SS"
  | "ZS"
  | "ZH"
  | "ZM"
  | "ZZZ";

/** The kind names `classifyEdifactDtmFormat` returns: one per UN/EDIFACT kind of value. */
export type EdifactDtmKind = EdifactDtmFormatClass["kind"];

/** The kind names `classifyX12DateTimePeriodFormat` returns: one per X12 kind of value. */
export type X12DateTimePeriodKind = X12DateTimePeriodFormatClass["kind"];

/** The kind of value a format code states, in either standard's own name for it. */
export type EdiKind = EdifactDtmKind | X12DateTimePeriodKind;

/**
 * What one half of a value is: the kind of ISO 8601 string the reader returns for it and the
 * writer takes. A single value has one half; a period or range has two of the same kind.
 */
export type EdiValueKind = "date" | "time" | "dateTime" | "offsetDateTime";

/** A code's value: its kind, its parts in mask order, and for a period or range the end's parts too. */
export interface EdiLayout<Kind extends EdiKind = EdiKind> {
  readonly kind: Kind;
  readonly start: readonly EdiPart[];
  readonly end?: readonly EdiPart[];
}

/** The standard a format code belongs to. */
export type EdiStandard = "edifact" | "x12";

/** One format code of one standard, as the classifier, the reader and the writer all look it up. */
export interface EdiCode {
  /** The kind of value the code states, as its standard's classifier names it. */
  readonly kind: EdiKind;
  /** What each half of the value is. */
  readonly valueKind: EdiValueKind;
  /** The code's parts in mask order. */
  readonly layout: EdiLayout;
  /** The anchored grammar of the code's value. */
  readonly grammar: RegExp;
  /** What the standard transmits between the halves of a period or range. */
  readonly rangeSeparator: string;
}

/** What each half of a value of each kind is: a period of dates is two dates. */
const VALUE_KIND: Readonly<Record<EdiKind, EdiValueKind>> = {
  date: "date",
  time: "time",
  dateTime: "dateTime",
  offsetDateTime: "offsetDateTime",
  datePeriod: "date",
  dateTimePeriod: "dateTime",
  dateRange: "date",
  dateTimeRange: "dateTime",
};

/** Hour, 00–23. */
const HH = "([01][0-9]|2[0-3])";
/** Minute, 00–59. */
const MI = "([0-5][0-9])";

/** The regex source of each part: one capture group, the field's whole range of digits. */
const FRAGMENT: Readonly<Record<EdiPart, string>> = {
  // Century and year: four digits.
  CCYY: "(\\d{4})",
  // Month, 01–12.
  MM: "(0[1-9]|1[0-2])",
  // Day of month, 01–31.
  DD: "(0[1-9]|[12][0-9]|3[01])",
  HH,
  MI,
  // Second, 00–59. `60` does not match: GMT rejects a leap second, which Temporal would read as 59.
  SS: "([0-5][0-9])",
  // 2379 codes 205 and 208: "Z is plus (+) or minus (-)", then hours and minutes.
  ZS: "([+-])",
  ZH: HH,
  ZM: MI,
  // 2379 codes 303 and 304: a signed hour `[+-]HH`, 00–23 (Rec 7 ¶12), or the literals `UTC` and
  // `GMT`. Nothing else is read: no UN/EDIFACT text defines a zone abbreviation, and a sign or a
  // digit outside a valid signed hour (`+24`, `000`) is a broken offset (GMT rule; see the file
  // header).
  ZZZ: "([+-](?:[01][0-9]|2[0-3])|UTC|GMT)",
};

/** The `ZHHMM` offset of 2379 codes 205 and 208: sign, hours, minutes. */
const ZHHMM: readonly EdiPart[] = ["ZS", "ZH", "ZM"];

/** The parts' sources joined, anchored, flagless; a period's halves joined by `join`. */
function grammarOf(layout: EdiLayout, join: string): RegExp {
  const source = (parts: readonly EdiPart[]): string =>
    parts.map((part) => FRAGMENT[part]).join("");
  const end = layout.end === undefined ? "" : `${join}${source(layout.end)}`;
  return new RegExp(`^${source(layout.start)}${end}$`);
}

/** A grammar table from a layout table, in the layout table's key order. */
function grammarsOf<Code extends string>(
  layouts: Readonly<Record<Code, EdiLayout>>,
  join: string,
): Readonly<Record<Code, RegExp>> {
  const grammars: Partial<Record<Code, RegExp>> = {};
  for (const code of Object.keys(layouts) as Code[]) {
    grammars[code] = grammarOf(layouts[code], join);
  }
  return grammars as Readonly<Record<Code, RegExp>>;
}

/**
 * The 11 UNTDID 2379 codes GMT reads, in directory order: a date (`102`), a date and time
 * (`203`, `204`), a date and time with a `ZHHMM` offset (`205`, `208`), a date and time with
 * three zone characters (`303`, `304`), a time (`401`, `402`) and a period (`718`, `719`).
 *
 * Every other 2379 code returns the sentinel; the file header lists the ones cut and why.
 */
export const EDIFACT_DTM_FORMATS: readonly EdifactDtmFormat[] = [
  "102",
  "203",
  "204",
  "205",
  "208",
  "303",
  "304",
  "401",
  "402",
  "718",
  "719",
];

/**
 * UNTDID 2379 code → its kind and its value's parts. Typed kind by kind from the public unions,
 * so a missing code, and a code filed under a kind its union does not name, both fail typecheck.
 */
const EDIFACT_DTM_LAYOUT: {
  readonly [Code in EdifactDateFormat]: EdiLayout<"date">;
} & {
  readonly [Code in EdifactTimeFormat]: EdiLayout<"time">;
} & { readonly [Code in EdifactDateTimeFormat]: EdiLayout<"dateTime"> } & {
  readonly [Code in EdifactOffsetDateTimeFormat]: EdiLayout<"offsetDateTime">;
} & { readonly [Code in EdifactDatePeriodFormat]: EdiLayout<"datePeriod"> } & {
  readonly [Code in EdifactDateTimePeriodFormat]: EdiLayout<"dateTimePeriod">;
} = {
  // 102 CCYYMMDD — "Calendar date: C = Century ; Y = Year ; M = Month ; D = Day."
  "102": { kind: "date", start: ["CCYY", "MM", "DD"] },
  // 203 CCYYMMDDHHMM — "Calendar date including time with minutes"
  "203": { kind: "dateTime", start: ["CCYY", "MM", "DD", "HH", "MI"] },
  // 204 CCYYMMDDHHMMSS — "Calendar date including time with seconds"
  "204": { kind: "dateTime", start: ["CCYY", "MM", "DD", "HH", "MI", "SS"] },
  // 205 CCYYMMDDHHMMZHHMM — "Calendar date including time and time zone expressed in hours and minutes."
  "205": {
    kind: "offsetDateTime",
    start: ["CCYY", "MM", "DD", "HH", "MI", ...ZHHMM],
  },
  // 208 CCYYMMDDHHMMSSZHHMM — "Calendar date including time with seconds, with Time Zone: … Z = leading plus/minus sign, HHMM = difference to UTC in Hours and Minutes." (D.12A on)
  "208": {
    kind: "offsetDateTime",
    start: ["CCYY", "MM", "DD", "HH", "MI", "SS", ...ZHHMM],
  },
  // 303 CCYYMMDDHHMMZZZ — "See 203 plus Z=Time zone."
  "303": {
    kind: "offsetDateTime",
    start: ["CCYY", "MM", "DD", "HH", "MI", "ZZZ"],
  },
  // 304 CCYYMMDDHHMMSSZZZ — "See 204 plus Z=Time zone."
  "304": {
    kind: "offsetDateTime",
    start: ["CCYY", "MM", "DD", "HH", "MI", "SS", "ZZZ"],
  },
  // 401 HHMM — "Time without seconds: H = Hour; m = Minute."
  "401": { kind: "time", start: ["HH", "MI"] },
  // 402 HHMMSS — "Time with seconds: H = Hour; m = Minute; s = Seconds."
  "402": { kind: "time", start: ["HH", "MI", "SS"] },
  // 718 CCYYMMDD-CCYYMMDD — "A period of time specified by giving the start date followed by the end date (both including century)."
  "718": {
    kind: "datePeriod",
    start: ["CCYY", "MM", "DD"],
    end: ["CCYY", "MM", "DD"],
  },
  // 719 CCYYMMDDHHMM-CCYYMMDDHHMM — "A period of time which includes the century, year, month, day, hour and minute."
  "719": {
    kind: "dateTimePeriod",
    start: ["CCYY", "MM", "DD", "HH", "MI"],
    end: ["CCYY", "MM", "DD", "HH", "MI"],
  },
};

/**
 * UNTDID 2379 code → the anchored, flagless grammar of its value. A period's halves are run
 * together with nothing between them: every directory read gives a period "without hyphen" (the
 * file header quotes each entry).
 */
export const EDIFACT_DTM_GRAMMAR: Readonly<Record<EdifactDtmFormat, RegExp>> =
  grammarsOf<EdifactDtmFormat>(EDIFACT_DTM_LAYOUT, "");

/**
 * The 10 X12 1250 codes GMT reads: a date (`D8`, `DB`), a date and time (`DT`, `RTS`), a time
 * (`TM`, `TS`), a range of dates (`RD8`, `RD`) and a range of date-times (`RDT`, `DTS`).
 *
 * The other 32 of the 42 codes return the sentinel; the file header lists the ones cut and why.
 * `TS` is also a code of data element 623, with an unrelated meaning there.
 */
export const X12_DATE_TIME_PERIOD_FORMATS: readonly X12DateTimePeriodFormat[] =
  ["D8", "DB", "DT", "RTS", "TM", "TS", "RD8", "RD", "RDT", "DTS"];

/**
 * X12 1250 code → its kind and its value's parts. Typed kind by kind from the public unions, so
 * a missing code, and a code filed under a kind its union does not name, both fail typecheck.
 */
const X12_DATE_TIME_PERIOD_LAYOUT: {
  readonly [Code in X12DateFormat]: EdiLayout<"date">;
} & {
  readonly [Code in X12TimeFormat]: EdiLayout<"time">;
} & { readonly [Code in X12DateTimeFormat]: EdiLayout<"dateTime"> } & {
  readonly [Code in X12DateRangeFormat]: EdiLayout<"dateRange">;
} & { readonly [Code in X12DateTimeRangeFormat]: EdiLayout<"dateTimeRange"> } =
  {
    // D8 CCYYMMDD — "Date Expressed in Format CCYYMMDD"
    D8: { kind: "date", start: ["CCYY", "MM", "DD"] },
    // DB MMDDCCYY — "Date Expressed in Format MMDDCCYY"
    DB: { kind: "date", start: ["MM", "DD", "CCYY"] },
    // DT CCYYMMDDHHMM — "Date and Time Expressed in Format CCYYMMDDHHMM"
    DT: { kind: "dateTime", start: ["CCYY", "MM", "DD", "HH", "MI"] },
    // RTS CCYYMMDDHHMMSS — "Date and Time Expressed in Format CCYYMMDDHHMMSS" (one date-time despite the R)
    RTS: { kind: "dateTime", start: ["CCYY", "MM", "DD", "HH", "MI", "SS"] },
    // TM HHMM — "Time Expressed in Format HHMM"
    TM: { kind: "time", start: ["HH", "MI"] },
    // TS HHMMSS — "Time Expressed in Format HHMMSS"
    TS: { kind: "time", start: ["HH", "MI", "SS"] },
    // RD8 CCYYMMDD-CCYYMMDD — "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD"
    RD8: {
      kind: "dateRange",
      start: ["CCYY", "MM", "DD"],
      end: ["CCYY", "MM", "DD"],
    },
    // RD MMDDCCYY-MMDDCCYY — "Range of Dates Expressed in Format MMDDCCYY-MMDDCCYY"
    RD: {
      kind: "dateRange",
      start: ["MM", "DD", "CCYY"],
      end: ["MM", "DD", "CCYY"],
    },
    // RDT CCYYMMDDHHMM-CCYYMMDDHHMM — "Range of Date and Time, Expressed in Format CCYYMMDDHHMM-CCYYMMDDHHMM"
    RDT: {
      kind: "dateTimeRange",
      start: ["CCYY", "MM", "DD", "HH", "MI"],
      end: ["CCYY", "MM", "DD", "HH", "MI"],
    },
    // DTS CCYYMMDDHHMMSS-CCYYMMDDHHMMSS — "Range of Date and Time Expressed in Format CCYYMMDDHHMMSS-CCYYMMDDHHMMSS" (a range despite having no R)
    DTS: {
      kind: "dateTimeRange",
      start: ["CCYY", "MM", "DD", "HH", "MI", "SS"],
      end: ["CCYY", "MM", "DD", "HH", "MI", "SS"],
    },
  };

/**
 * X12 1250 code → the anchored, flagless grammar of its value. A range's halves are joined by
 * exactly one hyphen, the one X12 transmits.
 */
export const X12_DATE_TIME_PERIOD_GRAMMAR: Readonly<
  Record<X12DateTimePeriodFormat, RegExp>
> = grammarsOf<X12DateTimePeriodFormat>(X12_DATE_TIME_PERIOD_LAYOUT, "-");

/**
 * X12 data element 337 (Time), the time element of `AT7`, `G62` and `DTM-03`: "Time expressed in
 * 24-hour clock time as follows: HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD, where H = hours
 * (00-23), M = minutes (00-59), S = integer seconds (00-59) and DD = decimal seconds; decimal
 * seconds are expressed as follows: D = tenths (0-9) and DD = hundredths (00-99)", length 4 to 8
 * (release 005010, https://www.stedi.com/edi/x12-005010/element/337). Not a 1250 value: its
 * four- and six-digit forms coincide with `TM` and `TS`, and no 1250 code holds decimal seconds.
 * Built from the same fragments as the 1250 masks.
 *
 * Capture groups: 1 hour, 2 minute, 3 second (absent for `HHMM`), 4 decimal seconds (absent, one
 * digit of tenths, or two digits of hundredths).
 */
export const X12_TIME_GRAMMAR: RegExp = new RegExp(
  `^${FRAGMENT.HH}${FRAGMENT.MI}(?:${FRAGMENT.SS}(\\d{1,2})?)?$`,
);

/**
 * The 56 X12 623 codes, release 008010, in dictionary order: `01`–`12` (UTC+1 … UTC+12), `13`–`24`
 * (UTC−12 … UTC−1, descending), `25`–`29` (the half-hour offsets, added in release 006010), then
 * the 27 letter codes. Release 005010 has the 51 codes other than `25`–`29`. Membership is by
 * this list, never by shape. `TS`, `TT`, `CD` and `MD` are also codes of data element 1250, with
 * unrelated meanings there.
 */
export const X12_TIME_CODES: readonly X12TimeCode[] = [
  // fallow-ignore-next-line code-duplication -- the 56 DE 623 codes as a runtime list; `X12TimeCode` in types/edi.ts is the same enumeration in type position
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "AD",
  "AS",
  "AT",
  "CD",
  "CS",
  "CT",
  "ED",
  "ES",
  "ET",
  "GM",
  "HD",
  "HS",
  "HT",
  "LT",
  "MD",
  "MS",
  "MT",
  "ND",
  "NS",
  "NT",
  "PD",
  "PS",
  "PT",
  "TD",
  "TS",
  "TT",
  "UT",
];

/** One standard's codes: the layout and grammar tables, and what joins a range on the wire. */
interface EdiCodeTable {
  readonly layouts: Readonly<Record<string, EdiLayout>>;
  readonly grammars: Readonly<Record<string, RegExp>>;
  readonly rangeSeparator: string;
}

const EDI_CODE_TABLES: Readonly<Record<EdiStandard, EdiCodeTable>> = {
  edifact: {
    layouts: EDIFACT_DTM_LAYOUT,
    grammars: EDIFACT_DTM_GRAMMAR,
    // UNTDID 2379, every directory read (twelve, from D.93A to D.22B): a period is given
    // "without hyphen".
    rangeSeparator: "",
  },
  x12: {
    layouts: X12_DATE_TIME_PERIOD_LAYOUT,
    grammars: X12_DATE_TIME_PERIOD_GRAMMAR,
    // X12 1250: each range definition gives the format with its hyphen.
    rangeSeparator: "-",
  },
};

/**
 * Look a format code up in its standard's tables: the one lookup the classifier, the reader and
 * the writer share.
 *
 * - Matching is exact and by own key, so `"__proto__"`, `" 102"` and `"d8"` are not codes.
 * - Null for a code that is not read (`101`, `209`, `D6`, `UN`), like an unknown code.
 * - Null for a standard that is not `"edifact"` or `"x12"`, and for a non-string argument.
 *
 * @param standard which element the code belongs to
 * @param code the 2379 or 1250 format code
 * @returns the code's kind, layout, grammar and range separator, or null
 *
 * @example ediCodeOf("edifact", "718") // { kind: "datePeriod", valueKind: "date", layout: { kind: "datePeriod", start: ["CCYY", "MM", "DD"], end: [...] }, grammar: /^…$/, rangeSeparator: "" }
 * @example ediCodeOf("x12", "RD8") // { kind: "dateRange", valueKind: "date", layout: {...}, grammar: /^…$/, rangeSeparator: "-" }
 * @example ediCodeOf("edifact", "101") // null (a two-digit year: not read)
 * @example ediCodeOf("edifact", "D8") // null (an X12 code)
 */
export function ediCodeOf(standard: unknown, code: unknown): EdiCode | null {
  if (typeof standard !== "string" || typeof code !== "string") {
    return null;
  }
  if (!Object.hasOwn(EDI_CODE_TABLES, standard)) {
    return null;
  }
  const table = EDI_CODE_TABLES[standard as EdiStandard];
  if (!Object.hasOwn(table.layouts, code)) {
    return null;
  }
  const layout = table.layouts[code];
  const grammar = table.grammars[code];
  return {
    kind: layout.kind,
    valueKind: VALUE_KIND[layout.kind],
    layout,
    grammar,
    rangeSeparator: table.rangeSeparator,
  };
}

/**
 * Look a format code up as a code of one kind: null unless the code is in its standard's tables
 * under exactly that kind. Each public function names its own kind here, so a code of another
 * kind (`203` given to a date function) is refused before any value is read.
 *
 * @param standard which element the code belongs to
 * @param kind the kind of value the calling function reads or writes
 * @param code the 2379 or 1250 format code
 * @returns the code's entry, or null when the code is not one of that kind
 *
 * @example ediCodeOfKind("edifact", "date", "102") // { kind: "date", … }
 * @example ediCodeOfKind("edifact", "date", "203") // null (a date-time code)
 * @example ediCodeOfKind("x12", "dateRange", "RD8") // { kind: "dateRange", … }
 */
export function ediCodeOfKind(
  standard: EdiStandard,
  kind: EdiKind,
  code: unknown,
): EdiCode | null {
  const entry = ediCodeOf(standard, code);
  return entry !== null && entry.kind === kind ? entry : null;
}
