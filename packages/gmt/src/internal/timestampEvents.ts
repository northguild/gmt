import type { TimestampClass } from "../types";
import { parseInstantNanoseconds } from "./instantNanoseconds";
import { isObject } from "./isObject";

/** A validated `TimestampEvent`, with both of its moments as epoch nanoseconds. */
export type ParsedTimestampEvent = {
  classifier: TimestampClass;
  /** The event's `at`, exactly as the caller wrote it. */
  at: string;
  atNanoseconds: bigint;
  recordedNanoseconds: bigint;
};

const TIMESTAMP_CLASSES: ReadonlySet<unknown> = new Set<TimestampClass>([
  "PLN",
  "EST",
  "REQ",
  "ACT",
]);

/** One event validated, or `null`. */
function parseEvent(event: unknown): ParsedTimestampEvent | null {
  if (!isObject(event)) {
    return null;
  }
  const { classifier, at, recordedAt } = event as Record<string, unknown>;
  if (!TIMESTAMP_CLASSES.has(classifier) || typeof at !== "string") {
    return null;
  }
  const atNanoseconds = parseInstantNanoseconds(at);
  const recordedNanoseconds = parseInstantNanoseconds(recordedAt as string);
  if (atNanoseconds === null || recordedNanoseconds === null) {
    return null;
  }
  return {
    classifier: classifier as TimestampClass,
    at,
    atNanoseconds,
    recordedNanoseconds,
  };
}

/**
 * Validate a list of `TimestampEvent`s and put them in recording order, or `null`.
 *
 * The shared reading behind `bestAvailable` and `estimateDrift`:
 *
 * - Every event must be an object whose `classifier` is exactly `PLN`, `EST`, `REQ` or `ACT` and
 *   whose `at` and `recordedAt` are instants (`Z`/offset) or zoned strings, read as
 *   `parseInstantNanoseconds` reads them: a bracketed zone is not read. One invalid event makes
 *   the whole list invalid.
 * - The result is sorted by `recordedAt`, earliest first. Events recorded at the same instant
 *   keep their input order, so of two ties the later index is the later record.
 * - `at` is kept exactly as written, so a caller can echo it.
 * - An empty list is `[]`; the caller decides what that means.
 * - A hostile value (a throwing getter, a revoked Proxy) is invalid input: `null`, never a throw.
 *
 * @param events candidate list of timestamp events
 * @returns the events in recording order with their instants, or null on invalid input
 *
 * @example parseTimestampEvents([]) // []
 * @example parseTimestampEvents([{ classifier: "ETA", at: "2024-06-15T12:00:00Z", recordedAt: "2024-06-15T10:00:00Z" }]) // null
 */
export function parseTimestampEvents(
  events: unknown,
): ParsedTimestampEvent[] | null {
  try {
    if (!Array.isArray(events)) {
      return null;
    }

    const parsed: ParsedTimestampEvent[] = [];
    for (const event of events) {
      const one = parseEvent(event);
      if (one === null) {
        return null;
      }
      parsed.push(one);
    }

    // Array.prototype.sort is stable, so ties keep their input order.
    return parsed.sort((a, b) =>
      a.recordedNanoseconds < b.recordedNanoseconds
        ? -1
        : a.recordedNanoseconds > b.recordedNanoseconds
          ? 1
          : 0,
    );
  } catch {
    // A hostile value (a throwing getter, a revoked Proxy) is invalid input.
    return null;
  }
}
