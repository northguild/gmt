import { convertZonedToUnix } from "./convertZonedToUnix";

export function convertToUnixMilliseconds(value: string): number | null {
  return convertZonedToUnix(value, "milliseconds");
}
