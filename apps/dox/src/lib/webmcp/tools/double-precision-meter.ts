/**
 * WebMCP tool for `/tools/double-precision-meter/`: how far a Julian Date, a Modified Julian Date,
 * seconds since J2000 and a two-part Julian Date drift from the instant they encode, from the same
 * `readMeter` the page's redraw calls. The chart's samples are not part of it.
 */
import {
  DEFAULT_PRESET,
  METER_FORMS,
  permalinkOf,
  readArgs,
  readMeter,
} from "../../double-precision-meter";
import { showDoublePrecisionMeterInput } from "../../dox-tool-schemas";
import { loadDayCountLib } from "../../timescale-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

export const defaultValueNote = (value: string): string =>
  `No value was given, so the example instant ${value} was measured.`;

export const def = definePageTool({
  page: "double-precision-meter",
  name: "measure_julian_date_precision",
  title: "Double Precision Meter",
  doxTool: "showDoublePrecisionMeter",
  returns:
    "status (ok, empty or sentinel), utc (the instant measured), year, and forms, one entry each for jd, mjd, j2000 and parts, in that order, with its form, name, drift (the gap between the instant and the instant read back, in microseconds) and value (the number stored), null where the library gives none; input shows the value and scale used, and with no value the first example instant is measured",
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
  input: showDoublePrecisionMeterInput,
  example: {
    value: DEFAULT_PRESET.state.value,
    scale: DEFAULT_PRESET.state.scale,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadDayCountLib, signal);
    const state = readArgs(args);
    const seeded = args.value === undefined || args.value === "";
    const used = seeded
      ? { ...args, value: state.value, scale: state.scale }
      : args;
    const read = readMeter(lib, state);
    const forms = METER_FORMS.map((form, i) => {
      const plate = read.plates[i];
      return {
        form,
        name: plate?.caption ?? null,
        drift: plate?.value ?? null,
        value: plate?.lines[0]?.replace(/^value /, "") ?? null,
      };
    });
    const notes: string[] = [];
    if (seeded) notes.push(defaultValueNote(state.value));
    if (read.failure !== null) notes.push(read.failure);
    if (read.emptyText !== null) notes.push(read.emptyText);
    if (read.footnote !== "") notes.push(read.footnote);
    return {
      input: used,
      result: jsonSafe({
        status: read.status,
        utc: read.utc,
        year: read.year,
        forms,
      }),
      notes,
      link: encodeWidgetPermalink("dpmeter", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
