// Not re-exported from `internal/index.ts`, for the reason `ediDateTimeFields.ts` gives:
// `toOffsetInstant` reads that barrel at module top level, and the `plain/validate` functions
// import it too, so a barrel entry for this module would close a cycle. Import this file directly.
import { Temporal } from "@js-temporal/polyfill";
import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import { isValidDate } from "../plain/validate/isValidDate";
import { isValidDateTime } from "../plain/validate/isValidDateTime";
import { isValidTime } from "../plain/validate/isValidTime";
import {
  type EdiLayout,
  type EdiPart,
  type EdiStandard,
  ediCodeOf,
} from "./ediGrammar";
import { splitIsoInterval } from "./isoInterval";
import { isoStringBody } from "./isoStringBody";
import { twoDigitYear } from "./twoDigitYear";
import { parseUtcOffsetNanoseconds } from "./utcOffsetString";
import { readYearWindowStart } from "./yearWindowStart";

const NANOSECONDS_PER_MINUTE = 60_000_000_000n;
const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;
const MINUTES_PER_HOUR = 60n;

/** The first and last years a `CCYY` mask can hold: four digits and no sign. */
const MIN_FOUR_DIGIT_YEAR = 0;
const MAX_FOUR_DIGIT_YEAR = 9999;
/** The years a `YY` mask counts through: the two digits are the year within its century. */
const YEARS_PER_CENTURY = 100;
/** The years a `Y` mask counts through: the one digit is the year within its decade. */
const YEARS_PER_DECADE = 10;

/**
 * The date a time with an offset (`209`, `404`) is read on. A time with an offset has no date, and
 * Temporal reads an offset only as part of a date-time, so the value is read as that time on the
 * epoch date, the way `internal/utcOffsetString.ts` reads an offset alone. Only the time and the
 * offset are written, so the date never reaches the output.
 */
const ANCHOR_DATE = "1970-01-01";

/** What one half of a value states, as the Temporal objects its digits are read from. */
interface IsoHalf {
  /** The calendar date, or null when the mask has none. */
  readonly date: Temporal.PlainDate | null;
  /** The time of day on the value's own wall clock, or null when the mask has none. */
  readonly time: Temporal.PlainTime | null;
  /** Nanoseconds the wall clock runs ahead of UTC, or null when the mask has no offset. */
  readonly offset: bigint | null;
}

/** The ISO 8601 kind a mask takes: fixed by the parts the mask has. */
type IsoKind =
  | "date"
  | "dateTime"
  | "time"
  | "instant"
  | "offsetTime"
  | "offset";

/** The digits (or sign) written for each part of a mask; null for a part that cannot hold its value. */
type PartText = Partial<Record<EdiPart, string | null>>;

