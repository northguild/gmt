import type { Temporal } from "@js-temporal/polyfill";
import { normalizeTimeZone } from "./normalizeTimeZone";
import { resolveDateTimeUnit } from "./resolveDateTimeUnit";
import {
  parseUnixEpochInterval,
  resolveUnixEpochUnit,
  unixEpochToInstant,
  type UnixEpochUnit,
} from "./unixEpochValue";
import { isValidDateTimeUnit } from "../plain/validate";

export interface ResolvedUnixInterval {
  startVal: Temporal.ZonedDateTime;
  endVal: Temporal.ZonedDateTime;
  resolvedUnit: Temporal.DateTimeUnit;
  epochUnit: UnixEpochUnit;
}

/**
 * Resolve the shared arguments of `intervalLengthUnix`, `intervalCountUnix` and
 * `splitIntervalByUnitUnix`: a non-reversed epoch pair in `epochUnit`, a singular-or-plural
 * `DateTimeUnit`, and the zone both ends are read in.
 *
 * - Epochs follow the one `unix/` grammar (`parseUnixEpochValue`) and must name Temporal instants.
 * - `epochUnit` defaults to `"milliseconds"`; `timeZone` defaults to `"UTC"` (`"local"` is the
 *   system zone, an unknown zone is invalid).
 *
 * @param start interval start epoch
 * @param end interval end epoch
 * @param unit unit name, singular or plural
 * @param options optional `{ epochUnit, timeZone }`
 * @returns the zoned ends, singular unit and epoch unit, or null on invalid input
 *
 * @example resolveUnixIntervalPair(0, 86400, "days", { epochUnit: "seconds" })?.resolvedUnit // "day"
 * @example resolveUnixIntervalPair(10, 0, "day") // null (reversed)
 */
export function resolveUnixIntervalPair(
  start: unknown,
  end: unknown,
  unit: unknown,
  options?: { epochUnit?: unknown; timeZone?: unknown },
): ResolvedUnixInterval | null {
  const interval = parseUnixEpochInterval(start, end);
  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const timeZone = normalizeTimeZone(options?.timeZone);

  if (
    interval === null ||
    epochUnit === null ||
    !timeZone ||
    typeof unit !== "string"
  ) {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateTimeUnit(resolvedUnit)) {
    return null;
  }

  const startInstant = unixEpochToInstant(interval.start, epochUnit);
  const endInstant = unixEpochToInstant(interval.end, epochUnit);

  if (startInstant === null || endInstant === null) {
    return null;
  }

  try {
    return {
      startVal: startInstant.toZonedDateTimeISO(timeZone),
      endVal: endInstant.toZonedDateTimeISO(timeZone),
      resolvedUnit,
      epochUnit,
    };
  } catch {
    return null;
  }
}
