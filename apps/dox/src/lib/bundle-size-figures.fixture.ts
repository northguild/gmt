/**
 * A small bundle report for the tests of the bundle-size figures and charts: two polyfill sets, a
 * floor, a `root`, three function entries and one `null` entry in the previous set. No test reads
 * the live JSON's numbers through it, so none breaks when the sizes are measured again.
 */
import type { BundleReport } from "./bundle-size-figures";

export const FIXTURE_FLOOR = "base";

export function fixtureReport(): BundleReport {
  return {
    floor: FIXTURE_FLOOR,
    entries: {
      root: { minified: 50000, gzipped: 15000, budget: 51000 },
      base: { minified: 5000, gzipped: 2000, budget: null },
      fnSmall: { minified: 5800, gzipped: 2300, budget: 6000 },
      fnMid: { minified: 7000, gzipped: 2600, budget: 7200 },
      fnBig: { minified: 9000, gzipped: 3400, budget: 9500 },
    },
    // The previous set comes first on purpose: sets are found by the flag, never by index.
    polyfills: [
      {
        package: "beta-poly",
        version: "0.5.1",
        import: "beta-poly",
        shipped: false,
        gmt: "9.9.9",
        from: "npm",
        entries: {
          root: { minified: 57000, gzipped: 17800 },
          base: { minified: 12000, gzipped: 4800 },
          fnSmall: { minified: 12800, gzipped: 5100 },
          fnMid: null,
          fnBig: { minified: 16000, gzipped: 6200 },
        },
      },
      {
        package: "alpha-poly",
        version: "2.0.0",
        import: "alpha-poly/full",
        shipped: true,
        gmt: "9.9.9",
        from: "source",
        entries: {
          root: { minified: 50000, gzipped: 15000 },
          base: { minified: 5000, gzipped: 2000 },
          fnSmall: { minified: 5800, gzipped: 2300 },
          fnMid: { minified: 7000, gzipped: 2600 },
          fnBig: { minified: 9000, gzipped: 3400 },
        },
      },
    ],
  };
}
