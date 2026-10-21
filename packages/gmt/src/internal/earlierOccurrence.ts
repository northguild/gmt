import { Temporal } from "./temporal";
import { plainToZoned } from "./zonedWallClockOperations";
import type { ZoneFrame } from "./zoneFrame";

/** Whether a local wall time is one instant, a repeated hour or a skipped one. */
export type WallClassification = "unique" | "ambiguous" | "nonexistent";

/**
 * Classify a local wall time in a named zone and place its earlier reading.
 *
 * Temporal separates a repeated wall time from a skipped one the same way: two instants. Only the
 * wall clock the earlier one lands on tells them apart: for an overlap both instants read back as
 * the requested time, and for a gap neither does, because `"earlier"` and `"later"` resolve a gap
 * by moving off the requested time entirely.
 *
 * Throws what Temporal throws; callers wrap it in their own try/catch.
 *
 * @param wall the local wall time
 * @param timeZone a Temporal time zone identifier (a `ZoneFrame`'s `timeZone` with no stored offset)
 * @returns the classification, the earlier reading (for a gap, the one `"earlier"` moves to) and the later one
 *
 * @example classifyWall(Temporal.PlainDateTime.from("2024-11-03T01:30:00"), "America/New_York").kind // "ambiguous"
 * @example classifyWall(Temporal.PlainDateTime.from("2024-03-10T02:30:00"), "America/New_York").kind // "nonexistent"
 */
export function classifyWall(
  wall: Temporal.PlainDateTime,
  timeZone: string,
): {
  kind: WallClassification;
  earliest: Temporal.ZonedDateTime;
  latest: Temporal.ZonedDateTime;
} {
  const earliest = plainToZoned(wall, timeZone, "earlier");
  const latest = plainToZoned(wall, timeZone, "later");

  if (earliest.epochNanoseconds === latest.epochNanoseconds) {
    return { kind: "unique", earliest, latest };
  }
  return {
    kind: earliest.toPlainDateTime().equals(wall) ? "ambiguous" : "nonexistent",
    earliest,
    latest,
  };
}

/**
 * The instant a local wall time names: the first occurrence of a repeated hour, as RFC 5545
 * §3.3.5 reads a local time that "occurs more than once", and `null` for a skipped one, which is
 * never shifted.
 *
 * @param wall the local wall time
 * @param frame the zone, from `zoneFrame`; a frame with a stored offset (seconds) names no
 * `ZonedDateTime`, so it answers `null`
 * @returns the zoned date-time, or `null` for a skipped wall time, a wall time Temporal cannot
 * place, or a frame with a stored offset
 *
 * @example earlierOccurrence(Temporal.PlainDateTime.from("2024-11-03T01:30:00"), { timeZone: "America/New_York", shiftNanoseconds: 0n })?.offset // "-04:00"
 * @example earlierOccurrence(Temporal.PlainDateTime.from("2024-03-10T02:30:00"), { timeZone: "America/New_York", shiftNanoseconds: 0n }) // null
 */
export function earlierOccurrence(
  wall: Temporal.PlainDateTime,
  frame: ZoneFrame,
): Temporal.ZonedDateTime | null {
  if (frame.shiftNanoseconds !== 0n) {
    return null;
  }
  try {
    const { kind, earliest } = classifyWall(wall, frame.timeZone);
    return kind === "nonexistent" ? null : earliest;
  } catch {
    return null;
  }
}
