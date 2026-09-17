import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { unixEpochToInstant } from "../../internal/unixEpochInstant";
import { resolveRelativeRounding } from "../../internal/resolveRelativeRounding";
import { durationTotal } from "../../internal/zonedWallClockDifference";
import type { RelativeRoundingMethod, RelativeUnit } from "../../types";
import { isValidUtc } from "../../utc/validate";
import { isValidUnixUnit } from "../validate/isValidUnixUnit";

export interface FormatRelativeUnixOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  roundingMethod?: RelativeRoundingMethod;
  epochUnit?: "milliseconds" | "seconds";
  reference?: string | number;
  timeZone?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: 86_400 },
  { unit: "day", maxSeconds: Infinity },
];

/**
 * Format the relative time between a unix epoch value and a reference instant.
 *
 * - Auto-picks the display unit (second through day) based on the distance, unless
 *   `largestUnit` forces one — week, month and year are never auto-picked, so a 3-year distance
 *   reads "1,096 days ago" unless `largestUnit: "year"` is passed.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 * - `timeZone` anchors a forced calendar unit (`largestUnit` week, month or year). Omitted, it is
 *   `"UTC"` — not the system time zone, unlike the other `unix/` functions that take a `timeZone`.
 *
 * @param value unix epoch (string or number, per `epochUnit`) to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { style, numeric, largestUnit, roundingMethod, epochUnit, reference, timeZone }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds", reference: 1805358645000 }) // "1,096 days ago" (day is the largest auto-picked unit)
 * @example formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds", reference: 1805358645000, largestUnit: "year" }) // "3 years ago"
 * @example formatRelativeUnix(0, "en-US", { reference: 37800000, roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeUnix("not-a-number") // ""
 */
export function formatRelativeUnix(
  value: string | number,
  locale?: string,
  options: FormatRelativeUnixOptions = {},
): string {
  // A default parameter covers only `undefined`; `null` also means "no options".
  options ??= {};
  const epochUnit = options.epochUnit ?? "milliseconds";
  if (!isValidUnixUnit(epochUnit)) return "";

  const target = unixEpochToInstant(value, epochUnit);
  if (target === null) return "";

  let reference: Temporal.Instant;
  if (options.reference === undefined) {
    try {
      reference = Temporal.Now.instant();
    } catch {
      return "";
    }
  } else if (typeof options.reference === "string") {
    // String references can be a numeric unix epoch ("1709164800000") OR a
    // UTC ISO string ("2024-02-29T00:00:00Z"). Try the numeric path first to
    // match formatUnix's symmetry, then fall back to UTC.
    const numericRef = unixEpochToInstant(options.reference, epochUnit);
    if (numericRef !== null) {
      reference = numericRef;
    } else if (isValidUtc(options.reference)) {
      try {
        reference = Temporal.Instant.from(options.reference);
      } catch {
        return "";
      }
    } else {
      return "";
    }
  } else {
    const ref = unixEpochToInstant(options.reference, epochUnit);
    if (ref === null) return "";
    reference = ref;
  }

  try {
    const diff = target.since(reference);
    const absSeconds = Math.abs(diff.total("second"));

    const unit =
      options.largestUnit ??
      AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ??
      "day";

    let amount: number;
    try {
      amount = resolveRelativeRounding(
        diff.total(unit),
        options.roundingMethod,
      );
    } catch {
      // month/year are calendrical and need a relativeTo anchor.
      // Defer timezone normalization until we know we need it.
      const tz = normalizeTimeZone(options.timeZone);
      amount = resolveRelativeRounding(
        durationTotal(diff, unit, reference.toZonedDateTimeISO(tz)),
        options.roundingMethod,
      );
    }

    return normalizeDateTime(
      new Intl.RelativeTimeFormat(locale, {
        numeric: options.numeric ?? "auto",
        style: options.style ?? "long",
      }).format(amount, unit),
    );
  } catch {
    return "";
  }
}
