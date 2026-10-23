import {
  holidayEpochDay,
  parseBusinessCalendar,
  type ResolvedBusinessCalendar,
} from "../../internal/businessCalendar";
import { isoDateString } from "../../internal/epochDay";
import {
  observedEpochDay,
  parseObservancePolicy,
  policyNeedsCalendar,
} from "../../internal/observance";
import type { BusinessCalendar, ObservancePolicy } from "../../types";

/**
 * Where a holiday is observed under a policy. The policy is required and has no default: every
 * default would make some other calendar wrong.
 *
 * - The policy is keyed by the ISO weekday of the holiday (`1` Monday to `7` Sunday). A weekday
 *   with no entry is not shifted; `{}` shifts nothing.
 * - `{ next: d }` moves to the first weekday `d` strictly after the holiday (1 to 6 days later).
 * - `{ previous: d }` moves to the first weekday `d` strictly before it (1 to 6 days earlier).
 * - `"nextWorkingDay"` moves to the first business day strictly after the holiday. It needs
 *   `calendar`; a policy that uses it without one gives `""` whatever the date's weekday.
 * - A supplied calendar is validated even when the policy never uses it.
 * - Only the policy's own keys are read.
 * - When the `"nextWorkingDay"` walk finds no business day within 200,000 calendar days, the
 *   result is `""`.
 * - A result outside Temporal's range (-271821-04-19 to +275760-09-13) gives `""`.
 * - Never throws.
 *
 * @param isoDate ISO PlainDate string of the holiday (`"2027-12-25"`)
 * @param policy shift per weekday of the holiday
 * @param calendar open and closed days, for `"nextWorkingDay"`
 * @returns the observed ISO PlainDate string (the input date when the policy does not shift it), or `""` when an argument is invalid or no observed date exists in range
 *
 * @example observedDate("2027-12-25", { 6: { previous: 5 }, 7: { next: 1 } }) // "2027-12-24" — a Saturday moves to the Friday before
 * @example observedDate("2021-12-26", { 7: "nextWorkingDay" }, { weekend: [6, 7], holidays: ["2021-12-27"], timeZone: "UTC" }) // "2021-12-28" — Monday 27 is already closed
 * @example observedDate("2027-12-25", { 6: "nextWorkingDay" }) // "" — no calendar for nextWorkingDay
 */
export function observedDate(
  isoDate: string,
  policy: ObservancePolicy,
  calendar?: BusinessCalendar,
): string {
  try {
    const day = holidayEpochDay(isoDate);
    const resolved = parseObservancePolicy(policy);

    if (day === null || resolved === null) {
      return "";
    }

    let resolvedCalendar: ResolvedBusinessCalendar | null = null;

    if (calendar !== undefined) {
      resolvedCalendar = parseBusinessCalendar(calendar);

      if (resolvedCalendar === null) {
        return "";
      }
    }

    if (policyNeedsCalendar(resolved) && resolvedCalendar === null) {
      return "";
    }

    const observed = observedEpochDay(day, resolved, resolvedCalendar);

    return observed === null ? "" : isoDateString(observed);
  } catch {
    // Never throws (Core Rule 3): a walk past Temporal's range is an invalid result.
    return "";
  }
}
