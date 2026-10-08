/*
 * The fixed digit-order grammars of UN/EDIFACT data element 2379 (Date or time or period format
 * code), X12 data element 1250 (Date Time Period Format Qualifier) and X12 data element 337
 * (Time), and the code list of X12 data element 623 (Time Code). Private: a value-plus-code
 * grammar is a two-argument relation, so its public form is the validator function
 * (`isValidEdifactDtm(value, code)`), never a constant per code.
 *
 * Sources:
 * - UNTDID data element 2379. UNECE's own directory page, D.21B, as archived:
 *   http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm
 *   Earlier directories were read from the stylusstudio
 *   (https://www.stylusstudio.com/edifact/D04B/2379.htm) and edifactory
 *   (https://www.edifactory.de/edifact/directory/D13B/data-element/2379) mirrors. Each entry's
 *   comment quotes the directory's mask and description; codes 206–209 first appear in D.12A.
 * - A 2379 period is transmitted without a hyphen. Every directory read (twelve, from D.93A to
 *   D.22B) says so. D.93A to D.01B: 713 and 717 "Format of period to be given in actual message
 *   without hyphen."; 718 "Format of period to be given without hyphen." From D.01C: 713, 717
 *   and 718 "Data is to be transmitted as consecutive characters without hyphen." 719, in every
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
 *   and are not valid in an 004010 or 005010 interchange. `x12TimeCode` takes no release, so it
 *   reads the superset.
 * - The three-character `ZZZ` of 2379 codes 301–304 and 404, which no directory defines beyond
 *   "Z = Time zone". It has three outcomes, and anything else is rejected (**GMT rule**):
 *   1. `[+-]HH`, hour 00–23, is an offset: UN/ECE Recommendation 7 (1988) ¶12 appends the
 *      difference from UTC "in hours and minutes, or hours only, with a leading "+" or "-" sign"
 *      (`+01`, `-05`).
 *   2. The literals `UTC` and `GMT` are +00:00: the SMDG IFTSAI 2.0 and BAPLIE 3.1.1 guides write
 *      `UTC` in a 303 value, and Recommendation 7 ¶12 names one scale by both names,
 *      "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)".
 *   3. Any other three upper-case letters (`CET`, `PDT`) are zone text the reader returns unread:
 *      no UN/EDIFACT text defines an abbreviation, so GMT asserts nothing about one.
 *   A field led by a sign, or holding a digit, that is not a valid signed hour (`+24`, `-99`,
 *   `000`) is a broken offset, not a zone name. Lower case is rejected because every published
 *   example is upper case, not because the syntax rules forbid it: the level A character set
 *   (UNTDID Part 4, Chapter 2.2, §5.1) is upper case only, and level B (§5.2) includes lower
 *   case. A lone `Z` is rejected: Recommendation 7 ¶12 does write UTC as the single letter `Z`,
 *   but the mask has three characters, a variable-length element carries no trailing spaces
 *   (syntax rules §7: "leading zeroes and trailing spaces shall be suppressed"), and no guide
 *   writes it.
 *
 * Every grammar proves shape only: month 01–12, day 01–31, hour 00–23, minute and second 00–59,
 * ordinal day 001–366. Whether the day exists in its month, or day 366 in its year, is Temporal's
 * (`ediDateTimeFields.ts`, `overflow: "reject"`).
 *
 * One table per standard describes each code as its parts in mask order; the regex, the field
 * reader (`ediDateTimeFields.ts`) and the writer (`ediDateTimeWriter.ts`) are all derived from it,
 * so a grammar, the fields it yields and the digits written for it cannot drift apart.
 */
import type {
  EdifactDtmFormat,
  X12DateTimePeriodFormat,
  X12TimeCode,
} from "../types/edi";

/**
 * One field of a mask, named as the standards print it. Each part is one capture group. The
 * standards write `MM` for both month and minute; `MI` is this file's name for the minute. `ZS`,
 * `ZH` and `ZM` are the sign, hours and minutes of the `ZHHMM` offset of codes 205–209 and 406.
 */
export type EdiPart =
  | "CCYY"
  | "YY"
  | "Y"
  | "MM"
  | "DD"
  | "HH"
  | "MI"
  | "SS"
  | "DDD"
  | "ZS"
  | "ZH"
  | "ZM"
  | "ZZZ";

