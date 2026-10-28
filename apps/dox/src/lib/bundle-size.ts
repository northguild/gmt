/**
 * The rows of the bundle-size table, from `src/generated/bundle-size.json` (written by
 * `scripts/bundle-size.mjs report` during `generate`) and the reference corpus. Shared by the page's
 * component and by its Markdown twin, so the two show the same figures. A size is in kB, 1 kB being
 * 1,000 bytes.
 */
import report from "../generated/bundle-size.json";
import corpus from "../generated/reference/gmt-corpus.json";

type Measured = { minified: number; gzipped: number; budget: number | null };

export type BundleRow = {
  name: string;
  importLine: string;
  minified: number;
  gzipped: number;
  budget: number | null;
  /** Bytes over the polyfill row; null on that row. */
  overMin: number | null;
  overGz: number | null;
};

/** Bytes as kB with one decimal. */
export const kb = (bytes: number): string => (bytes / 1000).toFixed(1);

/** The import that loads one entry: the package, the polyfill, or one function by its module. */
function importOf(name: string): string {
  if (name === "root") return 'import * as gmt from "@northguild/gmt"';
  if (name === report.floor) {
    return 'import { Temporal } from "@js-temporal/polyfill"';
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
    row.overMin === null ? "floor" : `${kb(row.overMin)} kB`,
    row.overGz === null ? "floor" : `${kb(row.overGz)} kB`,
    row.budget === null ? "none" : `${kb(row.budget)} kB`,
  ];
}
