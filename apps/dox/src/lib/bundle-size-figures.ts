/**
 * Every figure the /bundle-size page states about the two polyfills, computed in one place from
 * `src/generated/bundle-size.json` (written by `scripts/bundle-size.mjs report`).
 *
 * This module imports the report and nothing else. The chart module is in the client graph, and the
 * reference corpus is not allowed there, so nothing here may reach `bundle-size.ts`, the corpus or
 * `gmt-stats`. No package name, version or entry name is typed in: they come from the report. The
 * only literals are the measure names, `"root"` and the report's `floor` field, which the JSON
 * defines. A size is in kB, 1 kB being 1,000 bytes.
 */
import data from "../generated/bundle-size.json";

export type Measure = "minified" | "gzipped";
export const MEASURES: readonly Measure[] = ["minified", "gzipped"];

export interface Sized {
  minified: number;
  gzipped: number;
}

export interface PolyfillSet {
  package: string;
  version: string;
  import: string;
  shipped: boolean;
  /** The GMT release this set was measured with. */
  gmt: string;
  /** Where that GMT came from: the repository's source, or the published package on npm. */
  from: "source" | "npm";
  /** `null` where the GMT of this set does not export the entry. */
  entries: Record<string, Sized | null>;
}

export interface BundleReport {
  floor: string;
  entries: Record<string, Sized & { budget: number | null }>;
  polyfills?: PolyfillSet[];
}

const report = data as unknown as BundleReport;

/** The entry that measures the whole package. */
const ROOT = "root";

/** One measure of one entry: its total, the floor of its set, and the code above that floor. */
export interface Part {
  total: number;
  floor: number;
  code: number;
}

export type Split = Record<Measure, Part>;

export interface ComparisonRow {
  name: string;
  shipped: Split;
  previous: Split | null;
}

/** Bytes as kB with one decimal. */
export const kb = (bytes: number): string => (bytes / 1000).toFixed(1);

/** Under 1,000 B in bytes, from 1,000 B in kB, with a no-break space before the unit. */
export function formatBytes(bytes: number): string {
  return bytes < 1000 ? `${bytes} B` : `${kb(bytes)} kB`;
}

/** The two polyfill sets, found by their flag. Throws unless there is exactly one of each. */
export function polyfillSets(source: BundleReport = report): {
  shipped: PolyfillSet;
  previous: PolyfillSet;
} {
  const sets = source.polyfills;
  if (!sets) {
    throw new Error(
      "[bundle-size] the generated report has no polyfills list; run generate",
    );
  }
  const shipped = sets.filter((set) => set.shipped);
  const previous = sets.filter((set) => !set.shipped);
  if (shipped.length !== 1 || previous.length !== 1) {
    throw new Error(
      `[bundle-size] expected one shipped and one previous polyfill set, found ${shipped.length} shipped and ${previous.length} previous`,
    );
  }
  return { shipped: shipped[0], previous: previous[0] };
}

/** One entry of one set split into the polyfill and GMT's code; `null` when the set lacks it. */
export function splitOf(
  set: PolyfillSet,
  name: string,
  floorName: string = report.floor,
): Split | null {
  const entry = set.entries[name];
  const floor = set.entries[floorName];
  if (!entry || !floor) return null;
  const part = (measure: Measure): Part => ({
    total: entry[measure],
    floor: floor[measure],
    code: entry[measure] - floor[measure],
  });
  return { minified: part("minified"), gzipped: part("gzipped") };
}

/** One row per entry in shipped-set order, the floor left out and `root` kept. */
export function comparisonRows(source: BundleReport = report): ComparisonRow[] {
  const { shipped, previous } = polyfillSets(source);
  return Object.keys(shipped.entries)
    .filter((name) => name !== source.floor)
    .flatMap((name) => {
      const split = splitOf(shipped, name, source.floor);
      if (!split) return [];
      return [
        {
          name,
          shipped: split,
          previous: splitOf(previous, name, source.floor),
        },
      ];
    });
}

/** The rows the charts draw: no `root`, and no row the previous set lacks. */
export function chartRows(
  source: BundleReport = report,
): (ComparisonRow & { previous: Split })[] {
  return comparisonRows(source).filter(
    (row): row is ComparisonRow & { previous: Split } =>
      row.name !== ROOT && row.previous !== null,
  );
}

