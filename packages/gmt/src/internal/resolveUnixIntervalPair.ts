import { Temporal } from "@js-temporal/polyfill";
import { parseUnixEpochInterval } from "./unixEpochValue";
import { resolveDateTimeUnit } from "./resolveDateTimeUnit";
import { resolveUnixTimeZone } from "./resolveUnixTimeZone";
import { isValidDateTimeUnit } from "../plain/validate";

export interface ResolvedUnixInterval {
  startVal: Temporal.ZonedDateTime;
  endVal: Temporal.ZonedDateTime;
  resolvedUnit: Temporal.DateTimeUnit;
}

export function resolveUnixIntervalPair(
  start: number | string,
  end: number | string,
  unit: string,
): ResolvedUnixInterval | null {
  // Safe integers (or numeric strings of one) only: an empty string is not read as the epoch.
  const interval = parseUnixEpochInterval(start, end);

  if (interval === null) {
    return null;
  }

  const { start: startMs, end: endMs } = interval;

  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateTimeUnit(resolvedUnit)) {
    return null;
  }

  try {
    const timeZone = resolveUnixTimeZone();

    if (!timeZone) {
      return null;
    }

    const startVal =
      Temporal.Instant.fromEpochMilliseconds(startMs).toZonedDateTimeISO(
        timeZone,
      );
    const endVal =
      Temporal.Instant.fromEpochMilliseconds(endMs).toZonedDateTimeISO(
        timeZone,
      );

    return { startVal, endVal, resolvedUnit };
  } catch {
    return null;
  }
}