/** A code's value: its parts in mask order, and for a period or range the end's parts too. */
export interface EdiLayout {
  readonly start: readonly EdiPart[];
  readonly end?: readonly EdiPart[];
}

/** The standard a format code belongs to. */
export type EdiStandard = "edifact" | "x12";

/** One format code of one standard, as the reader and the writer both look it up. */
export interface EdiCode {
  /** The code's parts in mask order. */
  readonly layout: EdiLayout;
  /** The anchored grammar of the code's value. */
  readonly grammar: RegExp;
  /** What the standard transmits between the halves of a period or range. */
  readonly rangeSeparator: string;
}

/** Hour, 00–23. */
const HH = "([01][0-9]|2[0-3])";
/** Minute, 00–59. */
const MI = "([0-5][0-9])";

/** The regex source of each part: one capture group, the field's whole range of digits. */
const FRAGMENT: Readonly<Record<EdiPart, string>> = {
  // Century and year: four digits.
  CCYY: "(\\d{4})",
  // Year without century: two digits. The reader resolves the century in the caller's window.
  YY: "(\\d{2})",
  // The last digit of the year (X12 EH).
  Y: "(\\d)",
  // Month, 01–12.
  MM: "(0[1-9]|1[0-2])",
  // Day of month, 01–31.
  DD: "(0[1-9]|[12][0-9]|3[01])",
  HH,
  MI,
  // Second, 00–59. `60` does not match: GMT rejects a leap second, which Temporal would read as 59.
  SS: "([0-5][0-9])",
  // Day of year, 001–366.
  DDD: "(00[1-9]|0[1-9][0-9]|[12][0-9][0-9]|3[0-5][0-9]|36[0-6])",
  // 2379 codes 205–209 and 406: "Z is plus (+) or minus (-)", then hours and minutes.
  ZS: "([+-])",
  ZH: HH,
  ZM: MI,
  // 2379 codes 301–304 and 404: a signed hour `[+-]HH`, 00–23 (Rec 7 ¶12), or three upper-case
  // letters. The reader resolves `UTC` and `GMT` to +00:00 and returns any other letters as raw
  // zone text. Nothing else is a zone: a sign or a digit outside a valid signed hour (`+24`,
  // `000`) is a broken offset, not a name, and neither lower case nor a lone `Z` is read (GMT
  // rule; see the file header).
  ZZZ: "([+-](?:[01][0-9]|2[0-3])|[A-Z]{3})",
};

/** The `ZHHMM` offset of 2379 codes 205–209 and 406: sign, hours, minutes. */
const ZHHMM: readonly EdiPart[] = ["ZS", "ZH", "ZM"];

/** The parts' sources joined, anchored, flagless; a period's halves joined by `join`. */
function grammarOf(layout: EdiLayout | null, join: string): RegExp {
  if (layout === null) {
    // "Unstructured": no grammar can read it, so nothing matches.
    return /^(?!)$/;
  }
  const source = (parts: readonly EdiPart[]): string =>
    parts.map((part) => FRAGMENT[part]).join("");
  const end = layout.end === undefined ? "" : `${join}${source(layout.end)}`;
  return new RegExp(`^${source(layout.start)}${end}$`);
}

/** A grammar table from a layout table, in the layout table's key order. */
function grammarsOf<Code extends string>(
  layouts: Readonly<Record<Code, EdiLayout | null>>,
  join: string,
): Readonly<Record<Code, RegExp>> {
  const grammars: Partial<Record<Code, RegExp>> = {};
  for (const code of Object.keys(layouts) as Code[]) {
    grammars[code] = grammarOf(layouts[code], join);
  }
  return grammars as Readonly<Record<Code, RegExp>>;
}

/**
 * The 23 UNTDID 2379 codes GMT reads, in directory order: a date (`101`, `102`), a date and time
 * (`201`–`204`), a date and time with a `ZHHMM` offset (`205`–`208`), a time with one (`209`), a
 * date and time with three zone characters (`301`–`304`), a time (`401`, `402`), a time with
 * three zone characters (`404`), an offset alone (`406`) and a period (`713`, `717`–`719`).
 *
 * Every other 2379 code returns the sentinel. Not read, among others: the day-first and
 * month-first forms (`2`–`5`), `10` (`CCYYMMDDTHHMM`), the week date `103`, the ordinal date
 * `105`, the time period with offsets `210`, the milliseconds form `307`, the zoned period `308`,
 * the time spans `501`–`503`, and `711` (`CCYYMMDD-CCYYMMDD`, in the directories up to D.03A and
 * removed in D.03B; `718` has the same mask). Every period read (`713`, `717`–`719`) carries a
 * date in both halves, so no 2379 time-only range is read; X12's `RTM` is the only one.
 */
