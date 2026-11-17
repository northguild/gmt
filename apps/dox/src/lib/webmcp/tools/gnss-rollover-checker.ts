/**
 * WebMCP tool for `/tools/gnss-rollover-checker/`: what a receiver with a given week counter and
 * firmware era reports on a date, how far that is from the right date, and when each counter next
 * wraps, from the same `readRollover` the page's redraw calls. When the args leave the date out,
 * the tool reads the clock through the same `clockNow` helper the page's mount uses, and `input`
 * reports the date it used.
 */
import { showGnssRolloverCheckerInput } from "../../dox-tool-schemas";
import { loadGnssLib } from "../../gnss-lib";
import {
  clockNow,
  permalinkOf,
  readArgs,
  readRollover,
  ROLLOVER_PRESETS,
} from "../../gnss-rollover-checker";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = ROLLOVER_PRESETS[0];
if (!first) throw new Error("gnss-rollover-checker: no presets");

export const def = definePageTool({
  page: "gnss-rollover-checker",
  name: "check_gnss_week_rollover",
  title: "GNSS Rollover Checker",
  doxTool: "showGnssRolloverChecker",
  returns:
    "The date a receiver with the given counter and firmware reports on the check date, whether it is the right date, early or late and by how much, the time left before its next wrap, and for every counter its next wrap and the whole days left; the reported, broadcast, verdict and left fields are null when the library gives no answer, and with no date given the current time is used and input reports it",
  calls: [
    "utcToGnssWeek",
    "gnssWeekToUtc",
    "diffUtcAsDuration",
    "isValidInstant",
    "hasSecond60",
  ],
  rules: ["Give exactly one of firmwareNotBefore and firmwareEra."],
  input: showGnssRolloverCheckerInput,
  example: {
    counter: first.state.counter,
    firmwareNotBefore: first.state.pivot,
    date: first.state.date,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadGnssLib, signal);
    const now = clockNow();
    const state = readArgs(args);
    const read = readRollover(lib, state, now);
    const notes: string[] = [];
    if (read.failure !== null) notes.push(read.failure);
    if (read.emptyText !== null) notes.push(read.emptyText);
    return {
      input: { ...args, date: args.date ?? now },
      result: jsonSafe({
        status: read.status,
        at: read.at,
        rows: read.rows,
        reported: read.reported,
        broadcast: read.broadcast,
        verdict: read.verdict,
        verdictText: read.verdictText,
        wrongFrom: read.wrongFrom,
        left: read.left,
        rolling: read.rolling,
        eraZeroHint: read.eraZeroHint,
      }),
      notes,
      link: encodeWidgetPermalink("rollover", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
