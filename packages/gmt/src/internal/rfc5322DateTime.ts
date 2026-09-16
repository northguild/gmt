import {
  ENGLISH_MONTH_NAMES,
  ENGLISH_WEEKDAY_NAMES,
} from "./englishCalendarNames";

/** Date-time fields read from an RFC 5322 `date-time`, before calendar validation. */
export interface Rfc5322DateTimeFields {
  /** ISO day of week 1 (Monday) – 7 (Sunday), when the input names one. */
  dayOfWeek: number | undefined;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** `±HH:MM`; `-0000` and every zone RFC 5322 maps to it are `+00:00`. */
  offset: string;
}

// RFC 5322 §4.3 obs-zone: UT/GMT and the North American zones, with the
// offsets that section gives them.
const NAMED_ZONE_OFFSETS: Readonly<Record<string, string>> = {
  UT: "+00:00",
  GMT: "+00:00",
  EST: "-05:00",
  EDT: "-04:00",
  CST: "-06:00",
  CDT: "-05:00",
  MST: "-07:00",
  MDT: "-06:00",
  PST: "-08:00",
  PDT: "-07:00",
};

// Stands in for a folded comment. NUL may appear in a message only as an
// obsolete quoted-pair inside a comment (obs-qp = "\" (%d0 / …), RFC 5322
// §4.1), which folding removes, so any other NUL makes the input invalid and
// every NUL left after folding is a folded comment.
const COMMENT = "\u0000";
// An even run of backslashes (quoted-pairs of "\\") leaves the NUL unescaped.
const UNESCAPED_NUL = new RegExp(`(?:^|[^\\\\])(?:\\\\\\\\)*${COMMENT}`);

// comment = "(" *([FWS] ccontent) [FWS] ")", ccontent = ctext / quoted-pair
// / comment. Matches an innermost comment: no unescaped parenthesis inside
// (a NUL inside is an already folded nested comment).
const INNERMOST_COMMENT = /\((?:[^()\\]|\\[\s\S])*\)/g;

// The receiver grammar: RFC 5322 §3.3 plus the §4.3 obsolete forms, after
// every comment has become COMMENT. `C` is one unit of CFWS (WSP, a folded
// line, or a comment); ABNF literals are case-insensitive (RFC 5234 §2.3).
//   date-time = [ day-of-week "," ] date time [CFWS]
//   day-of-week = [CFWS] day-name [CFWS]      (current: [FWS] day-name)
//   day = [CFWS] 1*2DIGIT [CFWS]              (current: [FWS] 1*2DIGIT FWS)
//   year = [CFWS] 2*DIGIT [CFWS]              (current: FWS 4*DIGIT FWS)
//   hour, minute, second = [CFWS] 2DIGIT [CFWS]
//   zone = (FWS ("+" / "-") 4DIGIT) / obs-zone
// A numeric zone needs FWS, so the character before its sign must be WSP.
// Capture groups: 1 day-name, 2 day, 3 month, 4 year, 5 hour, 6 minute,
// 7 second, 8 numeric zone, 9 alphabetic zone.
const C = "(?:[ \\t\\u0000]|\\r\\n[ \\t])*";
const RECEIVER_DATE_TIME = new RegExp(
  `^${C}(?:([A-Za-z]{3})${C},${C})?(\\d{1,2})${C}([A-Za-z]{3})${C}(\\d{2,})${C}` +
    `(\\d{2})${C}:${C}(\\d{2})${C}(?::${C}(\\d{2})${C})?` +
    `(?:(?<=[ \\t])([+-]\\d{4})|([A-Za-z]+))${C}$`,
);

function foldComments(value: string): string | null {
  if (UNESCAPED_NUL.test(value)) return null;
  let folded = value;
  let previous;
  do {
    previous = folded;
    folded = folded.replace(INNERMOST_COMMENT, COMMENT);
  } while (folded !== previous);
  return folded;
}

// RFC 5322 §4.3: a 2-digit year 00–49 adds 2000, 50–99 adds 1900; a 3-digit
// year adds 1900. Four or more digits are the year itself.
function interpretYear(digits: string): number {
  const year = Number(digits);
  if (digits.length === 2) return year < 50 ? year + 2000 : year + 1900;
  if (digits.length === 3) return year + 1900;
  return year;
}

function numericZoneOffset(zone: string): string | null {
  // "the last two digits of the zone MUST be within the range 00 through 59"
  if (Number(zone.slice(3)) > 59) return null;
  return `${zone.slice(0, 3)}:${zone.slice(3)}`;
}

function alphabeticZoneOffset(zone: string): string | null {
  const upper = zone.toUpperCase();
  const named = NAMED_ZONE_OFFSETS[upper];
  if (named !== undefined) return named;
  // Military zones are %d65-73 / %d75-90 (A–I, K–Z, either case): J is not
  // one. Those and any other multi-character alphabetic zone "SHOULD all be
  // considered equivalent to -0000", which Temporal writes as +00:00.
  if (upper === "J") return null;
  return "+00:00";
}

function indexOfName(names: readonly string[], name: string): number {
  const wanted = name.toLowerCase();
  return names.findIndex((candidate) => candidate.toLowerCase() === wanted);
}

/**
 * Read the fields of an RFC 5322 `date-time` as a conformant receiver must:
 * the §3.3 syntax plus the §4 obsolete syntax (CFWS between tokens, 2- and
 * 3-digit years, alphabetic zones), with case-insensitive names.
 *
 * - Shape and name checks only: the calendar date, the time of day and the
 *   day of week are left to the caller (`Temporal.PlainDateTime.from` with
 *   `overflow: "reject"`).
 *
 * @param value candidate RFC 5322 date-time
 * @returns the fields, or `null` when `value` is not a `date-time`
 */
export function readRfc5322DateTime(
  value: string,
): Rfc5322DateTimeFields | null {
  const folded = foldComments(value);
  if (folded === null) return null;
  const match = RECEIVER_DATE_TIME.exec(folded);
  if (match === null) return null;
  const [
    ,
    dayName,
    day,
    monthName,
    year,
    hour,
    minute,
    second,
    numericZone,
    alphabeticZone,
  ] = match;

  const month = indexOfName(ENGLISH_MONTH_NAMES, monthName) + 1;
  if (month === 0) return null;
  let dayOfWeek: number | undefined;
  if (dayName !== undefined) {
    dayOfWeek = indexOfName(ENGLISH_WEEKDAY_NAMES, dayName) + 1;
    if (dayOfWeek === 0) return null;
  }
  const offset =
    numericZone === undefined
      ? alphabeticZoneOffset(alphabeticZone)
      : numericZoneOffset(numericZone);
  if (offset === null) return null;

  return {
    dayOfWeek,
    year: interpretYear(year),
    month,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: second === undefined ? 0 : Number(second),
    offset,
  };
}
