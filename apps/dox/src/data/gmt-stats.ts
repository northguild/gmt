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
  /** Every industry's own namespace, in `byNamespace` order. */
  industryNamespaces: readonly string[];
  /** The "By industry" chart's data: every declared industry in declared order, with the
   *  functions of its own namespace and the count of each module it draws on. */
  industryLayers: readonly IndustryLayerCount[];
  /** Distinct functions in all own namespaces. `coreFunctions + industryFunctions` is
   *  `functions`: a function is counted once. */
  industryFunctions: number;
}

/** One module an industry draws on, with the functions in it. */
export interface DrawnOnCount {
  /** A whole namespace (`workforce`) or one sub-module (`timescale/convert`). */
  module: string;
  count: number;
  /** True when the module is another industry's own namespace (a shared industry layer), false
   *  when it is Core. */
  shared: boolean;
}

export interface IndustryLayerCount {
  id: string;
  label: string;
  /** Functions in the industry's own namespace; 0 for one that owns none. */
  own: number;
  drawsOn: readonly DrawnOnCount[];
}

export interface NamespaceCount {
  namespace: string;
  count: number;
}

export const gmtStats: GmtStats = data;

/** The core primitives: every namespace that is no industry's own, largest first. */
export const coreNamespaces: readonly NamespaceCount[] =
  gmtStats.byNamespace.filter(
    (row) => !gmtStats.industryNamespaces.includes(row.namespace),
  );

/** The namespaces industries own, largest first. */
export const industryNamespaces: readonly NamespaceCount[] =
  gmtStats.byNamespace.filter((row) =>
    gmtStats.industryNamespaces.includes(row.namespace),
  );

const sumCounts = (rows: readonly NamespaceCount[]): number =>
  rows.reduce((sum, row) => sum + row.count, 0);

export const coreFunctions = sumCounts(coreNamespaces);
export const industryFunctions = gmtStats.industryFunctions;

const listFormat = new Intl.ListFormat("en-US", {
  style: "long",
  type: "conjunction",
});

/** Namespaces as prose: "`plain`, `zoned`, and `utc`". */
export function formatNamespaceList(rows: readonly NamespaceCount[]): string {
  return listFormat.format(rows.map((row) => `\`${row.namespace}\``));
}

const countFormat = new Intl.NumberFormat(undefined);

export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** How many times CI runs each test: once per Node version per timezone. */
export const runsPerTest = gmtStats.nodes.length * gmtStats.timezones;
