import { isUtcDateTime } from "../validate/isUtcDateTime";

export function chopUtc(value: string): string {
  if (!isUtcDateTime(value)) {
    return "";
  }

  // only shaves off z or Z at the end of the string, if it exists
  return value.replace(/z$/i, "");
}
