/**
 * WebMCP tool for `/tools/crossing-clock/`: a crossing logged as two instants, read on the clock
 * of the zone that administers it, computed by the same `crossingFacts` the page's redraw calls.
 */
import {
  CROSSING_PRESETS,
  crossingFacts,
  NULL_REASON_TEXT,
  permalinkOf,
  readArgs,
} from "../../crossing-clock";
import { showCrossingClockInput } from "../../dox-tool-schemas";
import { loadTransportLib } from "../../transport-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = CROSSING_PRESETS[0];
if (!first) throw new Error("crossing-clock: no presets");

export const def = definePageTool({
  page: "crossing-clock",
  name: "compute_crossing_time",
  title: "Crossing Clock",
  doxTool: "showCrossingClock",
  returns:
    "How long a crossing took in elapsed time, and its entry and exit written on the target zone's clock. The crossing is empty with the reason when the library refuses it, such as an exit before its entry",
  calls: ["crossingTime"],
  input: showCrossingClockInput,
  example: { ...first.state },
  async run(args, signal) {
    const lib = await loadLibFor(loadTransportLib, signal);
    const state = readArgs(args);
    const facts = crossingFacts(state, lib);
    return {
      input: args,
      result: jsonSafe(facts),
      notes:
        facts.result === null
          ? [
              facts.reason
                ? NULL_REASON_TEXT[facts.reason]
                : "The crossing could not be read.",
            ]
          : [],
      link: encodeWidgetPermalink("crossing", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
