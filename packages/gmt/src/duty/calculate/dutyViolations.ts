import { parseIntervalNanoseconds } from "../../internal";
import { prepareDutyCall, scanDutyViolations } from "../../internal/dutyEngine";
import type {
  Disambiguation,
  DutyEntry,
  DutyRule,
  DutyViolation,
  Interval,
} from "../../types";

/**
 * Return every violation of a set of hours-of-work rules inside a range, each with the window
 * that failed it: the record over a month, not the check before dispatch.
 *
 * - Each rule is checked as `evaluateDutyLog` checks it, at every instant where its answer can
 *   change: entry bounds, those bounds shifted by a sliding window's length, where a run reaches
 *   or falls below a floor the rule compares it with, the boundaries of its local periods, and
 *   the instants either side of each. So the record does not depend on how a status is split
 *   into entries.
 * - One entry per violation. A moving window (an elapsed duration, or more than one local period)
 *   is one violation for as long as it keeps failing, with no passing check between, reported by
 *   the window that failed worst, the earliest on a tie. A count since a reset, or one short rest
 *   before a duty, is one violation however often it is checked, reported by its worst check. One
 *   fixed period is one violation, reported by its last check, which judges the period complete.
 * - A violation is listed in the range it began in. One already failing at `range.start` belongs
 *   to the range before; one still failing at `range.end` is followed to its worst window, which
 *   may end after the range, but never past the log's last entry. So two adjacent ranges list
 *   every violation once.
 * - Each check reads the log as it stood then, so a failure stays listed when later entries would
 *   have excused it, such as a rest that completes a pair after the window it would have moved
 *   had closed. The record lists what a check at that moment would have said, so it only grows as
 *   the log does.
 * - Only logged time is judged. Nothing after the log's last entry is checked, so a range running
 *   past the log reads as one ending with it, and a period still open there is judged as not yet
 *   over. Nothing before the log's first entry (and, for `usageLookback`, its first use) is
 *   checked either, so a range of any length is read as the part of it the log covers.
 * - Time before the log is read two ways. `evaluateDutyLog` reads it strictly, for a check before
 *   dispatch: it is neither work nor rest, so a rest rule whose window reaches back before the log
 *   fails for want of logged rest. The record does not invent a violation there: a rest rule
 *   (`restRequirement`, `freePeriod`, `pattern`, `restBeforeDuty`) is not judged on a window that
 *   starts before the log's first entry. A cap is, since time no entry covers never counts towards
 *   one. Both read the log's first entry as the start of a stretch without rest for `maxGap`.
 * - Rules with `severity: "advisory"` are not listed: an advisory is not a violation.
 * - Entries are ordered by window start, then by the order of `rules`.
 * - Returns `null` for anything `evaluateDutyLog` refuses, for a `range` that is not a valid
 *   `Interval`, when more than 10,000 of a rule's local periods end in the part of `range` the log
 *   covers, and when one rule would need more than 1,000,000 instants checked there.
 *
 * @param log the duty log, ordered and non-overlapping
 * @param range `{ start, end }` record of ISO 8601 instant strings to report on
 * @param rules the rules, every number the caller's
 * @param options the reference zone and the operator day
 * @returns the violations, or null on invalid input
 *
 * @example dutyViolations([{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }, { status: "driving", start: "2024-01-01T10:00:00Z", end: "2024-01-01T22:00:00Z" }], { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, [{ label: "11 driving", kind: "cumulativeCap", statuses: ["driving"], cap: "PT11H", since: { statuses: ["off"], consecutive: "PT10H" } }], { timeZone: "UTC" }) // [{ label: "11 driving", window: { start: "2024-01-01T10:00:00Z", end: "2024-01-01T22:00:00Z" }, used: "PT12H", limit: "PT11H" }]
 * @example dutyViolations([], { start: "2024-01-01T00:00:00Z", end: "2024-02-01T00:00:00Z" }, [], { timeZone: "UTC" }) // []
 * @example dutyViolations([], { start: "2024-02-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }, [], { timeZone: "UTC" }) // null — inverted range
 */
export function dutyViolations(
  log: DutyEntry[],
  range: Interval,
  rules: DutyRule[],
  options: {
    /**
     * The reference time zone every local period is read in, an IANA name or UTC offset: a time
     * zone identifier (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns).
     */
    timeZone: string;
    /**
     * The local wall time each operator day starts at, as an ISO PlainTime string (`"04:00"`).
     * A rule that counts `operatorDays` needs it.
     *
     * @defaultValue None. A rule that counts operator days makes the call invalid.
     */
    dayStartTime?: string;
    /**
     * How a day start, or a `freePeriod` window edge, that the clock repeats or skips becomes an
     * instant, as `resolveLocal` resolves it. `"compatible"` reads a skipped time after the gap
     * and a repeated one at its first pass, `"earlier"` and `"later"` take that side in both
     * cases, and `"reject"` returns the sentinel when an operator day a rule counts starts or ends
     * at such a time, or a local window with such an edge reaches a logged free period.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
  },
): DutyViolation[] | null {
  try {
    const bounds = parseIntervalNanoseconds(range);
    const call = prepareDutyCall(log, rules, options);

    if (bounds === null || call === null) {
      return null;
    }

    return scanDutyViolations(call.context, call.rules, bounds);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
