import { Temporal } from "@js-temporal/polyfill";
import { toOffsetInstant } from "../../instant/convert/toOffsetInstant";
import { readEdiDateTime, readX12Time } from "../../internal/ediDateTimeFields";
import {
  formatUtcOffset,
  parseUtcOffsetNanoseconds,
} from "../../internal/utcOffsetString";
import { x12TimeCode } from "./x12TimeCode";

/**
 * What the date, time and time code of an X12 segment state together: the result of
 * `parseX12DateTime`.
 *
 * Each member is present only when the elements state it, so a caller can tell a local time
 * whose zone is unknown (`local` alone) from a moment whose offset was transmitted (`instant` and
 * `offset`) and from a local time in a named zone (`zone` and `daylight`). A segment may carry a
 * date alone or a time alone, so no member is always present; a result has `date`, `time` or
 * both.
 */
export interface X12DateTime {
  /**
   * The calendar date of the date element (373), `YYYY-MM-DD`. Absent when no date was sent: a
   * segment may carry a time alone.
   */
  date?: string;
  /**
   * The time of the time element (337), `HH:MM:SS` with a fraction of one or two digits when the
   * element carried tenths or hundredths that are not zero. Absent when no time was sent: a
   * segment may carry a date alone.
   */
  time?: string;
  /**
   * The date and time together, `YYYY-MM-DDTHH:MM:SS[.f[f]]`, on the clock the segment was
   * written on. It carries no offset: pass it and an IANA zone to `resolveLocal` to get the
   * moment. Absent unless both a date and a time were sent.
   */
  local?: string;
  /**
   * The UTC offset the time code states, `±HH:MM`, for the codes `01`–`29`, `UT` and `GM`. Absent
   * when no time code was sent and when the code names a zone.
   */
  offset?: string;
  /**
   * The moment as a UTC instant ending in `Z`: `local` read at `offset`. Present exactly when
   * `local` and `offset` both are, so a time alone has an `offset` and no instant: it is on no
   * day. A `local` within its offset of either end of years 0000–9999 gives an instant outside
   * them, written with a sign and a six-digit year.
   */
  instant?: string;
  /**
   * X12's own name for the zone a lettered time code names: `Alaska`, `Central`, `Eastern`,
   * `Hawaii-Aleutian`, `Mountain`, `Newfoundland`, `Pacific`, `Atlantic`, or `Local` for `LT`.
   * It is a name, not an IANA identifier and not an offset. Absent when no time code was sent and
   * when the code states an offset.
   */
  zone?: string;
  /**
   * Whether the lettered time code says daylight time: `true` for a `D` code (`ED`), `false` for
   * an `S` code (`ES`), and `null` for a code that says neither (`ET`, `LT`), where the date
   * decides. Present exactly when `zone` is.
   */
  daylight?: boolean | null;
}

