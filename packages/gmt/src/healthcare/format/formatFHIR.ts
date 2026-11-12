import {
  FHIR_PRECISIONS,
  fhirTypeAllows,
  hasTimeZoneAnnotation,
  hl7PrecisionRank,
  isoHl7Form,
  isoHl7Precision,
  isoStringBody,
  isOptionsArgument,
  parseUtcOffsetNanoseconds,
  readFhirValue,
  readFormOffsetInstant,
} from "../../internal";
import { Temporal } from "../../internal/temporal";
import type {
  FhirDateType,
  FhirFormatOptions,
  FhirPrecision,
  Hl7Precision,
} from "../../types";

const NANOSECONDS_PER_MINUTE = 60_000_000_000n;

const RANK_DAY = hl7PrecisionRank("day");
const RANK_SECOND = hl7PrecisionRank("second");

/**
 * Write an ISO 8601 string as a FHIR R4 `date`, `dateTime` or `instant`: the inverse of `parseFHIR`.
 *
 * FHIR R4 Datatypes §2.24.0.1 limits each type: `date` is `YYYY`, `YYYY-MM` or `YYYY-MM-DD` with
 * no time zone; `dateTime` adds a time that SHALL carry seconds and a zone; `instant` is at least
 * to the second and SHALL include a zone.
 *
 * | Type | Precisions written | Default precision |
 * | --- | --- | --- |
 * | `date` | year, month, day | the input's, or day for an input with a time |
 * | `dateTime` | year, month, day, second, fraction | the input's |
 * | `instant` | second, fraction | the input's |
 *
 * - It cuts and never rounds, so the result never names a later second, day or month than the
 *   input's own wall clock. `options.precision` only lowers the precision; a finer one returns `""`.
 * - Under `date`, the result is the wall-clock date at the input's own offset
 *   (`2024-06-15T23:30:00-05:00` is `2024-06-15`), because §2.24.0.1 forbids a zone on a `date`.
 *   A `…Z[zone]` value gives that zone's local date (`2024-06-15T23:30:00Z[Europe/Berlin]` is
 *   `2024-06-16`): RFC 9557 §3.4 says a `Z` timestamp asserts no local time, so it comes from the
 *   zone suffix.
 * - With no bracketed zone, the designator is written as the input spells it (`Z`, `+00:00` and
 *   `-00:00` stay as written; `+05:30:00` is written `+05:30`). After a bracketed zone, the
 *   zone's offset at that instant is written, whatever the designator: `…Z[Europe/Berlin]` in
 *   June writes `+02:00`, and `…Z[Europe/London]` in January writes `+00:00`. The fraction
 *   always uses `.`.
 * - `-00:00` before a bracketed zone returns `""` unless the zone's offset is zero at that
 *   instant (`2024-06-15T10:30:00-00:00[Europe/Berlin]`): Temporal's `ZonedDateTime.from` reads
 *   `-00:00` as the offset `+00:00` and rejects an offset the zone contradicts (RFC 9557 §3.4).
 * - A second of `60` returns `""`: §2.24.0.1 says "applications producing them MAY choose to avoid
 *   encoding leap seconds".
 * - There is no hour or minute precision, and nothing is zero-filled: a value written to the hour
 *   or minute, with or without an offset, is written only when cut to a day or coarser
 *   (`2024-06-15T23-05:00` is `2024-06-15` under `date`). An hour-only time is ISO 8601-1
 *   §5.3.1.3 reduced precision, which Temporal reads.
 * - An offset that is not a whole number of minutes returns `""` (`+02:00:30`; Monrovia before
 *   1972, `Africa/Monrovia`, was −0:44:30). This applies under `date` too, even though a `date`
 *   never writes the offset.
 * - Disambiguation: none, in the vocabulary of `LOCAL_TIME_RESOLUTION.md`. A wall time with no
 *   offset is written only as a date, and a zone with no offset returns `""` (see Annotations).
 *   In a repeated hour at the end of DST, the offset decides which one is written.
 * - Annotations: on a form with no offset, any bracketed annotation returns `""`
 *   (`2024-06-15[u-ca=iso8601]`, `…T10:30:00[foo=bar]`). On a form with an offset, an elective
 *   `[u-ca=…]` or `[foo=bar]` is ignored and the ISO digits are written, while a critical unknown
 *   key (`[!foo=bar]`) returns `""` (RFC 9557 §3.3).
 * - Never throws: any failure, for input of any type, is `""`.
 *
 * The matching reader is `parseFHIR`.
 *
 * @param value ISO 8601 date, date-time, or date-time with an offset
 * @param type The FHIR type to write
 * @param options How much of the value is written
 * @returns the FHIR value, or `""` when the value cannot be written as `type`
 *
 * @example formatFHIR("2024-06-15T23:30:00-05:00", "date") // "2024-06-15"
 * @example formatFHIR("2024-06-15T23-05:00", "date") // "2024-06-15" (an hour with an offset)
 * @example formatFHIR("2024-01-15T10:30:00Z[Europe/London]", "dateTime") // "2024-01-15T10:30:00+00:00"
 * @example formatFHIR("2024-06-15T23:30:00-05:00", "instant") // "2024-06-15T23:30:00-05:00"
 * @example formatFHIR("2024-06-15T10:30:00", "instant") // "" (an instant needs a zone)
 * @example formatFHIR("2024-06-15T10:30:00Z", "dateTime", { precision: "month" }) // "2024-06"
 * @example formatFHIR("2024-06", "dateTime", { precision: "day" }) // "" (finer than the value carries)
 * @example formatFHIR("2016-12-31T23:59:60Z", "instant") // "" (a leap second)
 */
