// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import type { Temporal } from "@js-temporal/polyfill";
import {
  subtractFromZoned,
  isValidAmount,
  resolveOverflow,
} from "../../internal";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  toUnixEpoch,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Subtract a temporal amount from a Unix epoch value and return the resulting epoch.
 *
 * - Converts to ZonedDateTime, subtracts the duration, then converts back to epoch.
 * - Validates duration units and values.
 * - `value` is a safe integer or a digit string (`"1706659200000"`); anything else returns null.
 * - An omitted `timeZone` is UTC; pass `"local"` for the system time zone.
 * - Returns null for invalid input.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 * 1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in null).
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone returns null), overflow ("constrain" | "reject")
 * @returns Unix epoch number after subtraction, or null on invalid input
 *
 * @example subtractUnix(1706745600000, { days: 1 }) // 1706659200000
 * @example subtractUnix(1706745600, { days: 1 }, { epochUnit: "seconds" }) // 1706659200
 * @example subtractUnix(0, { days: 1 }) // -86400000 (Jan 1 1970 - 1 day = Dec 31 1969)
 * @example subtractUnix(1.5, { days: 1 }) // null (not an integer epoch)
 * @example subtractUnix("1706659200000", { days: 1 }) // 1706572800000 (digit string)
 * @example subtractUnix(1706659200000, { days: 1 }, { timeZone: "Mars/Olympus" }) // null (unknown zone)
 */
export function subtractUnix(
  value: number | string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    overflow?: Overflow;
  },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const timeZone = normalizeTimeZone(options?.timeZone);
    const overflow = resolveOverflow(options?.overflow);

    if (!timeZone || epochUnit === null) return null;

    const validUnits =
      typeof units === "object" &&
      units !== null &&
      Object.keys(units).every(isValidDateTimeDurationUnit);
    const validAmounts = validUnits && Object.values(units).every(isValidAmount);

    if (!validUnits || !validAmounts) {
      return null;
    }

    const instant = unixEpochToInstant(value, epochUnit);

    if (instant === null) {
      return null;
    }

    try {
      const zdt: Temporal.ZonedDateTime = instant.toZonedDateTimeISO(timeZone);
      return toUnixEpoch(subtractFromZoned(zdt, units, { overflow }), epochUnit);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
