/**
 * RegExp matching a timezone identifier in one of three forms:
 *
 *  1. Literal `UTC` or `GMT`.
 *  2. IANA-style bracketed zone: `Area/Locality` (e.g. `America/New_York`, `Asia/Tokyo`),
 *     with support for arbitrarily deep nesting (`Area/SubArea/Locality`).
 *  3. Any other `[A-Za-z_+-]+(?:/[A-Za-z0-9_+-]+)+` shape — permissive enough to accept
 *     custom or future zone identifiers without rejecting them at the shape layer.
 *
 * This is a SHAPE-ONLY check used by `isValidZonedDateTime` and similar validators.
 * Real timezone validation (existence, IANA database membership) is delegated to
 * `Temporal.Zone.from` in `internal/calendarZonedString.ts`.
 *
 * @example timeZoneLike.test("UTC")              // true
 * @example timeZoneLike.test("GMT")              // true
 * @example timeZoneLike.test("America/New_York") // true
 * @example timeZoneLike.test("Asia/Tokyo")       // true
 * @example timeZoneLike.test("Custom/Zone")      // true (permissive)
 * @example timeZoneLike.test("+05:00")           // false (numeric offset, not a zone id)
 * @example timeZoneLike.test("UTC+05:00")        // false (mixed form)
 */
export const timeZoneLike: RegExp =
  /^(?:UTC|GMT|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+)$/;
