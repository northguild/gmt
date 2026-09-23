import { Temporal } from "@js-temporal/polyfill";
import { MAX_EPOCH_NANOSECONDS } from "./epochNanoseconds";

// TC39 Temporal IsValidEpochNanoseconds bound (nsMaxInstant = 10^8 days) in milliseconds: 8.64e15.
const MAX_EPOCH_MILLISECONDS = Number(MAX_EPOCH_NANOSECONDS / 1_000_000n);

// An optionally negative run of ASCII digits and nothing else. `\d` without the `u` flag is
// ASCII-only, and `$` without the `m` flag does not match before a trailing newline.
const EPOCH_DIGITS = /^-?\d+$/;

/** The two units a Unix epoch value is expressed in. */
export type UnixEpochUnit = "seconds" | "milliseconds";

/**
 * Parse one Unix epoch argument into a number, or null — the one epoch grammar every `unix/`
 * function and validator shares.
 *
 * - A number must be a safe integer (`Number.isSafeInteger`): fractional values, `NaN`,
 *   `±Infinity` and anything beyond ±(2^53 − 1) are rejected. Past 2^53 consecutive integers are
 *   no longer distinct doubles (`2 ** 53 + 1 === 2 ** 53`). Every Temporal instant (±8.64e15 ms) is
 *   well inside that range.
 * - A string must be an optionally negative run of ASCII digits (`/^-?\d+$/`) naming a safe
 *   integer. No whitespace, no `+`, no hex, binary, exponent, decimal point or numeric separator:
 *   POSIX epoch time is an integer count and has no other notation, so `Number()`'s wider
 *   StringToNumber grammar (`" 12 "`, `"0x10"`, `"1e3"`, `""` → 0) is not used.
 * - `-0` reads as `0`.
 * - Any other type is rejected.
 *
 * @param value Unix epoch value as a number or digit string
 * @returns the epoch as a safe integer, or null when invalid
 *
 * @example parseUnixEpochValue(1704067200000) // 1704067200000
 * @example parseUnixEpochValue("-86400") // -86400
 * @example parseUnixEpochValue(1.5) // null
 * @example parseUnixEpochValue(" 12") // null
 * @example parseUnixEpochValue("1e3") // null
 */
export function parseUnixEpochValue(value: unknown): number | null {
  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && EPOCH_DIGITS.test(value)) {
    parsed = Number(value);
  } else {
    return null;
  }

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed === 0 ? 0 : parsed;
}

/**
 * Resolve an `epochUnit` option: omitted → `"milliseconds"`; singular or plural `second` /
 * `millisecond` → the plural name; anything else → null.
 *
 * - Singular and plural are the same unit, as in Temporal §13.17 GetTemporalUnitValuedOption.
 *
 * @param unit candidate `epochUnit` value
 * @returns the resolved unit, or null when invalid
 *
 * @example resolveUnixEpochUnit(undefined) // "milliseconds"
 * @example resolveUnixEpochUnit("second") // "seconds"
 * @example resolveUnixEpochUnit("nanoseconds") // null
 */
export function resolveUnixEpochUnit(unit: unknown): UnixEpochUnit | null {
  switch (unit) {
    case undefined:
    case "millisecond":
    case "milliseconds":
      return "milliseconds";
    case "second":
    case "seconds":
      return "seconds";
    default:
      return null;
  }
}

/**
 * Resolve the `epochUnit` of an options argument (`{ epochUnit }`), or null.
 *
 * - `undefined` options → `"milliseconds"`, the same as omitted (TC39 GetOptionsObject).
 * - Anything that is not an object (`null`, a legacy positional unit string such as `"seconds"`, a
 *   number) → null: Temporal GetOptionsObject throws `TypeError` for it, so it is never silently
 *   read as the default.
 * - Otherwise `resolveUnixEpochUnit(options.epochUnit)`.
 *
 * @param options candidate options argument
 * @returns the resolved unit, or null when invalid
 *
 * @example resolveUnixEpochUnitOptions(undefined) // "milliseconds"
 * @example resolveUnixEpochUnitOptions({ epochUnit: "second" }) // "seconds"
 * @example resolveUnixEpochUnitOptions("seconds") // null
 */