export function formatFHIR(
  value: string,
  type: FhirDateType,
  options?: FhirFormatOptions,
): string {
  try {
    if (typeof value !== "string" || !isOptionsArgument(options)) {
      return "";
    }
    const plan = planWrite(value, type, options?.precision);
    if (plan === null) {
      return "";
    }
    const { target, written, rank, fractionDigits, designator, groups } = plan;
    const pair =
      designator === undefined ? null : readOffsetPair(value, written);
    if (designator !== undefined && pair === null) {
      return "";
    }
    const wallClock = readWallClock(groups, pair);
    let result = writeDigits(wallClock, target, rank, fractionDigits);
    if (rank >= RANK_SECOND && pair !== null) {
      result += keepSpelling(value, designator as string, pair.offset);
    }
    const check = readFhirValue(result);
    return check !== null && fhirTypeAllows(type, check.precision)
      ? result
      : "";
  } catch {
    // Never throws (Core Rule 3)
    return "";
  }
}

interface WritePlan {
  readonly target: Hl7Precision;
  readonly written: Hl7Precision;
  readonly rank: number;
  readonly fractionDigits: number;
  readonly designator: string | undefined;
  readonly groups: Record<string, string | undefined>;
}

/** The checks that need no Temporal: the form, the precision and the type; null when refused. */
function planWrite(
  value: string,
  type: FhirDateType,
  requested: unknown,
): WritePlan | null {
  if (
    requested !== undefined &&
    !FHIR_PRECISIONS.includes(requested as FhirPrecision)
  ) {
    return null;
  }
  const match = isoHl7Form.exec(isoStringBody(value));
  if (match === null) {
    return null;
  }
  const groups = match.groups as Record<string, string | undefined>;
  const { precision: written, fractionDigits } = isoHl7Precision(match);
  const designator = groups["offset"];
  // A second of 60: GMT writes none. A zone with no offset needs a disambiguation choice.
  if (
    groups["second"] === "60" ||
    (designator === undefined && value.includes("["))
  ) {
    return null;
  }
  const target = pickTarget(
    type,
    requested as FhirPrecision | undefined,
    written,
  );
  if (target === null || !fhirTypeAllows(type, target as FhirPrecision)) {
    return null;
  }
  const rank = hl7PrecisionRank(target);
  // §2.24.0.1: "If hours and minutes are specified, a time zone SHALL be populated"
  if (rank >= RANK_SECOND && designator === undefined) {
    return null;
  }
  return { target, written, rank, fractionDigits, designator, groups };
}

