/**
 * Type guard to check if a value is a valid ISO day-of-week number (1 = Monday … 7 = Sunday).
 *
 * @param value day-of-week candidate
 * @example isValidDayOfWeek(1) // true
 * @example isValidDayOfWeek(7) // true
 * @example isValidDayOfWeek(0) // false
 * @example isValidDayOfWeek(8) // false
 * @returns boolean indicating whether the value is a valid ISO day-of-week number
 */
export function isValidDayOfWeek(value: number): value is number {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}
