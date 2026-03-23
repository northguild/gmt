export type UnixUnit = "seconds" | "milliseconds";

export function isValidUnixUnit(unit: string): unit is UnixUnit {
  return unit === "seconds" || unit === "milliseconds";
}
