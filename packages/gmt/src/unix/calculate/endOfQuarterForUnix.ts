import { Temporal } from "@js-temporal/polyfill";
import { zonedQuarterEnd } from "../../internal";
import type { Disambiguation, Offset } from "../../types";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the end of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter end, converts back to epoch.
 * - Q1 ends month 3, Q2 ends month 6, Q3 ends month 9, Q4 ends month 12.
 * - With neither `disambiguation` nor `offset` passed, returns the last millisecond before the next quarter's first local month bucket in `timeZone` (see `floorToZone`), so the result is never before `value`: a quarter whose last local hour repeats (`Africa/Cairo`, 2010-09-30) ends with the second pass.
 * - Passing `disambiguation` or `offset` opts into Temporal's wall-clock `.with()` resolution instead. That result can land before `value` on the other pass of an overlap.
 * - `disambiguation` (opt-in path) controls DST gap/overlap resolution when a quarter boundary lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in null).
 * - `offset` (opt-in path) controls whether the source's existing UTC offset is kept when computing a new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** in the (rare) common-zone case since quarter boundaries don't fall on DST transitions), "use", "ignore" (**the default once either option is passed** — always recomputes from time zone + local time, discarding the stale offset), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`).
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore" once either is passed)
 * @returns Unix epoch number representing the end of the quarter, or null on invalid input
 *
 * @example endOfQuarterForUnix(1706659200000, { timeZone: "UTC" }) // 1711929599999
 * @example endOfQuarterForUnix(-86400000, { timeZone: "UTC" }) // -1 (Q4 1969 ends Dec 31)
 * @example endOfQuarterForUnix(1285882200000, { timeZone: "Africa/Cairo" }) // 1285883999999 (the second pass of Q3 2010's repeated last hour; the quarter ends after it)
 */
export function endOfQuarterForUnix(
  value: number,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): number | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();
  const disambiguation = options?.disambiguation ?? "compatible";
  const offset = options?.offset ?? "ignore";

  if (!timeZone || !isValidTimeZone(timeZone) || !isValidUnixUnit(epochUnit)) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value * 1000 : value,
    );

    const zdt = instant.toZonedDateTimeISO(timeZone);
    let result: Temporal.ZonedDateTime | null;

    if (
      options?.disambiguation === undefined &&
      options?.offset === undefined
    ) {
      result = zonedQuarterEnd(zdt);
    } else {
      const month = zdt.month;
      const quarterEndMonth = Math.floor((month - 1) / 3) * 3 + 3;

      const quarterStart = zdt.with(
        { month: quarterEndMonth, day: 1, hour: 0, minute: 0, second: 0 },
        { disambiguation, offset },
      );
      const nextQuarterStart = quarterStart.add({ months: 1 });
      const lastDayOfQuarter = nextQuarterStart.subtract({ days: 1 });

      result = lastDayOfQuarter.with(
        {
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        },
        { disambiguation, offset },
      );
    }

    if (!result) return null;

    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;

    return epoch;
  } catch {
    return null;
  }
}
