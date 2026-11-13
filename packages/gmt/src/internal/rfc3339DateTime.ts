import { Temporal } from "./temporal";
import { rfc3339DateTime } from "../regex";

/**
 * The core of `parseRfc3339` and `isValidRfc3339DateTime`: the zoned date-time an RFC 3339
 * `date-time` names. Never throws.
 *
 * @param value an RFC 3339 date-time
 * @returns an ISO 8601 zoned string, or `""` when `value` is not a valid RFC 3339 date-time
 *
 * @example readRfc3339("2024-03-15T12:30:45Z") // "2024-03-15T12:30:45+00:00[+00:00]"
 * @example readRfc3339("2024-02-30T12:30:45Z") // ""
 */
export function readRfc3339(value: string): string {
  if (typeof value !== "string") return "";

  const match = rfc3339DateTime.exec(value);
  if (match === null) return "";

  const [, year, month, day, hour, minute, second, fraction, offsetToken] =
    match;
  const offset =
    offsetToken === "Z" || offsetToken === "z" ? "+00:00" : offsetToken;
  const isoDateTime = `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction ?? ""}`;

  try {
    return Temporal.PlainDateTime.from(isoDateTime)
      .toZonedDateTime(offset)
      .toString();
  } catch {
    return "";
  }
}
