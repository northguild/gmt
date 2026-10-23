import {
  isObject,
  NANOSECONDS_PER_MILLISECOND,
  unsignedDecimalText,
} from "../../internal";
import { fromNanoseconds } from "../convert/fromNanoseconds";

/** The largest unsigned 64-bit value, the width of every Snowflake id. */
const MAX_UINT64 = 2n ** 64n - 1n;

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
  let value: bigint;

  if (typeof id === "bigint") {
    value = id;
  } else if (typeof id === "string" && unsignedDecimalText.test(id)) {
    value = BigInt(id);
  } else {
    return "";
  }

  if (value < 0n || value > MAX_UINT64) {
    return "";
  }

  let epochMs: unknown;
  let shift: unknown;
  let timestampBits: unknown;

  // Reading a hostile layout (a throwing getter, a Proxy trap, a revoked Proxy) can throw.
  try {
    if (!isObject(layout)) {
      return "";
    }

    ({ epochMs, shift, timestampBits } = layout);
  } catch {
    return "";
  }

  if (
    typeof epochMs !== "number" ||
    !Number.isSafeInteger(epochMs) ||
    typeof shift !== "number" ||
    !Number.isInteger(shift) ||
    shift < 0 ||
    shift > 63
  ) {
    return "";
  }

  const maxBits = 64 - shift;
  const bits = timestampBits === undefined ? maxBits : timestampBits;

  if (
    typeof bits !== "number" ||
    !Number.isInteger(bits) ||
    bits < 1 ||
    bits > maxBits
  ) {
    return "";
  }

  const ticks = (value >> BigInt(shift)) & ((1n << BigInt(bits)) - 1n);

  return fromNanoseconds(
    (ticks + BigInt(epochMs)) * NANOSECONDS_PER_MILLISECOND,
  );
}