export const EDIFACT_DTM_FORMATS: readonly EdifactDtmFormat[] = [
  "101",
  "102",
  "201",
  "202",
  "203",
  "204",
  "205",
  "206",
  "207",
  "208",
  "209",
  "301",
  "302",
  "303",
  "304",
  "401",
  "402",
  "404",
  "406",
  "713",
  "717",
  "718",
  "719",
];

/** The 2379 codes whose mask carries `YY` with no `CC`: each needs the caller's `yearWindow`. */
export const EDIFACT_TWO_DIGIT_YEAR_FORMATS: readonly EdifactDtmFormat[] = [
  "101",
  "201",
  "202",
  "206",
  "207",
  "301",
  "302",
  "713",
  "717",
];

/** UNTDID 2379 code → its value's parts. Typed so a missing code fails typecheck. */
const EDIFACT_DTM_LAYOUT: Readonly<Record<EdifactDtmFormat, EdiLayout>> = {
  // 101 YYMMDD — "Calendar date: Y = Year; M = Month; D = Day."
  "101": { start: ["YY", "MM", "DD"] },
  // 102 CCYYMMDD — "Calendar date: C = Century ; Y = Year ; M = Month ; D = Day."
  "102": { start: ["CCYY", "MM", "DD"] },
  // 201 YYMMDDHHMM — "Calendar date including time without seconds"
  "201": { start: ["YY", "MM", "DD", "HH", "MI"] },
  // 202 YYMMDDHHMMSS — "Calendar date including time with seconds"
  "202": { start: ["YY", "MM", "DD", "HH", "MI", "SS"] },
  // 203 CCYYMMDDHHMM — "Calendar date including time with minutes"
  "203": { start: ["CCYY", "MM", "DD", "HH", "MI"] },
  // 204 CCYYMMDDHHMMSS — "Calendar date including time with seconds"
  "204": { start: ["CCYY", "MM", "DD", "HH", "MI", "SS"] },
  // 205 CCYYMMDDHHMMZHHMM — "Calendar date including time and time zone expressed in hours and minutes."
  "205": { start: ["CCYY", "MM", "DD", "HH", "MI", ...ZHHMM] },
  // 206 YYMMDDHHMMZHHMM — "Calendar date including time without seconds, with Time Zone: … Z = leading plus/minus sign, HHMM = difference to UTC in Hours and Minutes." (D.12A on)
  "206": { start: ["YY", "MM", "DD", "HH", "MI", ...ZHHMM] },
  // 207 YYMMDDHHMMSSZHHMM — "Calendar date including time with seconds, with Time Zone: …" (D.12A on)
  "207": { start: ["YY", "MM", "DD", "HH", "MI", "SS", ...ZHHMM] },
  // 208 CCYYMMDDHHMMSSZHHMM — "Calendar date including time with seconds, with Time Zone: …" (D.12A on)
  "208": { start: ["CCYY", "MM", "DD", "HH", "MI", "SS", ...ZHHMM] },
  // 209 HHMMSSZHHMM — "Time with seconds and with Time Zone: …" (D.12A on)
  "209": { start: ["HH", "MI", "SS", ...ZHHMM] },
  // 301 YYMMDDHHMMZZZ — "See 201 + Z = Time zone."
  "301": { start: ["YY", "MM", "DD", "HH", "MI", "ZZZ"] },
  // 302 YYMMDDHHMMSSZZZ — "See 202 + Z = Time zone."
  "302": { start: ["YY", "MM", "DD", "HH", "MI", "SS", "ZZZ"] },
  // 303 CCYYMMDDHHMMZZZ — "See 203 plus Z=Time zone."
  "303": { start: ["CCYY", "MM", "DD", "HH", "MI", "ZZZ"] },
  // 304 CCYYMMDDHHMMSSZZZ — "See 204 plus Z=Time zone."
  "304": { start: ["CCYY", "MM", "DD", "HH", "MI", "SS", "ZZZ"] },
  // 401 HHMM — "Time without seconds: H = Hour; m = Minute."
  "401": { start: ["HH", "MI"] },
  // 402 HHMMSS — "Time with seconds: H = Hour; m = Minute; s = Seconds."
  "402": { start: ["HH", "MI", "SS"] },
  // 404 HHMMSSZZZ — "See 402 plus Z=Time zone."
  "404": { start: ["HH", "MI", "SS", "ZZZ"] },
  // 406 ZHHMM — "Offset from Coordinated Universal Time (UTC) where Z is plus (+) or minus (-)."
  "406": { start: ZHHMM },
  // 713 YYMMDDHHMM-YYMMDDHHMM — "A period of time specified by giving the start time followed by the end time (format year, month, day, hour and minute)."
  "713": {
    start: ["YY", "MM", "DD", "HH", "MI"],
    end: ["YY", "MM", "DD", "HH", "MI"],
  },
  // 717 YYMMDD-YYMMDD — "A period of time specified by giving the start date followed by the end date (both not including century)."
  "717": { start: ["YY", "MM", "DD"], end: ["YY", "MM", "DD"] },
  // 718 CCYYMMDD-CCYYMMDD — "A period of time specified by giving the start date followed by the end date (both including century)."
  "718": { start: ["CCYY", "MM", "DD"], end: ["CCYY", "MM", "DD"] },
  // 719 CCYYMMDDHHMM-CCYYMMDDHHMM — "A period of time which includes the century, year, month, day, hour and minute."
  "719": {
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
  grammarsOf(EDIFACT_DTM_LAYOUT, "");

/**
 * The 21 X12 1250 codes GMT names: the 20 it reads (a date, a time, a date and time, a day of the
 * year, or a range of those) and `UN`, which a validator can name and which never parses.
 *
 * The other 21 of the 42 codes return the sentinel: `CC`, `CD`, `CM`, `CQ`, `CY`, `DA`, `DD`,
 * `KA`, `MCY`, `MD`, `MM`, `RD2`, `RD4`, `RD5`, `RDM`, `RMD`, `RMY`, `TQ`, `YM`, `YMM` and `YY`.
 * `TS`, `TT`, `CD` and `MD` are also codes of data element 623, with unrelated meanings there.
 */
export const X12_DATE_TIME_PERIOD_FORMATS: readonly X12DateTimePeriodFormat[] =
  [
    "D6",
    "D8",
    "DB",
    "TT",
    "DT",
    "TR",
    "RTS",
    "TM",
    "TS",
    "RD6",
    "RD8",
    "RD",
    "RDT",
    "DTS",
    "DDT",
    "DTD",
    "RTM",
    "TC",
    "TU",
    "EH",
    "UN",
  ];

/** The 1250 codes whose mask carries `YY` with no `CC`: each needs the caller's `yearWindow`. */
export const X12_TWO_DIGIT_YEAR_FORMATS: readonly X12DateTimePeriodFormat[] = [
  "D6",
  "TT",
  "TR",
  "RD6",
  "TU",
];

/**
 * X12 1250 code → its value's parts. Typed so a missing code fails typecheck. `UN`
 * ("Unstructured") is `null`: no grammar can read it, so a lookup never guesses a format.
 */
const X12_DATE_TIME_PERIOD_LAYOUT: Readonly<
  Record<X12DateTimePeriodFormat, EdiLayout | null>
> = {
  // D6 YYMMDD — "Date Expressed in Format YYMMDD"
  D6: { start: ["YY", "MM", "DD"] },
  // D8 CCYYMMDD — "Date Expressed in Format CCYYMMDD"
  D8: { start: ["CCYY", "MM", "DD"] },
  // DB MMDDCCYY — "Date Expressed in Format MMDDCCYY"
  DB: { start: ["MM", "DD", "CCYY"] },
  // TT MMDDYY — "Date Expressed in Format MMDDYY"
  TT: { start: ["MM", "DD", "YY"] },
  // DT CCYYMMDDHHMM — "Date and Time Expressed in Format CCYYMMDDHHMM"
  DT: { start: ["CCYY", "MM", "DD", "HH", "MI"] },
  // TR DDMMYYHHMM — "Date and Time Expressed in Format DDMMYYHHMM"
  TR: { start: ["DD", "MM", "YY", "HH", "MI"] },
  // RTS CCYYMMDDHHMMSS — "Date and Time Expressed in Format CCYYMMDDHHMMSS" (one date-time despite the R)
  RTS: { start: ["CCYY", "MM", "DD", "HH", "MI", "SS"] },
  // TM HHMM — "Time Expressed in Format HHMM"
  TM: { start: ["HH", "MI"] },
  // TS HHMMSS — "Time Expressed in Format HHMMSS"
  TS: { start: ["HH", "MI", "SS"] },
  // RD6 YYMMDD-YYMMDD — "Range of Dates Expressed in Format YYMMDD-YYMMDD"
  RD6: { start: ["YY", "MM", "DD"], end: ["YY", "MM", "DD"] },
  // RD8 CCYYMMDD-CCYYMMDD — "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD"
  RD8: { start: ["CCYY", "MM", "DD"], end: ["CCYY", "MM", "DD"] },
  // RD MMDDCCYY-MMDDCCYY — "Range of Dates Expressed in Format MMDDCCYY-MMDDCCYY"
  RD: { start: ["MM", "DD", "CCYY"], end: ["MM", "DD", "CCYY"] },
  // RDT CCYYMMDDHHMM-CCYYMMDDHHMM — "Range of Date and Time, Expressed in Format CCYYMMDDHHMM-CCYYMMDDHHMM"
  RDT: {
    start: ["CCYY", "MM", "DD", "HH", "MI"],
    end: ["CCYY", "MM", "DD", "HH", "MI"],
  },
  // DTS CCYYMMDDHHMMSS-CCYYMMDDHHMMSS — "Range of Date and Time Expressed in Format CCYYMMDDHHMMSS-CCYYMMDDHHMMSS" (a range despite having no R)
  DTS: {
    start: ["CCYY", "MM", "DD", "HH", "MI", "SS"],
    end: ["CCYY", "MM", "DD", "HH", "MI", "SS"],
  },
  // DDT CCYYMMDD-CCYYMMDDHHMM — "Range of Dates and Time, Expressed in CCYYMMDD-CCYYMMDDHHMM"
  DDT: { start: ["CCYY", "MM", "DD"], end: ["CCYY", "MM", "DD", "HH", "MI"] },
  // DTD CCYYMMDDHHMM-CCYYMMDD — "Range of Dates and Time, Expressed in CCYYMMDDHHMM-CCYYMMDD"
  DTD: { start: ["CCYY", "MM", "DD", "HH", "MI"], end: ["CCYY", "MM", "DD"] },
  // RTM HHMM-HHMM — "Range of Time Expressed in Format HHMM-HHMM"
  RTM: { start: ["HH", "MI"], end: ["HH", "MI"] },
  // TC DDD — "Julian Date Expressed in Format DDD"
  TC: { start: ["DDD"] },
  // TU YYDDD — "Date Expressed in Format YYDDD"
  TU: { start: ["YY", "DDD"] },
  // EH YDDD — "Last Digit of Year and Julian Date Expressed in Format YDDD"
  EH: { start: ["Y", "DDD"] },
  // UN — "Unstructured"
  UN: null,
};

/**
 * X12 1250 code → the anchored, flagless grammar of its value. A range's halves are joined by
 * exactly one hyphen, the one X12 transmits. `UN` matches nothing.
 */
export const X12_DATE_TIME_PERIOD_GRAMMAR: Readonly<
  Record<X12DateTimePeriodFormat, RegExp>
> = grammarsOf(X12_DATE_TIME_PERIOD_LAYOUT, "-");

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
  readonly layouts: Readonly<Record<string, EdiLayout | null>>;
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
 * Look a format code up in its standard's tables: the one lookup the reader and the writer share.
 *
 * - Matching is exact and by own key, so `"__proto__"`, `" 102"` and `"d8"` are not codes.
 * - `UN` ("Unstructured") is a 1250 code with no layout: it is null here, like an unknown code.
 * - Null for a standard that is not `"edifact"` or `"x12"`, and for a non-string argument.
 *
 * @param standard which element the code belongs to
 * @param code the 2379 or 1250 format code
 * @returns the code's layout, grammar and range separator, or null
 *
 * @example ediCodeOf("edifact", "718") // { layout: { start: ["CCYY", "MM", "DD"], end: [...] }, grammar: /^…$/, rangeSeparator: "" }
 * @example ediCodeOf("x12", "RD8") // { layout: {...}, grammar: /^…$/, rangeSeparator: "-" }
 * @example ediCodeOf("x12", "UN") // null (no layout)
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
  return layout === null || layout === undefined || grammar === undefined
    ? null
    : { layout, grammar, rangeSeparator: table.rangeSeparator };
}
