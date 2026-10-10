import type { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "./resolveDateTimeUnit";
import {
  parseUnixEpochInterval,
  resolveUnixEpochUnit,
  unixEpochToInstant,
  type UnixEpochUnit,
} from "./unixEpochValue";
import { isValidDateTimeUnit } from "../plain/validate";
import { frameZoned, normalizeZoneFrame, type ZoneFrame } from "./zoneFrame";

export interface ResolvedUnixInterval {
  startVal: Temporal.ZonedDateTime;
  endVal: Temporal.ZonedDateTime;
  resolvedUnit: Temporal.DateTimeUnit;
  epochUnit: UnixEpochUnit;
  /** The frame both ends were placed on; `frameInstant` turns a result back into an instant. */
  frame: ZoneFrame;
}

/**
 * Resolve the shared arguments of `intervalLengthUnix`, `intervalCountUnix` and
 * `splitIntervalByUnitUnix`: a non-reversed epoch pair in `epochUnit`, a singular-or-plural
 * `DateTimeUnit`, and the zone both ends are read in.
 *
 * - Epochs follow the one `unix/` grammar (`parseUnixEpochValue`) and must name Temporal instants.
 * - `epochUnit` defaults to `"milliseconds"`; `timeZone` defaults to `"UTC"` (`"local"` is the
 *   system zone; a time zone identifier or a stored UTC offset `±HH:MM[:SS]` is read as written;
 *   anything else is invalid).
 * - The ends are placed with `frameZoned`: for a seconds offset they sit in the offset's
 *   whole-minute zone, moved by its seconds, to compute with and never to write.
 *
 * @param start interval start epoch
 * @param end interval end epoch
 * @param unit unit name, singular or plural
 * @param options optional `{ epochUnit, timeZone }`
 * @returns the zoned ends, singular unit, epoch unit and frame, or null on invalid input
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
  const frame = normalizeZoneFrame(options?.timeZone);

  if (
    interval === null ||
    epochUnit === null ||
    frame === null ||
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
      startVal: frameZoned(startInstant, frame),
      endVal: frameZoned(endInstant, frame),
      resolvedUnit,
      epochUnit,
      frame,
    };
  } catch {
    return null;
  }
}
