/**
 * WebMCP tool for `/tools/leap-day-birthday/`: a yearly date read the way the page reads it, from
 * the same `buildModel` the page's redraw calls. The printed calls are not part of it.
 */
import {
  buildModel,
  LEAP_PRESETS,
  permalinkOf,
  readArgs,
  readersYear,
  REASONS,
  ROW_COUNT,
} from "../../leap-day-birthday";
import { loadMonthDayLib } from "../../month-day-lib";
import { showLeapDayBirthdayInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = LEAP_PRESETS[0];
if (first === undefined) throw new Error("leap-day-birthday: no presets");

export const defaultYearNote = (year: string): string =>
  `No year was given, so the current year ${year} was used as the first of the ${ROW_COUNT} years.`;

export const noLocaleNote = (locale: string): string =>
  `formatMonthDay returned no text for the locale "${locale}", which this runtime does not read.`;

export const def = definePageTool({
  page: "leap-day-birthday",
  name: "resolve_yearly_date",
  title: "Leap-Day Birthday",
  doxTool: "showLeapDayBirthday",
  returns:
    "stored (the month-day as stored, null when no reader accepts it), reads (written in the locale, null when not placed), rows (eight years, each with year, gmt, verdict, pasted, policy and policyVerdict); the sentence that explains the outcome is the first note",
  calls: [
    "isValidMonthDay",
    "parseMonthDay",
    "parseMonthDayFromDate",
    "parseMonthDayFromDateTime",
    "formatMonthDay",
    "monthDayToDate",
    "compareMonthDays",
    "areMonthDaysEqual",
    "isValidDate",
    "addDate",
  ],
  input: showLeapDayBirthdayInput,
  example: { value: first.value },
  async run(args, signal) {
    const lib = await loadLibFor(loadMonthDayLib, signal);
    const thisYear = readersYear();
    const state = readArgs(args, thisYear);
    const model = buildModel(lib, state);
    const notes: string[] = [REASONS[model.reason]];
    if (args.year === undefined) notes.push(defaultYearNote(state.year));
    if (model.stored !== null && model.reads === null) {
      notes.push(noLocaleNote(state.locale));
    }
    return {
      input: {
        ...args,
        value: state.value,
        year: Number(state.year),
        locale: state.locale,
      },
      result: jsonSafe({
        stored: model.stored,
        reads: model.reads,
        rows: model.rows.map(
          ({ year, gmt, verdict, pasted, policy, policyVerdict }) => ({
            year,
            gmt,
            verdict,
            pasted,
            policy,
            policyVerdict,
          }),
        ),
      }),
      notes,
      link: encodeWidgetPermalink("leapday", permalinkOf(state, thisYear)),
    };
  },
});

export default toModelContextTool(def);
