import {
  NANOSECONDS_PER_MILLISECOND,
  unsignedDecimalText,
  instantStringFromEpochNanoseconds,
} from "../../internal";

/**
 * Where the timestamp sits in a Snowflake id. A Snowflake is a layout, not a standard: each
 * service picks its own epoch and bit split, so the caller passes the layout and GMT bundles
 * no vendor presets.
 */
export interface SnowflakeLayout {
  /** Unix milliseconds of the layout's epoch. A safe integer; negative is allowed. */
  epochMs: number;
  /** Number of bits below the timestamp field (22 for Twitter and Discord). An integer in `[0, 63]`. Required. */
  shift: number;
  /**
   * Width of the timestamp field in bits. An integer in `[1, 64 - shift]`.
   *
   * @defaultValue `64 - shift`, every bit above the shift
   */
  timestampBits?: number;
}

/**
 * Read the instant a Snowflake id carries, using a layout the caller supplies.
 *
 * - The timestamp field is `(id >> shift)` masked to `timestampBits`, counted in milliseconds
 *   from `epochMs`. The instant is the generator's clock, to the millisecond.
 * - **Say which layout the id came from.** A wrong epoch gives a plausible wrong date, not an
 *   error: the same id under Twitter's and Discord's epochs differs by over four years.
 * - Pass ids as a `bigint` or a decimal `string`, never a `number`. Ids above 2^53 lose digits
 *   as numbers (which is why Discord sends them as strings), so a `number` is refused rather
 *   than decoded wrongly. A `bigint` must be in `[0, 2^64 - 1]`; a `string` must be 1 to 20
 *   ASCII digits with no sign or space, and no larger than 2^64 - 1.
 * - Another tick size (Sonyflake counts 10 ms) is not supported.
 * - Returns "" on invalid input, including a result outside the instant range. Never throws,
 *   even if reading `layout` does.
 *
 * @param id The Snowflake as a `bigint` or a decimal string
 * @param layout `{ epochMs, shift, timestampBits? }` for the service that issued the id
 * @returns ISO 8601 instant string in UTC, or "" on invalid input
 *
 * @example fromSnowflake("175928847299117063", { epochMs: 1420070400000, shift: 22 }) // "2016-04-30T11:18:25.796Z" — Discord layout
 * @example fromSnowflake("1050118621198921728", { epochMs: 1288834974657, shift: 22, timestampBits: 41 }) // "2018-10-10T20:19:24.211Z" — Twitter layout
 * @example fromSnowflake("1050118621198921728", { epochMs: 1420070400000, shift: 22 }) // "2022-12-07T18:36:29.554Z" — same id, other epoch: a different instant
 * @example fromSnowflake(1704067200000n, { epochMs: 0, shift: 0 }) // "2024-01-01T00:00:00Z"
 * @example fromSnowflake(175928847299117063, { epochMs: 1420070400000, shift: 22 }) // "" — number, not bigint or string
 * @example fromSnowflake("1", { epochMs: 1420070400000 }) // "" — shift missing
 */
export function fromSnowflake(
  id: bigint | string,
  layout: SnowflakeLayout,
): string {
  // Anything that is neither a bigint nor a decimal string reads as -1n, which is not a uint64.
  const value =
    typeof id === "bigint"
      ? id
      : typeof id === "string" && unsignedDecimalText.test(id)
        ? BigInt(id)
        : -1n;

  if (BigInt.asUintN(64, value) !== value) {
    return "";
  }

  let epochMs: number;
  let shift = 0;
  let timestampBits: number;

  // Reading a hostile layout (null, a throwing getter, a Proxy trap, a revoked Proxy) can throw,
  // and so can `&` on a bigint, a symbol or an object whose `valueOf` throws.
  try {
    ({ epochMs, shift, timestampBits = 64 - shift } = layout);

    // `Number.isInteger` and `Number.isSafeInteger` are false for anything that is not a number.
    if (
      !Number.isSafeInteger(epochMs) ||
      (shift & 63) !== shift || // an integer in 0..63; `&` makes any other type or fraction unequal
      !Number.isInteger(timestampBits) ||
      timestampBits < 1 ||
      timestampBits > 64 - shift
    ) {
      return "";
    }
  } catch {
    return "";
  }

  const ticks = (value >> BigInt(shift)) & ((1n << BigInt(timestampBits)) - 1n);

  return instantStringFromEpochNanoseconds(
    (ticks + BigInt(epochMs)) * NANOSECONDS_PER_MILLISECOND,
  );
}
