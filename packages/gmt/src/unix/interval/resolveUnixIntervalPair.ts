import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal";
import {
  isValidUnixEpochPair,
  resolveUnixTimeZone,
} from "../../internal/resolveUnixTimeZone";
import { isValidDateTimeUnit } from "../../plain/validate";

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
  if (typeof start !== "number" && typeof start !== "string") {
    return null;
  }

  if (typeof end !== "number" && typeof end !== "string") {
    return null;
  }

  const startMs = typeof start === "number" ? start : Number(start);
  const endMs = typeof end === "number" ? end : Number(end);

  if (!isValidUnixEpochPair(startMs, endMs) || startMs > endMs) {
    return null;
  }

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
