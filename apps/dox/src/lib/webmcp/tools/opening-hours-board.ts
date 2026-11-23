/**
 * WebMCP tool for `/tools/opening-hours-board/`: what the six operating functions say about a
 * schedule and two instants, from the same `boardFacts` the page's redraw calls. Nothing is
 * defaulted: an instant, week, duration or horizon left out is not asked of the library.
 */
import { showOpeningHoursBoardInput } from "../../dox-tool-schemas";
import { loadHoursLib } from "../../hours-lib";
import { boardFacts } from "../../opening-hours-board";
import { permalinkOf, readBoardArgs } from "../../opening-hours-board-seed";
import { verdictOf } from "../../opening-hours-board-verdict";
import { scheduleFromEditor } from "../../opening-hours-editor";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

export const def = definePageTool({
  page: "opening-hours-board",
  name: "read_opening_hours",
  title: "Opening Hours Board",
  doxTool: "showOpeningHoursBoard",
  returns:
    "kind is refused or accepted; intervals is the week's open intervals; reading holds the five answers for the instants; probe names refused parts",
  calls: [
    "isValidOperatingSchedule",
    "operatingIntervals",
    "isOpenAt",
    "nextOpenAt",
    "nextCloseAt",
    "operatingTimeBetween",
    "addOperatingTime",
  ],
  rules: [
    "Send the schedule as JSON text, exactly as written.",
    "A refused schedule gives [] like a closed one: read kind.",
  ],
  input: showOpeningHoursBoardInput,
  example: { preset: "tokyo-desk" },
  async run(args, signal) {
    const lib = await loadLibFor(loadHoursLib, signal);
    const { state } = readBoardArgs(args);
    const facts = boardFacts(lib, state);
    const verdict = verdictOf(facts);
    return {
      input: args,
      result: jsonSafe({
        kind: facts.kind,
        intervals: facts.kind === "accepted" ? facts.intervals : [],
        reading: facts.kind === "accepted" ? facts.reading : null,
        probe: facts.kind === "refused" ? facts.probe : null,
      }),
      notes: [`${verdict.title}. ${verdict.detail}`],
      link: encodeWidgetPermalink(
        "hours",
        permalinkOf(
          state,
          JSON.stringify(scheduleFromEditor(state.editor), null, 2),
        ),
      ),
    };
  },
});

export default toModelContextTool(def);
