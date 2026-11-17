/**
 * WebMCP tool for `/tools/gtfs-trip-board/`: one trip's stop rows read as instants on a service
 * date in the agency's zone, beside the wrong reading a stop's own zone gives and each leg's
 * length, from the same `computeTrip` the page's redraw calls.
 */
import { showGtfsTripBoardInput } from "../../dox-tool-schemas";
import {
  computeTrip,
  MAX_STOPS,
  PRESETS,
  permalinkOf,
  readArgs,
} from "../../gtfs-trip-board";
import { loadTripBoardLib } from "../../rail-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = PRESETS[0];
if (!first) throw new Error("gtfs-trip-board: no presets");

export const def = definePageTool({
  page: "gtfs-trip-board",
  name: "convert_gtfs_trip_times",
  title: "GTFS Trip Board",
  doxTool: "showGtfsTripBoard",
  returns:
    "For each stop row read, the UTC instants of its arrival and departure on the service date in the agency zone, the wrong reading the stop's own zone gives, and the length of the leg to the next stop; the notes name any skipped row",
  calls: ["gtfsToInstant", "diffUtc", "classifyLocal"],
  rules: [
    "Give at least one of the rows, the date, the zone or a preset.",
    `Only the first ${MAX_STOPS} rows are read, within 2,000 characters.`,
  ],
  input: showGtfsTripBoardInput,
  example: {
    stopTimes: first.rows,
    date: first.date,
    zone: first.zone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadTripBoardLib, signal);
    const state = readArgs(args);
    const result = computeTrip(lib, state);
    return {
      input: args,
      result: jsonSafe(result),
      notes: result.notes,
      link: encodeWidgetPermalink("gtfstrip", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
