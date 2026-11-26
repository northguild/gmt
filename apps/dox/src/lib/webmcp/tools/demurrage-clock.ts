/**
 * WebMCP tool for `/tools/demurrage-clock/`: the four clocks that run between a container's
 * events, computed by the same `readClocks` the page's redraw calls.
 */
import {
  DEMURRAGE_PRESETS,
  NO_INTERVAL_TEXT,
  permalinkOf,
  readArgs,
  readClocks,
} from "../../demurrage-clock";
import { showDemurrageClockInput } from "../../dox-tool-schemas";
import { loadDemurrageLib } from "../../ledger-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = DEMURRAGE_PRESETS[0];
if (!first) throw new Error("demurrage-clock: no presets");

export const def = definePageTool({
  page: "demurrage-clock",
  name: "compute_demurrage_clocks",
  title: "Demurrage Clock",
  doxTool: "showDemurrageClock",
  returns:
    "The demurrage, detention, storage and combined clocks, each with the two events it runs between, or the reason a clock does not run",
  calls: ["demurrageClock", "toOffsetInstant", "diffUtcAsDuration"],
  input: showDemurrageClockInput,
  example: {
    events: first.events.map((e) => ({ ...e })),
    scope: first.scope as "demurrage",
    direction: first.direction as "import",
    zone: first.zone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadDemurrageLib, signal);
    const state = readArgs(args);
    const read = readClocks(state, lib);
    return {
      input: args,
      result: jsonSafe(read),
      notes:
        read.chosen.interval === null
          ? [read.chosen.reason?.sentence ?? NO_INTERVAL_TEXT]
          : [],
      link: encodeWidgetPermalink("demclock", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
