import { NANOSECONDS_PER_SECOND, hexValue, objectIdText } from "../../internal";
import { fromNanoseconds } from "../convert/fromNanoseconds";

/**
 * Read the creation second a MongoDB ObjectId carries (mongodb/specifications
 * `bson-objectid/objectid.md`, § Specification and § Timestamp Field).
 *
 * - The first 4 of the 12 bytes (8 of the 24 hex digits) are a big-endian count of seconds
 *   since the Unix epoch. The spec says drivers "MUST interpret this value as an unsigned
 *   32-bit integer", so the range is 1970-01-01T00:00:00Z to 2106-02-07T06:28:15Z and `8…`
 *   is 2038, never 1901.
 * - The other 8 bytes are a per-process random value and a counter (§ Random Value,
 *   § Counter). They are validated, never read: they carry no time.
 * - The time is the clock of whichever process made the id (usually the driver, sometimes the
 *   server when it fills in a missing `_id`), which may differ from the insert time.
 * - Some older drivers read the field as signed, which puts every id after
 *   2038-01-19T03:14:07Z before 1970. This function follows the spec's unsigned rule.
 * - Either hex case is read. Only the 24-digit string is accepted: not the 12 raw bytes and
 *   not the shell form `ObjectId("…")`.
 * - Second precision: the result never has a fraction.
 * - Returns "" on invalid input and never throws.
 *
 * @param objectId 24-character hex ObjectId text
 * @returns ISO 8601 instant string in UTC, or "" on invalid input
 *
 * @example fromObjectId("65a0f4d0c3b1a2e4f5d6c7b8") // "2024-01-12T08:14:08Z"
 * @example fromObjectId("000000000000000000000000") // "1970-01-01T00:00:00Z"
 * @example fromObjectId("7fffffff0000000000000000") // "2038-01-19T03:14:07Z"
 * @example fromObjectId("800000000000000000000000") // "2038-01-19T03:14:08Z" — unsigned, not 1901
 * @example fromObjectId("FFFFFFFF0000000000000000") // "2106-02-07T06:28:15Z" — upper case
 * @example fromObjectId("65a0f4d0c3b1a2e4f5d6c7b") // "" — 23 characters
 * @example fromObjectId("65a0f4d0c3b1a2e4f5d6c7bg") // "" — not hex
 * @example fromObjectId('ObjectId("65a0f4d0c3b1a2e4f5d6c7b8")') // "" — shell form
 */
export function fromObjectId(objectId: string): string {
  if (typeof objectId !== "string" || !objectIdText.test(objectId)) {
    return "";
  }

  const seconds = hexValue(objectId.slice(0, 8));
  return fromNanoseconds(seconds * NANOSECONDS_PER_SECOND);
}
