/**
 * WebMCP tool for `/tools/gnss-week-decoder/`: a broadcast week and time of week read as UTC in
 * the eras the counter allows, a RINEX navigation-file week read as UTC, or a UTC instant turned
 * into each counter's week, time of week and era, from the same `readGnss` the page's redraw
 * calls. The `mode` field picks which of the three the other fields belong to.
 */
import { showGnssWeekDecoderInput } from "../../dox-tool-schemas";
import { loadGnssLib } from "../../gnss-lib";
import {
  clockNow,
  GNSS_PRESETS,
  permalinkOf,
  readArgs,
  readGnss,
} from "../../gnss-week-decoder";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = GNSS_PRESETS[0];
if (!first) throw new Error("gnss-week-decoder: no presets");
const { counter, era } = first.state;
if (counter === "")
  throw new Error("gnss-week-decoder: first preset has no counter");

export const def = definePageTool({
  page: "gnss-week-decoder",
  name: "decode_gnss_week",
  title: "GNSS Week Decoder",
  doxTool: "showGnssWeekDecoder",
  returns:
    "Fills counters and rinexRows (week and time of week per counter and RINEX system); lanes, UTC by era with chosen marking the one used, come in broadcast, rinex, or utc with a counter; a row with none true or an empty lane means no answer",
  calls: [
    "gnssWeekToUtc",
    "utcToGnssWeek",
    "rinexWeekToUtc",
    "utcToRinexWeek",
    "isValidInstant",
  ],
  argsSwaps: [
    [" (for example GPS-LNAV)", ""],
    ["mode is broadcast, rinex or utc. ", ""],
  ],
  rules: [
    "broadcast needs counter, week, timeOfWeekSeconds and exactly one era field; rinex needs system, week and timeOfWeekSeconds; utc needs utc.",
  ],
  input: showGnssWeekDecoderInput,
  example: {
    mode: "broadcast",
    counter,
    week: Number(first.state.week),
    timeOfWeekSeconds: Number(first.state.timeOfWeekSeconds),
    rolloverEra: era,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadGnssLib, signal);
    const now = clockNow();
    const state = readArgs(args);
    const read = readGnss(lib, state, now);
    const notes: string[] = [];
    if (read.failure !== null) notes.push(read.failure);
    if (read.emptyText !== null) notes.push(read.emptyText);
    if (read.lanesEmpty !== null) notes.push(read.lanesEmpty);
    if (read.footnote !== "") notes.push(read.footnote);
    // The era window is placed from the clock whenever era lanes are drawn.
    const usedClock =
      args.mode === "broadcast" ||
      (args.mode === "utc" && args.counter !== undefined);
    if (usedClock) {
      notes.push(`The current time, ${now}, was used to place the eras.`);
    }
    return {
      input: usedClock ? { ...args, now } : args,
      result: jsonSafe({
        status: read.status,
        utc: read.utc,
        // The page keeps the counter in its state but does not use it in rinex mode.
        counter: args.mode === "rinex" ? null : read.counter,
        system: read.system,
        modulus: read.modulus,
        week: read.week,
        lanes: read.lanes.map((lane) => ({
          key: lane.key,
          label: lane.label,
          result: lane.result,
          chosen: lane.chosen,
          nearest: lane.nearest,
          differs: lane.differs,
          sentence: lane.sentence,
        })),
        counters: read.counters,
        rinexRows: read.rinexRows,
      }),
      notes,
      link: encodeWidgetPermalink("gnssweek", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
