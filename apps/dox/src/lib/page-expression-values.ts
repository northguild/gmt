/**
 * Build-time values for the `{…}` expressions the splash pages interpolate into their prose.
 *
 * `index.mdx` and `why-gmt.mdx` state their figures as JSX expressions over the same data modules
 * `pnpm stats:sync` writes, so nothing on them is ever typed in by hand. Astro evaluates those
 * expressions for the HTML, but the `.md`, `llms.txt`, `llms-full.txt` and retrieval surfaces are
 * built from the raw `.mdx`, where they are still source text. This module evaluates them once,
 * from those same modules, so the text surfaces carry the figures rather than the expressions.
 *
 * `page-expression-values.test.ts` fails when a page grows an expression this table doesn't
 * resolve, so the two cannot drift apart silently.
 */
import {
  combinedCompetitorExecutions,
  competitorExecutionRange,
  competitorPublicApiRange,
  competitorStatRange,
  competitorTimeResolutionLabel,
  executionRatio,
  largestCompetitorSuite,
} from "../data/library-comparison";
import {
  coreFunctions,
  coreNamespaces,
  formatCount,
  formatNamespaceList,
  gmtStats,
  industryNamespaces,
  runsPerTest,
} from "../data/gmt-stats";
import { familyCounts, formatFamilyCounts } from "./locale-families";
import { formatOffset, zoneOffsetRange } from "./timezone-offset-range";

/** The expressions' text exactly as the pages write it, mapped to its rendered value. */
export function pageExpressionValues(): Record<string, string> {
  const executionRange = competitorExecutionRange();
  const localeRange = competitorStatRange("locales");
  const timezoneRange = competitorStatRange("timezones");
  const nodeRange = competitorStatRange("nodeVersions");
  const testRange = competitorStatRange("tests");
  const publicApiRange = competitorPublicApiRange();
  const largestSuite = largestCompetitorSuite();
  const localeFamilyCounts = familyCounts(gmtStats.localeList);
  const zoneOffsets = zoneOffsetRange(gmtStats.timezoneList);
  const offsetWindowHours =
    (zoneOffsets.max.minutes - zoneOffsets.min.minutes) / 60;
  const plainAndZoned = coreNamespaces
    .filter((row) => row.namespace === "plain" || row.namespace === "zoned")
    .reduce((sum, row) => sum + row.count, 0);

  return {
    "gmtStats.tests": String(gmtStats.tests),
    "gmtStats.timezones": String(gmtStats.timezones),
    "gmtStats.locales": String(gmtStats.locales),
    "gmtStats.patterns": String(gmtStats.patterns),
    "gmtStats.nodes.length": String(gmtStats.nodes.length),
    'gmtStats.nodes.join(", ")': gmtStats.nodes.join(", "),
    "gmtStats.byNamespace.length": String(gmtStats.byNamespace.length),
    "formatCount(gmtStats.tests)": formatCount(gmtStats.tests),
    "formatCount(gmtStats.executions)": formatCount(gmtStats.executions),
    "formatCount(gmtStats.functions)": formatCount(gmtStats.functions),
    runsPerTest: String(runsPerTest),
    "coreNamespaces.length": String(coreNamespaces.length),
    "industryNamespaces.length": String(industryNamespaces.length),
    coreNamespaceList: formatNamespaceList(coreNamespaces),
    industryNamespaceList: formatNamespaceList(industryNamespaces),
    "formatCount(coreFunctions)": formatCount(coreFunctions),
    "formatCount(plainAndZoned)": formatCount(plainAndZoned),
    offsetWindowHours: String(offsetWindowHours),
    "localeFamilyCounts.length": String(localeFamilyCounts.length),
    "formatFamilyCounts(localeFamilyCounts)":
      formatFamilyCounts(localeFamilyCounts),
    "zoneOffsets.min.zoneId": zoneOffsets.min.zoneId,
    "zoneOffsets.max.zoneId": zoneOffsets.max.zoneId,
    "formatOffset(zoneOffsets.min.minutes)": formatOffset(
      zoneOffsets.min.minutes,
    ),
    "formatOffset(zoneOffsets.max.minutes)": formatOffset(
      zoneOffsets.max.minutes,
    ),
    "formatCount(executionRange.min)": formatCount(executionRange.min),
    "formatCount(executionRange.max)": formatCount(executionRange.max),
    "executionRatio(executionRange.max)": String(
      executionRatio(executionRange.max),
    ),
    "formatCount(executionRatio(executionRange.min))": formatCount(
      executionRatio(executionRange.min),
    ),
    "formatCount(combinedCompetitorExecutions())": formatCount(
      combinedCompetitorExecutions(),
    ),
    "executionRatio(combinedCompetitorExecutions())": String(
      executionRatio(combinedCompetitorExecutions()),
    ),
    "localeRange.min": String(localeRange.min),
    "localeRange.max": String(localeRange.max),
    "timezoneRange.min": String(timezoneRange.min),
    "timezoneRange.max": String(timezoneRange.max),
    "nodeRange.min": String(nodeRange.min),
    "nodeRange.max": String(nodeRange.max),
    "formatCount(testRange.min)": formatCount(testRange.min),
    "formatCount(testRange.max)": formatCount(testRange.max),
    "publicApiRange.min": String(publicApiRange.min),
    "publicApiRange.max": String(publicApiRange.max),
    "largestSuite.displayName": largestSuite.displayName,
    "formatCount(largestSuite.stats.tests)": formatCount(
      largestSuite.stats.tests,
    ),
    "competitorTimeResolutionLabel()": competitorTimeResolutionLabel(),
  };
}
