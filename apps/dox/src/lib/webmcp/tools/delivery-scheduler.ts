/**
 * WebMCP tool for `/tools/delivery-scheduler/`: a multi-leg journey laid out as an itinerary,
 * computed by the same `buildItinerary` the page's redraw calls. The leg times it holds come
 * from `scheduleDelivery`.
 */
import {
  buildItinerary,
  DELIVERY_PRESETS,
  legsOf,
  optionsOf,
  originZoneOf,
  permalinkOf,
  readArgs,
} from "../../delivery-scheduler";
import { showDeliverySchedulerInput } from "../../dox-tool-schemas";
import { loadTransportLib } from "../../transport-lib";
import { collectJourneyFacts, failureText } from "../../transport-widgets";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = DELIVERY_PRESETS[0];
if (!first) throw new Error("delivery-scheduler: no presets");

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
  page: "delivery-scheduler",
  name: "schedule_delivery",
  title: "Delivery Scheduler",
  doxTool: "showDeliveryScheduler",
  returns:
    "The journey as an itinerary grouped by local date: each leg's departure and arrival with zone and offset, the handling at each handoff, any clock change and the ETA on the final arrival. Empty with a note when a leg cannot be scheduled, e.g. a missed connection",
  calls: ["scheduleDelivery", "transitTime", "etaAtZone"],
  input: showDeliverySchedulerInput,
  example: {
    legs: first.legs.map(legArgs),
    ...(first.startTimeZone === ""
      ? {}
      : { startTimeZone: first.startTimeZone }),
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadTransportLib, signal);
    const state = readArgs(args);
    const legs = legsOf(state);
    const facts = collectJourneyFacts(legs, optionsOf(state), lib);
    const itinerary = buildItinerary(facts, legs, originZoneOf(state), lib);
    return {
      input: args,
      result: jsonSafe(itinerary),
      notes: facts.failure
        ? [failureText(facts.failure, facts, legs, lib)]
        : [],
      link: encodeWidgetPermalink("delivery", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
