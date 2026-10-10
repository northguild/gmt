import type {
  EdifactDateFormat,
  EdifactDatePeriodFormat,
  EdifactDateTimeFormat,
  EdifactDateTimePeriodFormat,
  EdifactDtmFormat,
  EdifactOffsetDateTimeFormat,
  EdifactTimeFormat,
  X12DateFormat,
  X12DateRangeFormat,
  X12DateTimeFormat,
  X12DateTimePeriodFormat,
  X12DateTimeRangeFormat,
  X12TimeFormat,
} from "../types/edi";
import type { X12DateTimePeriodKind } from "../internal/ediGrammar";
import type { EdifactDtmKind } from "../internal/ediGrammar";
import { hostileProxy, revokedProxy } from "./noThrow";

/**
 * The code tables the EDI tests share, written by hand from UNTDID data element 2379 and X12
 * data element 1250 and never read from the code under test.
 */

/**
 * Values that are not strings, each named for the failure message. Built per use: a Proxy that
 * throws on every trap reaches the catch path, where the others stop at the `typeof` guard.
 */
export const NON_STRINGS: [string, () => unknown][] = [
  ["null", () => null],
  ["undefined", () => undefined],
  ["a number", () => 20240615],
  ["a boolean", () => true],
  ["an array holding a string", () => ["20240615"]],
  ["an object", () => ({})],
  // `typeof` is "object": a String object is not a string, although it reads as one.
  ["a String object", () => new String("20240615")],
  ["a bigint", () => 20240615n],
  // A symbol throws a TypeError when it is read as a string.
  ["a symbol", () => Symbol("20240615")],
  ["a function", () => () => "20240615"],
  ["a Proxy that throws on any trap", hostileProxy],
  ["a revoked Proxy", revokedProxy],
];

/**
 * The kind of value each supported 2379 code states, from its mask: `102` is `CCYYMMDD`, a date;
 * `205` is `CCYYMMDDHHMMZHHMM`, a date and time with an offset; `718` is two dates. Typed kind by
 * kind from the public unions, so the table and the unions cannot disagree in either direction.
 */
export const EDIFACT_FORMAT_KINDS: Record<EdifactDateFormat, "date"> &
  Record<EdifactTimeFormat, "time"> &
  Record<EdifactDateTimeFormat, "dateTime"> &
  Record<EdifactOffsetDateTimeFormat, "offsetDateTime"> &
  Record<EdifactDatePeriodFormat, "datePeriod"> &
  Record<EdifactDateTimePeriodFormat, "dateTimePeriod"> = {
  "102": "date",
  "203": "dateTime",
  "204": "dateTime",
  "205": "offsetDateTime",
  "208": "offsetDateTime",
  "303": "offsetDateTime",
  "304": "offsetDateTime",
  "401": "time",
  "402": "time",
  "718": "datePeriod",
  "719": "dateTimePeriod",
};

/** The kind of value each supported 1250 code states, from its mask. Typed as the table above. */
export const X12_FORMAT_KINDS: Record<X12DateFormat, "date"> &
  Record<X12TimeFormat, "time"> &
  Record<X12DateTimeFormat, "dateTime"> &
  Record<X12DateRangeFormat, "dateRange"> &
  Record<X12DateTimeRangeFormat, "dateTimeRange"> = {
  D8: "date",
  DB: "date",
  DT: "dateTime",
  RTS: "dateTime",
  TM: "time",
  TS: "time",
  RD8: "dateRange",
  RD: "dateRange",
  RDT: "dateTimeRange",
  DTS: "dateTimeRange",
};

/** The supported 2379 codes of one kind, in directory order. */
export function edifactFormatsOf(kind: EdifactDtmKind): EdifactDtmFormat[] {
  return (Object.keys(EDIFACT_FORMAT_KINDS) as EdifactDtmFormat[]).filter(
    (code) => EDIFACT_FORMAT_KINDS[code] === kind,
  );
}

