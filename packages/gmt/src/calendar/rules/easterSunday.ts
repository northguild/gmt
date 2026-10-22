import { easterEpochDay } from "../../internal/easter";
import { isoDateString } from "../../internal/epochDay";
import { isOptionsArgument } from "../../internal/isObject";
import type { EasterComputus } from "../../types/holiday-rule";

/**
 * Easter Sunday of a year as an ISO date, by the Gregorian computus unless the Julian one is asked for.
 *
 * - The Gregorian computus (Meeus, *Astronomical Algorithms*, ch. 8) is applied proleptically
 *   before 1583, because Temporal dates are proleptic Gregorian.
 * - The Julian computus gives the Easter of the Julian calendar, returned as an ISO (proleptic
 *   Gregorian) date. Far from the present its ISO year can differ from `year`: Julian year 33808
 *   gives `"+033809-01-01"`.
 * - Returns `""` when `year` is not an integer, `options` is not an object or `undefined`,
 *   `options.computus` is neither `"gregorian"` nor `"julian"`, or the date falls outside
 *   Temporal's range.
 *
 * @param year integer year; zero and negative years are accepted
 * @param options options bag; `undefined` means the defaults
 * @returns ISO PlainDate string of Easter Sunday, or "" on invalid input
 *
 * @example easterSunday(2024) // "2024-03-31"
 * @example easterSunday(2024, { computus: "julian" }) // "2024-05-05"
 * @example easterSunday(2025, { computus: "julian" }) // "2025-04-20" — the two computus coincide
 * @example easterSunday(2024.5) // ""
 * @example easterSunday(2024, { computus: "lunar" }) // ""
 */
export function easterSunday(
  year: number,
  options?: {
    /**
     * Which computus decides Easter: `"gregorian"` or `"julian"` (the Julian calendar's Easter).
     *
     * @defaultValue "gregorian"
     */
    computus?: EasterComputus;
  },
): string {
  try {
    if (!Number.isInteger(year) || !isOptionsArgument(options)) {
      return "";
    }
    const requested = options?.computus;
    const computus = requested === undefined ? "gregorian" : requested;
    if (computus !== "gregorian" && computus !== "julian") {
      return "";
    }
    const epochDay = easterEpochDay(year, computus);

    return epochDay === null ? "" : isoDateString(epochDay);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
