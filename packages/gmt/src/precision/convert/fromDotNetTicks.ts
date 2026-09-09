import {
  DOT_NET_TICKS_EPOCH_OFFSET,
  MAX_DOT_NET_TICKS,
  MIN_DOT_NET_TICKS,
  NANOSECONDS_PER_TICK,
} from "../../internal";
import { fromNanoseconds } from "./fromNanoseconds";

/**
 * Convert .NET `DateTime.Ticks` back to an ISO 8601 instant string.
 *
 * - `value` counts 100-nanosecond intervals since 0001-01-01T00:00:00 in the proleptic
 *   Gregorian calendar.
 * - Accepts `DateTime.MinValue` (`0n`) to `DateTime.MaxValue` (`3155378975999999999n`,
 *   9999-12-31T23:59:59.9999999). A tick count outside that is not a `DateTime`, and a
 *   negative value in particular is rejected rather than read as a pre-year-1 instant.
 * - Pass `Ticks`, not the raw backing field: .NET packs `DateTimeKind` into its top two
 *   bits, and a `Kind`-tagged value would decode as an instant thousands of years out.
 * - Exact in this direction — 100 ns is coarser than the nanoseconds an ISO string carries,
 *   so nothing is rounded. The loss, if any, happened in `toDotNetTicks`.
 * - Returns "" on invalid input.
 *
 * @param value 100-nanosecond intervals since 0001-01-01 (bigint, 0n to 3155378975999999999n)
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromDotNetTicks(0n) // "0001-01-01T00:00:00Z" — DateTime.MinValue
 * @example fromDotNetTicks(621355968000000000n) // "1970-01-01T00:00:00Z"
 * @example fromDotNetTicks(638456708967890000n) // "2024-03-10T12:34:56.789Z"
 * @example fromDotNetTicks(3155378975999999999n) // "9999-12-31T23:59:59.9999999Z" — DateTime.MaxValue
 * @example fromDotNetTicks(-1n) // "" — before DateTime.MinValue
 * @example fromDotNetTicks(3155378976000000000n) // "" — past DateTime.MaxValue
 * @example fromDotNetTicks(621355968000000000) // "" — number, not bigint
 */
export function fromDotNetTicks(value: bigint): string {
  if (
    typeof value !== "bigint" ||
    value < MIN_DOT_NET_TICKS ||
    value > MAX_DOT_NET_TICKS
  ) {
    return "";
  }

  return fromNanoseconds(
    (value - DOT_NET_TICKS_EPOCH_OFFSET) * NANOSECONDS_PER_TICK,
  );
}
