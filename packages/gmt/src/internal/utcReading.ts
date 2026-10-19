import { Temporal } from "./temporal";
import { plainDate } from "../regex/date";
import { instantLeapSecond } from "../regex/leap-second";
import { NANOSECONDS_PER_SECOND } from "./foreignEpochs";
import { parseInstantNanoseconds } from "./instantNanoseconds";
import { EXTENDED_UTC_OFFSET, isoStringBody } from "./isoStringBody";

/**
 * A UTC label that may be a leap second.
 *
 * Temporal cannot represent a second of 60: `Temporal.Instant.from("2016-12-31T23:59:60.5Z")`
 * clamps it to `…:59.5Z` (proposal-temporal `ParseISODateTime`). A reading keeps the clamped
 * instant and a flag, so the inserted second (ITU-R TF.460-6 Annex 1 §2.2) and the second
 * before it stay two different readings.
 */
export interface UtcReading {
  /** For a leap reading, the instant of `…T23:59:59.f` (Temporal's clamp of `…:60.f`). */
  readonly epochNanoseconds: bigint;
  /** Whether the label's second field is 60. */
  readonly secondSixty: boolean;
}

/** The last year this realm writes: its strings carry four-digit years only (a GMT rule). */
export const MAX_FOUR_DIGIT_YEAR = 9999;

/** `plainDate` without its anchors: GMT's ISO 8601 extended calendar date. */
const DATE = plainDate.source.slice(1, -1);

/**
 * An instant body (before the first `[`) whose second is 60, in GMT's strict extended shape:
 * `<date>T<hh>:<mm>:60[.fraction]`, then `Z` or `±HH:MM[:SS[.fraction]]`. The fraction is 1 to 9
 * digits after `.` or `,` (RFC 3339 §5.6 `time-secfrac`; Temporal's nanosecond resolution).
 * Basic format, lower-case `t`/`z` and a space separator are refused, as `instantBody` refuses
 * them for every other second.
 */
const secondSixtyInstantBody = new RegExp(
  `^${DATE}T(?:[01]\\d|2[0-3]):[0-5]\\d:60(?:[.,]\\d{1,9})?(?:Z|${EXTENDED_UTC_OFFSET})$`,
);

/**
 * Read a UTC instant string that may carry a second of 60.
 *
 * Checks shape only: an ordinary instant goes through `parseInstantNanoseconds`; a second-60
 * instant in GMT's strict extended shape is read by `Temporal.Instant.from`, which clamps the
 * second to 59. Whether that second 60 was a real leap second is `taiOfUtc`'s decision.
 *
 * @param value candidate ISO 8601 instant string
 * @returns the reading, or null when `value` is not an instant string GMT reads
 */
export function parseUtcReading(value: unknown): UtcReading | null {
  if (typeof value !== "string") {
    return null;
  }

  const epochNanoseconds = parseInstantNanoseconds(value);
  if (epochNanoseconds !== null) {
    return { epochNanoseconds, secondSixty: false };
  }

  if (
    !instantLeapSecond.test(value) ||
    !secondSixtyInstantBody.test(isoStringBody(value))
  ) {
    return null;
  }

  try {
    return {
      epochNanoseconds: Temporal.Instant.from(value).epochNanoseconds,
      secondSixty: true,
    };
  } catch {
    return null;
  }
}

/**
 * Write a UTC reading as an ISO 8601 instant string in `Z` form.
 *
 * - An ordinary reading is `Temporal.Instant#toString()`.
 * - A second-60 reading is written `…T23:59:60[.fraction]Z` (ITU-R TF.460-6 Annex 3: "30 June,
 *   23h 59m 60.6s UTC"), the fraction in Temporal's shortest digits.
 * - Four-digit years only, as in the realm's time-scale strings (a GMT rule): a reading past
 *   9999-12-31 is "", never Temporal's six-digit `+010000-…` form.
 *
 * @param reading the UTC reading
 * @returns the instant string, or "" past year 9999 or when Temporal throws
 */
export function formatUtcReading(reading: UtcReading): string {
  try {
    const instant = Temporal.Instant.fromEpochNanoseconds(
      reading.epochNanoseconds,
    );
    if (instant.toZonedDateTimeISO("UTC").year > MAX_FOUR_DIGIT_YEAR) {
      return "";
    }
    return reading.secondSixty
      ? `${secondSixtyWallClock(reading.epochNanoseconds)}Z`
      : instant.toString();
  } catch {
    return "";
  }
}

/**
 * The wall clock of a second-60 label, `YYYY-MM-DDTHH:MM:60[.fraction]`, from the `…:59.f`
 * instant Temporal clamps it to. Throws where Temporal throws, so callers call it inside `try`.
 *
 * @param nanoseconds the clamped `…:59.f` instant or label, in epoch nanoseconds
 * @returns the wall clock with second 60 and no designator
 */
export function secondSixtyWallClock(nanoseconds: bigint): string {
  const wall = Temporal.Instant.fromEpochNanoseconds(nanoseconds)
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime();
  return `${wall.toPlainDate().toString()}T${wall
    .toPlainTime()
    .toString({ smallestUnit: "minute" })}:60${subsecondFraction(nanoseconds)}`;
}

/**
 * The fraction of the second a nanosecond count falls in, written as Temporal writes a time's
 * fraction: `""` for none, else `.` and the shortest digits (`".5"`, `".123456789"`).
 *
 * The sub-second count is split into milliseconds, microseconds and nanoseconds: passed as
 * `nanosecond` alone, Temporal's default `overflow: "constrain"` clamps it to 999.
 *
 * @param nanoseconds epoch or label nanoseconds
 * @returns the fraction, with its leading `.`, or ""
 */
export function subsecondFraction(nanoseconds: bigint): string {
  const subsecond = Number(
    ((nanoseconds % NANOSECONDS_PER_SECOND) + NANOSECONDS_PER_SECOND) %
      NANOSECONDS_PER_SECOND,
  );
  return Temporal.PlainTime.from(
    {
      hour: 0,
      millisecond: Math.floor(subsecond / 1e6),
      microsecond: Math.floor(subsecond / 1e3) % 1000,
      nanosecond: subsecond % 1000,
    },
    { overflow: "reject" },
  )
    .toString()
    .slice("00:00:00".length);
}
