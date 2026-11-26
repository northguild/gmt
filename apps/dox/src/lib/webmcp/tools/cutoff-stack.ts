/**
 * WebMCP tool for `/tools/cutoff-stack/`: a sailing's cut-offs counted back from one departure,
 * computed by the same `collectStackFacts` the page's redraw calls.
 */
import { loadCutoffLib } from "../../cutoff-lib";
import {
  collectStackFacts,
  entriesOf,
  permalinkOf,
  readArgs,
  stackNullReason,
  stackNullText,
  STACK_PRESETS,
} from "../../cutoff-stack";
import { showCutoffStackInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = STACK_PRESETS[0];
if (!first) throw new Error("cutoff-stack: no presets");

export const def = definePageTool({
  page: "cutoff-stack",
  name: "list_sailing_cutoffs",
  title: "Cut-off Stack",
  doxTool: "showCutoffStack",
  returns:
    "A sailing's cut-offs in time order, each with its instant, rule and distance before departure. Empty with a note when the library refuses it",
  calls: ["cutoffSchedule", "cutoffAt", "timeToCutoff", "isPastCutoff"],
  input: showCutoffStackInput,
  example: {
    anchor: first.anchor,
    timeZone: first.timeZone,
    cutoffs: first.cutoffs.map(({ name, offset, atLocalTime }) => ({
      name,
      offset,
      ...(atLocalTime === "" ? {} : { atLocalTime }),
    })),
    weekend: [...first.weekend],
    roll: first.roll as "preceding",
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadCutoffLib, signal);
    const state = readArgs(args);
    const facts = collectStackFacts(state, lib);
    const empty = entriesOf(state).length > 0 && facts.result.length === 0;
    const why = empty ? stackNullReason(state, facts, lib) : null;
    return {
      input: args,
      result: jsonSafe(facts),
      notes: empty
        ? [why ? stackNullText(why) : "The stack could not be computed."]
        : [],
      link: encodeWidgetPermalink("cutoffstack", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
