import type { UnixUnit } from "./convertZonedToUnix";
import { convertZonedToUnix } from "./convertZonedToUnix";

export function convertTimezoneToUnix(
  value: string,
  ...unitInput: [unit?: UnixUnit]
): number | null {
  if (unitInput.length === 0) {
    return convertZonedToUnix(value);
  }

  return convertZonedToUnix(value, unitInput[0]);
}
