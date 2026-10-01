import { Temporal } from "@js-temporal/polyfill";
import { isValidInstant } from "../../precision/validate/isValidInstant";

/**
 * Measure how far an actual time is from its plan: positive when late, negative when early.
 *
 * Every mode publishes a plan and records what happened, and measures the gap the same way. This
 * is that gap; `classifyPunctuality` judges it against a tolerance.
 *
 * - **Exact elapsed time**, as an ISO 8601 duration with hours as the largest unit, so the value
 *   never depends on a calendar or a wall clock. A delay across a fall-back night is `PT1H`,
 *   never the `PT0S` a wall-clock subtraction reads; across a spring-forward it is `PT1H`, never
 *   `PT2H`. Two days late is `PT48H`, not `P2D`.
 * - **Signed:** `actual` after `planned` is positive (late), before it negative (`"-PT5M"`,
 *   early), and equal is `"PT0S"`.
 * - Both arguments are exact: an instant (`Z`/offset) or a zoned string. The zone each is written
 *   in does not matter, and a bracketed zone is not read. To show a schedule's local time, use
 *   `etaAtZone`.
 * - Returns `""` on invalid input, including a zoneless wall time, which is not a moment.
 *
 * @param planned ISO 8601 instant or zoned datetime string of the planned time
 * @param actual ISO 8601 instant or zoned datetime string of the actual (or compared) time
 * @returns ISO 8601 duration from planned to actual, negative when early, or "" on invalid input
 *
 * @example scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T10:14:00Z") // "PT14M"
 * @example scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T09:55:00Z") // "-PT5M" (five minutes early)
 * @example scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T10:00:00Z") // "PT0S"
 * @example scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-17T11:30:00Z") // "PT49H30M" (hours, never days)
 * @example scheduleDeviation("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]") // "PT1H" (the same wall time, one hour later across the fall-back)
 * @example scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T12:14:00+02:00[Europe/Amsterdam]") // "PT14M" (the zone it is written in does not matter)
 * @example scheduleDeviation("2024-06-15T10:00:00", "2024-06-15T10:14:00Z") // "" (a zoneless plan is not a moment)
 */
export function scheduleDeviation(planned: string, actual: string): string {
  try {
    if (!isValidInstant(planned) || !isValidInstant(actual)) {
      return "";
    }

    return Temporal.Instant.from(planned)
      .until(Temporal.Instant.from(actual), { largestUnit: "hours" })
      .toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
