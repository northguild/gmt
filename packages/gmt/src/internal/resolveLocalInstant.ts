import type { Disambiguation } from "../types";
import { plainDateTimeOf } from "./inputChecks";
import { isoStringBody } from "./isoStringBody";
import { instantOfWallClock, zoneFrame } from "./zoneFrame";
import { zonedDateTimeFrom } from "./zonedWallClock";

const DISAMBIGUATIONS: readonly string[] = [
  "compatible",
  "earlier",
  "later",
  "reject",
];

/**
 * The core of `resolveLocal`: the instant a local date-time names in a zone, under one
 * disambiguation. Never throws.
 *
 * @param localDateTime a PlainDateTime string
 * @param timeZone an IANA zone or a numeric offset
 * @param disambiguation how a repeated or skipped wall time resolves
 * @returns the instant as an ISO 8601 string, or `""` when any input is invalid or the time is
 * rejected
 *
 * @example resolveLocalInstant("2024-06-15T12:00:00", "UTC", "compatible") // "2024-06-15T12:00:00Z"
 * @example resolveLocalInstant("2024-03-10T02:30:00", "America/New_York", "reject") // ""
 */
export function resolveLocalInstant(
  localDateTime: string,
  timeZone: string,
  disambiguation: string | undefined,
): string {
  try {
    const frame = zoneFrame(timeZone);

    if (
      plainDateTimeOf(localDateTime) === null ||
      frame === null ||
      disambiguation === undefined ||
      !DISAMBIGUATIONS.includes(disambiguation)
    ) {
      return "";
    }

    try {
      // An offset with seconds is no time zone identifier, so it cannot go in a bracket. It needs
      // none: the wall time at a fixed offset is one instant, whatever `disambiguation` says.
      if (frame.shiftNanoseconds !== 0n) {
        return instantOfWallClock(
          isoStringBody(localDateTime),
          frame,
        ).toString();
      }

      return zonedDateTimeFrom(
        `${isoStringBody(localDateTime)}[${frame.timeZone}]`,
        { disambiguation: disambiguation as Disambiguation },
      )
        .toInstant()
        .toString();
    } catch {
      return "";
    }
  } catch {
    return "";
  }
}
