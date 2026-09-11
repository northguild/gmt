/**
 * Single source of truth for competitor-library comparison data used across
 * the dox site: the why-gmt CI-execution chart (render-charts.ts) and the
 * homepage "alternatives inherit it, or deviate from the standard" cards
 * (WhyDateAlternatives.astro). Previously this data was duplicated as
 * separate, index-matched literals in each file — a new library meant
 * editing both, and a reordering in one silently desynced the other.
 *
 * `@northguild/gmt`, Temporal, and native `Date` are not "competitors" and
 * are not listed here — they're rendered as fixed structural rows local to
 * WhyDateAlternatives.astro. `@northguild/gmt`'s chart bar/stats still live
 * here (isSubject: true) since the CI-execution chart needs them alongside
 * every other bar.
 */

import { gmtStats } from "./gmt-stats";

export interface LibraryComparisonStats {
  /** Total test cases in one default run of the library's own suite. */
  tests: number;
  /** Distinct locales/i18n exercised by dedicated locale test files. */
  locales: number;
  /** Distinct timezone contexts exercised by dedicated tz/DST test files. */
  timezones: number;
  /** Node.js versions covered by the library's own CI matrix. */
  nodeVersions: number;
  /** Total test executions the library's own CI actually runs (tests × any TZ/Node matrix its own scripts apply). */
  executions: number;
  /** Tests that fail on the library's own current default branch, if measured. */
  knownFailures?: number;
}

export interface LibraryComparison {
  id: string;
  displayName: string;
  /** Shorter label for the bar chart's y-axis; falls back to displayName. */
  chartLabel?: string;
  /** How the CI matrix re-runs the suite, for the chart tooltip; omitted when CI runs it once. */
  matrixLabel?: string;
  /** True only for @northguild/gmt — the highlighted bar in the chart. */
  isSubject?: boolean;
  /** Card styling bucket for WhyDateAlternatives.astro; omitted for @northguild/gmt. */
  kind?: "wraps" | "nonstandard";
  /** Short badge text for the card, e.g. "built on Date". */
  foundation?: string;
  /** Card body copy explaining what the library is and why it falls short. */
  detail?: string;
  /** Companion packages this library's ban also covers (footnoted, not a separate card). */
  bannedCompanions?: string[];
  stats: LibraryComparisonStats;
  /** Where the numbers above came from, for auditability. */
  sourceNote: string;
}

