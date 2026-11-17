/**
 * WebMCP tool for `/tools/eta-drift/`: the best available timestamp of one event, how far its
 * estimate moved and the naive latest-recorded pick, from the same `collectDriftFacts` the page's
 * redraw calls.
 */
import { showEtaDriftInput } from "../../dox-tool-schemas";
import {
  collectDriftFacts,
  driftNullReason,
  driftReasonText,
  ETA_PRESETS,
  permalinkOf,
  readArgs,
} from "../../eta-drift";
import { loadPunctualityLib } from "../../punctuality-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = ETA_PRESETS[0];
if (!first) throw new Error("eta-drift: no presets");

export const def = definePageTool({
  page: "eta-drift",
  name: "compute_eta_drift",
  title: "ETA Drift",
  doxTool: "showEtaDrift",
  returns:
    "The events as read, the best available timestamp with its class, the drift report of the estimates (or null), the naive latest-recorded pick and the count of estimates. The best pick and the drift are null when the library cannot read the events, and the drift is also null for fewer than two estimates",
  calls: ["bestAvailable", "estimateDrift"],
  input: showEtaDriftInput,
  example: {
    events: first.events.map((e) => ({ ...e })),
    ...(first.tolerance === "" ? {} : { tolerance: first.tolerance }),
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadPunctualityLib, signal);
    const state = readArgs(args);
    const facts = collectDriftFacts(state, lib);
    const reason = driftNullReason(state, facts, lib);
    return {
      input: args,
      result: jsonSafe(facts),
      notes: reason === null ? [] : [driftReasonText(reason)],
      link: encodeWidgetPermalink("etadrift", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
