/**
 * Resolve a two-digit year inside a caller-chosen hundred-year window: the one year in
 * `[windowStart, windowStart + 99]` whose last two digits are `yy`.
 *
 * Pure arithmetic: the function holds no window of its own and reads no clock. The window comes
 * from the caller's `TwoDigitYearOptions.yearWindow`, resolved by `readYearWindowStart`
 * (`internal/yearWindowStart.ts`); no standard says which century a two-digit year belongs to,
 * so the library never supplies one.
 *
 * @param yy the two-digit year, 0–99, as the grammar read it
 * @param windowStart the first year of the hundred-year window
 * @returns the four-digit year in the window ending in `yy`
 *
 * @example twoDigitYear(24, 2000) // 2024
 * @example twoDigitYear(99, 1950) // 1999
 * @example twoDigitYear(49, 1950) // 2049
 * @example twoDigitYear(0, 1976) // 2000
 */
export function twoDigitYear(yy: number, windowStart: number): number {
  const candidate = Math.floor(windowStart / 100) * 100 + yy;
  return candidate < windowStart ? candidate + 100 : candidate;
}
