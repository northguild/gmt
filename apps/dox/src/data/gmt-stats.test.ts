/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import {
  coreFunctions,
  coreNamespaces,
  formatCount,
  formatNamespaceList,
  gmtStats,
  industryFunctions,
  industryNamespaces,
  runsPerTest,
} from "./gmt-stats";
import {
  competitorComparisons,
  competitorExecutionRange,
  competitorStatRange,
  executionRatio,
  largestCompetitorSuite,
} from "./library-comparison";

describe("gmtStats", () => {
  it("describes the packages/gmt suite only", () => {
    expect(gmtStats.suite).toBe("packages/gmt");
  });

  it("runs every test once per Node version per timezone", () => {
    expect(gmtStats.executions).toBe(gmtStats.tests * runsPerTest);
  });

  it("totals public functions across the namespaces", () => {
    const total = gmtStats.byNamespace.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(gmtStats.functions);
  });

  it("lists namespaces largest first", () => {
    const counts = gmtStats.byNamespace.map((row) => row.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("names only exporting namespaces as industry layers", () => {
    const namespaces = gmtStats.byNamespace.map((row) => row.namespace);
    for (const industry of gmtStats.industries) {
      expect(namespaces).toContain(industry);
    }
  });

  it("splits every namespace into core or industry", () => {
    expect(coreNamespaces.length + industryNamespaces.length).toBe(
      gmtStats.byNamespace.length,
    );
    expect(coreFunctions + industryFunctions).toBe(gmtStats.functions);
  });
});

describe("formatNamespaceList", () => {
  it("lists namespaces as code, joined as prose", () => {
    expect(
      formatNamespaceList([
        { namespace: "plain", count: 2 },
        { namespace: "zoned", count: 1 },
        { namespace: "utc", count: 1 },
      ]),
    ).toBe("`plain`, `zoned`, and `utc`");
  });
});

// why-gmt.mdx states these as facts, so a data change that falsifies one must
// fail here rather than ship.
describe("claims the why-gmt copy makes", () => {
  it("GMT's suite outnumbers every alternative's", () => {
    expect(gmtStats.tests).toBeGreaterThan(
      largestCompetitorSuite().stats.tests,
    );
  });

  it("`plain` and `zoned` are the two largest core namespaces", () => {
    expect(
      coreNamespaces
        .slice(0, 2)
        .map((row) => row.namespace)
        .sort(),
    ).toEqual(["plain", "zoned"]);
  });

  it("there is at least one industry layer beside the core", () => {
    expect(industryNamespaces.length).toBeGreaterThan(0);
    expect(coreNamespaces.length).toBeGreaterThan(0);
  });

  it("GMT's CI executions exceed every alternative's", () => {
    expect(gmtStats.executions).toBeGreaterThan(competitorExecutionRange().max);
  });
});

describe("competitor comparisons", () => {
  it("finds the alternative with the largest suite", () => {
    const tests = competitorComparisons.map((l) => l.stats.tests);
    expect(largestCompetitorSuite().stats.tests).toBe(Math.max(...tests));
  });

  it("spans the fewest to the most alternative executions", () => {
    const executions = competitorComparisons.map((l) => l.stats.executions);
    expect(competitorExecutionRange()).toEqual({
      min: Math.min(...executions),
      max: Math.max(...executions),
    });
  });

  // Expected ranges come from each library's measured sourceNote: locales 0 (most) to 42 (Day.js),
  // tz/DST test files 0 (most) to 8 (Spacetime), Node versions 1 (date-fns, Day.js,
  // @internationalized/date) to 4 (Luxon). A new or re-measured library that moves a range must
  // fail here, so the why-gmt table is re-checked rather than silently changing.
  it.each`
    stat              | min  | max
    ${"locales"}      | ${0} | ${42}
    ${"timezones"}    | ${0} | ${8}
    ${"nodeVersions"} | ${1} | ${4}
  `(
    "spans $stat from $min to $max across the alternatives",
    ({ stat, min, max }) => {
      expect(competitorStatRange(stat)).toEqual({ min, max });
    },
  );

  it("rounds GMT's executions to a whole multiple", () => {
    expect(executionRatio(gmtStats.executions)).toBe(1);
    expect(Number.isInteger(executionRatio(3))).toBe(true);
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(374820)).toBe("374,820");
  });
});
