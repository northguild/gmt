/**
 * WebMCP tool for `/tools/punctuality-board/`: each arrival's deviation and class and the on-time
 * rate under one or two tolerances, from the same `collectBoardFacts` the page's redraw calls.
 */
import { showPunctualityBoardInput } from "../../dox-tool-schemas";
import {
  boardNullReason,
  boardReasonText,
  collectBoardFacts,
  permalinkOf,
  PUNCTUALITY_PRESETS,
  readArgs,
} from "../../punctuality-board";
import { loadPunctualityLib } from "../../punctuality-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = PUNCTUALITY_PRESETS[0];
if (!first) throw new Error("punctuality-board: no presets");

export const def = definePageTool({
  page: "punctuality-board",
  name: "check_punctuality",
  title: "Punctuality Board",
  doxTool: "showPunctualityBoard",
  returns:
    "For each pair, its deviation, its class under the tolerance (and under the second late tolerance when one is given) and the same two figures read off the wall clocks, then the on-time rate under each tolerance. A class or a rate is null when the library cannot read a tolerance or a time",
  calls: ["scheduleDeviation", "classifyPunctuality", "punctualityRate"],
  input: showPunctualityBoardInput,
  example: {
    pairs: first.rows.map((r) => ({ ...r })),
    late: first.late,
    ...(first.early === undefined ? {} : { early: first.early }),
    ...(first.compareLate === undefined
      ? {}
      : { compareLate: first.compareLate }),
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadPunctualityLib, signal);
    const state = readArgs(args);
    const facts = collectBoardFacts(state, lib);
    const reason = boardNullReason(state, facts, lib);
    return {
      input: args,
      result: jsonSafe(facts),
      notes: reason === null ? [] : [boardReasonText(reason)],
      link: encodeWidgetPermalink("punctuality", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
