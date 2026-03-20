import { Temporal } from "@js-temporal/polyfill";

type UnixUnit = "seconds" | "milliseconds";

function isValidUnixUnit(unit: string): unit is UnixUnit {
  return unit === "seconds" || unit === "milliseconds";
}

// Returns the current unix timestamp in seconds or milliseconds.
export function getUnixNow(...unitInput: [unit?: UnixUnit]): number | null {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!isValidUnixUnit(resolvedUnit ?? "")) {
    return null;
  }

  const instant = Temporal.Now.instant();
  if (resolvedUnit === "seconds") {
    return Math.floor(instant.epochMilliseconds / 1000);
  }
  return instant.epochMilliseconds;
}
