/**
 * Checks if a given number is a valid unix timestamp in milliseconds.
 * @param timestamp The timestamp to validate.
 * @returns True if the timestamp is valid, false otherwise.
 */
export function isValidUnixMilliseconds(timestamp: unknown): boolean {
  if (typeof timestamp === "number") {
    return Number.isInteger(timestamp) && timestamp >= 0;
  }
  return false;
}
