/*
 * The HL7 v2 date-time grammar: `DTM` (2.A.22) and the older `TS` (2.A.77) that wraps it with a
 * degree of precision (2.A.77.2, Table 0529). Private: a `DTM` is valid only as a whole, so its
 * public form is the validator `isValidHL7`, never a pattern.
 *
 * The grammar is pure; `readHl7DateTime` is the one reader that builds Temporal values, through
 * `readOffsetInstant`. Both import their dependencies directly, never through `internal/index.ts`.
 *
 * Sources (HL7 Europe's published copies of the standard; the v2.5.1 copy heads these sections
 * 2.A.1.22 and 2.A.1.77, HL7's own cross-references and the v2.6 copy say 2.A.22 and 2.A.77):
 * - 2.A.22 DTM, picture `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]`:
 *   https://www.hl7.eu/HL7v2x/v251/std251/ch02a.html
 *   https://www.hl7.eu/HL7v2x/v26/std26/ch02a.html
 * - 2.A.77 TS, 2.A.77.2 degree of precision, Table 0529 (`Y L D H M S`), same pages.
 * - Ch. 2 §2.5.3 (the null value `""`), §2.5.4 and Figure 2-1 (the recommended separators `^`
 *   and `&`), §2.6.1.1 (a sender writes `^` only before another populated component), §2.6.2 (a
 *   component not sent is not present, and one not expected is ignored) and §2.8.1, §2.8.2 (a
 *   later version adds components at the end):
 *   https://www.hl7.eu/HL7v2x/v251/std251/ch02.html
 */

import type {
  Hl7DateTime,
  Hl7MomentPrecision,
  Hl7Precision,
} from "../types/hl7";
import { utcOffset } from "../regex/utc-offset";
import { readOffsetInstant } from "./offsetInstant";
import { Temporal } from "./temporal";
import { formatUtcOffset, parseUtcOffsetNanoseconds } from "./utcOffsetString";

/**
 * The seven precisions of an HL7 v2 date-time, coarsest first. Every "lower or raise" test in
 * the parser and the formatter compares ranks (`hl7PrecisionRank`); nothing compares strings.
 */
export const HL7_PRECISIONS: readonly Hl7Precision[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "fraction",
];

/**
 * The index of a precision in `HL7_PRECISIONS`, coarsest first.
 *
 * @param precision candidate precision
 * @returns its rank, or `-1` for anything that is not one of the seven
 *
 * @example hl7PrecisionRank("year") // 0
 * @example hl7PrecisionRank("fraction") // 6
 * @example hl7PrecisionRank("Second") // -1
 */
export function hl7PrecisionRank(precision: unknown): number {
  return HL7_PRECISIONS.indexOf(precision as Hl7Precision);
}

/**
 * Table 0529, degree of precision (2.A.77.2): "(Y = year, L = month, D = day, H = hour,
 * M = minute, S = second)". Upper case only; `"fraction"` has no letter.
 */
export const HL7_DEGREE_OF_PRECISION: Readonly<
  Record<"Y" | "L" | "D" | "H" | "M" | "S", Hl7Precision>
> = Object.freeze({
  Y: "year",
  L: "month",
  D: "day",
  H: "hour",
  M: "minute",
  S: "second",
});

/**
 * The precision a Table 0529 degree letter names.
 *
 * @param degree candidate degree of precision
 * @returns the precision, or `null` for anything but an own upper-case key (`"toString"` and
 * `"__proto__"` included)
 *
 * @example hl7DegreePrecision("L") // "month"
 * @example hl7DegreePrecision("l") // null
 * @example hl7DegreePrecision("toString") // null
 */
export function hl7DegreePrecision(degree: unknown): Hl7Precision | null {
  return typeof degree === "string" &&
    Object.hasOwn(HL7_DEGREE_OF_PRECISION, degree)
    ? HL7_DEGREE_OF_PRECISION[degree as keyof typeof HL7_DEGREE_OF_PRECISION]
    : null;
}

/**
 * The HL7 null value: two U+0022 characters (ch. 2 §2.5.3, "transmitted as two double quote
 * marks (\"\"), is different from omitting an optional data field").
 */
export const HL7_NULL_VALUE = '""';

