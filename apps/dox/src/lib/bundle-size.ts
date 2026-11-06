/**
 * The rows of the bundle-size table, from `src/generated/bundle-size.json` (written by
 * `scripts/bundle-size.mjs report` during `generate`) and the reference corpus. Shared by the page's
 * component and by its Markdown twin, so the two show the same figures. A size is in kB, 1 kB being
 * 1,000 bytes; the two "over the polyfill" columns drop to bytes under 1,000 B.
 */
import report from "../generated/bundle-size.json";
import corpus from "../generated/reference/gmt-corpus.json";
import {
  comparisonRows,
  formatBytes,
  kb,
  polyfillSets,
  splitOf,
} from "./bundle-size-figures";

type Measured = { minified: number; gzipped: number; budget: number | null };

type BundleRow = {
  name: string;
  importLine: string;
  minified: number;
  gzipped: number;
  budget: number | null;
  /** Bytes over the polyfill row; null on that row. */
  overMin: number | null;
  overGz: number | null;
};

/** The import that loads one entry: the package, the polyfill, or one function by its module. */
function importOf(name: string): string {
  if (name === "root") return 'import * as gmt from "@northguild/gmt"';
  if (name === report.floor) {
    return `import { Temporal } from "${polyfillSets().shipped.import}"`;
  }
  const found = corpus.find((e) => e.kind === "function" && e.name === name);
  if (!found) {
    throw new Error(`[bundle-size] no function named ${name} in the reference`);
  }
  return `import { ${name} } from "@northguild/gmt/${found.namespace}/${found.module}"`;
}

export function bundleRows(): BundleRow[] {
  const entries = report.entries as Record<string, Measured>;
  const floor = entries[report.floor];
  return Object.entries(entries).map(([name, row]) => ({
    name,
    importLine: importOf(name),
    ...row,
    overMin: name === report.floor ? null : row.minified - floor.minified,
    overGz: name === report.floor ? null : row.gzipped - floor.gzipped,
  }));
}

export const BUNDLE_COLUMNS = [
  "Import",
  "Minified",
  "Gzipped",
  "Minified over the polyfill",
  "Gzipped over the polyfill",
  "Budget (minified)",
] as const;

/** One row's cells as text, in the order of `BUNDLE_COLUMNS`. */
export function bundleCells(row: BundleRow): string[] {
  return [
    row.importLine,
    `${kb(row.minified)} kB`,
    `${kb(row.gzipped)} kB`,
    row.overMin === null ? "floor" : formatBytes(row.overMin),
    row.overGz === null ? "floor" : formatBytes(row.overGz),
    row.budget === null ? "none" : `${kb(row.budget)} kB`,
  ];
}

/** The columns of the polyfill comparison. A package name sits in backticks, for `<code>`. */
export function compareColumns(): string[] {
  const { shipped, previous } = polyfillSets();
  return [
    "Import",
    `\`${shipped.package}\` gzipped`,
    `\`${previous.package}\` gzipped`,
    `GMT code over \`${shipped.package}\``,
    `GMT code over \`${previous.package}\``,
  ];
}

/**
 * The comparison's rows as text, floor first, then every entry of `comparisonRows()`. The
 * previous set's cells read "not in GMT {version}" where its GMT does not export the entry.
 */
export function compareCells(): { importLine: string; cells: string[] }[] {
  const { shipped, previous } = polyfillSets();
  const absent = `not in GMT ${previous.gmt}`;
  const floorShipped = splitOf(shipped, report.floor);
  const floorPrevious = splitOf(previous, report.floor);
  if (!floorShipped || !floorPrevious) {
    throw new Error("[bundle-size] a polyfill set lacks the floor entry");
  }
  return [
    {
      importLine: importOf(report.floor),
      cells: [
        formatBytes(floorShipped.gzipped.total),
        formatBytes(floorPrevious.gzipped.total),
        "floor",
        "floor",
      ],
    },
    ...comparisonRows().map((row) => ({
      importLine: importOf(row.name),
      cells: [
        formatBytes(row.shipped.gzipped.total),
        row.previous ? formatBytes(row.previous.gzipped.total) : absent,
        formatBytes(row.shipped.gzipped.code),
        row.previous ? formatBytes(row.previous.gzipped.code) : absent,
      ],
    })),
  ];
}
