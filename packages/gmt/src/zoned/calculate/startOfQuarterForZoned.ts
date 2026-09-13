import { Temporal } from "@js-temporal/polyfill";

import { zonedQuarterStart } from "../../internal";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the start of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the first instant of that quarter, with every field below the day reset — milliseconds, microseconds and nanoseconds included.
 * - With neither `disambiguation` nor `offset` passed, returns the real start of the quarter's first local month bucket in `value`'s own zone (see `floorToZone`), so the result is never after `value` and a skipped first midnight starts at the quarter's first real instant.
 * - Passing `disambiguation` or `offset` opts into Temporal's wall-clock `.with()` resolution instead.
 * - `disambiguation` (opt-in path) controls DST gap/overlap resolution when the quarter-start boundary lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in "").
 * - `offset` (opt-in path) controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** in the (rare) common-zone case since quarter boundaries don't fall on DST transitions), "use", "ignore" (**the default once either option is passed** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect where a quarter boundary does coincide with a transition), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`).
 * - `fractionalSecondDigits` controls how many fractional seconds are included in the output: 0 (default — no fractional seconds), 3 (milliseconds), 6 (microseconds), or 9 (nanoseconds).
 * - Validation is performed on the input.
 *
 * @param value ISO ZonedDateTime string
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore"), fractionalSecondDigits (0 | 3 | 6 | 9, default 0)
 * @returns ISO ZonedDateTime string for the start of the quarter, or "" on invalid input
 *
 * @example startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-01-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-04-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-10-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", { fractionalSecondDigits: 3 }) // "2024-01-01T00:00:00.000+00:00[UTC]"
 * @example startOfQuarterForZoned("invalid") // ""
 */
export function startOfQuarterForZoned(
  value: string,
  optionsArg?: {
    disambiguation?: Disambiguation;
    offset?: Offset;
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits ?? 0;

  try {
    const zdt = Temporal.ZonedDateTime.from(value);

    if (
      optionsArg?.disambiguation === undefined &&
      optionsArg?.offset === undefined
    ) {
      const start = zonedQuarterStart(zdt);
      return start ? start.toString({ fractionalSecondDigits }) : "";
    }

    const month = zdt.month;
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    return zdt
      .with(
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
      )
      .toString({ fractionalSecondDigits });
  } catch {
    return "";
  }
}