/**
 * Write an ISO 8601 value as an EDI date/time value in a format code: the inverse of
 * `readEdiDateTime`, driven by the same `EdiLayout` tables (`ediGrammar.ts`), so what one writes
 * the other reads back.
 *
 * - The code's mask fixes the ISO 8601 kind `value` must be: a date (a mask with a day or a day
 *   of the year), a local date-time, a time, a date-time with an offset or `Z` (a mask with a
 *   date, a time and `ZHHMM` or `ZZZ`), a time with an offset (`209`, `404`), or an offset alone
 *   (`406`).
 *   Each is checked by `isValidDate`, `isValidDateTime`, `isValidTime`, `toOffsetInstant` or
 *   `parseUtcOffsetNanoseconds` and then read by Temporal; no digit of the input is sliced.
 * - A period or range takes an ISO 8601 interval, `<start>/<end>`, one half per mask. The halves
 *   are joined by what the standard transmits: nothing for UNTDID 2379, a hyphen for X12 1250.
 * - A value with an offset is written on its own wall clock, never the UTC clock. `ZZZ` is always
 *   the signed hour of UN/ECE Recommendation 7 ¶12 (`+02`), never `UTC`, `GMT` or an
 *   abbreviation.
 * - The mask must hold the value exactly; nothing is rounded or dropped. A fraction of a second,
 *   seconds under a mask with no `SS`, offset minutes under `ZZZ`, offset seconds under any mask
 *   and a year outside 0000–9999 return `""`. `TC` (`DDD`) and `EH` (`YDDD`) are lossy by
 *   definition and write what their masks have.
 * - A two-digit year is written only inside the caller's `options.yearWindow`
 *   (`readYearWindowStart`), so the same window reads it back as the same year. A mask with no
 *   `YY` never reads the option.
 * - When both halves of a range carry a date, an end that precedes its start returns `""`
 *   (**GMT rule**), comparing by calendar date first and by time when both halves have one. A
 *   time-only range (`RTM`) is written whatever the order of its times: it carries no date, so
 *   `22:00/06:00` is a window that crosses midnight.
 * - Never throws: any failure, including a clock that cannot be read for a rolling window, is
 *   `""`.
 *
 * @param standard which element the code belongs to
 * @param code the 2379 or 1250 format code
 * @param value one ISO 8601 string of the kind the code takes
 * @param options the caller's `TwoDigitYearOptions` bag, already accepted by `isOptionsArgument`
 * @returns the element value, or `""`
 *
 * @example writeEdiDateTime("edifact", "203", "2024-06-15T14:30:00") // "202406151430"
 * @example writeEdiDateTime("edifact", "303", "2024-06-15T14:30:00+02:00") // "202406151430+02"
 * @example writeEdiDateTime("edifact", "718", "2024-06-15/2024-06-20") // "2024061520240620"
 * @example writeEdiDateTime("x12", "RD8", "2024-06-15/2024-06-20") // "20240615-20240620"
 * @example writeEdiDateTime("x12", "RTM", "22:00/06:00") // "2200-0600"
 * @example writeEdiDateTime("x12", "D6", "2024-06-15", { yearWindow: 2000 }) // "240615"
 * @example writeEdiDateTime("x12", "D6", "2024-06-15") // "" (two-digit year, no window)
 * @example writeEdiDateTime("x12", "UN", "2024-06-15") // ""
 */
export function writeEdiDateTime(
  standard: EdiStandard,
  code: string,
  value: string,
  options?: unknown,
): string {
  try {
    const entry = ediCodeOf(standard, code);
    if (entry === null || typeof value !== "string") {
      return "";
    }
    const masks = masksOf(entry.layout);
    const halves = readHalves(masks, value);
    if (halves === null || endPrecedesStart(halves)) {
      return "";
    }

    // The window is read only when a mask carries a two-digit year, so a four-digit code never
    // reads the option and a rolling window never reads the clock for nothing.
    const needsWindow = masks.some((parts) => parts.includes("YY"));
    const windowStart = needsWindow ? readYearWindowStart(options) : null;
    if (needsWindow && windowStart === null) {
      return "";
    }

    const written = halves.map((half, index) =>
      writeHalf(masks[index], half, windowStart),
    );
    return written.includes(null) ? "" : written.join(entry.rangeSeparator);
  } catch {
    return "";
  }
}

/** A layout's masks in order: one for a single value, two for a period or range. */
function masksOf(layout: EdiLayout): (readonly EdiPart[])[] {
  return layout.end === undefined ? [layout.start] : [layout.start, layout.end];
}

/**
 * The value as one half per mask: the value itself for a single mask, the two halves of an ISO
 * 8601 interval for two. Null when the value is not an interval of two halves under a range code,
 * or when a half is not the kind its mask takes.
 */
function readHalves(
  masks: readonly (readonly EdiPart[])[],
  value: string,
): IsoHalf[] | null {
  const texts = masks.length === 1 ? [value] : splitIsoInterval(value);
  if (texts === null) {
    return null;
  }
  const halves: IsoHalf[] = [];
  for (const [index, parts] of masks.entries()) {
    const half = READERS[kindOf(parts)](texts[index]);
    if (half === null) {
      return null;
    }
    halves.push(half);
  }
  return halves;
}

/** Whether the mask has any of the named parts. */
function hasAny(parts: readonly EdiPart[], ...names: EdiPart[]): boolean {
  return names.some((name) => parts.includes(name));
}

