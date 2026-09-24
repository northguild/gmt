/**
 * Published figures for `packages/gmt` — its own suite only, never apps/dox's or
 * gmt-oxlint's. `scripts/stats.mjs` derives them (vitest collection, CI's gmt-matrix,
 * the locale matrix, the reference corpus), `pnpm stats:sync` writes gmt-stats.json,
 * and `pnpm validate` fails when the file drifts. Dox copy imports every GMT number
 * from here rather than typing it.
 */
import data from "./gmt-stats.json";

export interface GmtStats {
  /** The suite every figure describes — always `packages/gmt`. */
  suite: string;
  tests: number;
  files: number;
  /** tests × Node versions × timezones. */
  executions: number;
  /** Node versions in CI's gmt-matrix. */
  nodes: readonly string[];
  timezones: number;
  /** IANA zone IDs in CI's gmt-matrix, in declaration order. */
  timezoneList: readonly string[];
  locales: number;
  /** BCP-47 locale tags in the mandatory locale matrix, in declaration order. */
  localeList: readonly string[];
  /** Public functions across every namespace except `regex`. */
  functions: number;
  /** Exported regex patterns. */
  patterns: number;
  /** Functions per namespace, largest first. */
  byNamespace: readonly NamespaceCount[];
  /** The namespaces that are industry layers built on the core, in `byNamespace` order. */
  industries: readonly string[];
}

export interface NamespaceCount {
  namespace: string;
  count: number;
}

export const gmtStats: GmtStats = data;

/** The core primitives: every namespace that is not an industry layer, largest first. */
export const coreNamespaces: readonly NamespaceCount[] =
  gmtStats.byNamespace.filter(
    (row) => !gmtStats.industries.includes(row.namespace),
  );

/** The industry layers, largest first. */
export const industryNamespaces: readonly NamespaceCount[] =
  gmtStats.byNamespace.filter((row) =>
    gmtStats.industries.includes(row.namespace),
  );

const sumCounts = (rows: readonly NamespaceCount[]): number =>
  rows.reduce((sum, row) => sum + row.count, 0);

export const coreFunctions = sumCounts(coreNamespaces);
export const industryFunctions = sumCounts(industryNamespaces);

const listFormat = new Intl.ListFormat("en-US", {
  style: "long",
  type: "conjunction",
});

/** Namespaces as prose: "`plain`, `zoned`, and `utc`". */
export function formatNamespaceList(rows: readonly NamespaceCount[]): string {
  return listFormat.format(rows.map((row) => `\`${row.namespace}\``));
}

const countFormat = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** How many times CI runs each test: once per Node version per timezone. */
export const runsPerTest = gmtStats.nodes.length * gmtStats.timezones;
