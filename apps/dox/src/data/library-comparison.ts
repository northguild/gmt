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
import measurementData from "./library-measurements.json";

/**
 * What was measured about one other library, and where it came from. One entry per library in
 * `library-measurements.json`, the single place these numbers are typed. `scripts/stats.mjs`
 * reads the same file for the READMEs.
 */
export interface LibraryMeasurement {
  /** Matches `LibraryComparison.id`. */
  id: string;
  /**
   * The library's name as the site and the READMEs print it. `scripts/stats.mjs` finds a
   * library's row in the README comparison table by this name.
   */
  name: string;
  /**
   * The package version the tests were run at: the `version` of `package.json` at `commit`, or,
   * where the repository stamps the version only when it publishes, the release tag whose source
   * and tests are the same as that commit's.
   */
  version: string;
  repository: string;
  commit?: string;
  /** ISO date the figures were taken. Each is a snapshot of that day. */
  measuredOn: string;
  /** The command that produced the test count, where the repository records it. */
  command?: string;
  /** A link to the library's CI configuration, a workflow file or the folder that holds them. */
  ciConfigUrl: string;
  tests: number;
  executions: number;
  nodeVersions: number;
  timezones: number;
  /** Time-zone test files re-run under several zones rather than the whole suite. */
  partialZoneRuns?: { testFiles: number; zones: number; unit: string };
  /** True when a dedicated time-zone workflow exists whose scope could not be read. */
  timeZoneWorkflowScopeUnclear?: boolean;
  /** The dedicated locale and i18n test files the repository holds, one count for every library. */
  locales: number;
  /** Tests that fail on the library's own current default branch, if measured. */
  knownFailures?: number;
  /** Failures on the measuring machine caused by its environment; they do not change `tests`. */
  environmentFailures?: number;
  publicApi: { functions: number; methods: number; version: string };
  note: string;
}

export const libraryMeasurements: readonly LibraryMeasurement[] =
  measurementData.libraries;

function measured(id: string): LibraryMeasurement {
  const found = libraryMeasurements.find((m) => m.id === id);
  if (!found)
    throw new Error(`library-measurements.json has no entry for ${id}`);
  return found;
}

/** The counts a comparison entry carries, read from its measurement. */
function statsOf(m: LibraryMeasurement): LibraryComparisonStats {
  return {
    tests: m.tests,
    locales: m.locales,
    timezones: m.timezones,
    nodeVersions: m.nodeVersions,
    executions: m.executions,
    ...(m.knownFailures === undefined
      ? {}
      : { knownFailures: m.knownFailures }),
    publicApi: m.publicApi,
  };
}

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
  /**
   * Public callable API, measured from the library's published TypeScript declarations:
   * every exported function, plus every public method (static or instance, including
   * function-typed members) of its exported classes, interfaces and namespaces. A name
   * counts once per owner, an alias export once, and a method inherited from a base type
   * only on that base. Not counted: constructors, getters, plain properties,
   * private/`@internal` members. Absent for @northguild/gmt, whose figure is
   * `gmtStats.functions` (it exports functions only, so the two rules agree).
   */
  publicApi?: { functions: number; methods: number; version: string };
}

/** The finest time unit a library's public API can represent. */
export type TimeResolution = "millisecond" | "nanosecond";

export interface LibraryComparison {
  id: string;
  displayName: string;
  /**
   * The finest time unit the library's public API represents. Measured from each library's
   * published TypeScript declarations at its `publicApi` version (2026-09-15): no alternative
   * declares a microsecond or nanosecond field or unit anywhere, so each stops at the
   * millisecond, like `Date`. GMT is nanosecond: Temporal counts epoch nanoseconds, and GMT
   * keeps them exact as `bigint` (the `precision` namespace).
   */
  timeResolution: TimeResolution;
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
  /** Where the numbers above came from; absent for @northguild/gmt, whose figures come from gmt-stats.json. */
  measurement?: LibraryMeasurement;
}

