import { convertZonedToUnix } from "./convertZonedToUnix";

export function convertToUnixSeconds(value: string): number | null {
  return convertZonedToUnix(value, "seconds");
}
