import type { Temporal } from "@js-temporal/polyfill";
import {
  frameInstant,
  frameZoned,
  instantFrom,
  zonedUnitStart,
  zoneFrame,
} from "../../internal";
import { isValidInstant } from "../../precision/validate";
import type { ZoneBucketUnit } from "../../types";
import { isValidZoneBucketUnit } from "../validate";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";

/**
 * Floor an instant to the start of the `unit` containing it **in `timeZone`**, and return
 * the instant of that boundary.
 *
 * Flooring a UTC instant to a UTC day and calling it a local day is wrong for most of the
 * world for most of the day: 03:00 UTC on 15 June is still 14 June in New York, so the local
 * day it belongs to started 20 hours before the UTC one did. The zone is an argument because
 * GMT has no ambient one and must not acquire one.
 *
 * - `unit` is `"hour"`, `"day"`, `"week"` or `"month"`, or its plural (`"days"`), as Temporal
 *   accepts. Weeks start on Monday (ISO 8601), matching `startOfZoned` and `intervalCountZoned`.
 *   `isValidZoneBucketUnit` narrows a candidate unit, singular or plural, so a unit out of config
 *   can be told apart from a bad instant.
 * - `value` is any instant `isValidInstant` accepts — `Z`, an offset, or a bracketed zone.
 *   Only its instant is read: a bracketed zone in `value` is *not* the zone the boundary is
 *   computed in, `timeZone` is, and the two may differ freely. An offset written to the minute
 *   that is the bracketed zone's sub-minute offset rounded (`-00:45[Africa/Monrovia]`, for
 *   −00:44:30) names the instant the zone gives, as `isValidInstant` describes.
 * - The boundary is a real instant in the zone, so it survives the days a local boundary does
 *   not exist: a local day whose midnight is skipped by a spring-forward starts at 01:00, and
 *   a wall hour repeated by a fall-back floors to whichever pass `value` was in.
 * - Returns a UTC instant string ending in `"Z"`, exactly — no rounding.
 * - Returns `""` on invalid input, and where the boundary itself is not representable — the
 *   week or month containing the first instant Temporal supports began before it.
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `""`. An offset to the minute has no
 *   such limit.
 *
 * @param value ISO 8601 instant string (e.g. "2024-06-15T03:00:00Z")
 * @param unit boundary unit ("hour" | "day" | "week" | "month", or its plural)
 * @param timeZone IANA name or UTC offset the boundary is computed in: a time zone identifier
 *   (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns UTC instant string ending in "Z", or "" on invalid input
 *
 * @example floorToZone("2024-06-15T03:00:00Z", "day", "America/New_York") // "2024-06-14T04:00:00Z" (the 14 June local midnight — the instant is already 14 June there)
 * @example floorToZone("2024-06-15T03:00:00Z", "day", "UTC") // "2024-06-15T00:00:00Z" (the same instant, a different local day)
 * @example floorToZone("2024-06-15T03:00:00Z", "hour", "Asia/Kathmandu") // "2024-06-15T02:15:00Z" (a +05:45 zone's hour boundary)
 * @example floorToZone("2024-06-15T03:00:00Z", "week", "America/New_York") // "2024-06-10T04:00:00Z" (the Monday)
 * @example floorToZone("2024-09-08T10:00:00Z", "day", "America/Santiago") // "2024-09-08T04:00:00Z" (local midnight is skipped, so the day starts at 01:00)
 * @example floorToZone("2024-05-15T10:20:30.123Z", "days", "Europe/Berlin") // "2024-05-14T22:00:00Z" (plural unit name)
 * @example floorToZone("2024-06-15T03:00:00Z", "year", "UTC") // "" (not a bucketing unit)
 * @example floorToZone("2024-06-15T03:00:00", "day", "UTC") // "" (zoneless, so it names no instant)
 * @example floorToZone("-271821-04-20T00:00:00Z", "month", "UTC") // "" (that month began before Temporal's range does)
 * @example floorToZone("2024-06-15T03:00:00Z", "day", "Invalid/Zone") // ""
 * @example floorToZone("1970-01-01T13:00:00Z", "day", "-00:44:30") // "1970-01-01T00:44:30Z" (local midnight at a stored offset with seconds)
 */
export function floorToZone(
  value: string,
  unit: Temporal.SmallestUnit<ZoneBucketUnit>,
  timeZone: string,
): string {
  // The singular name; the guard below rejects anything outside the four units.
  const resolvedUnit = resolveDateTimeUnit(unit) as ZoneBucketUnit;

  const frame = zoneFrame(timeZone);

  if (
    !isValidInstant(value) ||
    !isValidZoneBucketUnit(resolvedUnit) ||
    frame === null
  ) {
    return "";
  }

  try {
    const zoned = frameZoned(instantFrom(value), frame);
    const start = zonedUnitStart(zoned, resolvedUnit);

    return start ? frameInstant(start, frame).toString() : "";
  } catch {
    return "";
  }
}
