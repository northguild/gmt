import { MAX_EPOCH_NANOSECONDS } from "./epochNanoseconds";
import { isValidUnixMilliseconds } from "../unix/validate/isValidUnixMilliseconds";

// TC39 Temporal IsValidEpochNanoseconds bound (nsMaxInstant = 10^8 days) in milliseconds: 8.64e15.
const MAX_EPOCH_MILLISECONDS = Number(MAX_EPOCH_NANOSECONDS / 1_000_000n);

/**
 * Parse one Unix epoch argument (seconds or milliseconds) into a number, or null when it is not a
 * safe integer.
 *
 * - A number must already be a safe integer (`Number.isSafeInteger`): fractional values,
 *   `NaN`, `±Infinity` and anything beyond ±(2^53 − 1) are rejected. Past 2^53 consecutive
 *   integers are no longer distinct doubles, so `2 ** 53 + 1 === 2 ** 53` and adjacency, gaps
 *   and one-unit steps stop being meaningful. Every representable Temporal instant (±8.64e15 ms)
 *   is well inside that range.
 * - A numeric string is coerced with `Number()` and must then be a safe integer.
 * - An empty or whitespace-only string is rejected: `Number("")` is `0`, which would silently read
 *   a missing value as the epoch.
 * - Any other type is rejected.
 *
 * @param value Unix epoch value as a number or numeric string
 * @returns the epoch as a safe integer, or null when invalid
 *
 * @example parseUnixEpochValue(1704067200000) // 1704067200000
 * @example parseUnixEpochValue("1704067200") // 1704067200
 * @example parseUnixEpochValue(1.5) // null
 * @example parseUnixEpochValue(2 ** 53) // null
 * @example parseUnixEpochValue("") // null
 */
export function parseUnixEpochValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Parse a Unix epoch interval `[start, end]`, or null when either value is invalid (see
 * `parseUnixEpochValue`) or the interval is reversed (`start > end`).
 *
 * @param start Unix epoch value, in the one unit all epoch arguments share — interval start
 * @param end Unix epoch value, in the one unit all epoch arguments share — interval end
 * @returns `{ start, end }` as safe integers, or null
 *
 * @example parseUnixEpochInterval(0, "1500000000") // { start: 0, end: 1500000000 }
 * @example parseUnixEpochInterval(10, 0) // null (reversed)
 * @example parseUnixEpochInterval(0, 1.5) // null (fractional)
 */
export function parseUnixEpochInterval(
  start: unknown,
  end: unknown,
): { start: number; end: number } | null {
  const startValue = parseUnixEpochValue(start);
  const endValue = parseUnixEpochValue(end);

  if (startValue === null || endValue === null || startValue > endValue) {
    return null;
  }

  return { start: startValue, end: endValue };
}

/**
 * Parse two Unix epoch intervals `[aStart, aEnd]` and `[bStart, bEnd]`, or null when either is
 * invalid or reversed (see `parseUnixEpochInterval`).
 *
 * @param aStart first interval start
 * @param aEnd first interval end
 * @param bStart second interval start
 * @param bEnd second interval end
 * @returns `[a, b]` as `{ start, end }` safe-integer records, or null
 *
 * @example parseUnixEpochIntervalPair(0, 10, "5", "20") // [{ start: 0, end: 10 }, { start: 5, end: 20 }]
 * @example parseUnixEpochIntervalPair(0, 10, 20, 5) // null (B reversed)
 */
export function parseUnixEpochIntervalPair(
  aStart: unknown,
  aEnd: unknown,
  bStart: unknown,
  bEnd: unknown,
): [{ start: number; end: number }, { start: number; end: number }] | null {
  const a = parseUnixEpochInterval(aStart, aEnd);
  const b = parseUnixEpochInterval(bStart, bEnd);

  return a === null || b === null ? null : [a, b];
}

/**
 * Parse a list of Unix epoch `{ start, end }` records, or null when `intervals` is not an array or
 * any element is not an object holding a valid, non-reversed interval (see
 * `parseUnixEpochInterval`). An empty list parses to `[]`.
 *
 * @param intervals candidate list of `{ start, end }` records
 * @returns the parsed intervals in input order, or null
 *
 * @example parseUnixEpochIntervalList([{ start: 0, end: "10" }]) // [{ start: 0, end: 10 }]
 * @example parseUnixEpochIntervalList([{ start: 10, end: 0 }]) // null (reversed)
 * @example parseUnixEpochIntervalList("not-an-array") // null
 */
export function parseUnixEpochIntervalList(
  intervals: unknown,
): Array<{ start: number; end: number }> | null {
  if (!Array.isArray(intervals)) {
    return null;
  }

  const parsed: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    if (!interval || typeof interval !== "object") {
      return null;
    }

    const { start, end } = interval as { start?: unknown; end?: unknown };
    const next = parseUnixEpochInterval(start, end);

    if (next === null) {
      return null;
    }

    parsed.push(next);
  }

  return parsed;
}

/**
 * Coerce the epoch argument of the `unix/parse` field extractors to a number, keeping their
 * `Number()` grammar except for a blank string.
 *
 * - A number is returned unchanged.
 * - An empty or whitespace-only string becomes `NaN`: ECMA-262 StringToNumber maps it to `+0`,
 *   which would read a missing value as the epoch.
 * - Any other string goes through `Number()`, so its acceptance is exactly as before.
 *
 * @param value Unix epoch value as a number or numeric string
 * @returns the coerced number, `NaN` for a blank string
 *
 * @example coerceUnixEpochNumber("1700000000") // 1700000000
 * @example coerceUnixEpochNumber("   ") // NaN
 */
export function coerceUnixEpochNumber(value: number | string): number {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Return true when `value` is a unix epoch number that names a `Temporal.Instant`, for the
 * aggregators (`sortUnix`, `minUnix`, `maxUnix`) that take no `epochUnit`.
 *
 * - Must be an integer number (`isValidUnixMilliseconds`, which `isValidUnixSeconds` matches).
 * - Must lie within ±8.64e15, the instant range in milliseconds. That range contains the seconds
 *   range (±8.64e12), so no valid epoch of either unit is dropped.
 *
 * @param value candidate epoch value
 * @returns true when `value` is an in-range integer epoch
 *
 * @example isUnixEpochInInstantRange(1700000000000) // true
 * @example isUnixEpochInInstantRange(1e20) // false
 */
export function isUnixEpochInInstantRange(value: unknown): value is number {
  return (
    isValidUnixMilliseconds(value) &&
    Math.abs(value as number) <= MAX_EPOCH_MILLISECONDS
  );
}
