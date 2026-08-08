import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the start of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter start, converts back to epoch.
 * - Q1 returns month 1, Q2 returns month 4, Q3 returns month 7, Q4 returns month 10.
 * - `disambiguation` controls DST gap/overlap resolution when the quarter-start boundary lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in null).
 * - `offset` controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** in the (rare) common-zone case since quarter boundaries don't fall on DST transitions), "use", "ignore" (**this function's default** — always recomputes from time zone + local time, discarding the stale offset), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`). Leave `offset` at its default unless you specifically need Temporal's raw `.with()` semantics.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns Unix epoch number representing the start of the quarter, or null on invalid input
 *
 * @example startOfQuarterForUnix(1706659200000) // 1704067200000
 * @example startOfQuarterForUnix(-86400000) // -25598400001 (Q1 1969 starts Jan 1)
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
    const month = zdt.month;
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    const result = zdt.with(
      {
        month: quarterStartMonth,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      { disambiguation, offset },
    );

    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;

    return epoch;
  } catch {
    return null;
  }
}
