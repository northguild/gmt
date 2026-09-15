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
 * @param start Unix epoch value (seconds or milliseconds) — interval start
 * @param end Unix epoch value (seconds or milliseconds) — interval end
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
