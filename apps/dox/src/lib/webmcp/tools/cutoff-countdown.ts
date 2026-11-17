/**
 * WebMCP tool for `/tools/cutoff-countdown/`: whether a moment is past a cut-off and how long is
 * left, computed by the same `collectCountdownFacts` the page's redraw calls. Without `now` it
 * reads the clock the way the page's "Use my clock" does, and `input` reports the moment it used.
 */
import {
  collectCountdownFacts,
  COUNTDOWN_PRESETS,
  countdownNullReason,
  countdownNullText,
  floorToSecond,
  permalinkOf,
  readArgs,
} from "../../cutoff-countdown";
import { loadCutoffLib } from "../../cutoff-lib";
import { showCutoffCountdownInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = COUNTDOWN_PRESETS[0];
if (!first) throw new Error("cutoff-countdown: no presets");

export const def = definePageTool({
  page: "cutoff-countdown",
  name: "compute_time_to_cutoff",
  title: "Cut-off Countdown",
  doxTool: "showCutoffCountdown",
  returns:
    "Whether a moment is past a cut-off, and the time left as an ISO 8601 duration (negative once it has closed; PT0S exactly at the cut-off, which counts as closed). Both are empty or false with a note when the library refuses an input. With no moment given, the current time is used and input reports it",
  argsSwaps: [
    ["use the reader's own clock", "use the current time"],
    ["both are shown on", "both are read on"],
  ],
  calls: ["isPastCutoff", "timeToCutoff", "etaAtZone"],
  input: showCutoffCountdownInput,
  example: {
    cutoff: first.cutoff,
    now: first.now,
    timeZone: first.timeZone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadCutoffLib, signal);
    const used = {
      ...args,
      now: args.now ?? floorToSecond(lib.getUtcNow()),
    };
    const state = readArgs(used);
    const facts = collectCountdownFacts(state, lib);
    return {
      input: used,
      result: facts,
      notes:
        facts.left === ""
          ? [countdownNullText(countdownNullReason(state, lib))]
          : [],
      link: encodeWidgetPermalink("cutoffcountdown", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
