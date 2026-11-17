/**
 * WebMCP tool for `/tools/code-b-day-ruler/`: one day of the year read as a date in two years,
 * from the same `createRuler(lib).read` the page's redraw calls. A field left out takes the
 * page's first preset.
 */
import { loadCcsdsLib } from "../../ccsds-lib";
import {
  createRuler,
  DEFAULT_PRESET,
  permalinkOf,
  readArgs,
} from "../../code-b-day-ruler";
import { showCodeBDayRulerInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

export const def = definePageTool({
  page: "code-b-day-ruler",
  name: "convert_day_of_year_to_date",
  title: "Code B Day Ruler",
  doxTool: "showCodeBDayRuler",
  returns:
    "The day of the year read in two years, each with its length in days, the Code B text sent, the Code A the library writes back, the date in words and the month and day, plus one sentence comparing the two; a lane has its missing field true when the library reads the year but has no such day in it, and a lane the library reads no Code B in has a null length and no date",
  calls: ["parseCcsdsAsciiB", "formatCcsdsAsciiA", "getLocaleMonthNames"],
  input: showCodeBDayRulerInput,
  example: {
    year: Number(DEFAULT_PRESET.state.year),
    compareYear: Number(DEFAULT_PRESET.state.compare),
    day: DEFAULT_PRESET.state.day,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadCcsdsLib, signal);
    const state = readArgs({
      ...(args.year === undefined ? {} : { year: args.year }),
      ...(args.compareYear === undefined ? {} : { compare: args.compareYear }),
      ...(args.day === undefined ? {} : { day: args.day }),
    });
    const read = createRuler(lib).read(state);
    const notes: string[] = [];
    if (read.lanes.some((lane) => lane.status !== "ok" || lane.missing)) {
      notes.push(read.sentence);
    }
    return {
      input: args,
      result: jsonSafe({
        day: read.day,
        dayText: read.dayText,
        sentence: read.sentence,
        lanes: read.lanes.map((lane) => ({
          status: lane.status,
          year: lane.year,
          length: lane.length,
          header: lane.header,
          codeB: lane.codeB,
          codeA: lane.codeA,
          date: lane.date,
          monthDay: lane.monthDay,
          missing: lane.missing,
        })),
      }),
      notes,
      link: encodeWidgetPermalink("dayruler", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
