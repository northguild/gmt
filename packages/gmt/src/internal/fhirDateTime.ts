import { fhirDateTime } from "../regex/fhir";
import type { FhirDateTime, FhirDateType, FhirPrecision } from "../types";
import { LEAP_SECOND_STEPS, taiOfUtc } from "./leapSeconds";
import { readOffsetInstant } from "./offsetInstant";
import { Temporal } from "./temporal";
import { parseUtcReading } from "./utcReading";

/** FHIR precisions, coarsest first. */
export const FHIR_PRECISIONS: readonly FhirPrecision[] = Object.freeze([
  "year",
  "month",
  "day",
  "second",
  "fraction",
] as const);

/**
 * The precisions each type allows: `date` has no time, `instant` is at least to the second, and
 * `dateTime` takes all five (R4 Datatypes §2.24.0.1).
 */
export const FHIR_TYPE_PRECISIONS: Readonly<
  Record<FhirDateType, readonly FhirPrecision[]>
> = Object.freeze({
  date: Object.freeze(["year", "month", "day"] as const),
  dateTime: FHIR_PRECISIONS,
  instant: Object.freeze(["second", "fraction"] as const),
});

/** The longest fraction Temporal holds: nanoseconds. */
const MAX_FRACTION_DIGITS = 9;

/**
 * True when `type` is a FhirDateType and allows `precision`. An own-key check, so `"toString"`
 * is false.
 */
export function fhirTypeAllows(
  type: unknown,
  precision: FhirPrecision,
): boolean {
  return (
    typeof type === "string" &&
    Object.hasOwn(FHIR_TYPE_PRECISIONS, type) &&
    FHIR_TYPE_PRECISIONS[type as FhirDateType].includes(precision)
  );
}

/** The date part names a day that exists (§2.24.0.1 "Dates SHALL be valid dates"). */
function isRealCalendarDate(
  year: string,
  month: string | undefined,
  day: string | undefined,
): boolean {
  try {
    Temporal.PlainDate.from(
      {
        year: Number(year),
        month: month === undefined ? 1 : Number(month),
        day: day === undefined ? 1 : Number(day),
      },
      { overflow: "reject" },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * The time and offset are a moment Temporal holds. A second of `60` goes through the leap-second
 * core (exactly what `isLeapSecond` does), because `readOffsetInstant` refuses every one.
 */
function isRealMoment(value: string, second: string | undefined): boolean {
  if (second === "60") {
    const reading = parseUtcReading(value);
    return (
      reading !== null &&
      reading.secondSixty &&
      taiOfUtc(LEAP_SECOND_STEPS, reading) !== null
    );
  }
  return readOffsetInstant(value) !== null;
}

/**
 * The core of `parseFHIR`, `isValidFHIR` and `formatFHIR`'s final check. Never throws.
 *
 * The pattern reads the form, Temporal reads the values: a month or day that does not exist is
 * refused, a second of `60` only on an inserted leap second (GMT rule, SPA-48's table), and a
 * fraction of more than nine digits not at all.
 */
export function readFhirValue(value: unknown): FhirDateTime | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const m = fhirDateTime.exec(value);
    if (m === null) {
      return null;
    }
    // Group numbers of the anchored `fhirDateTime`: 1 year, 5 month, 7 day, 10 second,
    // 11 fraction (with its "."), 12 designator (`Z` or `±HH:MM`). The minute is not captured.
    const [, year = "", , , , month, , day, , , second, fraction, designator] =
      m;
    if (!isRealCalendarDate(year, month, day)) {
      return null;
    }
    if (designator === undefined) {
      let precision: FhirPrecision = "year";
      if (day !== undefined) {
        precision = "day";
      } else if (month !== undefined) {
        precision = "month";
      }
      return { value, precision, offset: "" };
    }
    if (
      (fraction !== undefined && fraction.length - 1 > MAX_FRACTION_DIGITS) ||
      !isRealMoment(value, second)
    ) {
      return null;
    }
    return {
      value,
      precision: fraction === undefined ? "second" : "fraction",
      offset:
        designator === "Z" || designator === "-00:00" ? "+00:00" : designator,
    };
  } catch {
    return null;
  }
}
