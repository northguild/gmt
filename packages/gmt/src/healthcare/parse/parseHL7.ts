import {
  formatUtcOffset,
  HL7_NULL_VALUE,
  hl7DegreePrecision,
  hl7PrecisionRank,
  parseUtcOffsetNanoseconds,
  readHl7Dtm,
  splitHl7Ts,
} from "../../internal";
import type { Hl7DtmFields } from "../../internal/hl7DateTime";
import { Temporal } from "../../internal/temporal";
import { toOffsetInstant } from "../../instant/convert/toOffsetInstant";
import { utcOffset } from "../../regex/utc-offset";
import type { Hl7DateTime, Hl7Precision } from "../../types";

/**
 * Read an HL7 v2 date-time (`DTM`, or the older `TS`) as what it states: a moment, the sender's
 * local time, or a span.
 *
 * HL7 v2.5.1 2.A.22 (headed 2.A.1.22 in the hl7.eu v2.5.1 copy) defines the `DTM`
 * `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]`; 2.A.77 the `TS`, a `DTM` then `^` and a
 * degree of precision.
 *
 * | `kind` | when | members |
 * | --- | --- | --- |
 * | `"instant"` | an offset and a minute or finer | `instant`, `offset`, `local`, `precision` |
 * | `"local"` | no offset and a minute or finer | `local`, `precision` |
 * | `"partial"` | year, month, day or hour | `local`, `offset` (`""` when none), `precision` |
 * | `"null"` | the string `""` | none |
 *
 * - No offset is the sender's local time: 2.A.22, "if the time zone is not included, the time
 *   zone defaults to that of the local time zone of the sender". It is never read as UTC; supply
 *   the sender's zone to `resolveLocal`.
 * - A partial value has no instant: padding a year or a day to a moment states a fact the sender
 *   did not send.
 * - The degree of precision only lowers (2.A.77.2: it "may not indicate greater precision"), by
 *   cutting, never rounding. `S` on a fractional value cuts the fraction.
 * - `0000` is the start of the stated day (2.A.22, `198807050000`: "Midnight of the night
 *   extending from July 4 to July 5, 1988"), not the end of the day before.
 * - `+0000` and `-0000` are both UTC (2.A.22), read as `+00:00`.
 * - `""` (two double quote marks) is the null value and differs from `''` (ch. 2 §2.5.3: "is
 *   different from omitting an optional data field"); `''` returns `null`.
 * - Only `^` separates a `TS`. When a feed's MSH-2 names another separator, the caller
 *   re-joins that `TS` with `^` first.
 * - Second `60` and hour `24` are rejected, as is any day the month lacks.
 * - Returns `null` on invalid input and for any value that is not a string. Never throws.
 *
 * @param value HL7 v2 `DTM` or `TS` string
 * @returns the reading, or `null` on invalid input
 *
 * @example parseHL7("20240615103000-0500") // { kind: "instant", instant: "2024-06-15T15:30:00Z", offset: "-05:00", local: "2024-06-15T10:30:00", precision: "second" }
 * @example parseHL7("20240615103000") // { kind: "local", local: "2024-06-15T10:30:00", precision: "second" }
 * @example parseHL7("20240615") // { kind: "partial", local: "2024-06-15", offset: "", precision: "day" }
 * @example parseHL7("199904011200^L") // { kind: "partial", local: "1999-04", offset: "", precision: "month" }
 * @example parseHL7('""') // { kind: "null" }
 * @example parseHL7("") // null
 * @example parseHL7("20240615240000") // null (hour 24)
 */
export function parseHL7(value: string): Hl7DateTime | null {
  try {
    if (typeof value !== "string") {
      return null;
    }
    if (value === HL7_NULL_VALUE) {
      return { kind: "null" };
    }
    const ts = splitHl7Ts(value);
    if (ts === null || ts.dtm === "") {
      return null;
    }
    const fields = readHl7Dtm(ts.dtm);
    if (fields === null) {
      return null;
    }
    const precision = lowerPrecision(fields.precision, ts.degree);
    if (precision === null) {
      return null;
    }
    const local = writeLocal(fields, precision);
    const offset = readOffset(fields);
    if (offset === null) {
      return null;
    }
    if (hl7PrecisionRank(precision) >= hl7PrecisionRank("minute")) {
      if (offset === "") {
        return { kind: "local", local, precision };
      }
      const pair = toOffsetInstant(local + offset);
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

/** The precision after a `TS` degree (2.A.77.2 lowers only); `null` for a bad or finer degree. */
function lowerPrecision(
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
function readOffset(fields: Hl7DtmFields): string | null {
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
function writeLocal(fields: Hl7DtmFields, precision: Hl7Precision): string {
  const reject = { overflow: "reject" } as const;
  const date = Temporal.PlainDate.from(
    {
      year: Number(fields.year),
      month: num(fields.month, 1),
      day: num(fields.day, 1),
    },
    reject,
  );
  const hour = num(fields.hour, 0);
  const minute = num(fields.minute, 0);
  const second = num(fields.second, 0);
  // The field bag rejects second 60 and hour 24, which a string would clamp or refuse.
  Temporal.PlainDateTime.from(
    { year: date.year, month: date.month, day: date.day, hour, minute, second },
    reject,
  );
  if (precision === "year" || precision === "month" || precision === "day") {
    return date.toString().slice(0, { year: 4, month: 7, day: 10 }[precision]);
  }
  if (precision === "hour") {
    return `${date.toString()}T${pad(hour)}`;
  }
  const clock = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  return writeClock(
    Temporal.PlainDateTime.from(
      `${date.toString()}T${clock}${fields.fraction === undefined ? "" : `.${fields.fraction}`}`,
    ),
    precision,
    fields.fractionDigits,
  );
}

/** A minute or finer: cut to `precision`, seconds always written. */
function writeClock(
  dateTime: Temporal.PlainDateTime,
  precision: "minute" | "second" | "fraction",
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
function num(group: string | undefined, absent: number): number {
  return group === undefined ? absent : Number(group);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
