/**
 * WebMCP tool for `/tools/departure-board/`: the departure an arrival can make from a timetable,
 * beside the pick with no connection time, from the same `collectDepartureFacts` the page's redraw
 * calls. The arrival comes only from `after`.
 */
import {
  collectDepartureFacts,
  DEPARTURE_PRESETS,
  departureNullReason,
  departureReasonText,
  permalinkOf,
  readArgs,
} from "../../departure-board";
import { showDepartureBoardInput } from "../../dox-tool-schemas";
import { loadPunctualityLib } from "../../punctuality-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = DEPARTURE_PRESETS[0];
if (!first) throw new Error("departure-board: no presets");

export const def = definePageTool({
  page: "departure-board",
  name: "find_next_departure",
  title: "Departure Board",
  doxTool: "showDepartureBoard",
  returns:
    "The first departure the arrival can make once the connection time has passed, and the first departure the same arrival would make with no connection time, each as an instant or an empty string when none is left",
  calls: ["nextDeparture"],
  input: showDepartureBoardInput,
  example: {
    after: first.after,
    headway: first.headway.headway,
    from: first.headway.from,
    to: first.headway.to,
    minimumConnection: first.minimumConnection,
    onwardDuration: first.onwardDuration,
    onwardZone: first.onwardZone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadPunctualityLib, signal);
    const state = readArgs(args);
    const facts = collectDepartureFacts(state, lib);
    const reason = departureNullReason(state, facts, lib);
    return {
      input: args,
      result: jsonSafe(facts),
      notes: reason === null ? [] : [departureReasonText(reason)],
      link: encodeWidgetPermalink("departure", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
