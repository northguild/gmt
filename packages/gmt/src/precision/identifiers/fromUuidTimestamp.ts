import {
  GREGORIAN_EPOCH_OFFSET_TICKS,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_TICK,
  hexValue,
  uuidText,
} from "../../internal";
import { fromNanoseconds } from "../convert/fromNanoseconds";

/**
 * Read the instant a version 1, 6 or 7 UUID carries (RFC 9562 §5.1, §5.6, §5.7).
 *
 * - Input must be the hyphenated 8-4-4-4-12 form, in either case (RFC 9562 §4). Strip
 *   `urn:uuid:`, braces and whitespace first; unhyphenated hex is not read.
 * - Only the RFC 9562 variant (`8`, `9`, `a`, `b` at the start of the fourth group) is read. The
 *   NCS, Microsoft and reserved variants have other layouts.
 * - v1 and v6 count 100-nanosecond ticks from 1582-10-15 and resolve to 100 ns. A v1 and the v6
 *   made from it give the same instant (§5.6). The v1 timestamp fields are reassembled in
 *   their correct order (erratum 7955).
 * - v7 counts Unix milliseconds in its first 48 bits and resolves to the millisecond. `rand_a`
 *   is never read: §5.7 makes a sub-millisecond fraction optional and nothing in the UUID says
 *   whether it is used.
 * - A v1 or v6 timestamp is UTC unless its generator had no UTC clock: §5.1 (which §5.6 applies
 *   to v6) lets such a system use local time "as long as they do so consistently". The function
 *   cannot tell which.
 * - v2 (DCE security), v3, v4, v5, v8, the Nil and the Max UUID carry no timestamp: `null`.
 * - Returns `null` on invalid input.
 *
 * @param uuid UUID text in the hyphenated form
 * @returns the instant (UTC ISO 8601) and UUID version, or `null` when the input has no timestamp
 *
 * @example fromUuidTimestamp("C232AB00-9414-11EC-B3C8-9F6BDECED846") // { instant: "2022-02-22T19:22:22Z", version: 1 } — RFC 9562 A.1
 * @example fromUuidTimestamp("1EC9414C-232A-6B00-B3C8-9F6BDECED846") // { instant: "2022-02-22T19:22:22Z", version: 6 } — A.5, the same instant
 * @example fromUuidTimestamp("017F22E2-79B0-7CC3-98C4-DC0C0C07398F") // { instant: "2022-02-22T19:22:22Z", version: 7 } — A.6
 * @example fromUuidTimestamp("f81d4fae-7dec-11d0-a765-00a0c91e6bf6") // { instant: "1997-02-03T17:43:12.216875Z", version: 1 } — 100 ns kept
 * @example fromUuidTimestamp("c232ab00-9414-11ec-b3c8-9f6bdeced846") // { instant: "2022-02-22T19:22:22Z", version: 1 } — lower case
 * @example fromUuidTimestamp("00000000-0000-1000-8000-000000000000") // { instant: "1582-10-15T00:00:00Z", version: 1 } — the v1 epoch
 * @example fromUuidTimestamp("ffffffff-ffff-7fff-bfff-ffffffffffff") // { instant: "+010889-08-02T05:31:50.655Z", version: 7 } — 48-bit maximum
 * @example fromUuidTimestamp("919108f7-52d1-4320-9bac-f847db4148a8") // null — v4 carries no timestamp
 * @example fromUuidTimestamp("urn:uuid:c232ab00-9414-11ec-b3c8-9f6bdeced846") // null — strip the prefix first
 * @example fromUuidTimestamp("017f22e2-79b0-7cc3-c8c4-dc0c0c07398f") // null — Microsoft variant
 */
export function fromUuidTimestamp(uuid: string): {
  /** The timestamp as an ISO 8601 instant string in UTC; 100 ns for v1 and v6, milliseconds for v7. */
  instant: string;
  /** The UUID version that carried the timestamp: 1, 6 or 7. */
  version: 1 | 6 | 7;
} | null {
  if (typeof uuid !== "string" || !uuidText.test(uuid)) {
    return null;
  }
  // RFC 9562 §4.1: the variant is bits 10xx, the digit at index 19 is 8, 9, a or b.
  if (!"89abAB".includes(uuid.charAt(19))) {
    return null;
  }

  const version = Number(hexValue(uuid.charAt(14)));
  const timeLow = uuid.slice(0, 8);
  const timeMid = uuid.slice(9, 13);
  const timeHigh = uuid.slice(15, 18);

  let nanoseconds: bigint;
  if (version === 1) {
    // §5.1 with erratum 7955: the last group holds the most significant 12 bits.
    const ticks =
      (hexValue(timeHigh) << 48n) |
      (hexValue(timeMid) << 32n) |
      hexValue(timeLow);
    nanoseconds = (ticks - GREGORIAN_EPOCH_OFFSET_TICKS) * NANOSECONDS_PER_TICK;
  } else if (version === 6) {
    // §5.6: the most significant 48 bits, then the low 12.
    const ticks = (hexValue(timeLow + timeMid) << 12n) | hexValue(timeHigh);
    nanoseconds = (ticks - GREGORIAN_EPOCH_OFFSET_TICKS) * NANOSECONDS_PER_TICK;
  } else if (version === 7) {
    // §5.7: 48-bit Unix milliseconds. rand_a (timeHigh) is not read.
    nanoseconds = hexValue(timeLow + timeMid) * NANOSECONDS_PER_MILLISECOND;
  } else {
    return null;
  }

  const instant = fromNanoseconds(nanoseconds);
  return instant === "" ? null : { instant, version };
}