// The 2.A.22 picture `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]`, one fragment per element.
// ASCII digits only: `[0-9]`, never `\d` with the `u` flag.
const YYYY = "(?<year>[0-9]{4})";
const MM = "(?<month>[0-9]{2})";
const DD = "(?<day>[0-9]{2})";
const HH = "(?<hour>[0-9]{2})";
const MI = "(?<minute>[0-9]{2})";
const SS = "(?<second>[0-9]{2})";
const FRACTION = "\\.(?<fraction>[0-9]{1,4})";
const ZZZZ = "(?<sign>[+-])(?<offsetHour>[0-9]{2})(?<offsetMinute>[0-9]{2})";

/**
 * The `DTM` grammar of 2.A.22, anchored. Named groups: `year month day hour minute second
 * fraction sign offsetHour offsetMinute`. The longest match is 24 characters, the `DTM` maximum
 * length (2.A.22), so there is no separate length check. Shape only: the ranges and the calendar
 * of the date and time fields are Temporal's to check; a partial value's offset is checked with the
 * `utcOffset` regex and normalised with `formatUtcOffset` (parseHL7).
 */
export const hl7Dtm: RegExp = new RegExp(
  `^${YYYY}(?:${MM}(?:${DD}(?:${HH}(?:${MI}(?:${SS}(?:${FRACTION})?)?)?)?)?)?(?:${ZZZZ})?$`,
);

/** The fields of a `DTM` that matched `hl7Dtm`, as the strings sent. */
export interface Hl7DtmFields {
  readonly year: string;
  readonly month: string | undefined;
  readonly day: string | undefined;
  readonly hour: string | undefined;
  readonly minute: string | undefined;
  readonly second: string | undefined;
  readonly fraction: string | undefined;
  readonly sign: string | undefined;
  readonly offsetHour: string | undefined;
  readonly offsetMinute: string | undefined;
  /** The finest group present: `"fraction"` when a fraction matched. */
  readonly precision: Hl7Precision;
  /** The number of fraction digits sent, `0` when none. */
  readonly fractionDigits: number;
}

/**
 * Reads a `DTM` against `hl7Dtm`. No range check here.
 *
 * @param dtm candidate `DTM` text
 * @returns the matched groups and the precision written, or `null` when it does not match
 *
 * @example readHl7Dtm("20240615103000.1234") // { year: "2024", …, precision: "fraction", fractionDigits: 4 }
 * @example readHl7Dtm("2024-0500") // { year: "2024", sign: "-", offsetHour: "05", offsetMinute: "00", precision: "year", … }
 * @example readHl7Dtm("20240615103000.12345") // null
 */
export function readHl7Dtm(dtm: string): Hl7DtmFields | null {
  if (typeof dtm !== "string") {
    return null;
  }
  const groups = hl7Dtm.exec(dtm)?.groups;
  if (groups === undefined) {
    return null;
  }
  const fraction = groups["fraction"];
  return {
    year: groups["year"] as string,
    month: groups["month"],
    day: groups["day"],
    hour: groups["hour"],
    minute: groups["minute"],
    second: groups["second"],
    fraction,
    sign: groups["sign"],
    offsetHour: groups["offsetHour"],
    offsetMinute: groups["offsetMinute"],
    precision: finestPrecision(groups, fraction),
    fractionDigits: fraction === undefined ? 0 : fraction.length,
  };
}

/** The finest of `year … second` whose group is present, or `"fraction"` when a fraction is. */
function finestPrecision(
  groups: Readonly<Record<string, string | undefined>>,
  fraction: string | undefined,
): Hl7Precision {
  if (fraction !== undefined) {
    return "fraction";
  }
  let finest: Hl7Precision = "year";
  for (const precision of HL7_PRECISIONS) {
    if (precision !== "fraction" && groups[precision] !== undefined) {
      finest = precision;
    }
  }
  return finest;
}

