import { Temporal } from "@js-temporal/polyfill";
import { parseInstantNanoseconds } from "../../internal";
import { evaluateDutyRules, prepareDutyCall } from "../../internal/dutyEngine";
import type {
  Disambiguation,
  DutyEntry,
  DutyReport,
  DutyRule,
} from "../../types";

/**
 * Evaluate every hours-of-work rule over a duty log at one instant, and report each one whether
 * or not it binds.
 *
 * GMT implements no regulation: each rule is a shape, and every number in it is the caller's. A
 * regime is the array of rules the caller assembles and labels. GMT reports totals, what is left
 * and what failed; it does not decide dispatch, fitness or eligibility.
 *
 * - The log is read as it stands at `at`: later entries are ignored and one straddling `at` is cut
 *   there. Time no entry covers is in no status, so it is neither work nor rest. That includes the
 *   time before the log's first entry: give a log that reaches back as far as the longest rule
 *   looks, or a rest rule fails for want of logged rest. A planned roster is the same call with
 *   the plan appended and `at` set to its end.
 * - This is the strict reading, for a check before dispatch. `dutyViolations` reads a record the
 *   other way: it does not judge a rest rule on a window that starts before the log's first
 *   entry, since the log cannot say what happened then. Both read the log's first entry as the
 *   start of a stretch without rest for `maxGap`, as the end of a rest would be.
 * - Every outcome carries `used`, `limit`, `remaining`, `window`, `dueBy` and `resetAt`, so the
 *   second-tightest limit is visible before it binds. Failed rules are listed again under
 *   `violations` or, with `severity: "advisory"`, under `advisories` only.
 * - A duration in a `Period` is a sliding window ending at `at`; `operatorDays` are the days of
 *   `dutyDayFor`; calendar days, ISO weeks, months and years are local periods in `timeZone`,
 *   23 or 25 hours long across a one-hour clock change. Each outcome names its `periodBasis`.
 * - The local periods are the ones holding the last instant before `at`, so at a boundary the
 *   period just ended is judged: a roster ending at midnight is checked through its last day.
 * - A window that runs past `at` (the rest of today, this week) has not failed a minimum while
 *   the minimum could still be met with rest from `at` to its end; a cap fails as soon as it is
 *   passed.
 * - Endpoints are UTC instants ending in "Z"; durations are ISO 8601 with hours as the largest
 *   unit (`"PT49H30M"`).
 * - Returns `null` when the log fails `isValidDutyLog`, when `at` is not an ISO 8601 instant
 *   string, when a rule is malformed (an unknown kind, a status list that is empty or holds a
 *   non-string, a duration that is not positive exact time, a malformed period, a duplicate
 *   label, a count of periods past 10,000 alone or times `adjacent`, `lookback` or `periods`, a
 *   `containing.count` past 10,000), when `options.timeZone` is invalid, when a rule counts
 *   `operatorDays` without `options.dayStartTime`, when a window, or a requirement `orFactor`
 *   scales, falls outside Temporal's range, when a count of free periods passes
 *   `Number.MAX_SAFE_INTEGER`, and when one run of rest in a `freePeriod` window holds more than
 *   20,000 of its `containing` windows (about 54 years of a daily window).
 *
 * @param log the duty log, ordered and non-overlapping
 * @param at ISO 8601 instant string to evaluate at
 * @param rules the rules, every number the caller's
 * @param options the reference zone and the operator day
 * @returns the report, or null on invalid input
 *
 * @example evaluateDutyLog([{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }, { status: "driving", start: "2024-01-01T10:00:00Z", end: "2024-01-01T21:00:00Z" }], "2024-01-01T21:00:00Z", [{ label: "11 driving", kind: "cumulativeCap", statuses: ["driving"], cap: "PT11H", since: { statuses: ["off"], consecutive: "PT10H" } }], { timeZone: "UTC" }) // { at: "2024-01-01T21:00:00Z", outcomes: [{ label: "11 driving", kind: "cumulativeCap", severity: "violation", satisfied: true, used: "PT11H", limit: "PT11H", remaining: "PT0S", window: { start: "2024-01-01T10:00:00Z", end: "2024-01-01T21:00:00Z" }, periodBasis: null, dueBy: null, resetAt: "2024-01-01T10:00:00Z" }], violations: [], advisories: [] }
 * @example evaluateDutyLog([{ status: "driving", start: "2024-01-01T10:00:00Z", end: "2024-01-01T21:00:00Z" }], "2024-01-01T21:00:00Z", [{ label: "60 in 7", kind: "rollingCap", statuses: ["driving"], cap: "PT60H", window: { operatorDays: 7 } }], { timeZone: "UTC" }) // null — operator days without dayStartTime
 * @example evaluateDutyLog([], "2024-01-01T00:00:00Z", [], { timeZone: "UTC" }) // { at: "2024-01-01T00:00:00Z", outcomes: [], violations: [], advisories: [] }
 * @example evaluateDutyLog([{ status: "on", start: "2024-01-01T02:00:00Z", end: "2024-01-01T01:00:00Z" }], "2024-01-01T03:00:00Z", [], { timeZone: "UTC" }) // null — inverted entry
 */
export function evaluateDutyLog(
  log: DutyEntry[],
  at: string,
  rules: DutyRule[],
  options: {
    /**
     * The reference time zone every local period is read in, an IANA name or UTC offset: a time
     * zone identifier (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns). A log kept in another clock is converted to instants first.
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
): DutyReport | null {
  try {
    const instant = typeof at === "string" ? parseInstantNanoseconds(at) : null;
    const call = prepareDutyCall(log, rules, options);

    if (instant === null || call === null) {
      return null;
    }

    const outcomes = evaluateDutyRules(call.context, call.rules, instant);

    return {
      at: Temporal.Instant.fromEpochNanoseconds(instant).toString(),
      outcomes,
      violations: outcomes.filter(
        (outcome) => !outcome.satisfied && outcome.severity === "violation",
      ),
      advisories: outcomes.filter(
        (outcome) => !outcome.satisfied && outcome.severity === "advisory",
      ),
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
