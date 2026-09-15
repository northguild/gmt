import type { Interval } from "../../types";
import { intersectIntervals } from "./intersectIntervals";

/**
 * Return the part of `interval` that lies inside `bounds`, or null when none of it does.
 *
 * - Exactly `intersectIntervals(interval, bounds)`: half-open, so an interval that only touches
 *   `bounds` clamps to `null`, as does an empty interval at an edge of `bounds`.
 * - Endpoints are the caller's own strings. Where an endpoint of `interval` and of `bounds` are
 *   the same instant, `interval`'s spelling is used (GMT rule: the first argument wins ties).
 * - For zone-aligned bounds (a local business day), build them with `floorToZone` first.
 * - Returns `null` on invalid input — either argument not an `Interval`, or inverted.
 *
 * @param interval `{ start, end }` record of ISO 8601 instant strings to clamp; its strings win ties
 * @param bounds `{ start, end }` record of ISO 8601 instant strings to clamp into
 * @returns `{ start, end }` inside `bounds`, or null when nothing remains or on invalid input
 *
 * @example clampInterval({ start: "2024-01-01T08:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }
 * @example clampInterval({ start: "2024-01-01T06:00:00Z", end: "2024-01-01T20:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }
 * @example clampInterval({ start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // null — touching
 * @example clampInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T09:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // null — empty, at the edge
 * @example clampInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }) // null — inverted bounds
 */
export function clampInterval(
  interval: Interval,
  bounds: Interval,
): Interval | null {
  return intersectIntervals(interval, bounds);
}
