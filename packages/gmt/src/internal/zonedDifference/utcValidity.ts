/*
 * ---------------------------------------------------------------------------------------------
 * Defect 2 — UTC fast path without a validity check (zoned.D)
 * ---------------------------------------------------------------------------------------------
 * 2. **UTC fast path without a validity check.** The polyfill's `GetPossibleEpochNanoseconds`
 *    returns `GetUTCEpochNanoseconds` for `"UTC"` without the `IsValidEpochNanoseconds` check the
 *    spec performs for every zone, so near the maximum a UTC rounding or total window that ends
 *    past the limit yields a value where TC39 throws (`+00:00` and IANA zones throw correctly).
 *    - Trigger: the zone is `"UTC"`, the polyfill returned a value, and the operation reaches a
 *      limit. The same call is repeated in the `+00:00` zone, which is identical to `"UTC"` in the
 *      spec but takes the validating offset-zone branch; if it throws, that error is thrown,
 *      otherwise the original UTC result is returned unchanged.
 *    - Retired by: no upstream fix yet (drafted as issue D in the CORE-6 polyfill research).
 *    - Removal: delete this file and the guarded call in `./rangeLimit.ts` (`runAtRangeLimit`), and the
 *      zoned.D rows in `../temporalCompat/repros.ts`. If zoned.A is gone too, delete `./rangeLimit.ts`,
 *      the reach code and `atRangeLimit`, and make each wrapper return its plain polyfill call. Then
 *      drop the imports and locals tsc reports unused, and the `./operations.ts` exports fallow
 *      reports unused.
 * ---------------------------------------------------------------------------------------------
 */

/** The zone that resolves exactly like `"UTC"` in the spec but through the validating branch. */
const UTC_EQUIVALENT_OFFSET_ZONE = "+00:00";

/** Defect 2: the spec validates every UTC exact time; `+00:00` resolves identically and does. */
export function checkUtcValidity(compute: (timeZone: string) => unknown): void {
  compute(UTC_EQUIVALENT_OFFSET_ZONE);
}
