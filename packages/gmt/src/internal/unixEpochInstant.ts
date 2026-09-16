import { Temporal } from "@js-temporal/polyfill";

/**
 * Read a unix epoch argument of the `unix/format` functions as epoch milliseconds, or null.
 *
 * - A number is taken as-is when finite.
 * - A string must be an optionally negative run of digits once trimmed, so `""`, `"not-a-date"`
 *   and `"12.5"` are rejected rather than coerced to `0` or `12`.
 * - `epochUnit` `"seconds"` scales by 1000.
 *
 * @param value unix epoch value as a number or string
 * @param epochUnit unit the value is expressed in
 * @returns epoch milliseconds, or null when the value is not an epoch
 *
 * @example parseUnixEpochMilliseconds("1710685845", "seconds") // 1710685845000
 * @example parseUnixEpochMilliseconds("12.5", "milliseconds") // null
 */
export function parseUnixEpochMilliseconds(
  value: unknown,
  epochUnit: "milliseconds" | "seconds",
): number | null {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    n = Number(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  return epochUnit === "seconds" ? n * 1000 : n;
}

/**
 * Read a unix epoch argument as a `Temporal.Instant` (see `parseUnixEpochMilliseconds`), or null
 * when it is not an epoch or lies outside the Temporal instant range.
 *
 * @param value unix epoch value as a number or string
 * @param epochUnit unit the value is expressed in
 * @returns the instant, or null
 *
 * @example unixEpochToInstant(0, "seconds")?.toString() // "1970-01-01T00:00:00Z"
 * @example unixEpochToInstant(8.64e15 + 1, "milliseconds") // null
 */
export function unixEpochToInstant(
  value: unknown,
  epochUnit: "milliseconds" | "seconds",
): Temporal.Instant | null {
  const ms = parseUnixEpochMilliseconds(value, epochUnit);
  if (ms === null) return null;
  try {
    return Temporal.Instant.fromEpochMilliseconds(ms);
  } catch {
    return null;
  }
}
