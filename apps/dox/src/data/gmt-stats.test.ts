/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { formatCount, gmtStats, runsPerTest } from "./gmt-stats";
import {
  competitorComparisons,
  competitorExecutionRange,
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
});

// why-gmt.mdx states these as facts, so a data change that falsifies one must
// fail here rather than ship.
describe("claims the why-gmt copy makes", () => {
  it("GMT's suite outnumbers every alternative's", () => {
    expect(gmtStats.tests).toBeGreaterThan(
      largestCompetitorSuite().stats.tests,
    );
  });

  it("GMT's CI executions exceed every alternative's", () => {
    expect(gmtStats.executions).toBeGreaterThan(
      competitorExecutionRange().max,
    );
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
