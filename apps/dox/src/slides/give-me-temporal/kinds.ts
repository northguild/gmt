/**
 * The `kinds` slide's grid: one five-line `nextDay` over `Date`, called with each kind of time a
 * caller might pass (`date-kinds.json`), run by `scripts/zone-matrix/date-kinds.mjs` on Node 22, 24
 * and 26 in every zone it lists (`date-kinds-run.json`). The slide shows Node 26 in three of them,
 * UTC and two east of it: east of UTC, a local time comes out a day early. Three columns and the
 * calls, which break between their name and arguments, fit beside the clock, and the grid comes in
 * under the code in a `Stack`.
 */
import type { AgentRunRecord } from "~/lib/slides/agent-quote";
import {
  runGrid,
  type RunGridConfig,
  type RunGridFile,
} from "~/lib/slides/run-grid";
import file from "./date-kinds.json";
import runs from "./date-kinds-run.json";

const CONFIG: RunGridConfig = {
  node: "26",
  zones: ["UTC", "Asia/Kolkata", "Europe/Helsinki"],
  path: "apps/dox/src/slides/give-me-temporal/date-kinds-run.json",
  command:
    "cd scripts/zone-matrix && fnm exec --using=26 -- node date-kinds.mjs",
};

export const KINDS = {
  file: file as RunGridFile,
  node: CONFIG.node,
  grid: runGrid(
    file as RunGridFile,
    runs as Partial<Record<string, AgentRunRecord>>,
    CONFIG,
  ),
};