/**
 * Read the date, time and time code of an X12 segment as one moment, or as much of one as the
 * three elements state.
 *
 * X12 freight segments carry a moment as three separate elements, and this function takes the
 * three as they are transmitted: `AT7-05`/`06`/`07` (in a 214 shipment status, the date and time
 * of the status or of an appointment: "If AT703 is present, AT705 is a date related to an
 * appointment"), `G62-02`/`04`/`05` (a 204 load tender) and `DTM-02`/`03`/`04`. Definitions are
 * release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/segment/DTM); the X12
 * text itself was not reached.
 *
 * ### The three elements
 * | Element | Name | The standard's definition |
 * |---|---|---|
 * | [373](https://www.stedi.com/edi/x12-005010/element/373) | Date | "Date expressed as CCYYMMDD where CC represents the first two digits of the calendar year" |
 * | [337](https://www.stedi.com/edi/x12-005010/element/337) | Time | "Time expressed in 24-hour clock time as follows: HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD, where H = hours (00-23), M = minutes (00-59), S = integer seconds (00-59) and DD = decimal seconds; decimal seconds are expressed as follows: D = tenths (0-9) and DD = hundredths (00-99)" |
 * | [623](https://www.stedi.com/edi/x12-008010/element/623) | Time Code | "Code identifying the time", read by `x12TimeCode` |
 *
 * ### What each combination returns
 * | Elements sent | Members returned |
 * |---|---|
 * | date | `date` |
 * | date, time | `date`, `time`, `local` |
 * | date, time, a time code that states an offset | `date`, `time`, `local`, `offset`, `instant` |
 * | date, time, a time code that names a zone | `date`, `time`, `local`, `zone`, `daylight` |
 * | time | `time` |
 * | time, a time code that states an offset | `time`, `offset` |
 * | time, a time code that names a zone | `time`, `zone`, `daylight` |
 * | neither a date nor a time | `null` |
 *
 * - **A date alone and a time alone are both read.** `G62` allows either: syntax note R0103,
 *   "At least one of G62-01 or G62-03 is required", with P0102 and P0304 pairing each qualifier
 *   (`G62-01`, `G62-03`) with its value (`G62-02` the date, `G62-04` the time). `DTM` allows
 *   either: R020305, "At least one of DTM-02, DTM-03 or DTM-05 is required". `AT7` forbids a
 *   time without a date: C0605, "If AT7-06 is present, then AT7-05 is required". This function
 *   is not told which segment a value came from, so it reads a time alone wherever it came from
 *   (GMT's rule).
 * - **Neither a date nor a time returns `null`** (GMT's rule): there is nothing to read. X12
 *   does not say so. R020305 is also met by a `DTM` that carries only `DTM-05`/`06`, which is
 *   valid X12; read that pair with `parseX12DateTimePeriod`.
 * - **An element that was not sent is `undefined` or `""`**, for each of the three (GMT's rule,
 *   not an X12 statement). An X12 element that is not sent is empty between its delimiters, so
 *   a caller reading a split segment holds an empty string. Both mean "not sent".
 * - **A date alone returns `{ date }`.** A date names no instant in any zone.
 * - **A time alone returns `time`, and never `local` or `instant`.** A time on no stated day
 *   names no moment. A time code beside it still adds what it states, `offset` or `zone` and
 *   `daylight`, and the time is returned as transmitted: with no date there is no day for an
 *   offset to move it across. UN/EDIFACT `209` and `404` are read the same way.
 * - **A date and a time with no time code return `date`, `time` and `local`, and never an
 *   instant.** `AT7` says what a blank time code means: "If AT707 is not present then AT706
 *   represents local time of the status". `DTM` and `G62` do not say what an absent time code
 *   means, and GMT reads them the same way (GMT's reading). Either way the result states no
 *   offset. The code `LT` says local to the event too. The place is elsewhere in the message
 *   and GMT maps no place to a zone: pass `local` and the place's IANA zone to `resolveLocal`.
 *   Reading the value as UTC is the most common EDI timestamp bug.
 * - **A time code that states an offset adds `offset`, and `instant` when a date was sent**:
 *   `01`–`29`, `UT` and `GM`. `13`–`24` count down, so `20` is `-05:00`. The instant can fall on
 *   the day before or after `date`.
 * - **A time code that names a zone adds `zone` and `daylight`, and no offset.** `ES` is the name
 *   "Eastern" and the word "standard"; X12 states no offset for it. Resolve `local` in the IANA
 *   zone you map the name to, with `resolveLocal`.
 * - **A time code with no time returns `null`.** It is X12's rule for `DTM` (syntax note C0403,
 *   "If DTM-04 is present, then DTM-03 is required") and for `AT7` (C0706, "If AT7-07 is
 *   present, then AT7-06 is required"). `G62` has no such note; GMT applies the same rule to it
 *   (GMT's rule).
 * - **The time is one of the four element 337 forms**, 4, 6, 7 or 8 digits. Tenths and
 *   hundredths become the fraction of the second exactly: `1430001` is `14:30:00.1` and
 *   `14300012` is `14:30:00.12`. A zero fraction is not written (`14300000` is `14:30:00`).
 *   Seconds are always written, `00` for `HHMM`.
 * - **Fields are checked, not clamped.** 29 February 2023, 31 June, hour 24, minute or second 60
 *   and a time of 5 or 9 digits return `null`.
 * - **The date has a four-digit year.** Before release 004010, element 373 was `YYMMDD`; read
 *   such a date with `parseX12DateTimePeriod(value, "D6", { yearWindow })`.
 * - **These are not data element 1250 values.** 373 and 337 are fixed forms with no format
 *   qualifier; their 8-, 4- and 6-digit forms coincide with the 1250 codes `D8`, `TM` and `TS`.
 *   A `DTP` segment, and `DTM-05`/`06`, carry a 1250 qualifier and a value instead: read those
 *   with `parseX12DateTimePeriod`.
 * - **To write the elements**, use `formatX12DateTimePeriod(value, "D8")` for the date and
 *   `"TM"` or `"TS"` for the time. Tenths and hundredths are read here and are not written.
 * - Returns `null` for a time code that is not an element 623 code, and for an argument that is
 *   neither a string nor `undefined`.
 *
 * @param date The element 373 date as transmitted, `CCYYMMDD` (e.g. "20240615"); `undefined` or `""` when not sent
 * @param time The element 337 time as transmitted (e.g. "1430"); `undefined` or `""` when not sent
 * @param timeCode The element 623 time code (e.g. "ET"); `undefined` or `""` when not sent
 * @returns the members the elements state, or null on invalid input
 *
 * @example parseX12DateTime("20240615", "1430") // { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00" } (no time code: local, not UTC)
 * @example parseX12DateTime("20240615") // { date: "2024-06-15" }
 * @example parseX12DateTime("20240615", "1430", "UT") // { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", offset: "+00:00", instant: "2024-06-15T14:30:00Z" }
 * @example parseX12DateTime("20240615", "1430", "20") // { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", offset: "-05:00", instant: "2024-06-15T19:30:00Z" }
 * @example parseX12DateTime("20240615", "2330", "24") // { date: "2024-06-15", time: "23:30:00", local: "2024-06-15T23:30:00", offset: "-01:00", instant: "2024-06-16T00:30:00Z" } (the instant is on the next UTC day)
 * @example parseX12DateTime("20240615", "1430", "ES") // { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Eastern", daylight: false } (a zone name: no offset)
 * @example parseX12DateTime("20240615", "1430", "ET") // { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Eastern", daylight: null }
 * @example parseX12DateTime("20240615", "1430", "LT") // { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Local", daylight: null }
 * @example parseX12DateTime("20240615", "143045") // { date: "2024-06-15", time: "14:30:45", local: "2024-06-15T14:30:45" }
 * @example parseX12DateTime("20240615", "14300012") // { date: "2024-06-15", time: "14:30:00.12", local: "2024-06-15T14:30:00.12" } (hundredths of a second)
 * @example parseX12DateTime("20240615", "", "") // { date: "2024-06-15" } (empty elements were not sent)
 * @example parseX12DateTime("", "1430") // { time: "14:30:00" } (a time alone: no date, so no local)
 * @example parseX12DateTime(undefined, "14300012") // { time: "14:30:00.12" }
 * @example parseX12DateTime("", "1430", "UT") // { time: "14:30:00", offset: "+00:00" } (an offset, and no instant: the time is on no day)
 * @example parseX12DateTime("", "2330", "24") // { time: "23:30:00", offset: "-01:00" }
 * @example parseX12DateTime("", "1430", "ES") // { time: "14:30:00", zone: "Eastern", daylight: false }
 * @example parseX12DateTime("", "1430", "LT") // { time: "14:30:00", zone: "Local", daylight: null }
 * @example parseX12DateTime("", "") // null (neither a date nor a time)
 * @example parseX12DateTime("", "", "UT") // null (a time code needs a time)
 * @example parseX12DateTime("20240615", "", "ET") // null (a time code needs a time)
 * @example parseX12DateTime("20240615", "1430", "EST") // null (not an element 623 code)
 * @example parseX12DateTime("20240615", "2430") // null (hour 24)
 * @example parseX12DateTime("20240615", "14304") // null (five digits is not an element 337 form)
 * @example parseX12DateTime("20230229", "1430") // null (2023 has no 29 February)
 * @example parseX12DateTime("240615") // null (the date element has a four-digit year)
 */
