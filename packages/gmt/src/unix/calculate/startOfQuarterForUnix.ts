import { Temporal } from "@js-temporal/polyfill";
import { zonedQuarterStart } from "../../internal";
import type { Disambiguation, Offset } from "../../types";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the start of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter start, converts back to epoch.
 * - Q1 returns month 1, Q2 returns month 4, Q3 returns month 7, Q4 returns month 10, with every field below the day reset — milliseconds included.
 * - With neither `disambiguation` nor `offset` passed, returns the real start of the quarter's first local month bucket in `timeZone` (see `floorToZone`), so the result is never after `value`.
 * - Passing `disambiguation` or `offset` opts into Temporal's wall-clock `.with()` resolution instead.
 * - `disambiguation` (opt-in path) controls DST gap/overlap resolution when the quarter-start boundary lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in null).
 * - `offset` (opt-in path) controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** in the (rare) common-zone case since quarter boundaries don't fall on DST transitions), "use", "ignore" (**the default once either option is passed** — always recomputes from time zone + local time, discarding the stale offset), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`).
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore" once either is passed)
 * @returns Unix epoch number representing the start of the quarter, or null on invalid input
 *
 * @example startOfQuarterForUnix(1706659200000, { timeZone: "UTC" }) // 1704067200000
 * @example startOfQuarterForUnix(1715776496789, { timeZone: "UTC" }) // 1711929600000 (2024-05-15T12:34:56.789Z; the milliseconds are reset too)
 * @example startOfQuarterForUnix(-86400000, { timeZone: "UTC" }) // -7948800000 (1969-12-31 is in Q4, which starts Oct 1)
 */
export function startOfQuarterForUnix(
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
      result = zonedQuarterStart(zdt);
    } else {
      const month = zdt.month;
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

      result = zdt.with(
        {
          month: quarterStartMonth,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
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
