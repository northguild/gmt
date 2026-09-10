/**
 * RegExp matching an ISO 8601 UTC offset in the extended form GMT's offset-instant pair
 * stores: `±HH:MM`, optionally `±HH:MM:SS`.
 *
 * - Anchored, so it matches a whole offset rather than the offset half of a datetime string.
 * - `Z` is deliberately **not** matched. `Z` is a designator meaning "this string is already
 *   UTC"; the pair's `offset` field records where the event happened, and for UTC that is
 *   `+00:00`. Accepting both would give one fact two spellings.
 * - Seconds are allowed because IANA offsets were not always whole minutes: `Africa/Monrovia`
 *   ran at `-00:44:30` until 1972, and `toOffsetInstant` reports it as written rather than
 *   rounding a real offset to a convenient one.
 * - Sub-second offsets are rejected. ISO 8601 permits them and `Temporal.Instant.from` parses
 *   them, but no zone, and no standard that stores this pair, has ever used one.
 * - Shape only. Whether the offset is in Temporal's representable range is a separate check —
 *   `internal/utcOffsetString.ts` applies both.
 *
 * @example utcOffset.test("-04:00") // true
 * @example utcOffset.test("+05:45") // true
 * @example utcOffset.test("-00:44:30") // true (Africa/Monrovia before 1972)
 * @example utcOffset.test("Z") // false (a designator, not an offset)
 * @example utcOffset.test("-0400") // false (basic format)
 * @example utcOffset.test("+24:00") // false (out of range)
 */
export const utcOffset: RegExp =
  /^[+-](?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/;
