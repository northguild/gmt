import { Temporal } from "@js-temporal/polyfill";
import { isUtcDateTime } from "../../plain/validate/isUtcDateTime";
import type { UnixUnit } from "./convertZonedToUnix";

function isValidUnixUnit(unit: string): unit is UnixUnit {
  return unit === "seconds" || unit === "milliseconds";
}

export function convertUtcToUnix(
  value: string,
  ...unitInput: [unit?: UnixUnit]
): number | null {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!isUtcDateTime(value) || !isValidUnixUnit(resolvedUnit ?? "")) {
    return null;
  }

  try {
    const milliseconds = Number(Temporal.Instant.from(value).epochMilliseconds);

    return resolvedUnit === "seconds"
      ? Math.floor(milliseconds / 1000)
      : milliseconds;
  } catch {
    return null;
  }
}
