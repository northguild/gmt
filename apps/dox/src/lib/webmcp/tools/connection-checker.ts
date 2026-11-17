/**
 * WebMCP tool for `/tools/connection-checker/`: whether a cargo, once handled, is ready before
 * the onward departure, computed by the same `connectionFacts` the page's redraw calls.
 */
import {
  CONNECTION_PRESETS,
  connectionFacts,
  permalinkOf,
  readArgs,
} from "../../connection-checker";
import { showConnectionCheckerInput } from "../../dox-tool-schemas";
import { loadTransportLib } from "../../transport-lib";
import { scheduleNullText } from "../../transport-widgets";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = CONNECTION_PRESETS[0];
if (!first) throw new Error("connection-checker: no presets");

export const def = definePageTool({
  page: "connection-checker",
  name: "check_connection",
  title: "Connection Checker",
  doxTool: "showConnectionChecker",
  returns:
    "Whether one handoff is made or missed, with the instant the cargo is ready and the instant the onward leg departs, each on the port's clock. Equal times pass. The schedule is empty with a note when the library cannot give a verdict. A check of the times as printed on the clock is included, to show where it disagrees",
  calls: ["scheduleDelivery", "etaAtZone"],
  input: showConnectionCheckerInput,
  example: {
    inboundDeparture: first.state.inboundDeparture,
    inboundDuration: first.state.inboundDuration,
    portZone: first.state.portZone,
    handlingMinutes: Number(first.state.handlingMinutes),
    onwardDeparture: first.state.onwardDeparture,
    onwardDuration: first.state.onwardDuration,
    onwardZone: first.state.onwardZone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadTransportLib, signal);
    const state = readArgs(args);
    const facts = connectionFacts(state, lib);
    const notes = [
      ...(facts.arrivalOutOfRange
        ? [
            "The inbound arrival is too near the limit of the supported time range to place.",
          ]
        : []),
      ...(facts.verdict.kind === "no-verdict"
        ? [
            facts.diagnosis
              ? scheduleNullText(
                  facts.diagnosis.reason,
                  facts.diagnosis.leg + 1,
                )
              : "The connection could not be checked.",
          ]
        : []),
    ];
    return {
      input: args,
      result: jsonSafe(facts),
      notes,
      link: encodeWidgetPermalink("connection", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
