import { parseTimestampEvents } from "../../internal";
import type { TimestampClass, TimestampEvent } from "../../types";

/** What `bestAvailable` returns: the chosen timestamp and the class it carries. */
export interface ClassifiedTimestamp {
  /** The chosen event's `at`, exactly as it was written. */
  at: string;
  /** Its class, so the value is never shown as something it is not. */
  classifier: TimestampClass;
}

/**
 * GMT's selection order: an actual, else a plan, else a request, else an estimate.
 *
 * GMT rule. DCSA defines the four classes (`eventClassifierCode`) and, in its Port Call
 * standard, the pattern some port call services are negotiated through: "an (Estimated,
 * Requested, Planned) ERP-pattern, including an (Actual) A" (DCSA Port Call 2.0.0, Use Cases,
 * "Port Call Services Summary":
 * https://reference.dcsa.org/content/standards/releases/port-call/v2-0-0/port-call-v2-0-0-use-cases).
 * DCSA gives no rule for choosing among the classes; this order reads that pattern from its most
 * settled end.
 */
const PRECEDENCE: readonly TimestampClass[] = ["ACT", "PLN", "REQ", "EST"];

/**
 * Pick the best available timestamp for an event from its planned, estimated, requested and
 * actual records, and say which class it is.
 *
 * One field often carries four meanings — DCSA's `eventClassifierCode` vocabulary: `PLN`
 * (planned), `EST` (estimated), `REQ` (requested) and `ACT` (actual). A dashboard that shows the
 * latest-recorded value puts an estimate in the actual column the moment a late feed arrives.
 * This returns the class with the value, so the consumer can label it.
 *
 * - **An `ACT` wins whenever there is one**, whatever was recorded after it: an estimate recorded
 *   after the arrival is still only an estimate.
 * - Otherwise `PLN`, then `REQ`, then `EST`. This `ACT` > `PLN` > `REQ` > `EST` selection is GMT's
 *   own convention. DCSA's Port Call standard negotiates some port call services — a berth,
 *   pilotage, towage — through an estimated, then requested, then planned timestamp, followed by
 *   an actual; this order reads that pattern from its most settled end. DCSA defines the classes
 *   and the pattern, not a rule for choosing among them. A plan is agreed; a request is asked
 *   for; an estimate is only predicted. So an `EST` or `REQ` never replaces a `PLN`, however much later it was recorded,
 *   and there is never an `EST` when a `REQ` exists. The order is fixed, not configurable.
 * - Within the chosen class, the newest-recorded event wins (latest `recordedAt`), so a revised
 *   plan or a corrected actual replaces the earlier one. Two records at the same instant go to
 *   the later one in the array.
 * - `at` is echoed exactly as written. `at` and `recordedAt` are instants (`Z`/offset) or zoned
 *   strings, compared as instants and read as `scheduleDeviation` reads them: the offset fixes
 *   the instant, and an offset written to the minute that is the bracketed zone's sub-minute
 *   offset rounded (`-00:45[Africa/Monrovia]`, for −00:44:30) names the instant the zone gives.
 *   Otherwise the bracket is not checked.
 * - Returns `null` for an empty list, or when any event is invalid — a `classifier` other than
 *   exactly `PLN`, `EST`, `REQ` or `ACT` included.
 *
 * @param events the event's timestamp records, in any order
 * @returns the chosen `at` and its class (null for an empty list), or null on invalid input
 *
 * @example bestAvailable([{ classifier: "ACT", at: "2024-06-15T12:52:00Z", recordedAt: "2024-06-15T12:53:00Z" }, { classifier: "EST", at: "2024-06-15T13:05:00Z", recordedAt: "2024-06-15T14:00:00Z" }]) // { at: "2024-06-15T12:52:00Z", classifier: "ACT" } (an estimate recorded after the actual never replaces it)
 * @example bestAvailable([{ classifier: "PLN", at: "2024-06-15T12:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }, { classifier: "PLN", at: "2024-06-15T13:00:00Z", recordedAt: "2024-06-10T00:00:00Z" }]) // { at: "2024-06-15T13:00:00Z", classifier: "PLN" } (the newest plan)
 * @example bestAvailable([{ classifier: "EST", at: "2024-06-15T12:40:00Z", recordedAt: "2024-06-14T00:00:00Z" }, { classifier: "REQ", at: "2024-06-15T12:30:00Z", recordedAt: "2024-06-12T00:00:00Z" }]) // { at: "2024-06-15T12:30:00Z", classifier: "REQ" } (never an EST when a REQ exists)
 * @example bestAvailable([]) // null
 * @example bestAvailable([{ classifier: "ETA", at: "2024-06-15T12:40:00Z", recordedAt: "2024-06-14T00:00:00Z" }]) // null (not a timestamp class)
 */
export function bestAvailable(
  events: TimestampEvent[],
): ClassifiedTimestamp | null {
  try {
    const parsed = parseTimestampEvents(events);
    if (parsed === null) {
      return null;
    }

    // `parsed` is in recording order, so the last event of a class is its newest record.
    const newest = new Map<TimestampClass, string>();
    for (const event of parsed) {
      newest.set(event.classifier, event.at);
    }
    for (const classifier of PRECEDENCE) {
      const at = newest.get(classifier);
      if (at !== undefined) {
        return { at, classifier };
      }
    }
    return null;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
