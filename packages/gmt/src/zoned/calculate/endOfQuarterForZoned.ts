import { Temporal } from "@js-temporal/polyfill";

import type { Disambiguation, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the end of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the last moment of that quarter.
 * - Returns the last nanosecond of the last day of the quarter.
 * - `disambiguation` controls DST gap/overlap resolution when a quarter boundary lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in "").
 * - `offset` controls whether the source's existing UTC offset is kept when computing a new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** in the (rare) common-zone case since quarter boundaries don't fall on DST transitions), "use", "ignore" (**this function's default** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect where a quarter boundary does coincide with a transition), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`). Leave `offset` at its default unless you specifically need Temporal's raw `.with()` semantics.
 * - Validation is performed on the input.
 *
 * @param value ISO ZonedDateTime string
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns ISO ZonedDateTime string for the end of the quarter, or "" on invalid input
 *
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-03-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-06-30T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-12-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("invalid") // ""
 */
export function endOfQuarterForZoned(
  value: string,
  optionsArg?: { disambiguation?: Disambiguation; offset?: Offset },
): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";

  try {
    const zdt = Temporal.ZonedDateTime.from(value);
    const month = zdt.month;
    const quarterEndMonth = Math.floor((month - 1) / 3) * 3 + 3;

    const quarterStart = zdt.with(
      { month: quarterEndMonth, day: 1, hour: 0, minute: 0, second: 0 },
      { disambiguation, offset },
    );
    const nextQuarterStart = quarterStart.add({ months: 1 });
    const lastDayOfQuarter = nextQuarterStart.subtract({ days: 1 });

    return lastDayOfQuarter
      .with(
        {
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        },
        { disambiguation, offset },
      )
      .toString();
  } catch {
    return "";
  }
}