export function parseX12DateTime(
  date?: string,
  time?: string,
  timeCode?: string,
): X12DateTime | null {
  try {
    const dateOnly = readDate(date);
    if (dateOnly === null) {
      return null;
    }
    const codeSent = isSent(timeCode);
    if (!isSent(time)) {
      // No time was sent. A time code with no time is null: X12's rule for `DTM` (C0403, "If
      // DTM-04 is present, then DTM-03 is required") and `AT7` (C0706), and GMT's rule for `G62`,
      // which has no such note. With no date either there is nothing to read (GMT rule: X12's
      // R020305 is also met by a `DTM` carrying only `DTM-05`/`06`).
      return codeSent || dateOnly === undefined ? null : { date: dateOnly };
    }
    const timeOnly = readX12Time(time);
    if (timeOnly === null) {
      return null;
    }
    const stated = readStated(dateOnly, timeOnly);
    if (!codeSent) {
      return stated;
    }
    const meaning = x12TimeCode(timeCode);
    if (meaning === null) {
      return null;
    }
    return "zone" in meaning
      ? { ...stated, zone: meaning.zone, daylight: meaning.daylight }
      : withOffset(stated, meaning.offset);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}

/** Whether an element was sent: an absent X12 element is `undefined` or an empty string. */
function isSent(element: string | undefined): element is string {
  return element !== undefined && element !== "";
}

/**
 * The element 373 date as `YYYY-MM-DD`: `undefined` when the element was not sent, `null` when
 * it was sent and is not a real `CCYYMMDD` date.
 */
function readDate(date: string | undefined): string | null | undefined {
  if (!isSent(date)) {
    return undefined;
  }
  // Element 373 is the `CCYYMMDD` mask of the 1250 code `D8`: one grammar, one reader.
  return readEdiDateTime("x12", "D8", date)?.date ?? null;
}

/**
 * What the date and time elements state before the time code is read: `time` alone when no date
 * was sent, and `date`, `time` and `local` when one was.
 */
function readStated(
  dateOnly: string | undefined,
  timeOnly: string,
): X12DateTime {
  if (dateOnly === undefined) {
    return { time: timeOnly };
  }
  const local = Temporal.PlainDate.from(dateOnly)
    .toPlainDateTime(Temporal.PlainTime.from(timeOnly))
    .toString();
  return { date: dateOnly, time: timeOnly, local };
}

/**
 * Attach the offset a time code states. Beside a `local` it is paired with the wall clock through
 * `toOffsetInstant`, which gives the instant; no digit is moved by hand. A time alone is on no
 * day, so it names no instant: the offset is returned beside it, normalised to `±HH:MM` through
 * the same reader and writer as a UN/EDIFACT `209` or `404` value, with no date borrowed.
 */
function withOffset(stated: X12DateTime, offset: string): X12DateTime | null {
  if (stated.local === undefined) {
    const nanoseconds = parseUtcOffsetNanoseconds(offset);
    const normalised =
      nanoseconds === null ? null : formatUtcOffset(nanoseconds);
    return normalised === null ? null : { ...stated, offset: normalised };
  }
  const pair = toOffsetInstant(`${stated.local}${offset}`);
  return pair === null
    ? null
    : { ...stated, offset: pair.offset, instant: pair.instant };
}
