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
  locales: number;
  /** Public functions across every namespace except `regex`. */
  functions: number;
  /** Exported regex patterns. */
  patterns: number;
  /** Functions per namespace, largest first. */
  byNamespace: readonly { namespace: string; count: number }[];
}

export const gmtStats: GmtStats = data;

const countFormat = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** How many times CI runs each test: once per Node version per timezone. */
export const runsPerTest = gmtStats.nodes.length * gmtStats.timezones;
