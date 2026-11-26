/**
 * The grid of a slide that runs one piece of code with several calls: one row per call, one column
 * per zone, each cell what the code returned there on one Node major, held to the value every call
 * should give. The calls and the code are a committed file (`date-kinds.json` for Deck 0's `kinds`
 * slide), the values a run record per call written by `scripts/zone-matrix/date-kinds.mjs`, the
 * same shape and hash as the agent's answer (`agent-quote.ts`). A grid is ready only while every
 * call's record is current and ran in every zone the slide shows; otherwise it says why, and the
 * slide marks it and `slides-check` fails.
 */
import { cityOf } from "~/lib/zone-map-labels";
import {
  runProblem,
  sameValue,
  type AgentRunRecord,
  type RunValue,
} from "./agent-quote";

/** The committed file: the code, the value every call should give, and the calls. */
export interface RunGridFile {
  code: string;
  want: string;
  kinds: readonly { id: string; kind: string; call: string }[];
}

/** Where the grid reads from and what it shows: the Node major, the zones, and the paths it names. */
export interface RunGridConfig {
  node: string;
  zones: readonly string[];
  path: string;
  command: string;
}

interface RunGridCell {
  value: RunValue;
  /** The cell's text: the value, or the name of the error it threw. */
  label: string;
  outcome: "right" | "wrong";
}

interface RunGridRow {
  id: string;
  kind: string;
  call: string;
  cells: RunGridCell[];
}

export type RunGrid =
  | {
      ready: true;
      /** The zones' place names, one per column. */
      places: string[];
      rows: RunGridRow[];
      /** Every Node major the calls ran on. */
      nodes: string[];
      /** How many zones each call ran in. */
      zones: number;
      /** How many different values every run of every call gave. */
      distinct: number;
    }
  | { ready: false; problem: string };

/** A cell's text: the value itself, or the name of the error, as `RangeError`. */
export const cellLabel = (value: RunValue): string =>
  typeof value === "string"
    ? value
    : (value.threw.split(":")[0] ?? value.threw);

/** The grid of `file`'s calls from their run records, or why it cannot be shown. */
export function runGrid(
  file: RunGridFile,
  runs: Partial<Record<string, AgentRunRecord>>,
  { node, zones, path, command }: RunGridConfig,
): RunGrid {
  const stale = (id: string, reason: string): RunGrid => ({
    ready: false,
    problem: `The run record of "${id}" in ${path} ${reason}. Run: ${command}`,
  });
  const rows: RunGridRow[] = [];
  const seen: RunValue[] = [];
  let nodes: string[] = [];
  let zoneCount = 0;
  for (const k of file.kinds) {
    const run = runs[k.id];
    const problem = runProblem(run, file.code, k.call);
    if (problem !== undefined || !run)
      return stale(k.id, problem ?? "is missing");
    const row = run.nodes.findIndex((n) => n.node === node);
    if (row < 0) return stale(k.id, `has no run on Node ${node}`);
    const missing = zones.find((z) => !run.zones.includes(z));
    if (missing !== undefined) return stale(k.id, `has no run in ${missing}`);
    for (const v of run.values.flat())
      if (!seen.some((s) => sameValue(s, v))) seen.push(v);
    nodes = run.nodes.map((n) => n.node);
    zoneCount = run.zones.length;
    rows.push({
      ...k,
      cells: zones.map((z) => {
        const value = run.values[row]![run.zones.indexOf(z)]!;
        return {
          value,
          label: cellLabel(value),
          outcome: sameValue(value, file.want) ? "right" : "wrong",
        };
      }),
    });
  }
  return {
    ready: true,
    places: zones.map(cityOf),
    rows,
    nodes,
    zones: zoneCount,
    distinct: seen.length,
  };
}