/**
 * Splits a `TS` (2.A.77: `DTM ^ degree of precision`) into its two components, each read up to
 * its first subcomponent. A lone field carries no MSH-2, so the separators are the ones Figure
 * 2-1 recommends, `^` between components and `&` between subcomponents (ch. 2 §2.5.4). A
 * recipient ignores components and subcomponents "that are present but were not expected"
 * (ch. 2 §2.6.2), and a later version adds components at the end of a data type (§2.8.1,
 * §2.8.2), so everything after the second component and after each first `&` is ignored:
 * `20240615^D^X` is `20240615^D`, and `2024&X^D` is `2024^D`. A component left empty is not
 * present (§2.6.2), so `20240615^` and `20240615^^D` are `20240615`.
 *
 * @param value candidate `TS` text
 * @returns the two components, each `""` when not present; `null` for a value that is not a string
 *
 * @example splitHl7Ts("199904011200^L") // { dtm: "199904011200", degree: "L" }
 * @example splitHl7Ts("20240615^D^X") // { dtm: "20240615", degree: "D" }
 * @example splitHl7Ts("2024&X^D") // { dtm: "2024", degree: "D" }
 */
export function splitHl7Ts(
  value: string,
): { dtm: string; degree: string } | null {
  if (typeof value !== "string") {
    return null;
  }
  // The limit stops the split at the second component, so the rest is never read.
  const [dtm = "", degree = ""] = value.split("^", 2);
  return { dtm: firstSubcomponent(dtm), degree: firstSubcomponent(degree) };
}

/** A component up to its first `&`; the subcomponents after it are not expected (ch. 2 §2.6.2). */
function firstSubcomponent(component: string): string {
  const amp = component.indexOf("&");
  return amp < 0 ? component : component.slice(0, amp);
}

const ISO_OFFSET =
  "(?<offset>Z|[+-][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:[.,][0-9]{1,9})?)?)";

/**
 * Which form an ISO 8601 extended string is written in, for `formatHL7`; apply it to
 * `isoStringBody(value)`. It reads the form, never the values (Temporal checks those). Groups
 * `year month day hour minute second fraction offset`:
 * - `year` is exactly four digits, so `+010000` and `-000001` do not match.
 * - `fraction` is one to nine digits after `.` or `,` (the decimal signs `plainDateTime` accepts).
 * - `offset` follows a time only: `Z` or `±HH:MM` with the optional `:SS` and fraction Temporal
 *   writes for a sub-minute zone, so the formatter can refuse it rather than fail to match.
 * - Upper-case `T` and `Z` only.
 */
export const isoHl7Form: RegExp = new RegExp(
  `^(?<year>[0-9]{4})(?:-(?<month>[0-9]{2})(?:-(?<day>[0-9]{2})(?:T(?<hour>[0-9]{2})(?::(?<minute>[0-9]{2})(?::(?<second>[0-9]{2})(?:[.,](?<fraction>[0-9]{1,9}))?)?)?${ISO_OFFSET}?)?)?)?$`,
);

/**
 * The precision an `isoHl7Form` match is written at, as `readHl7Dtm` gives it for a `DTM`.
 *
 * @param match a successful `isoHl7Form.exec` result
 * @returns the finest group present and the number of fraction digits written
 *
 * @example isoHl7Precision(isoHl7Form.exec("2024-06-15T10:30") as RegExpExecArray) // { precision: "minute", fractionDigits: 0 }
 * @example isoHl7Precision(isoHl7Form.exec("2024-06-15T10:30:00,5") as RegExpExecArray) // { precision: "fraction", fractionDigits: 1 }
 */
export function isoHl7Precision(match: RegExpExecArray): {
  precision: Hl7Precision;
  fractionDigits: number;
} {
  const groups = match.groups ?? {};
  const fraction = groups["fraction"];
  return {
    precision: finestPrecision(groups, fraction),
    fractionDigits: fraction === undefined ? 0 : fraction.length,
  };
}

/**
 * The core of `parseHL7` and `isValidHL7`: the structured value an HL7 v2 `DTM` or `TS` names.
 * Never throws.
 *
 * @param value an HL7 v2 `DTM`, or a `TS` with its degree of precision
 * @returns the structured value, or `null` when `value` is not one
 *
 * @example readHl7DateTime("20240710143000+0200")?.kind // "instant"
 * @example readHl7DateTime("202407")?.kind // "partial"
 * @example readHl7DateTime("not a date") // null
 */
