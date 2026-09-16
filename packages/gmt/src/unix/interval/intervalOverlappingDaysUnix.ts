import { Temporal } from "@js-temporal/polyfill";
import { resolveUnixTimeZone } from "../../internal/resolveUnixTimeZone";
import { parseUnixEpochInterval } from "../../internal";
import { isValidUnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return how many distinct calendar dates two Unix epoch intervals share, in a given
 * time zone.
 *
 * - Counts the number of local dates touched by the closed intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd)]` — inclusive of both endpoints.
 * - Uses the system timeZone by default (consistent with `addUnix` and
 *   `intervalCountUnix`), so day counts are host-dependent unless `timeZone` is given.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one date and count as `1`.
 * - Returns `0` when the intervals do not overlap at all (a well-defined answer, not
 *   invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (epoch values that are not safe integers or numeric strings of
 *   one — fractions, empty strings and values beyond ±(2^53 − 1) are invalid — or an invalid
 *   timeZone).
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates. To reproduce date-fns's number,
 *   compose `intervalIntersectionUnix` with `intervalCountUnix`:
 *   `const span = intervalIntersectionUnix(aStart, aEnd, bStart, bEnd); span ? intervalCountUnix(span.start, span.end, "day") : 0;`
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — first interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — first interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — second interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — second interval end
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA, default: system timeZone)
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysUnix(0, 172800000, 86400000, 259200000, { timeZone: "UTC" }) // 2
 * @example intervalOverlappingDaysUnix(0, 86400000, 86400000, 172800000, { timeZone: "UTC" }) // 1 (adjacent)
 * @example intervalOverlappingDaysUnix(0, 86400000, 172800000, 259200000, { timeZone: "UTC" }) // 0 (disjoint)
 * @example intervalOverlappingDaysUnix(NaN, 172800000, 86400000, 259200000, { timeZone: "UTC" }) // null
 */
export function intervalOverlappingDaysUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  },
): number | null {
  const a = parseUnixEpochInterval(aStart, aEnd);
  const b = parseUnixEpochInterval(bStart, bEnd);

  if (a === null || b === null) {
    return null;
  }

  const { start: a1, end: a2 } = a;
  const { start: b1, end: b2 } = b;

  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = resolveUnixTimeZone(options?.timeZone);

  if (!timeZone || !isValidUnixUnit(epochUnit)) {
    return null;
  }

  if (a2 < b1 || b2 < a1) {
    return 0;
  }

  try {
    const toMs = (value: number) =>
      epochUnit === "seconds" ? value * 1000 : value;

    const start = Math.max(a1, b1);
    const end = Math.min(a2, b2);

    const startDate = Temporal.Instant.fromEpochMilliseconds(toMs(start))
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();
    const endDate = Temporal.Instant.fromEpochMilliseconds(toMs(end))
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();

    return startDate.until(endDate, { largestUnit: "day" }).days + 1;
  } catch {
    return null;
  }
}
