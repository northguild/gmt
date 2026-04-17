/**
 * Type guard to check if a value is a valid amount (finite number).
 *
 * @param value number candidate
 * @example isValidAmount(10) // true
 * @example isValidAmount(-5) // true
 * @returns boolean indicating whether the value is a valid amount
 */
export function isValidAmount(value: number): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
