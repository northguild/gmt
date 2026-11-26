/**
 * WebMCP tool for `/tools/journey-split/`: a journey's moving time and waiting time, computed by
 * the same `readJourney` the page's redraw calls.
 */
import { showJourneySplitInput } from "../../dox-tool-schemas";
import {
  JOURNEY_PRESETS,
  permalinkOf,
  readArgs,
  readJourney,
} from "../../journey-split";
import { loadJourneyLib } from "../../transport-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = JOURNEY_PRESETS[0];
if (!first) throw new Error("journey-split: no presets");

/** A leg with only the fields it has: the schema takes no empty string. */
function legArgs(leg: (typeof first.legs)[number]) {
  return {
    ...(leg.departure === "" ? {} : { departure: leg.departure }),
    duration: leg.duration,
    timeZone: leg.timeZone,
    ...(leg.dwellAfter === "" ? {} : { dwellAfter: leg.dwellAfter }),
    ...(leg.mode === "" ? {} : { mode: leg.mode }),
  };
}

export const def = definePageTool({
  page: "journey-split",
  name: "compute_journey_split",
  title: "Journey Split",
  doxTool: "showJourneySplit",
  returns:
    "A journey's moving and waiting time, split at every handoff into handling time and time waiting for a scheduled departure, with the door-to-door total in hours. No result, with a note, when the library cannot schedule the legs",
  calls: ["multimodalETA", "scheduleDelivery", "diffUtcAsDuration"],
  input: showJourneySplitInput,
  example: {
    legs: first.legs.map(legArgs),
    ...(first.startTimeZone === ""
      ? {}
      : { startTimeZone: first.startTimeZone }),
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadJourneyLib, signal);
    const state = readArgs(args);
    const read = readJourney(state, lib);
    return {
      input: args,
      result: jsonSafe(read),
      notes: read.failure === null ? [] : [read.failure],
      link: encodeWidgetPermalink("journeysplit", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
