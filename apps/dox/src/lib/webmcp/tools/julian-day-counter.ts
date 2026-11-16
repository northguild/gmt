/**
 * WebMCP tool for `/tools/julian-day-counter/`: one instant written as a two-part Julian Date, a
 * single Julian Date, a Modified Julian Date and seconds since J2000 on one scale, or one count
 * read back to UTC, from the same `readCounter` the page's redraw calls. The ruler is not part of it.
 */
import {
  COUNTER_PRESETS,
  DEFAULT_PRESET,
  LEAP_NOTE,
  permalinkOf,
  readArgs,
  readCounter,
} from "../../julian-day-counter";
import { showJulianDayCounterInput } from "../../dox-tool-schemas";
import { loadDayCountLib } from "../../timescale-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

if (COUNTER_PRESETS.length === 0) {
  throw new Error("julian-day-counter: no presets");
}

export const defaultValueNote = (value: string): string =>
  `No value was given, so the example instant ${value} was converted.`;

export const def = definePageTool({
  page: "julian-day-counter",
  name: "convert_instant_to_julian_date",
  title: "Julian Day Counter",
  doxTool: "showJulianDayCounter",
  returns:
    "status (ok, empty or sentinel), read (the way the value was read: instant, jd, mjd or j2000), scale (the scale counted on), utc (the instant every form is made from) and rows, one entry for each of parts, jd, mjd and j2000 with its name, value, back (the form read back to UTC) and shift (the gap from the instant); input shows the value, read and scale used, and with no value the first example is converted",
  calls: [
    "toJulianDateParts",
    "toJulianDate",
    "toModifiedJulianDate",
    "toJ2000Seconds",
    "fromJulianDateParts",
    "fromJulianDate",
    "fromModifiedJulianDate",
    "fromJ2000Seconds",
  ],
  input: showJulianDayCounterInput,
  example: {
    value: DEFAULT_PRESET.state.value,
    read: DEFAULT_PRESET.state.read,
    scale: DEFAULT_PRESET.state.scale,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadDayCountLib, signal);
    const state = readArgs(args);
    const seeded = args.value === undefined || args.value === "";
    const used = seeded
      ? { ...args, value: state.value, read: state.read, scale: state.scale }
      : args;
    const read = readCounter(lib, state);
    const notes: string[] = [];
    if (seeded) notes.push(defaultValueNote(state.value));
    if (read.failure !== null) notes.push(read.failure);
    if (read.emptyText !== null) notes.push(read.emptyText);
    if (read.footnote !== "") notes.push(read.footnote);
    if (read.ruler?.leap === true) notes.push(LEAP_NOTE);
    return {
      input: used,
      result: jsonSafe({
        status: read.status,
        read: state.read,
        scale: state.scale,
        utc: read.utc,
        rows: read.rows.map(({ form, name, value, back, shift }) => ({
          form,
          name,
          value,
          back,
          shift,
        })),
      }),
      notes,
      link: encodeWidgetPermalink("jdcount", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