/** The supported 1250 codes of one kind. */
export function x12FormatsOf(
  kind: X12DateTimePeriodKind,
): X12DateTimePeriodFormat[] {
  return (Object.keys(X12_FORMAT_KINDS) as X12DateTimePeriodFormat[]).filter(
    (code) => X12_FORMAT_KINDS[code] === kind,
  );
}

/** A code no function reads, with a value that fits the standard's mask for it and the reason. */
export interface UnreadCode {
  code: string;
  /** A value in the code's own mask, so the sentinel is for the code and not for the value. */
  value: string;
  reads: string;
}

/**
 * The 2379 codes cut from the EDI functions: nine with a two-digit year, and three that state no
 * date, time, date-time or instant. `value` is 15 June 2024 at 14:30 (and 45 seconds, at +02:00)
 * under the directory's mask for the code.
 */
export const CUT_EDIFACT_FORMATS: UnreadCode[] = [
  { code: "101", value: "240615", reads: "YYMMDD: a two-digit year" },
  { code: "201", value: "2406151430", reads: "YYMMDDHHMM: a two-digit year" },
  {
    code: "202",
    value: "240615143045",
    reads: "YYMMDDHHMMSS: a two-digit year",
  },
  {
    code: "206",
    value: "2406151430+0200",
    reads: "YYMMDDHHMMZHHMM: a two-digit year",
  },
  {
    code: "207",
    value: "240615143045+0200",
    reads: "YYMMDDHHMMSSZHHMM: a two-digit year",
  },
  {
    code: "301",
    value: "2406151430+02",
    reads: "YYMMDDHHMMZZZ: a two-digit year",
  },
  {
    code: "302",
    value: "240615143045+02",
    reads: "YYMMDDHHMMSSZZZ: a two-digit year",
  },
  {
    code: "713",
    value: "24061514302406201600",
    reads: "YYMMDDHHMM-YYMMDDHHMM: a two-digit year",
  },
  {
    code: "717",
    value: "240615240620",
    reads: "YYMMDD-YYMMDD: a two-digit year",
  },
  {
    code: "209",
    value: "143045+0200",
    reads: "HHMMSSZHHMM: a time with an offset and no date",
  },
  {
    code: "404",
    value: "143045+02",
    reads: "HHMMSSZZZ: a time with a zone and no date",
  },
  { code: "406", value: "+0200", reads: "ZHHMM: an offset alone" },
];

/**
 * The 1250 codes cut from the EDI functions: five with a two-digit year, and six that state no
 * date, time, date-time or range of one kind. `value` is 15 June 2024 (day 167 of a leap year)
 * under the dictionary's mask for the code.
 */
export const CUT_X12_FORMATS: UnreadCode[] = [
  { code: "D6", value: "240615", reads: "YYMMDD: a two-digit year" },
  { code: "TT", value: "061524", reads: "MMDDYY: a two-digit year" },
  { code: "TR", value: "1506241430", reads: "DDMMYYHHMM: a two-digit year" },
  {
    code: "RD6",
    value: "240615-240620",
    reads: "YYMMDD-YYMMDD: a two-digit year",
  },
  { code: "TU", value: "24167", reads: "YYDDD: a two-digit year" },
  { code: "TC", value: "167", reads: "DDD: a day of the year with no year" },
  {
    code: "EH",
    value: "4167",
    reads: "YDDD: a day of the year with one digit of the year",
  },
  {
    code: "DDT",
    value: "20240615-202406201600",
    reads:
      "CCYYMMDD-CCYYMMDDHHMM: a date on one side, a date-time on the other",
  },
  {
    code: "DTD",
    value: "202406151430-20240620",
    reads:
      "CCYYMMDDHHMM-CCYYMMDD: a date-time on one side, a date on the other",
  },
  { code: "RTM", value: "0900-1700", reads: "HHMM-HHMM: a range of times" },
  { code: "UN", value: "20240615", reads: "Unstructured" },
];

