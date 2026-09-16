import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { resolveRelativeRounding } from "../../internal/resolveRelativeRounding";
import { toInstantFromUtc } from "../../internal/toInstantFromUtc";
import { durationTotal } from "../../internal/zonedWallClockDifference";
import type { RelativeTimeFormatOptions, RelativeUnit } from "../../types";
import { isValidUtc } from "../validate";

export interface FormatRelativeUtcOptions extends RelativeTimeFormatOptions {
  largestUnit?: RelativeUnit;
  reference?: string;
  timeZone?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: 86_400 },
  { unit: "day", maxSeconds: Infinity },
];

/**
 * Format the relative time between a UTC ISO string and a reference instant.
 *
 * - Auto-picks the display unit (second through year) based on the distance, unless
 *   `largestUnit` forces one.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference, timeZone }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", { reference: "2026-04-15T14:30:45Z" }) // "90 days ago"
 * @example formatRelativeUtc(value, "en-US", { roundingMethod: "floor" }) // rounds toward the earlier boundary
 * @example formatRelativeUtc("not-a-date") // ""
 */
export function formatRelativeUtc(
  value: string,
  locale?: string,
  options: FormatRelativeUtcOptions = {},
): string {
  if (!isValidUtc(value)) return "";
  if (options.reference !== undefined && !isValidUtc(options.reference))
    return "";

  const target = toInstantFromUtc(value);
  if (target === null) return "";

  let reference: Temporal.Instant;
  if (options.reference) {
    const ref = toInstantFromUtc(options.reference);
    if (ref === null) return "";
    reference = ref;
  } else {
    try {
      reference = Temporal.Now.instant();
    } catch {
      return "";
    }
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