export const libraryComparisons: LibraryComparison[] = [
  {
    id: "@northguild/gmt",
    timeResolution: "nanosecond",
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
  },
  {
    id: "@internationalized/date",
    timeResolution: "millisecond",
    displayName: measured("@internationalized/date").name,
    chartLabel: "@intl/date",
    kind: "nonstandard",
    foundation: "not TC39",
    detail:
      "Its own CalendarDate / ZonedDateTime types. Fixes the model, but it is Adobe's API — a second migration once Temporal ships.",
    measurement: measured("@internationalized/date"),
    stats: statsOf(measured("@internationalized/date")),
  },
  {
    id: "luxon",
    timeResolution: "millisecond",
    displayName: measured("luxon").name,
    matrixLabel: "4 Node versions",
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "A DateTime is a Date plus a zone string. Invalid inputs become an Invalid DateTime you have to remember to check for.",
    measurement: measured("luxon"),
    stats: statsOf(measured("luxon")),
  },
  {
    id: "date-fns",
    timeResolution: "millisecond",
    displayName: measured("date-fns").name,
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "Tree-shakeable functions — but every argument and every return value is a Date, so all of its footguns are still yours.",
    bannedCompanions: ["date-fns-tz"],
    measurement: measured("date-fns"),
    stats: statsOf(measured("date-fns")),
  },
  {
    id: "moment",
    timeResolution: "millisecond",
    displayName: measured("moment").name,
    matrixLabel: "3 Node versions",
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "A wrapper around Date. In legacy maintenance mode since 2020, and mutable like the thing it wraps.",
    bannedCompanions: ["moment-timezone"],
    measurement: measured("moment"),
    stats: statsOf(measured("moment")),
  },
  {
    id: "dayjs",
    timeResolution: "millisecond",
    displayName: measured("dayjs").name,
    matrixLabel: "2 tz files × 4 extra TZ runs",
    kind: "wraps",
    foundation: "built on Date",
    detail:
      "Wraps a real Date instance under the hood. Its timezone plugin is graded against moment's output — it can't verify itself without the library it replaces.",
    measurement: measured("dayjs"),
    stats: statsOf(measured("dayjs")),
  },
  {
    id: "spacetime",
    timeResolution: "millisecond",
    displayName: measured("spacetime").name,
    matrixLabel: "2 Node versions",
    kind: "wraps",
    foundation: "leans on Date",
    detail:
      "now()/today() default through new Date(). Four DST edge-case suites are named .ignore.js and never run — and the DST tests that do run are currently failing.",
    measurement: measured("spacetime"),
    stats: statsOf(measured("spacetime")),
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

/** Fewest and most of one stat among the alternatives — so page copy never types a range. */
export function competitorStatRange(
  stat: keyof Omit<LibraryComparisonStats, "knownFailures" | "publicApi">,
): { min: number; max: number } {
  const values = competitorComparisons.map((l) => l.stats[stat]);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** A library's public callable API: functions plus methods (see `LibraryComparisonStats.publicApi`). */
export function publicApiTotal(library: LibraryComparison): number {
  const api = library.stats.publicApi;
  return api ? api.functions + api.methods : 0;
}

/** Alternatives with a measured public API, largest first, for the why-gmt footnote. */
export function competitorsByPublicApi(): LibraryComparison[] {
  return competitorComparisons
    .filter((l) => l.stats.publicApi)
    .sort((a, b) => publicApiTotal(b) - publicApiTotal(a));
}

/** Smallest and largest measured public API among the alternatives. */
export function competitorPublicApiRange(): { min: number; max: number } {
  const totals = competitorsByPublicApi().map(publicApiTotal);
  return { min: Math.min(...totals), max: Math.max(...totals) };
}

/**
 * The finest time units the alternatives represent, as one table label, e.g. "Milliseconds".
 * Derived from each entry's `timeResolution`, so page copy never types the claim.
 */
export function competitorTimeResolutionLabel(): string {
  const units = [
    ...new Set(competitorComparisons.map((l) => l.timeResolution)),
  ];
  return units
    .map((unit) => `${unit.charAt(0).toUpperCase()}${unit.slice(1)}s`)
    .join(", ");
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