export const libraryComparisons: LibraryComparison[] = [
  {
    id: "@northguild/gmt",
    displayName: "@northguild/gmt",
    isSubject: true,
    matrixLabel: `${gmtStats.timezones} timezones × ${gmtStats.nodes.length} Node versions`,
    stats: {
      // Derived by scripts/stats.mjs into gmt-stats.json — never typed here. The library
      // suite only (packages/gmt, the same subject every other published figure uses), so
      // the bar compares like with like and executions is exactly tests × timezones × Node
      // versions. apps/dox's and packages/gmt-oxlint's suites are counted nowhere; they test
      // the docs site and a lint plugin, not the shipped API. `locales: 0` because the
      // locale matrix is inside the test count, not a further multiplier of it.
      tests: gmtStats.tests,
      locales: 0,
      timezones: gmtStats.timezones,
      nodeVersions: gmtStats.nodes.length,
      executions: gmtStats.executions,
    },
    sourceNote: "Internal CI measurement.",
  },
  {
    id: "@internationalized/date",
    displayName: "@internationalized/date",
    chartLabel: "@intl/date",
    kind: "nonstandard",
    foundation: "not TC39",
    detail:
      "Its own CalendarDate / ZonedDateTime types. Fixes the model, but it is Adobe's API — a second migration once Temporal ships.",
    stats: {
      // 386, not 20,190: that figure was the four original competitors' *combined*
      // execution total and was never this library's own test count. Its bar has always
      // used the correct 386, so only the hover tooltip read wrong ("386 executions
      // (20,190 tests × 1 Node)"), and executions below tests is impossible on a 1× matrix.
      tests: 386,
      locales: 0,
      timezones: 0,
      nodeVersions: 1,
      executions: 386,
    },
    sourceNote: "Internal CI measurement.",
  },
  {
    id: "luxon",
    displayName: "Luxon",
    matrixLabel: "4 Node versions",
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "A DateTime is a Date plus a zone string. Invalid inputs become an Invalid DateTime you have to remember to check for.",
    stats: {
      // 1,222, not 4,888: 4,888 is the CI execution total, and was typed in as the test
      // count too — the same figures as the README comparison table.
      tests: 1222,
      locales: 0,
      timezones: 0,
      nodeVersions: 4,
      executions: 4888,
    },
    sourceNote:
      "Measured 2026-08-22 against moment/luxon@f427515 (3.7.2) by cloning, installing and running `jest`: 1,222 tests. " +
      "CI (.github/workflows/test.yml) runs `npm run test` on a 4-version Node matrix (20, 22, 24, 25) under one fixed " +
      "TZ, America/New_York — no timezone matrix: executions = 1,222 × 4 = 4,888.",
  },
  {
    id: "date-fns",
    displayName: "date-fns",
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "Tree-shakeable functions — but every argument and every return value is a Date, so all of its footguns are still yours.",
    bannedCompanions: ["date-fns-tz"],
    stats: {
      tests: 3213,
      locales: 0,
      timezones: 0,
      nodeVersions: 1,
      executions: 3213,
    },
    sourceNote: "Internal CI measurement.",
  },
  {
    id: "moment",
    displayName: "Moment.js",
    matrixLabel: "3 Node versions",
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "A wrapper around Date. In legacy maintenance mode since 2020, and mutable like the thing it wraps.",
    bannedCompanions: ["moment-timezone"],
    stats: {
      // 3,901, not 11,703: 11,703 is the CI execution total, and was typed in as the test
      // count too — the same figures as the README comparison table.
      tests: 3901,
      locales: 0,
      timezones: 0,
      nodeVersions: 3,
      executions: 11703,
    },
    sourceNote:
      "Measured 2026-08-22 against moment/moment@cf524af (2.30.1) by cloning, installing and running " +
      "`node scripts/test.js`: 3,901 tests, 0 failed on Node 24. CI (.github/workflows/ci.yml) runs `pnpm test` " +
      "on a 3-version Node matrix (lts/*, lts/-1, latest): executions = 3,901 × 3 = 11,703. " +
      "timezones.yml re-runs 5 test modules (not the full suite) under 6 zones; those partial runs are not counted.",
  },
  {
    id: "dayjs",
    displayName: "Day.js",
    matrixLabel: "2 tz files × 4 extra TZ runs",
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "Wraps a real Date instance under the hood. Its timezone plugin is graded against moment's output — it can't verify itself without the library it replaces.",
    stats: {
      tests: 794,
      locales: 42,
      timezones: 6,
      nodeVersions: 1,
      executions: 1034,
    },
    sourceNote:
      "Measured 2026-09-09 against iamkun/dayjs@539c4b9 (`npm test`, single default run: 93 suites / 794 tests). " +
      "The repo's real `test` script re-runs test/timezone.test.js (6 tests) and test/plugin/timezone.test.js (54 tests) " +
      "under 6 distinct TZ env values (Pacific/Auckland, Europe/London, America/Whitehorse, system default, Europe/Paris, America/New_York) " +
      "before the full jest run: 4×6 + 4×54 + 794 = 1034 total executions. locales=42 counts test/locale.test.js plus the 41 files in test/locale/. " +
      "CI (.github/workflows/lint-test.yml) runs npm test on a single Node LTS — no version matrix.",
  },
  {
    id: "spacetime",
    displayName: "Spacetime",
    matrixLabel: "2 Node versions",
    kind: "wraps",
    foundation: "leans on Date",
    detail:
      "now()/today() default through new Date(). Four DST edge-case suites are named .ignore.js and never run — and the DST tests that do run are currently failing.",
    stats: {
      tests: 6086,
      locales: 2,
      timezones: 8,
      nodeVersions: 2,
      executions: 12172,
      knownFailures: 41,
    },
    sourceNote:
      "Measured 2026-09-09 against spencermountain/spacetime@2acdc4e (`tape ./test/**/*.test.js`): 6086 tests, 6045 pass, 41 fail " +
      "(all `dst-off` post-transition assertions in europe/london, europe/ljubljana, atlantic/madeira). " +
      "locales=2 counts test/i18n.test.js and test/intl.test.js. timezones=8 counts the dedicated tz/DST test files that actually run " +
      "(dst-north, dst-south, dst-sneak, findTz, informal-tzs, kazakhstan-timezones, swapTz, timezone-name) — 4 more DST files exist but are " +
      "disabled via the .ignore.js extension and excluded from every count above. " +
      "CI (.github/workflows) runs a real 2-version Node matrix (20.x, 26.x): executions = 6086 × 2 = 12172.",
  },
];

export const gmtLibraryComparison = libraryComparisons.find(
  (l) => l.isSubject,
)!;
export const competitorComparisons = libraryComparisons.filter(
  (l) => !l.isSubject,
);

/** Fewest and most CI executions among the alternatives. */
export function competitorExecutionRange(): { min: number; max: number } {
  const executions = competitorComparisons.map((l) => l.stats.executions);
  return { min: Math.min(...executions), max: Math.max(...executions) };
}

/** Every alternative's CI executions, summed. */
export function combinedCompetitorExecutions(): number {
  return competitorComparisons.reduce((sum, l) => sum + l.stats.executions, 0);
}

/** The alternative whose own suite has the most tests. */
export function largestCompetitorSuite(): LibraryComparison {
  return competitorComparisons.reduce((largest, l) =>
    l.stats.tests > largest.stats.tests ? l : largest,
  );
}

/** GMT's CI executions divided by `executions`, rounded to a whole multiple. */
export function executionRatio(executions: number): number {
  return Math.round(gmtLibraryComparison.stats.executions / executions);
}
