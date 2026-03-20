import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidTimezone } from "../validate";
import type { UnixUnit } from "./convertZonedToUnix";

function isValidUnixUnit(unit: string): unit is UnixUnit {
  return unit === "seconds" || unit === "milliseconds";
}

export function convertUnixToZoned(
  value: number,
  timeZone: string,
  ...unitInput: [unit?: UnixUnit]
): string {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (
    !isValidAmount(value) ||
    !isValidTimezone(timeZone) ||
    !isValidUnixUnit(resolvedUnit ?? "")
  ) {
    return "";
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      resolvedUnit === "seconds" ? value * 1000 : value,
    );

    return instant.toZonedDateTimeISO(timeZone).toString();
  } catch {
    return "";
  }
}
