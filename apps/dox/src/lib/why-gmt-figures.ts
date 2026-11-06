import { formatCount, gmtStats } from "../data/gmt-stats";
import { formatOffset, zoneOffsetRange } from "./timezone-offset-range";

const zoneOffsets = zoneOffsetRange(gmtStats.timezoneList);

/** One headline figure at the top of /why-gmt, linking to the section that explains it. */
export interface WhyGmtFigure {
  value: string;
  label: string;
  /** The heading anchor of the section on /why-gmt that gives the detail. */
  href: string;
}

/**
 * The headline figures under the /why-gmt intro, all read from `gmt-stats.json`. The page
 * (`WhyGmtFigures.astro`) and the text surfaces (`mdx-jsx.ts`) both render this list, so the
 * two cannot disagree.
 */
export const whyGmtFigures: readonly WhyGmtFigure[] = [
  {
    value: formatCount(gmtStats.tests),
    label: "tests in one run",
    href: "#ci-test-execution-volume",
  },
  {
    value: formatCount(gmtStats.executions),
    label: "test runs in CI on every pull request",
    href: "#ci-test-execution-volume",
  },
  {
    value: formatCount(gmtStats.functions),
    label: "public functions",
    href: "#api-surface",
  },
  {
    value: String(gmtStats.timezones),
    label: `time zones, from ${formatOffset(zoneOffsets.min.minutes)} to ${formatOffset(zoneOffsets.max.minutes)}`,
    href: "#timezone-coverage",
  },
  {
    value: String(gmtStats.locales),
    label: "locales in every test",
    href: "#locale-matrix",
  },
];