/**
 * Codes that were never read: other 2379 and 1250 codes, the other standard's codes, and strings
 * that are not codes at all (matching is exact, and by own key).
 */
export const NOT_EDIFACT_FORMATS: { code: string; reads: string }[] = [
  { code: "2", reads: "a day-first or month-first date" },
  { code: "10", reads: "CCYYMMDDTHHMM" },
  { code: "103", reads: "the week date" },
  { code: "105", reads: "the ordinal date" },
  { code: "210", reads: "a time period with offsets" },
  { code: "307", reads: "a date and time with milliseconds" },
  { code: "308", reads: "a zoned period" },
  { code: "501", reads: "a time span" },
  { code: "602", reads: "a partial value" },
  { code: "711", reads: "CCYYMMDD-CCYYMMDD, removed in D.03B" },
  { code: "720", reads: "a weekday period" },
  { code: "801", reads: "a quantity" },
  { code: "999", reads: "not a 2379 code" },
  { code: "D8", reads: "an X12 1250 code" },
  { code: "", reads: "an empty code" },
  { code: "0102", reads: "102 with a leading zero" },
  { code: " 102", reads: "102 with a leading space" },
  { code: "102 ", reads: "102 with a trailing space" },
  { code: "constructor", reads: "an inherited property name" },
  { code: "toString", reads: "an inherited property name" },
  { code: "__proto__", reads: "an inherited property name" },
  { code: "hasOwnProperty", reads: "an inherited property name" },
];

/** As `NOT_EDIFACT_FORMATS`, for X12 data element 1250. */
export const NOT_X12_FORMATS: { code: string; reads: string }[] = [
  { code: "CC", reads: "a century" },
  { code: "CM", reads: "CCYYMM" },
  { code: "CY", reads: "a year" },
  { code: "MD", reads: "MMDD" },
  { code: "RD4", reads: "a range of years" },
  { code: "YM", reads: "YYMM" },
  { code: "YY", reads: "a two-digit year alone" },
  { code: "102", reads: "a UN/EDIFACT 2379 code" },
  { code: "", reads: "an empty code" },
  { code: "d8", reads: "lower case: matching is exact" },
  { code: " D8", reads: "D8 with a leading space" },
  { code: "D8 ", reads: "D8 with a trailing space" },
  { code: "D08", reads: "D8 with a zero" },
  { code: "constructor", reads: "an inherited property name" },
  { code: "toString", reads: "an inherited property name" },
  { code: "__proto__", reads: "an inherited property name" },
  { code: "hasOwnProperty", reads: "an inherited property name" },
];

/**
 * Every 2379 code a function of `kind` must refuse: the supported codes of every other kind, the
 * cut codes, and the codes that were never read.
 */
export function edifactFormatsOutside(
  kind: EdifactDtmKind,
): { code: string; reads: string }[] {
  const others = (Object.keys(EDIFACT_FORMAT_KINDS) as EdifactDtmFormat[])
    .filter((code) => EDIFACT_FORMAT_KINDS[code] !== kind)
    .map((code) => ({
      code,
      reads: `a ${EDIFACT_FORMAT_KINDS[code]} code`,
    }));
  return [...others, ...CUT_EDIFACT_FORMATS, ...NOT_EDIFACT_FORMATS];
}

/** As `edifactFormatsOutside`, for X12 data element 1250. */
export function x12FormatsOutside(
  kind: X12DateTimePeriodKind,
): { code: string; reads: string }[] {
  const others = (Object.keys(X12_FORMAT_KINDS) as X12DateTimePeriodFormat[])
    .filter((code) => X12_FORMAT_KINDS[code] !== kind)
    .map((code) => ({ code, reads: `a ${X12_FORMAT_KINDS[code]} code` }));
  return [...others, ...CUT_X12_FORMATS, ...NOT_X12_FORMATS];
}
