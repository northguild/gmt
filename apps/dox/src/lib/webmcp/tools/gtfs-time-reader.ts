/**
 * WebMCP tool for `/tools/gtfs-time-reader/`: a GTFS stop time read into its seconds and whole
 * days past the service day, folded into one day, and written back from seconds and days, from the
 * same `collectGtfsFacts` the page's redraw calls. It never takes a zone or a date.
 */
import { showGtfsTimeReaderInput } from "../../dox-tool-schemas";
import {
  collectGtfsFacts,
  permalinkOf,
  READ_PRESETS,
  READ_REASONS,
  readArgs,
  WRITE_PRESETS,
  WRITE_REASONS,
} from "../../gtfs-time-reader";
import { loadRailLib } from "../../rail-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const read = READ_PRESETS[0];
const write = WRITE_PRESETS[0];
if (!read || !write) throw new Error("gtfs-time-reader: no presets");

export const def = definePageTool({
  page: "gtfs-time-reader",
  name: "read_gtfs_stop_time",
  title: "GTFS Time Reader",
  doxTool: "showGtfsTimeReader",
  returns:
    "The record a GTFS stop time reads as, with its seconds, the days past the service day and whether it is valid, what a clock-time check and a fold into one day do with it, and the stop time that the given seconds and days write back",
  calls: ["parseGtfsTime", "isValidGtfsTime", "formatGtfsTime", "isValidTime"],
  rules: [
    "Give a GTFS time to read, or the seconds and the days past the service day to write.",
  ],
  input: showGtfsTimeReaderInput,
  example: {
    value: read.value,
    seconds: write.seconds,
    dayOverflow: write.dayOverflow,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadRailLib, signal);
    const state = readArgs(args);
    const facts = collectGtfsFacts(lib, state);
    const notes: string[] = [];
    if (facts.read.kind === "refused") {
      notes.push(READ_REASONS[facts.read.reason]);
    }
    if (facts.write.kind === "notNumber" || facts.write.kind === "refused") {
      notes.push(WRITE_REASONS[facts.write.reason]);
    }
    return {
      input: args,
      result: jsonSafe(facts),
      notes,
      link: encodeWidgetPermalink("gtfstime", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