export function readHl7DateTime(value: string): Hl7DateTime | null {
  try {
    if (typeof value !== "string") {
      return null;
    }
    const ts = splitHl7Ts(value);
    if (ts === null || ts.dtm === "") {
      return null;
    }
    if (ts.dtm === HL7_NULL_VALUE) {
      return ts.degree === "" ? { kind: "null" } : null;
    }
    const fields = readHl7Dtm(ts.dtm);
    if (fields === null) {
      return null;
    }
    const precision = loweredPrecision(fields.precision, ts.degree);
    if (precision === null) {
      return null;
    }
    const local = writeHl7Local(fields, precision);
    const offset = readHl7Offset(fields);
    if (offset === null) {
      return null;
    }
    if (isMomentPrecision(precision)) {
      if (offset === "") {
        return { kind: "local", local, precision };
      }
      const pair = readOffsetInstant(local + offset);
      if (pair === null) {
        return null;
      }
      return {
        kind: "instant",
        instant: pair.instant,
        offset: pair.offset,
        local,
        precision,
      };
    }
    return { kind: "partial", local, offset, precision };
  } catch {
    // Never throws (Core Rule 3)
    return null;
  }
}

/** A minute or finer names a moment; a coarser precision names a span. */
function isMomentPrecision(
  precision: Hl7Precision,
): precision is Hl7MomentPrecision {
  return (
    precision === "minute" || precision === "second" || precision === "fraction"
  );
}

/** The precision after a `TS` degree (2.A.77.2 lowers only); `null` for a bad or finer degree. */
function loweredPrecision(
  written: Hl7Precision,
  degree: string,
): Hl7Precision | null {
  if (degree === "") {
    return written;
  }
  const lowered = hl7DegreePrecision(degree);
  return lowered === null ||
    hl7PrecisionRank(lowered) > hl7PrecisionRank(written)
    ? null
    : lowered;
}

/** The sent offset as `±HH:MM` (`-0000` reads `+00:00`), `""` when none, `null` when out of range. */
function readHl7Offset(fields: Hl7DtmFields): string | null {
  if (fields.sign === undefined) {
    return "";
  }
  const sent = `${fields.sign}${fields.offsetHour}:${fields.offsetMinute}`;
  const nanoseconds = utcOffset.test(sent)
    ? parseUtcOffsetNanoseconds(sent)
    : null;
  return nanoseconds === null ? null : formatUtcOffset(nanoseconds);
}

/**
 * Validates the calendar of `fields` with Temporal (`overflow: "reject"`), then writes `local` at
 * `precision`, cutting and never rounding. A field out of range throws a `RangeError`, which
 * `parseHL7` catches.
 */
function writeHl7Local(fields: Hl7DtmFields, precision: Hl7Precision): string {
  const reject = { overflow: "reject" } as const;
  const date = Temporal.PlainDate.from(
    {
      year: Number(fields.year),
      month: hl7Num(fields.month, 1),
      day: hl7Num(fields.day, 1),
    },
    reject,
  );
  const hour = hl7Num(fields.hour, 0);
  const minute = hl7Num(fields.minute, 0);
  const second = hl7Num(fields.second, 0);
  // The field bag rejects second 60 and hour 24, which a string would clamp or refuse.
  Temporal.PlainDateTime.from(
    { year: date.year, month: date.month, day: date.day, hour, minute, second },
    reject,
  );
  if (precision === "year" || precision === "month" || precision === "day") {
    return date.toString().slice(0, { year: 4, month: 7, day: 10 }[precision]);
  }
  if (precision === "hour") {
    return `${date.toString()}T${hl7Pad(hour)}`;
  }
  const clock = `${hl7Pad(hour)}:${hl7Pad(minute)}:${hl7Pad(second)}`;
  return writeHl7Clock(
    Temporal.PlainDateTime.from(
      `${date.toString()}T${clock}${fields.fraction === undefined ? "" : `.${fields.fraction}`}`,
    ),
    precision,
    fields.fractionDigits,
  );
}

/** A minute or finer: cut to `precision`, seconds always written. */
function writeHl7Clock(
  dateTime: Temporal.PlainDateTime,
  precision: Hl7MomentPrecision,
  fractionDigits: number,
): string {
  return precision === "fraction"
    ? dateTime.toString({
        fractionalSecondDigits: fractionDigits as 1 | 2 | 3 | 4,
      })
    : dateTime
        .round({ smallestUnit: precision, roundingMode: "trunc" })
        .toString({ smallestUnit: "second" });
}

/** An absent group reads as its first value (month 1, day 1, time 0). */
function hl7Num(group: string | undefined, absent: number): number {
  return group === undefined ? absent : Number(group);
}

function hl7Pad(n: number): string {
  return String(n).padStart(2, "0");
}