/** The ISO 8601 kind a mask takes, from whether it has a date, a time and an offset. */
function kindOf(parts: readonly EdiPart[]): IsoKind {
  const hasDate = hasAny(parts, "DD", "DDD");
  const hasTime = hasAny(parts, "HH");
  const hasOffset = hasAny(parts, "ZS", "ZZZ");
  if (hasDate && hasTime) {
    return hasOffset ? "instant" : "dateTime";
  }
  if (hasDate) {
    return "date";
  }
  if (hasTime) {
    return hasOffset ? "offsetTime" : "time";
  }
  return "offset";
}

/** Each kind's reader: the public validator proves the string, then Temporal reads its fields. */
const READERS: Readonly<Record<IsoKind, (text: string) => IsoHalf | null>> = {
  date: (text) =>
    isValidDate(text)
      ? { date: Temporal.PlainDate.from(text), time: null, offset: null }
      : null,
  dateTime: (text) =>
    isValidDateTime(text)
      ? wallClockHalf(Temporal.PlainDateTime.from(text), null)
      : null,
  time: (text) =>
    isValidTime(text)
      ? { date: null, time: Temporal.PlainTime.from(text), offset: null }
      : null,
  instant: readInstant,
  // A time has no date to check a bracketed zone against, so a 209 or 404 value takes no
  // annotation.
  // The anchor date it is read on is not part of the value and is dropped again.
  offsetTime: (text) => {
    const anchored =
      isoStringBody(text) === text
        ? readInstant(`${ANCHOR_DATE}T${text}`)
        : null;
    return anchored === null ? null : { ...anchored, date: null };
  },
  offset: (text) => {
    const offset = parseUtcOffsetNanoseconds(text);
    return offset === null ? null : { date: null, time: null, offset };
  },
};

/**
 * A date-time with an offset as its own wall clock and its offset. `toOffsetInstant` reads the
 * string (an offset, `Z`, or a bracketed zone that agrees), and the wall clock is the instant
 * seen at that offset, so no digit of the input is sliced.
 */
function readInstant(text: string): IsoHalf | null {
  const pair = toOffsetInstant(text);
  if (pair === null) {
    return null;
  }
  const offset = parseUtcOffsetNanoseconds(pair.offset);
  // An offset with seconds fits no mask, and is not a time zone Temporal can show a clock in.
  if (offset === null || offset % NANOSECONDS_PER_MINUTE !== 0n) {
    return null;
  }
  const wallClock = Temporal.Instant.from(pair.instant)
    .toZonedDateTimeISO(pair.offset)
    .toPlainDateTime();
  return wallClockHalf(wallClock, offset);
}

function wallClockHalf(
  wallClock: Temporal.PlainDateTime,
  offset: bigint | null,
): IsoHalf {
  return {
    date: wallClock.toPlainDate(),
    time: wallClock.toPlainTime(),
    offset,
  };
}

/**
 * GMT rule: a reversed period names no span of time, when both halves carry a date. A date beside
 * a date-time (`DDT`, `DTD`) compares by calendar date. A time-only range (`RTM`) has no date to
 * compare, so an end before its start is a window that crosses midnight and is never reversed.
 */
function endPrecedesStart(halves: readonly IsoHalf[]): boolean {
  const [start, end] = halves;
  if (end === undefined || start.date === null || end.date === null) {
    return false;
  }
  const byDate = Temporal.PlainDate.compare(end.date, start.date);
  if (byDate !== 0 || start.time === null || end.time === null) {
    return byDate < 0;
  }
  return Temporal.PlainTime.compare(end.time, start.time) < 0;
}

/**
 * One half written in its mask, or null when the mask cannot hold it exactly (`maskHolds`) or a
 * part has no value to write.
 */
function writeHalf(
  parts: readonly EdiPart[],
  half: IsoHalf,
  windowStart: number | null,
): string | null {
  if (!maskHolds(parts, half, windowStart)) {
    return null;
  }
  const text: PartText = {
    ...dateText(half.date),
    ...timeText(half.time),
    ...offsetText(half.offset),
  };
  const written = parts.map((part) => text[part] ?? null);
  return written.includes(null) ? null : written.join("");
}