/** The function entries (not `root`, not the floor) in shipped-set order. */
function functionRows(source: BundleReport): ComparisonRow[] {
  return comparisonRows(source).filter((row) => row.name !== ROOT);
}

/** The function entry with the smallest minified total on the shipped set. */
export function smallestFunction(source: BundleReport = report): string {
  const rows = functionRows(source);
  if (rows.length === 0) {
    throw new Error("[bundle-size] the report has no function entries");
  }
  return rows.reduce((least, row) =>
    row.shipped.minified.total < least.shipped.minified.total ? row : least,
  ).name;
}

/** The function entry with the most of GMT's code, gzipped, on the shipped set. */
function largestFunction(source: BundleReport): string {
  const rows = functionRows(source);
  if (rows.length === 0) {
    throw new Error("[bundle-size] the report has no function entries");
  }
  return rows.reduce((most, row) =>
    row.shipped.gzipped.code > most.shipped.gzipped.code ? row : most,
  ).name;
}

/** The text the lead and the section state, each a finished string. */
export interface LeadFigures {
  shippedVersion: string;
  previousVersion: string;
  previousGmt: string;
  /**
   * The first GMT release on the shipped polyfill: the minor release after `previousGmt`. The
   * pages name it before it is published; `bundle-size.test.ts` holds it to the pending
   * changesets, then to the changelog.
   */
  firstShippedGmt: string;
  /** "the published" or "the source of": how the previous set's GMT was measured. */
  previousMeasuredFrom: string;
  floorGzipped: string;
  floorMinified: string;
  previousFloorGzipped: string;
  previousFloorMinified: string;
  floorDifferenceGzipped: string;
  floorDifferenceMinified: string;
  smallestName: string;
  smallestCodeMinified: string;
  smallestCodeGzipped: string;
  smallestTotalGzipped: string;
  largestName: string;
  largestCodeGzipped: string;
  rootGzipped: string;
  previousRootGzipped: string;
}

/** `1.21.0` to `1.22.0`. */
function nextMinor(version: string): string {
  const [major, minor] = version.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

export function leadFigures(source: BundleReport = report): LeadFigures {
  const { shipped, previous } = polyfillSets(source);
  const need = (set: PolyfillSet, name: string): Split => {
    const split = splitOf(set, name, source.floor);
    if (!split) {
      throw new Error(`[bundle-size] ${set.package} has no entry ${name}`);
    }
    return split;
  };
  const floor = need(shipped, source.floor);
  const previousFloor = need(previous, source.floor);
  const smallestName = smallestFunction(source);
  const smallest = need(shipped, smallestName);
  const largestName = largestFunction(source);
  const largest = need(shipped, largestName);
  return {
    shippedVersion: shipped.version,
    previousVersion: previous.version,
    previousGmt: previous.gmt,
    firstShippedGmt: nextMinor(previous.gmt),
    previousMeasuredFrom:
      previous.from === "npm" ? "the published" : "the source of",
    floorGzipped: formatBytes(floor.gzipped.total),
    floorMinified: formatBytes(floor.minified.total),
    previousFloorGzipped: formatBytes(previousFloor.gzipped.total),
    previousFloorMinified: formatBytes(previousFloor.minified.total),
    floorDifferenceGzipped: formatBytes(
      previousFloor.gzipped.total - floor.gzipped.total,
    ),
    floorDifferenceMinified: formatBytes(
      previousFloor.minified.total - floor.minified.total,
    ),
    smallestName,
    smallestCodeMinified: formatBytes(smallest.minified.code),
    smallestCodeGzipped: formatBytes(smallest.gzipped.code),
    smallestTotalGzipped: formatBytes(smallest.gzipped.total),
    largestName,
    largestCodeGzipped: formatBytes(largest.gzipped.code),
    rootGzipped: formatBytes(need(shipped, ROOT).gzipped.total),
    previousRootGzipped: formatBytes(need(previous, ROOT).gzipped.total),
  };
}

/** `leadFigures()` on the live report, evaluated once for the MDX page. */
export const polyfillFigures: LeadFigures = leadFigures();
