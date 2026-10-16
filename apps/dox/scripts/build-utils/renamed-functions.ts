/**
 * Public functions of a released version that were renamed or moved, each with the key it
 * had and the key it has now (`<namespace>/<module>/<name>`). `buildRedirects` writes a
 * 301 from the old reference URL to the new page, so links from outside (search results,
 * older copies of the docs) keep working.
 *
 * Add an entry only for a function a release published. A function that was never released
 * has no inbound links, and its old key needs no redirect. Remove an entry only when the old
 * URL no longer needs to resolve. The new key must stay a live function page, or the
 * generation fails.
 *
 * A leaf data module: it imports nothing.
 */

export interface RenamedFunction {
  /** The key of the function's old page. */
  from: string;
  /** The key of the function's page now. */
  to: string;
}

export const RENAMED_FUNCTIONS: readonly RenamedFunction[] = [
  { from: "plain/parse/parseSql", to: "plain/parse/parseSqlDateTime" },
  { from: "plain/format/formatSql", to: "plain/format/formatSqlDateTime" },
  { from: "utc/parse/parseHttp", to: "utc/parse/parseHttpDate" },
  { from: "utc/format/formatHttp", to: "utc/format/formatHttpDate" },
  {
    from: "duration/calculate/durationAs",
    to: "duration/calculate/totalDuration",
  },
  // `isLeapSecond` kept its name for a new function, the check against the leap-second table.
  // The old one, which reads the syntax of a seconds field of 60, is `hasSecond60`.
  { from: "plain/validate/isLeapSecond", to: "plain/validate/hasSecond60" },
  // The duty engine became the `workforce` industry layer.
  ...[
    "dutyDayFor",
    "dutyTotals",
    "dutyViolations",
    "evaluateDutyLog",
    "longestRun",
    "qualifyingRestPairs",
    "qualifyingRests",
  ].map((name) => ({
    from: `duty/calculate/${name}`,
    to: `workforce/calculate/${name}`,
  })),
  {
    from: "duty/validate/isValidDutyLog",
    to: "workforce/validate/isValidDutyLog",
  },
];