/** Whether the mask holds the half exactly, so that nothing is rounded or dropped. */
function maskHolds(
  parts: readonly EdiPart[],
  half: IsoHalf,
  windowStart: number | null,
): boolean {
  return (
    maskHoldsYear(parts, half.date, windowStart) &&
    maskHoldsTime(parts, half.time) &&
    maskHoldsOffset(parts, half.offset)
  );
}

/**
 * Whether the mask can hold the date's year: 0000–9999 for every mask, and inside the caller's
 * hundred-year window when the mask has `YY`, so that the two digits read back as the same year.
 */
function maskHoldsYear(
  parts: readonly EdiPart[],
  date: Temporal.PlainDate | null,
  windowStart: number | null,
): boolean {
  if (date === null) {
    return true;
  }
  const { year } = date;
  if (year < MIN_FOUR_DIGIT_YEAR || year > MAX_FOUR_DIGIT_YEAR) {
    return false;
  }
  if (!parts.includes("YY")) {
    return true;
  }
  return (
    windowStart !== null &&
    twoDigitYear(year % YEARS_PER_CENTURY, windowStart) === year
  );
}

/**
 * Whether the mask can hold the time without dropping anything: cutting the time to the mask's
 * smallest field (the second when it has `SS`, the minute otherwise) changes nothing.
 */
function maskHoldsTime(
  parts: readonly EdiPart[],
  time: Temporal.PlainTime | null,
): boolean {
  if (time === null) {
    return true;
  }
  const smallestUnit = parts.includes("SS") ? "second" : "minute";
  return time.equals(time.round({ smallestUnit, roundingMode: "trunc" }));
}

/** Whether the mask can hold the offset: whole minutes, or whole hours where the mask has `ZZZ`. */
function maskHoldsOffset(
  parts: readonly EdiPart[],
  offset: bigint | null,
): boolean {
  if (offset === null) {
    return true;
  }
  const step = parts.includes("ZZZ")
    ? NANOSECONDS_PER_HOUR
    : NANOSECONDS_PER_MINUTE;
  return offset % step === 0n;
}

/** The digits of each date part of a mask, read from the date's Temporal fields. */
function dateText(date: Temporal.PlainDate | null): PartText {
  return date === null
    ? {}
    : {
        CCYY: digits(date.year, 4),
        YY: digits(date.year % YEARS_PER_CENTURY, 2),
        Y: digits(date.year % YEARS_PER_DECADE, 1),
        MM: digits(date.month, 2),
        DD: digits(date.day, 2),
        DDD: digits(date.dayOfYear, 3),
      };
}

/** The digits of each time part of a mask, read from the time's Temporal fields. */
function timeText(time: Temporal.PlainTime | null): PartText {
  return time === null
    ? {}
    : {
        HH: digits(time.hour, 2),
        MI: digits(time.minute, 2),
        SS: digits(time.second, 2),
      };
}

/**
 * The sign, hours and minutes of an offset, and the `ZZZ` spelling: the signed hour of UN/ECE
 * Recommendation 7 ¶12, never `UTC` or `GMT` (**GMT rule**, one spelling). A zero offset is
 * written `+`.
 */
function offsetText(offset: bigint | null): PartText {
  if (offset === null) {
    return {};
  }
  const sign = offset < 0n ? "-" : "+";
  const magnitude = offset < 0n ? -offset : offset;
  const hours = digits(Number(magnitude / NANOSECONDS_PER_HOUR), 2);
  const minutes = digits(
    Number((magnitude / NANOSECONDS_PER_MINUTE) % MINUTES_PER_HOUR),
    2,
  );
  return {
    ZS: sign,
    ZH: hours,
    ZM: minutes,
    ZZZ: hours === null ? null : `${sign}${hours}`,
  };
}

/** `value` zero-padded to `width` digits, or null when it is not a whole number that fits. */
function digits(value: number, width: number): string | null {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  const text = String(value);
  return text.length > width ? null : text.padStart(width, "0");
}
