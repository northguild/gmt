import { Temporal } from "@js-temporal/polyfill";
import { resolveDurationRelativeTo } from "../../internal";
import type { DurationRelativeTo } from "../../types";

/**
 * Roll an ISO 8601 duration string's small units into larger ones.
 *
 * - Uses Temporal.Duration.from and .round to rebalance, then .toString() to re-emit.
 * - Defaults to { largestUnit: "auto" } when no options are given, which reformats a
 *   day/time-only duration without promoting units (e.g. "PT90M" stays "PT90M" — pass
 *   an explicit largestUnit to promote).
 * - relativeTo is required whenever a calendar unit (year/month/week) is involved,
 *   either as the requested largestUnit or because the input duration already has a
 *   nonzero year/month/week component (this applies even under the "auto" default).
 *   Without relativeTo in either case, returns "".
 * - roundingIncrement must evenly divide 60 for minute/second (24 for hour);
 *   unconstrained for day/week/month/year. An invalid increment returns "".
 * - Returns "" for invalid input: non-string value, invalid duration string, or
 *   invalid relativeTo.
 *
 * @param value ISO 8601 duration string
 * @param options optional: { largestUnit, smallestUnit, roundingIncrement, roundingMode, relativeTo } per Temporal's Duration.round options
 * @returns rebalanced ISO 8601 duration string, or "" on invalid input
 *
 * @example normalizeDuration("PT90M", { largestUnit: "hour" }) // "PT1H30M"
 * @example normalizeDuration("PT90M30S", { smallestUnit: "minute" }) // "PT91M"
 * @example normalizeDuration("P45D", { largestUnit: "month" }) // "" (relativeTo required)
 * @example normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-01-01" }) // "P1M14D"
 * @example normalizeDuration("invalid") // ""
 * @example normalizeDuration("P400D", { largestUnit: "year", relativeTo: "5784-06-15[u-ca=hebrew]" }) // "P1Y15D" (Hebrew leap year — relativeTo accepts GMT's calendar-annotated PlainDate string, not Temporal's own ISO-digit u-ca convention)
 */
export function normalizeDuration(
  value: string,
  options?: {
    largestUnit?: Temporal.LargestUnit<Temporal.DateTimeUnit>;
    smallestUnit?: Temporal.SmallestUnit<Temporal.DateTimeUnit>;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
    relativeTo?: DurationRelativeTo;
  },
): string {
  if (typeof value !== "string") {
    return "";
  }

  try {
    const duration = Temporal.Duration.from(value);
    return duration
      .round({
        largestUnit: options?.largestUnit ?? "auto",
        smallestUnit: options?.smallestUnit,
        roundingIncrement: options?.roundingIncrement,
        roundingMode: options?.roundingMode,
        relativeTo: resolveDurationRelativeTo(options?.relativeTo),
      })
      .toString();
  } catch {
    return "";
  }
}
