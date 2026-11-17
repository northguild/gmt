/**
 * WebMCP tool for `/tools/cutoff-ruler/`: the page's three readings of one cut-off, computed by
 * the same `collectRulerFacts` the page's redraw calls.
 */
import { loadCutoffLib } from "../../cutoff-lib";
import {
  collectRulerFacts,
  permalinkOf,
  readArgs,
  RULER_PRESETS,
  rulerNullReason,
  rulerNullText,
  type RulerFacts,
} from "../../cutoff-ruler";
import { showCutoffRulerInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { WidgetLoadError } from "../../widget-mount";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = RULER_PRESETS[0];
if (!first) throw new Error("cutoff-ruler: no presets");

/** A reading with no `atLocalTime` key when it has none, as JSON carries it. */
function jsonFacts(facts: RulerFacts): RulerFacts {
  return {
    ...facts,
    readings: facts.readings.map(({ atLocalTime, ...rest }) =>
      atLocalTime === undefined ? rest : { ...rest, atLocalTime },
    ) as RulerFacts["readings"],
  };
}

export const def = definePageTool({
  page: "cutoff-ruler",
  name: "check_eta_against_cutoff",
  title: "Cut-off Ruler",
  doxTool: "showCutoffRuler",
  returns:
    "Three readings of one departure's cut-off counted back N days, as calendar days, as exact hours and at a pinned local time. Each reading is an instant, or an empty string when the library refuses it, with its length in hours before the departure; a note explains each empty reading",
  calls: ["etaAtZone", "cutoffAt", "timeToCutoff"],
  input: showCutoffRulerInput,
  example: {
    anchor: first.anchor,
    timeZone: first.timeZone,
    days: Number(first.days),
    atLocalTime: first.atLocalTime,
  },
  async run(args, signal) {
    let lib;
    try {
      lib = await loadCutoffLib();
    } catch (cause) {
      throw cause instanceof WidgetLoadError
        ? cause
        : new WidgetLoadError(cause);
    }
    if (signal.aborted) throw signal.reason;
    const state = readArgs(args);
    const facts = collectRulerFacts(state, lib);
    const notes = facts.readings
      .filter((reading) => reading.at === "")
      .map((reading) => {
        const reason = rulerNullReason(reading, state, lib);
        return reason
          ? rulerNullText(reason)
          : "This reading could not be computed.";
      });
    return {
      input: args,
      result: jsonFacts(facts),
      notes,
      link: encodeWidgetPermalink("cutoffruler", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
