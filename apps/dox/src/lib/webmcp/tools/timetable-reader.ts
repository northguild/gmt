/**
 * WebMCP tool for `/tools/timetable-reader/`: each printed departure time read as an exact
 * instant, from the same `rowFacts` the page's redraw calls for each row.
 */
import { showTimetableReaderInput } from "../../dox-tool-schemas";
import {
  permalinkOf,
  readArgs,
  rowFacts,
  rowResult,
  TIMETABLE_PRESETS,
  type RowFacts,
} from "../../timetable-reader";
import { loadTimetableLib } from "../../transport-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = TIMETABLE_PRESETS[0];
if (!first) throw new Error("timetable-reader: no presets");

const offsets = first.rows.map((r) => r.offset);

export const def = definePageTool({
  page: "timetable-reader",
  name: "read_timetable_times",
  title: "Timetable Reader",
  doxTool: "showTimetableReader",
  returns:
    "One entry per printed departure, in the order given: the exact instant it leaves, as the library resolves it in the timetable's zone (null when it does not resolve), and the full schedule of that single leg (null when the library refuses it)",
  calls: ["scheduleDelivery", "classifyLocal"],
  input: showTimetableReaderInput,
  example: {
    startTimeZone: first.startTimeZone,
    departures: first.rows.map((r) => r.departure),
    ...(offsets.every((o) => o === "") ? {} : { offsets }),
    duration: first.duration,
    timeZone: first.timeZone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadTimetableLib, signal);
    const state = readArgs(args);
    const result: RowFacts[] = [];
    const notes: string[] = [];
    args.departures.forEach((_, i) => {
      // The page skips a row with nothing in it; the schema keeps at least four characters.
      result.push(
        state.rows[i]!.departure === ""
          ? { leaves: null, result: null }
          : rowFacts(state, i, lib),
      );
      const { reason } = rowResult(state, i, lib);
      if (reason !== null) notes.push(`Row ${i + 1}: ${reason}`);
    });
    return {
      input: args,
      result: jsonSafe(result),
      notes,
      link: encodeWidgetPermalink("timetable", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
