/**
 * WebMCP tool for `/tools/gtfs-service-day-clock/`: the instant a GTFS service date and stop time
 * mean, beside the midnight anchor, from the same `computeClock` the page's redraw calls.
 */
import { showGtfsServiceDayClockInput } from "../../dox-tool-schemas";
import {
  computeClock,
  PRESETS,
  permalinkOf,
  readArgs,
  REASONS,
} from "../../gtfs-service-day-clock";
import { loadServiceDayLib } from "../../rail-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = PRESETS[0];
if (!first) throw new Error("gtfs-service-day-clock: no presets");

export const def = definePageTool({
  page: "gtfs-service-day-clock",
  name: "convert_gtfs_service_time",
  title: "GTFS Service Day Clock",
  doxTool: "showGtfsServiceDayClock",
  returns:
    "The UTC instant and the agency-zone time that a GTFS service time on a service date means, anchored at noon minus twelve hours, beside the instant that adding the same service time to local midnight gives, with the gap between them in minutes. Both are empty, with a reason, when GTFS defines no anchor",
  calls: ["gtfsToInstant", "classifyLocal", "diffUtc"],
  rules: [
    "Give at least one of a service date, a stop time, an agency zone or a preset.",
  ],
  input: showGtfsServiceDayClockInput,
  example: {
    serviceDate: first.date,
    time: first.time,
    timeZone: first.zone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadServiceDayLib, signal);
    const state = readArgs(args);
    const result = computeClock(lib, state);
    const reason = REASONS[result.reason];
    return {
      input: args,
      result: jsonSafe(result),
      notes: result.reason === "ok" || reason === "" ? [] : [reason],
      link: encodeWidgetPermalink("gtfsday", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
