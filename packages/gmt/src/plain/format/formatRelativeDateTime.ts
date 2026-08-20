import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime, resolveRelativeRounding } from "../../internal";
import type { RelativeRoundingMethod } from "../../types";
import { isValidDateTime } from "../validate";

// Intl.RelativeTimeFormatUnit includes "quarter" which Temporal doesn't support.
type RelativeUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";

export interface FormatRelativeDateTimeOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  /**
   * How the computed distance rounds to the display unit: "floor" rounds toward the
   * earlier boundary, "ceil" toward the later boundary, "round" (default) to the nearest —
   * matches current behavior when omitted.
   */
  roundingMethod?: RelativeRoundingMethod;
  reference?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: 86_400 },
  { unit: "day", maxSeconds: Infinity },
];

/**
 * Format the relative time between a plain date-time and a reference date-time.
 *
 * - Auto-picks the display unit (second through year) based on the distance, unless
 *   `largestUnit` forces one.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 *
 * @param value ISO date-time string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeDateTime("2026-03-17T09:00:00", "en-GB", { style: "long" }) // "in 3 hours"
 * @example formatRelativeDateTime(value, "en-US", { roundingMethod: "floor" }) // rounds toward the earlier boundary
 * @example formatRelativeDateTime("not-a-date") // ""
 */
export function formatRelativeDateTime(
  value: string,
  locale?: string,
  options: FormatRelativeDateTimeOptions = {},
): string {
  if (!isValidDateTime(value)) return "";
  if (options.reference !== undefined && !isValidDateTime(options.reference))
    return "";

  try {
    const target = Temporal.PlainDateTime.from(value);
    const reference = options.reference
      ? Temporal.PlainDateTime.from(options.reference)
      : Temporal.Now.plainDateTimeISO();

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
      // month/year are calendrical — relativeTo needs a PlainDate
      amount = resolveRelativeRounding(
        diff.total({ unit, relativeTo: reference.toPlainDate() }),
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
