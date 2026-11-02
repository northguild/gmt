import { wholeSecondsUntil } from "../../internal/lengthFromNow";
import { nowInstant } from "../../internal/temporalCompat";
import {
  resolveUnixEpochUnitOptions,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the whole seconds from now until a stored Unix epoch, such as a JWT `exp`.
 *
 * - Rounded up to a whole second, so a wait of that length never falls short. `result <= 0` means
 *   the target has been reached: it is RFC 7519 section 4.1.4's test that the current time must be
 *   before `exp`.
 * - A past target gives a negative number, and `null` is invalid input only. Check `null` first,
 *   then wait `Math.max(0, n)`: `Math.max(0, null)` is 0, so an unchecked `null` reads as "no
 *   wait".
 * - `value` is a safe integer or a digit string (`"1813060920"`); anything else returns null.
 *   **A fractional epoch returns null**, though RFC 7519 section 2 allows one: every `unix/`
 *   function shares one integer grammar. Call `Math.floor(exp)` first, which can only end a token
 *   early, never late.
 * - No `timeZone`: an instant has none.
 * - No leeway: RFC 7519 section 4.1.4 allows "some small leeway", so add it where you test the
 *   result:
 *
 *   ```ts
 *   const left = secondsUntilUnix(exp, { epochUnit: "seconds" });
 *   const expired = left === null || left + leeway <= 0;
 *   ```
 *
 * - Reads the clock once, after `value` and `options` are checked.
 * - For "expires in 3 days", once `left` is not null and above 0:
 *
 *   ```ts
 *   formatHumanDuration(
 *     normalizeDuration(durationFromUnits({ seconds: left }), { largestUnit: "day" }),
 *   ); // "3d" for 259200
 *   ```
 *
 *   Without `normalizeDuration` the text is `"259200s"`.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: the unit `value` is counted in
 * @returns whole seconds until `value`, negative when it is past, or null for an invalid `value`
 *   or `options` or an epoch outside Temporal's range
 *
 * @example secondsUntilUnix(1813060920, { epochUnit: "seconds" }) // 120 (two minutes after a clock at 1813060800)
 * @example secondsUntilUnix("1813060920", { epochUnit: "seconds" }) // 120 (digit string)
 * @example secondsUntilUnix(1813060800.5, { epochUnit: "seconds" }) // null (not an integer epoch: use Math.floor)
 * @example secondsUntilUnix("soon") // null
 * @example secondsUntilUnix(1813060920, { epochUnit: "minutes" } as never) // null (not a UnixUnit)
 */
export function secondsUntilUnix(
  value: number | string,
  options?: {
    /**
     * The unit `value` is counted in: `"seconds"` or `"milliseconds"`, singular or plural; any
     * other value returns `null`. The result is always in seconds. A seconds value read as the
     * default milliseconds lands in 1970 and looks long past, so pass `"seconds"` for a JWT `exp`.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
  },
): number | null {
  try {
    const epochUnit = resolveUnixEpochUnitOptions(options);
    if (epochUnit === null) {
      return null;
    }

    const instant = unixEpochToInstant(value, epochUnit);
    if (instant === null) {
      return null;
    }

    return wholeSecondsUntil(instant, nowInstant());
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