/**
 * The instant and offset `toOffsetInstant` reads (`readFormOffsetInstant`, which also reads an
 * hour-only time), or null when it refuses or the offset is not a whole number of minutes (as
 * `formatHL7`): Temporal cannot show an instant at an offset with seconds.
 */
function readOffsetPair(
  value: string,
  written: Hl7Precision,
): { instant: string; offset: string } | null {
  const pair = readFormOffsetInstant(value, written);
  if (pair === null) {
    return null;
  }
  const nanoseconds = parseUtcOffsetNanoseconds(pair.offset);
  return nanoseconds === null || nanoseconds % NANOSECONDS_PER_MINUTE !== 0n
    ? null
    : pair;
}

/** The wall clock as written: the instant seen at its offset, or the fields with `reject`. */
function readWallClock(
  groups: Record<string, string | undefined>,
  pair: { instant: string; offset: string } | null,
): Temporal.PlainDateTime {
  if (pair !== null) {
    return Temporal.Instant.from(pair.instant)
      .toZonedDateTimeISO(pair.offset)
      .toPlainDateTime();
  }
  return Temporal.PlainDateTime.from(
    {
      year: Number(groups["year"]),
      month: Number(groups["month"] ?? 1),
      day: Number(groups["day"] ?? 1),
      hour: Number(groups["hour"] ?? 0),
      minute: Number(groups["minute"] ?? 0),
      second: Number(groups["second"] ?? 0),
    },
    { overflow: "reject" },
  );
}

/** The precision to write; null when it is finer than the input carries. */
function pickTarget(
  type: unknown,
  requested: FhirPrecision | undefined,
  written: Hl7Precision,
): Hl7Precision | null {
  let target: Hl7Precision = written;
  if (requested !== undefined) {
    target = requested;
  } else if (type === "date" && hl7PrecisionRank(written) > RANK_DAY) {
    target = "day";
  }
  return hl7PrecisionRank(target) > hl7PrecisionRank(written) ? null : target;
}

/**
 * After a bracketed zone, the zone's offset. Otherwise the input's own spelling when it names the
 * offset Temporal read (`Z` and `-00:00` name `+00:00`), and that offset when it does not.
 */
function keepSpelling(
  value: string,
  designator: string,
  offset: string,
): string {
  if (hasTimeZoneAnnotation(value)) {
    return offset;
  }
  const named =
    designator === "Z" || designator === "-00:00" ? "+00:00" : designator;
  return named === offset ? designator : offset;
}

/** The digits of the wall clock up to the target: a cut, never a rounding. */
function writeDigits(
  wallClock: Temporal.PlainDateTime,
  target: Hl7Precision,
  rank: number,
  fractionDigits: number,
): string {
  const pad = (n: number, width: number): string =>
    String(n).padStart(width, "0");
  let text = pad(wallClock.year, 4);
  if (rank >= 1) {
    text += `-${pad(wallClock.month, 2)}`;
  }
  if (rank >= RANK_DAY) {
    text += `-${pad(wallClock.day, 2)}`;
  }
  if (rank >= RANK_SECOND) {
    text += `T${pad(wallClock.hour, 2)}:${pad(wallClock.minute, 2)}:${pad(wallClock.second, 2)}`;
  }
  if (target === "fraction") {
    const subSecond =
      pad(wallClock.millisecond, 3) +
      pad(wallClock.microsecond, 3) +
      pad(wallClock.nanosecond, 3);
    text += `.${subSecond.slice(0, fractionDigits)}`;
  }
  return text;
}
