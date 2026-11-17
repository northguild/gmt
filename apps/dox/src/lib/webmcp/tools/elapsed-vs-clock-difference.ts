/**
 * WebMCP tool for `/tools/elapsed-vs-clock-difference/`: two UTC instants read as a clock
 * difference, as the seconds that passed through TAI, and as the leap seconds between them, from
 * the same `readElapsed` the page's redraw calls. The library's nanosecond counts are bigints, so
 * the result holds them as decimal strings.
 */
import { showElapsedVsClockInput } from "../../dox-tool-schemas";
import {
  ELAPSED_PRESETS,
  permalinkOf,
  readArgs,
  readElapsed,
} from "../../elapsed-vs-clock";
import { loadTimescaleLib } from "../../timescale-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = ELAPSED_PRESETS[0];
if (!first) throw new Error("elapsed-vs-clock-difference: no presets");

export const def = definePageTool({
  page: "elapsed-vs-clock-difference",
  name: "compare_elapsed_and_clock_seconds",
  title: "Elapsed vs Clock Difference",
  doxTool: "showElapsedVsClock",
  returns:
    "The clock difference, the seconds that passed through TAI and the number of leap seconds between the two instants, with the clock difference and the seconds that passed as decimal nanosecond strings and the inserted seconds listed in counted; each of the three is null when the library gives no answer for it",
  calls: ["spanNs", "toTAI", "leapSecondsBetween", "nextLeapSecond"],
  input: showElapsedVsClockInput,
  example: { start: first.start, end: first.end },
  async run(args, signal) {
    const lib = await loadLibFor(loadTimescaleLib, signal);
    const state = readArgs(args);
    const read = readElapsed(lib, state);
    const notes = [
      read.clockReason,
      read.elapsedReason,
      read.countReason,
    ].filter((reason) => reason !== "");
    return {
      input: args,
      result: jsonSafe({
        clockNanoseconds: read.clock === null ? null : String(read.clock),
        elapsedNanoseconds: read.elapsed === null ? null : String(read.elapsed),
        count: read.count,
        counted: read.counted,
      }),
      notes,
      link: encodeWidgetPermalink("elapsed", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
