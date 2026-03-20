import { convertUnixToZoned } from "./convertUnixToZoned";
import type { UnixUnit } from "./convertZonedToUnix";

export function convertUnixToTimezone(
  value: number,
  timeZone: string,
  ...unitInput: [unit?: UnixUnit]
): string {
  if (unitInput.length === 0) {
    return convertUnixToZoned(value, timeZone);
  }

  return convertUnixToZoned(value, timeZone, unitInput[0]);
}
