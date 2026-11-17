/**
 * WebMCP tool for `/tools/satellite-clock-converter/`: one instant, as UTC or as a string on a
 * satellite clock or TAI, read on every clock with each clock's lead over UTC, from the same
 * `readClocks` the page's redraw calls. It needs no clock of its own: the value is the instant.
 */
import { showSatelliteClockConverterInput } from "../../dox-tool-schemas";
import { loadGnssLib } from "../../gnss-lib";
import {
  CLOCK_PRESETS,
  permalinkOf,
  readArgs,
  readClocks,
} from "../../satellite-clock-converter";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = CLOCK_PRESETS[0];
if (!first) throw new Error("satellite-clock-converter: no presets");

export const def = definePageTool({
  page: "satellite-clock-converter",
  name: "convert_instant_to_satellite_clocks",
  title: "Satellite Clock Converter",
  doxTool: "showSatelliteClockConverter",
  returns:
    "The UTC instant the value names and eight rows, UTC, TAI and the six satellite systems, each with the instant on that clock and its lead over UTC; clock is the one the value was written on, next is the next inserted leap second after the instant or empty when none follows, and taiMinusUtc is null when the library gives no answer",
  calls: [
    "utcToGnss",
    "gnssToUtc",
    "toTAI",
    "fromTAI",
    "taiMinusUtc",
    "nextLeapSecond",
    "isValidInstant",
    "isLeapSecond",
  ],
  input: showSatelliteClockConverterInput,
  example: { value: first.state.value },
  async run(args, signal) {
    const lib = await loadLibFor(loadGnssLib, signal);
    const state = readArgs(args);
    const read = readClocks(lib, state);
    const notes: string[] = [];
    if (read.failure !== null) notes.push(read.failure);
    if (read.emptyText !== null) notes.push(read.emptyText);
    if (read.footnote !== "") notes.push(read.footnote);
    return {
      input: args,
      result: jsonSafe({
        status: read.status,
        clock: read.clock,
        utc: read.utc,
        rows: read.rows,
        next: read.next,
        taiMinusUtc: read.taiMinusUtc,
      }),
      notes,
      link: encodeWidgetPermalink("satclock", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
