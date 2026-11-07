/**
 * TAI64 text labels. A TAI64 label names one TAI second by an integer `s`: for `s` in
 * [2^62, 2^63) it is the second that began `s - 2^62` seconds after the beginning of 1970 TAI.
 * Bernstein's TAI64 page (https://cr.yp.to/libtai/tai64.html) defines the byte layouts: 8, 12
 * and 16 bytes for TAI64, TAI64N and TAI64NA. daemontools `tai64n`
 * (https://cr.yp.to/daemontools/tai64n.html) defines the text for TAI64N only: `@` and 24
 * lowercase hex digits. Reading 16 or 32 digits, an optional `@` and either hex case is GMT's
 * own rule (as `fromObjectId` reads either case).
 * Pure bigint arithmetic: every loop is absent, so each call is O(1).
 *
 * Grammar exception: coding-standards § Scoped exception: TAI64 text labels in `timescale/convert`.
 */
import { floorDivide } from "./floorDivide";
import { NANOSECONDS_PER_SECOND } from "./foreignEpochs";
import { hexValue } from "./identifierText";

/** 2^62: the label of the TAI second that began 1970 TAI (Bernstein, TAI64 § labels). */
export const TAI64_SECONDS_OFFSET = 4_611_686_018_427_387_904n;

/** 9999-12-31T23:59:59.999999999Z in epoch nanoseconds: the last UTC instant this realm writes. */
export const LAST_FOUR_DIGIT_UTC_NANOSECONDS = 253_402_300_799_999_999_999n;

/** Bernstein: the nanosecond and attosecond counters are "between 0 and 999999999 inclusive". */
const MAX_COUNTER = 999_999_999n;

/**
 * GMT's reading grammar for a TAI64, TAI64N or TAI64NA label in hex text: an optional `@`, 16 hex
 * digits of seconds, then optionally 8 of nanoseconds, then optionally 8 of attoseconds. Either
 * case. Only the 24-digit lowercase `@` form is daemontools' text; the rest is GMT's rule.
 * Groups: 1 seconds, 2 nanoseconds, 3 attoseconds.
 */
export const tai64LabelText = /^@?([\da-f]{16})([\da-f]{8})?([\da-f]{8})?$/i;

/**
 * Read a TAI64, TAI64N or TAI64NA label as TAI nanoseconds since 1970-01-01T00:00:00 TAI.
 * Returns `null` for anything that is not a whole label, a second before 1970 TAI or at 2^63
 * and above (reserved), and a counter above 999999999. Attoseconds are validated, then dropped.
 *
 * @example parseTai64Label("@400000002a2b2c2d00000000") // 707472429000000000n
 * @example parseTai64Label("@3fffffffffffffff") // null (before 1970 TAI)
 * @example parseTai64Label("@400000002a2b2c2d00000000 mark") // null (not a whole label)
 */
export function parseTai64Label(value: unknown): bigint | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = tai64LabelText.exec(value);
  if (match === null) {
    return null;
  }
  const seconds = hexValue(match[1]);
  if (seconds < TAI64_SECONDS_OFFSET || seconds >= 2n * TAI64_SECONDS_OFFSET) {
    return null;
  }
  const nanoseconds = match[2] ? hexValue(match[2]) : 0n;
  const attoseconds = match[3] ? hexValue(match[3]) : 0n;
  if (nanoseconds > MAX_COUNTER || attoseconds > MAX_COUNTER) {
    return null;
  }
  return (
    (seconds - TAI64_SECONDS_OFFSET) * NANOSECONDS_PER_SECOND + nanoseconds
  );
}

/**
 * Write TAI nanoseconds since 1970-01-01T00:00:00 TAI as a TAI64N text label: `@` and 24
 * lowercase hex digits. The seconds floor, so a negative value names the last nanosecond of
 * the second before it. Callers pass only values in the 1972 to 9999 range.
 *
 * @example formatTai64nLabel(707472429000000000n) // "@400000002a2b2c2d00000000"
 * @example formatTai64nLabel(-1n) // "@3fffffffffffffff3b9ac9ff"
 */
export function formatTai64nLabel(tai: bigint): string {
  const seconds =
    TAI64_SECONDS_OFFSET + floorDivide(tai, NANOSECONDS_PER_SECOND);
  const nanoseconds =
    tai - floorDivide(tai, NANOSECONDS_PER_SECOND) * NANOSECONDS_PER_SECOND;
  return `@${seconds.toString(16).padStart(16, "0")}${nanoseconds.toString(16).padStart(8, "0")}`;
}