export function resolveUnixEpochUnitOptions(
  options: unknown,
): UnixEpochUnit | null {
  if (options === undefined) {
    return "milliseconds";
  }

  if (options === null || typeof options !== "object") {
    return null;
  }

  return resolveUnixEpochUnit((options as { epochUnit?: unknown }).epochUnit);
}

/**
 * Read a Unix epoch argument (see `parseUnixEpochValue`) as a `Temporal.Instant`, or null when it
 * is not an epoch or lies outside the Temporal instant range.
 *
 * - Seconds scale by 1000 exactly: every in-range seconds value (±8.64e12) times 1000 is a safe
 *   integer, and any product that is not exact is already outside the instant range.
 *
 * @param value Unix epoch value as a number or digit string
 * @param epochUnit unit the value is expressed in
 * @returns the instant, or null
 *
 * @example unixEpochToInstant(0, "seconds")?.toString() // "1970-01-01T00:00:00Z"
 * @example unixEpochToInstant(8.64e15 + 1, "milliseconds") // null
 */
export function unixEpochToInstant(
  value: unknown,
  epochUnit: UnixEpochUnit,
): Temporal.Instant | null {
  const epoch = parseUnixEpochValue(value);

  if (epoch === null) {
    return null;
  }

  try {
    return Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? epoch * 1000 : epoch,
    );
  } catch {
    return null;
  }
}

/**
 * Express an instant (or zoned date-time) as a Unix epoch in `epochUnit`.
 *
 * - Seconds floor toward −∞, so `1969-12-31T23:59:59.999Z` is second `-1`, as POSIX
 *   `time_t` counts whole elapsed seconds.
 *
 * @param value anything with `epochMilliseconds`
 * @param epochUnit unit of the result
 * @returns the epoch value
 *
 * @example toUnixEpoch({ epochMilliseconds: 1710685845999 }, "seconds") // 1710685845
 * @example toUnixEpoch({ epochMilliseconds: -1 }, "seconds") // -1
 */
export function toUnixEpoch(
  value: { epochMilliseconds: number },
  epochUnit: UnixEpochUnit,
): number {
  return epochUnit === "seconds"
    ? Math.floor(value.epochMilliseconds / 1000)
    : value.epochMilliseconds;
}

/**
 * Parse an epoch for the aggregators (`sortUnix`, `minUnix`, `maxUnix`) that take no `epochUnit`:
 * the epoch grammar (`parseUnixEpochValue`) inside ±8.64e15, or null.
 *
 * - ±8.64e15 is the instant range in milliseconds. It contains the seconds range (±8.64e12), so no
 *   valid epoch of either unit is dropped.
 *
 * @param value candidate epoch value
 * @returns the epoch as a number, or null
 *
 * @example parseUnixEpochInInstantRange("1700000000000") // 1700000000000
 * @example parseUnixEpochInInstantRange(1e20) // null
 */
export function parseUnixEpochInInstantRange(value: unknown): number | null {
  const epoch = parseUnixEpochValue(value);

  return epoch !== null && Math.abs(epoch) <= MAX_EPOCH_MILLISECONDS
    ? epoch
    : null;
}

/**
 * The values of a list that `parseUnixEpochInInstantRange` accepts, in list order.
 *
 * @param values candidate epoch values
 * @returns the accepted epochs as numbers; empty when `values` is not an array or none is valid
 *
 * @example parseUnixEpochsInInstantRange(["1700000000000", 1.5, 1e20, -1]) // [1700000000000, -1]
 * @example parseUnixEpochsInInstantRange("1700000000000") // []
 */
export function parseUnixEpochsInInstantRange(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(parseUnixEpochInInstantRange)
    .filter((epoch): epoch is number => epoch !== null);
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
